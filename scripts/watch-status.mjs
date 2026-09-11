// Local live monitoring. Production collection remains the independent CI workflow.
import { spawn } from "node:child_process";
import { copyFile, access, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const configuredInterval = Number.parseInt(
  process.env.STATUS_MONITOR_INTERVAL_SECONDS ?? "600",
  10,
);
const intervalSeconds = Number.isFinite(configuredInterval)
  ? Math.min(3600, Math.max(300, configuredInterval))
  : 600;
let stopped = false,
  child;
for (const name of ["SIGINT", "SIGTERM"])
  process.on(name, () => {
    stopped = true;
    child?.kill();
  });
while (!stopped) {
  const exit = await new Promise((resolve) => {
    child = spawn(
      process.execPath,
      [
        "--env-file-if-exists=.env.monitor.local",
        "--env-file-if-exists=.env.cloudflare.local",
        "scripts/collect-status.mjs",
      ],
      { cwd: root, stdio: "inherit", windowsHide: true },
    );
    child.once("error", () => resolve(1));
    child.once("exit", resolve);
  });
  if (exit === 0) {
    try {
      await access(new URL("../build/client/index.html", import.meta.url));
      for (const name of ["status.json", "feed.xml"]) {
        const target = new URL(`../build/client/${name}`, import.meta.url);
        await copyFile(
          new URL(`../public/${name}`, import.meta.url),
          new URL(`${target.href}.tmp`),
        );
        await rename(new URL(`${target.href}.tmp`), target);
      }
    } catch {
      /* Development reads public directly; a preview build is optional. */
    }
  } else
    console.error(
      "Collection failed; last observation retained and freshness will expire.",
    );
  for (let seconds = 0; seconds < intervalSeconds && !stopped; seconds++)
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
