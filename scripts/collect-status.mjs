import { readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  validateServices,
  validateIncidents,
  validateSnapshot,
  reconcilePrevious,
  collect,
  retainHistory,
  renderFeed,
} from "./status-core.mjs";
import { loadIncidentMarkdown } from "./incident-markdown.mjs";
import { reconcileProviderIncidents } from "./probes/provider.mjs";
const root = new URL("../", import.meta.url);
const read = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const services = validateServices(await read("config/services.json"));
const operatorIncidents = await loadIncidentMarkdown(
  new URL("content/incidents/", root),
);
const previous = await read("public/status.json");
const previousHistory = reconcilePrevious(previous, services);
let signals = [];
if (process.env.STATUS_HEALTH_SIGNALS_FILE) {
  try {
    const content = await readFile(
      process.env.STATUS_HEALTH_SIGNALS_FILE,
      "utf8",
    );
    if (content.length > 1_000_000) throw new Error("Oversized signals");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("Invalid signals");
    signals = parsed;
  } catch {
    console.warn(
      "Service health signals could not be loaded; affected monitoring will be degraded.",
    );
  }
}
let collectorEnv = process.env;
if (process.env.LOCAL_CLOUDFLARE_AUTH === "wrangler") {
  try {
    const { resolveCloudflareLocalAuth } = await import(
      "./cloudflare-local-auth.mjs"
    );
    collectorEnv = await resolveCloudflareLocalAuth();
  } catch {
    collectorEnv = { ...process.env, CLOUDFLARE_API_TOKEN: "" };
    console.warn(
      "Local Cloudflare authentication unavailable; other checks continue.",
    );
  }
}
const now = new Date();
const providerIncidentSyncs = [];
const observations = await collect(services, {
  signals,
  env: collectorEnv,
  now: () => now,
  onProviderIncidents: (sync) => providerIncidentSyncs.push(sync),
});
const manualIds = new Set(operatorIncidents.map((incident) => incident.id));
const providerIncidents = reconcileProviderIncidents(
  previous.incidents ?? [],
  providerIncidentSyncs,
  now.toISOString(),
);
const incidents = validateIncidents(
  [
    ...operatorIncidents,
    ...providerIncidents.filter((incident) => !manualIds.has(incident.id)),
  ],
  services,
  now.valueOf(),
);
const snapshot = validateSnapshot(
  {
    schemaVersion: 2,
    generatedAt: now.toISOString(),
    observations,
    history: retainHistory(
      previousHistory,
      observations,
      now.valueOf(),
      previous.observations,
    ),
    incidents,
  },
  services,
);
// Serialize publication across an interactive collector and the local watcher.
// The lock prevents two processes from reusing the same atomic replacement path.
const lockPath = fileURLToPath(new URL("output/collector.publish.lock", root));
let lock;
try {
  lock = await open(lockPath, "wx");
} catch (error) {
  if (error?.code === "EEXIST") {
    console.log("Another collector is publishing; this collection was skipped.");
    process.exit(0);
  }
  throw error;
}
try {
  // Atomic replacement avoids publishing partially written JSON.
  for (const [path, content] of [
    ["public/status.json", JSON.stringify(snapshot, null, 2) + "\n"],
    ["public/feed.xml", renderFeed(incidents)],
  ]) {
    const destination = fileURLToPath(new URL(path, root));
    await writeFile(`${destination}.tmp`, content);
    await rename(`${destination}.tmp`, destination);
  }
} finally {
  await lock.close();
  await unlink(lockPath).catch(() => {});
}
console.log(
  `Collected ${observations.length} observations at ${snapshot.generatedAt}.`,
);
