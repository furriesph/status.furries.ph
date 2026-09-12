import { PLATFORM_TARGETS } from "./probes/platform.mjs";
const STATES = [
  "operational",
  "degraded",
  "outage",
  "maintenance",
  "not_launched",
  "unknown",
];
const PROVIDER_HOSTS = ["status.supabase.com", "www.cloudflarestatus.com"];
const fail = (message) => {
  throw new Error(message);
};
const string = (value) => typeof value === "string" && value.trim().length > 0;
const date = (value) =>
  string(value) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value.replace(/(?<=:\d{2})Z$/, ".000Z");
const keys = (value, allowed) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    fail("Unexpected schema field");
};
const safe = (value) => {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      (u.hostname === "furries.ph" ||
        u.hostname.endsWith(".furries.ph") ||
        PROVIDER_HOSTS.includes(u.hostname)) &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
};
export function validateServices(services) {
  if (!Array.isArray(services) || !services.length)
    fail("Services must be a non-empty array");
  const ids = new Set();
  for (const s of services) {
    keys(s, [
      "id",
      "name",
      "group",
      "description",
      "url",
      "check",
      "dependencies",
    ]);
    if (!s || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id) || ids.has(s.id))
      fail("Invalid or duplicate service id");
    ids.add(s.id);
    for (const field of ["name", "group", "description"])
      if (!string(s[field])) fail(`Missing ${field}: ${s.id}`);
    if (s.url !== undefined && !safe(s.url))
      fail(`Unsafe service URL: ${s.id}`);
    if (s.check?.kind === "http") {
      keys(s.check, ["kind", "url", "expectedStatus", "contains"]);
      if (!safe(s.check.url) || !string(s.check.contains))
        fail(`HTTP check requires safe URL and content assertion: ${s.id}`);
      if (
        s.check.expectedStatus !== undefined &&
        (!Number.isInteger(s.check.expectedStatus) ||
          s.check.expectedStatus < 200 ||
          s.check.expectedStatus > 299)
      )
        fail("Expected HTTP status must be successful");
    } else if (s.check?.kind === "cms") {
      keys(s.check, ["kind"]);
    } else if (s.check?.kind === "platform" || s.check?.kind === "operations") {
      keys(s.check, ["kind", "target"]);
      const targets =
        s.check.kind === "platform"
          ? Object.keys(PLATFORM_TARGETS)
          : [
              "email",
              "linked-messaging",
              "discord",
              "telegram",
              "sms",
              "jobs",
              "payments",
              "federation",
              "lan",
            ];
      if (!targets.includes(s.check.target))
        fail(`Invalid operational target: ${s.id}`);
    } else if (s.check?.kind === "media") {
      keys(s.check, ["kind", "url"]);
      if (!safe(s.check.url)) fail(`Invalid media URL: ${s.id}`);
    } else if (s.check?.kind === "supabase" || s.check?.kind === "cloudflare" || s.check?.kind === "sanity") {
      keys(s.check, ["kind", "target"]);
      const targets =
        s.check.kind === "supabase"
          ? ["database", "auth", "capacity", "limits"]
          : s.check.kind === "cloudflare"
            ? ["workers", "requests"]
            : ["media-pools"];
      if (!targets.includes(s.check.target))
        fail(`Invalid provider target: ${s.id}`);
    } else if (s.check?.kind === "provider") {
      keys(s.check, ["kind", "provider", "components"]);
      if (
        !["supabase", "cloudflare"].includes(s.check.provider) ||
        !Array.isArray(s.check.components) ||
        !s.check.components.length ||
        s.check.components.some((c) => !string(c))
      )
        fail(`Invalid provider components: ${s.id}`);
    } else if (s.check?.kind === "heartbeat") {
      keys(s.check, ["kind", "signal"]);
      if (s.check.signal !== s.id)
        fail(`Heartbeat must match service: ${s.id}`);
    } else if (s.check?.kind === "lifecycle") {
      keys(s.check, ["kind", "reason"]);
      if (!string(s.check.reason)) fail(`Lifecycle requires reason: ${s.id}`);
    } else fail(`Invalid check: ${s.id}`);
  }
  for (const s of services)
    if (
      s.dependencies !== undefined &&
      (!Array.isArray(s.dependencies) ||
        new Set(s.dependencies).size !== s.dependencies.length ||
        s.dependencies.some((id) => !ids.has(id) || id === s.id))
    )
      fail("Invalid dependencies");
  const visiting = new Set(),
    visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) fail("Cyclic dependencies");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of services.find((s) => s.id === id).dependencies ??
      [])
      visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const s of services) visit(s.id);
  return services;
}
export function validateIncidents(incidents, services, now = Date.now()) {
  if (!Array.isArray(incidents)) fail("Incidents must be an array");
  const ids = new Set(),
    serviceIds = new Set(services.map((s) => s.id));
  for (const i of incidents) {
    keys(i, [
      "id",
      "title",
      "status",
      "impact",
      "serviceIds",
      "startedAt",
      "resolvedAt",
      "endsAt",
      "updates",
    ]);
    if (!i || !string(i.id) || ids.has(i.id) || !string(i.title))
      fail("Invalid or duplicate incident");
    ids.add(i.id);
    if (
      ![
        "investigating",
        "identified",
        "monitoring",
        "resolved",
        "scheduled",
      ].includes(i.status) ||
       !["operational", "degraded", "outage", "maintenance"].includes(i.impact)
    )
      fail(`Invalid incident state: ${i.id}`);
    if (
      !Array.isArray(i.serviceIds) ||
      !i.serviceIds.length ||
      new Set(i.serviceIds).size !== i.serviceIds.length ||
      i.serviceIds.some((id) => !serviceIds.has(id))
    )
      fail("Incident references invalid services");
    if (
      !date(i.startedAt) ||
      (i.status !== "scheduled" && Date.parse(i.startedAt) > now)
    )
      fail("Invalid incident start");
    if (i.status === "resolved" && !date(i.resolvedAt))
      fail("Resolved incident requires resolvedAt");
    if (
      i.resolvedAt !== undefined &&
      (i.status !== "resolved" ||
        !date(i.resolvedAt) ||
        Date.parse(i.resolvedAt) < Date.parse(i.startedAt) ||
        Date.parse(i.resolvedAt) > now)
    )
      fail("Invalid resolution timestamp");
    if (
      i.endsAt !== undefined &&
      (!date(i.endsAt) || Date.parse(i.endsAt) <= Date.parse(i.startedAt))
    )
      fail("Invalid maintenance end");
    if (
      i.status === "scheduled" &&
      (i.impact !== "maintenance" || !date(i.endsAt))
    )
      fail("Scheduled maintenance requires end");
    if (!Array.isArray(i.updates) || !i.updates.length)
      fail("Incident requires updates");
    let previous = 0;
    for (const u of i.updates) {
      keys(u, ["at", "message"]);
      const stamp = Date.parse(u.at);
      if (
        !date(u.at) ||
        !string(u.message) ||
        stamp <= previous ||
        stamp > now ||
        (i.status !== "scheduled" && stamp < Date.parse(i.startedAt)) ||
        (i.resolvedAt && stamp > Date.parse(i.resolvedAt))
      )
        fail("Invalid incident update");
      previous = stamp;
    }
  }
  return incidents;
}
export function validateSnapshot(snapshot, services) {
  keys(snapshot, [
    "schemaVersion",
    "generatedAt",
    "observations",
    "history",
    "incidents",
  ]);
  if (
    !snapshot ||
    snapshot.schemaVersion !== 2 ||
    (snapshot.generatedAt !== null && !date(snapshot.generatedAt)) ||
    !Array.isArray(snapshot.observations) ||
    !Array.isArray(snapshot.history)
  )
    fail("Invalid snapshot");
  if (
    snapshot.generatedAt !== null &&
    Date.parse(snapshot.generatedAt) > Date.now()
  )
    fail("Snapshot generation cannot be in the future");
  const ids = new Set(services.map((s) => s.id));
  if (
    snapshot.observations.length !== ids.size ||
    new Set(snapshot.observations.map((o) => o.serviceId)).size !== ids.size
  )
    fail("Snapshot must cover every service exactly once");
  for (const o of snapshot.observations) {
    keys(o, [
      "serviceId",
      "status",
      "checkedAt",
      "latencyMs",
      "message",
      "evidence",
    ]);
    if (
      !ids.has(o.serviceId) ||
      !STATES.includes(o.status) ||
      !date(o.checkedAt) ||
      !string(o.message) ||
      (o.evidence !== undefined &&
        !["direct", "dependency", "monitoring-gap"].includes(o.evidence)) ||
      !(
        o.latencyMs === null ||
        (Number.isFinite(o.latencyMs) && o.latencyMs >= 0)
      )
    )
      fail("Invalid observation");
    if (
      snapshot.generatedAt !== null &&
      Date.parse(o.checkedAt) > Date.parse(snapshot.generatedAt)
    )
      fail("Observation cannot postdate snapshot");
    if (
      snapshot.generatedAt === null &&
      !["unknown", "degraded", "not_launched"].includes(o.status)
    )
      fail("Uninitialized snapshot cannot claim known health");
  }
  const historyKeys = new Set();
  for (const day of snapshot.history) {
    keys(day, ["serviceId", "date", "status", "checks", "operationalChecks"]);
    const key = `${day.serviceId}:${day.date}`;
    if (
      !ids.has(day.serviceId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
      !date(`${day.date}T00:00:00Z`) ||
      !STATES.includes(day.status) ||
      !Number.isSafeInteger(day.checks) ||
      day.checks < 1 ||
      !Number.isSafeInteger(day.operationalChecks) ||
      day.operationalChecks < 0 ||
      day.operationalChecks > day.checks ||
      historyKeys.has(key)
    )
      fail("Invalid daily history");
    if (
      (day.status === "operational") !==
      (day.checks === day.operationalChecks)
    )
      fail("Daily status contradicts counts");
    if (
      snapshot.generatedAt === null ||
      day.date > snapshot.generatedAt.slice(0, 10)
    )
      fail("Daily history cannot postdate snapshot");
    historyKeys.add(key);
  }
  validateIncidents(snapshot.incidents, services);
  return snapshot;
}
export function reconcilePrevious(snapshot, services) {
  snapshot = migrateLegacySnapshot(snapshot);
  // Validate the old snapshot against its own registry before filtering retired IDs.
  // A changed registry is expected; malformed history or incomplete old coverage is not.
  if (!Array.isArray(snapshot?.observations) || !snapshot.observations.length)
    fail("Previous snapshot requires observations");
  const previousServices = snapshot.observations.map((o) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o?.serviceId))
      fail("Invalid previous service id");
    return { id: o.serviceId };
  });
  validateSnapshot(snapshot, previousServices);
  const currentIds = new Set(services.map((s) => s.id));
  return snapshot.history.filter((o) => currentIds.has(o.serviceId));
}
export function migrateLegacySnapshot(snapshot) {
  if (snapshot?.schemaVersion !== 1) return snapshot;
  if (!Array.isArray(snapshot.observations) || !Array.isArray(snapshot.history))
    fail("Invalid legacy snapshot");
  // Preserve measured counts. Legacy unknown was unavailable monitoring, never successful uptime.
  return {
    ...snapshot,
    schemaVersion: 2,
    observations: snapshot.observations.map((o) =>
      o.status === "unknown"
        ? {
            ...o,
            status: "unknown",
            evidence: "monitoring-gap",
            message:
              "Monitoring coverage was unavailable in this legacy observation.",
          }
        : o,
    ),
    history: snapshot.history,
  };
}
export async function probe(
  service,
  {
    fetchImpl = fetch,
    now = () => new Date(),
    timeoutMs = 10000,
    env = process.env,
    signals = [],
  } = {},
) {
  const options = { fetchImpl, now, timeoutMs, env, signals };
  if (service.check.kind === "cms")
    return (await import("./probes/cms.mjs")).probeCms(service, options);
  if (service.check.kind === "platform")
    return (await import("./probes/platform.mjs")).probePlatform(
      service,
      options,
    );
  if (service.check.kind === "operations")
    return (await import("./probes/operations.mjs")).probeOperations(
      service,
      options,
    );
  if (service.check.kind === "media")
    return (await import("./probes/media.mjs")).probeMedia(service, options);
  if (service.check.kind === "supabase")
    return (await import("./probes/supabase.mjs")).probeSupabase(
      service,
      options,
    );
  if (service.check.kind === "cloudflare")
    return (await import("./probes/cloudflare.mjs")).probeCloudflare(
      service,
      options,
    );
  if (service.check.kind === "sanity")
    return (await import("./probes/sanity.mjs")).probeSanity(service, options);
  if (service.check.kind === "provider")
    return (await import("./probes/provider.mjs")).probeProvider(
      service,
      options,
    );
  if (service.check.kind === "heartbeat")
    return (await import("./probes/heartbeat.mjs")).probeHeartbeat(
      service,
      options,
    );
  const observation = {
    serviceId: service.id,
    status: "degraded",
    checkedAt: now().toISOString(),
    latencyMs: null,
    message: "",
    evidence: "direct",
  };
  if (service.check.kind === "lifecycle")
    return {
      ...observation,
      status: "not_launched",
      message: service.check.reason,
    };
  const start = performance.now();
  try {
    const response = await fetchImpl(service.check.url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "FurriesPH-Status/1.0",
        Accept: "text/html, application/json",
      },
    });
    observation.latencyMs = Math.round(performance.now() - start);
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return {
        ...observation,
        status: "unknown",
        evidence: "monitoring-gap",
        message:
          "Redirect requires operator review; destination was not followed.",
      };
    }
    if (response.status === 429) {
      const retry = response.headers.get("retry-after");
      await response.body?.cancel();
      return {
        ...observation,
        status: "degraded",
        message: /^\d{1,7}$/.test(retry ?? "")
          ? `API request limit reached (HTTP 429); retry permitted after ${Number(retry)} seconds.`
          : "API request limit reached (HTTP 429). Requests are being throttled.",
      };
    }
    if (response.status !== (service.check.expectedStatus ?? 200)) {
      await response.body?.cancel();
      return {
        ...observation,
        status: response.status >= 500 ? "outage" : "degraded",
        message:
          response.status >= 520 && response.status <= 527
            ? `Cloudflare edge/origin failure (HTTP ${response.status}).`
            : `Public endpoint returned HTTP ${response.status}.`,
      };
    }
    // Bound body consumption and retain timeout through content verification.
    const reader = response.body?.getReader();
    let text = "",
      bytes = 0;
    const decoder = new TextDecoder();
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 1048576)
            return {
              ...observation,
              status: "unknown",
              evidence: "monitoring-gap",
              message: "Response exceeds content verification limit.",
            };
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        await reader.cancel().catch(() => {});
      }
    }
    if (!text.toLowerCase().includes(service.check.contains.toLowerCase()))
      return {
        ...observation,
        status: "degraded",
        message: "Public endpoint content assertion failed.",
      };
    const remainingHeader =
      response.headers.get("ratelimit-remaining") ??
      response.headers.get("x-ratelimit-remaining");
    const limitHeader =
      response.headers.get("ratelimit-limit") ??
      response.headers.get("x-ratelimit-limit");
    const remaining = remainingHeader === null ? NaN : Number(remainingHeader);
    const limit = limitHeader === null ? NaN : Number(limitHeader);
    if (
      Number.isFinite(remaining) &&
      remaining >= 0 &&
      (remaining === 0 ||
        (Number.isFinite(limit) && limit > 0 && remaining / limit <= 0.1))
    )
      return {
        ...observation,
        status: "degraded",
        message:
          "API request-limit headroom is low or exhausted according to response headers.",
      };
    const slowMs = Number(env.STATUS_SLOW_RESPONSE_MS ?? 3000);
    if (
      Number.isFinite(slowMs) &&
      slowMs > 0 &&
      performance.now() - start > slowMs
    )
      return {
        ...observation,
        status: "degraded",
        message:
          "Public endpoint responded slower than the configured latency threshold.",
      };
    return {
      ...observation,
      status: "operational",
      message:
        "Public endpoint responded and matched expected content; authenticated workflows are monitored separately.",
    };
  } catch {
    return {
      ...observation,
      status: "outage",
      latencyMs: Math.round(performance.now() - start),
      message:
        "Public endpoint could not be reached within the probe deadline.",
    };
  }
}
export async function collect(services, options = {}) {
  const results = new Array(services.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, services.length) }, async () => {
      while (next < services.length) {
        const index = next++;
        const result = await probe(services[index], options);
        if (Array.isArray(result.providerIncidentSync))
          options.onProviderIncidents?.({
            serviceId: result.serviceId,
            complete: true,
            incidents: result.providerIncidentSync,
          });
        delete result.providerIncidentSync;
        results[index] = result;
      }
    }),
  );
  return propagateDependencies(services, results);
}
export function propagateDependencies(services, observations) {
  const byId = new Map(observations.map((o) => [o.serviceId, { ...o }]));
  const severity = {
    unknown: 0,
    not_launched: 0,
    operational: 0,
    maintenance: 1,
    degraded: 2,
    outage: 3,
  };
  const done = new Set();
  const resolve = (id) => {
    if (done.has(id)) return byId.get(id);
    const service = services.find((s) => s.id === id),
      result = byId.get(id);
    if (!service || !result) return result;
    done.add(id);
    for (const depId of service.dependencies ?? []) {
      const dependency = resolve(depId);
      if (
        !dependency ||
        result.status === "not_launched" ||
        dependency.status === "operational" ||
        dependency.status === "not_launched" ||
        dependency.status === "unknown" ||
        dependency.evidence === "dependency"
      )
        continue;
      // Provider-wide failures are risk signals, not proof of a project outage.
      const impact =
        dependency.evidence === "dependency" ||
        dependency.evidence === "monitoring-gap"
          ? "degraded"
          : dependency.status;
      if (
        severity[impact] > severity[result.status] ||
        (result.status === "operational" && impact === "degraded")
      ) {
        result.status = impact;
        result.evidence =
          dependency.evidence === "monitoring-gap"
            ? "monitoring-gap"
            : "dependency";
        result.message = `Dependent ${services.find((s) => s.id === depId)?.name ?? "service"} reports ${dependency.status}. ${dependency.evidence === "monitoring-gap" ? "Monitoring evidence is incomplete." : "Inspect the dependency for scope and details."}`;
      }
    }
    return result;
  };
  return services.map((s) => resolve(s.id));
}
export function retainHistory(
  history,
  observations,
  now = Date.now(),
  previousObservations = [],
) {
  const today = new Date(now).toISOString().slice(0, 10);
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400000)
    .toISOString()
    .slice(0, 10);
  const days = new Map(
    history
      .filter((day) => day.date >= cutoff && day.date <= today)
      .map((day) => [`${day.serviceId}:${day.date}`, { ...day }]),
  );
  const seen = new Set(
    previousObservations.map((o) => `${o.serviceId}:${o.checkedAt}`),
  );
  const severity = {
    unknown: 1,
    operational: 0,
    not_launched: 0,
    maintenance: 2,
    degraded: 3,
    outage: 4,
  };
  for (const o of observations) {
    const sampleKey = `${o.serviceId}:${o.checkedAt}`,
      day = o.checkedAt.slice(0, 10);
    // Manual observations have no probe latency and do not create synthetic uptime samples.
    if (
      o.latencyMs === null ||
      day < cutoff ||
      Date.parse(o.checkedAt) > now ||
      seen.has(sampleKey)
    )
      continue;
    seen.add(sampleKey);
    const key = `${o.serviceId}:${day}`;
    const aggregate = days.get(key) ?? {
      serviceId: o.serviceId,
      date: day,
      status: "operational",
      checks: 0,
      operationalChecks: 0,
    };
    if (aggregate.checks >= Number.MAX_SAFE_INTEGER)
      fail("Daily count overflow");
    aggregate.checks++;
    aggregate.operationalChecks += Number(o.status === "operational");
    if (severity[o.status] > severity[aggregate.status])
      aggregate.status = o.status;
    days.set(key, aggregate);
  }
  return [...days.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.serviceId.localeCompare(b.serviceId),
  );
}
const xml = (value) =>
  String(value).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function renderFeed(incidents) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Furries PH status</title><link>https://status.furries.ph</link><description>Platform incidents and maintenance updates</description>${incidents.flatMap((i) => i.updates.map((u) => `<item><title>${xml(i.title)} — ${xml(i.status)}</title><guid isPermaLink="false">${xml(i.id)}:${xml(u.at)}</guid><link>https://status.furries.ph/#incident-${xml(encodeURIComponent(i.id))}</link><pubDate>${new Date(u.at).toUTCString()}</pubDate><description>${xml(u.message)}</description></item>`)).join("")}</channel></rss>\n`;
}
