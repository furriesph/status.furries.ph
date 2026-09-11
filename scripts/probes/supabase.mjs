// Server-only. Metrics contract: https://supabase.com/docs/guides/telemetry/metrics
const MAX_BODY = 2 * 1024 * 1024;
async function boundedText(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new Error("Oversized body");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString("utf8");
}

function capacity(text) {
  const metrics = new Map();
  for (const line of text.split("\n")) {
    const match = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^\n]*\})?\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?:\s+\d+)?\s*$/,
    );
    if (!match) continue;
    const value = Number(match[3]);
    if (!Number.isFinite(value) || value < 0) continue;
    const entries = metrics.get(match[1]) || [];
    entries.push({ labels: match[2] || "", value });
    metrics.set(match[1], entries);
  }
  const max = metrics.get("max_connections_connection_count");
  const active = metrics.get("connection_stats_connection_count");
  const direct = metrics.get("direct_connection_stats_connection_count");
  const sizes = metrics.get("node_filesystem_size_bytes");
  const avail = metrics.get("node_filesystem_avail_bytes");
  const readonly = metrics.get("node_filesystem_readonly") || [];
  if (
    !max?.length ||
    !active?.length ||
    !direct?.length ||
    !sizes?.length ||
    !avail?.length
  )
    return null;
  // Each server has its own connection budget; never average saturation away.
  const serverKey = (labels) =>
    [
      ...labels.matchAll(
        /(?:^|[,\{])(server|supabase_identifier|supabase_project_ref)="((?:\\.|[^"\\])*)"/g,
      ),
    ]
      .map((m) => `${m[1]}=${m[2]}`)
      .sort()
      .join(",");
  const connectionSamples = max.flatMap((limit) =>
    [active, direct].map((series) => {
      const samples = series.filter(
        (entry) => serverKey(entry.labels) === serverKey(limit.labels),
      );
      const used = samples.reduce((sum, entry) => sum + entry.value, 0);
      return limit.value > 0 && samples.length
        ? { used, limit: limit.value, ratio: used / limit.value }
        : null;
    }),
  );
  const labelsKey = (labels) =>
    [...labels.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g)]
      .map((m) => `${m[1]}=${m[2]}`)
      .sort()
      .join(",");
  // Hosted database storage is /data. Root images can report zero available
  // bytes despite a writable database volume, so do not call those DB capacity.
  // A changed/missing data mount is a monitoring gap, never assumed healthy.
  const disks = sizes
    .filter(
      (entry) =>
        entry.value > 0 &&
        /mountpoint="\/data(?:\/[^"\\]*)?"/.test(entry.labels) &&
        !/fstype="(?:tmpfs|devtmpfs|overlay|squashfs|proc|sysfs|ramfs)"/.test(
          entry.labels,
        ) &&
        !readonly.some(
          (ro) =>
            labelsKey(ro.labels) === labelsKey(entry.labels) && ro.value === 1,
        ),
    )
    .map((size) => {
      const remaining = avail.find(
        (entry) => labelsKey(entry.labels) === labelsKey(size.labels),
      );
      return remaining && remaining.value <= size.value
        ? { used: size.value - remaining.value, limit: size.value, ratio: 1 - remaining.value / size.value }
        : null;
    });
  if (
    !disks.length ||
    [...connectionSamples, ...disks].some(
      (sample) => !sample || !Number.isFinite(sample.ratio),
    )
  )
    return null;
  const connection = connectionSamples.reduce((worst, sample) =>
    sample.ratio > worst.ratio ? sample : worst,
  );
  const disk = disks.reduce((worst, sample) =>
    sample.ratio > worst.ratio ? sample : worst,
  );
  const metricTotal = (name) =>
    (metrics.get(name) || []).reduce((sum, entry) => sum + entry.value, 0);
  return {
    connections: connection.ratio,
    disk: disk.ratio,
    connection,
    diskUsage: disk,
    authUsers: metricTotal("auth_users_user_count"),
    realtimeSubscriptions: metricTotal("realtime_postgres_changes_total_subscriptions"),
    poolerClientLimit: metricTotal("pgbouncer_config_max_client_connections"),
    poolerActiveClients: metricTotal("pgbouncer_pools_client_active_connections"),
  };
}

export async function probeSupabase(
  service,
  {
    fetchImpl = fetch,
    env = process.env,
    now = () => new Date(),
    timeoutMs = 10000,
  } = {},
) {
  const started = Date.now();
  const result = (status, message, evidence = "direct") => ({
    serviceId: service.id,
    status,
    checkedAt: now().toISOString(),
    latencyMs: Date.now() - started,
    message,
    evidence,
  });
  const gap = (message) => result("unknown", message, "monitoring-gap");
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  let origin;
  try {
    origin = new URL(env.SUPABASE_URL);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      !["", "/"].includes(origin.pathname)
    )
      throw new Error("Invalid URL");
  } catch {
    return gap("Database monitoring configuration is missing or invalid.");
  }
  if (!key) return gap("Database monitoring credentials are not configured.");
  const target = service.check.target;
  const paths = {
    database: "/rest/v1/partners?select=id&limit=1",
    auth: "/auth/v1/health",
    capacity: "/customer/v1/privileged/metrics",
    limits: "/customer/v1/privileged/metrics",
  };
  if (!paths[target]) return gap("Database monitoring target is invalid.");
  const headers =
    target === "capacity" || target === "limits"
      ? {
          authorization: `Basic ${Buffer.from(`service_role:${key}`).toString("base64")}`,
        }
      : {
          apikey: key,
          ...(key.startsWith("sb_secret_")
            ? {}
            : { authorization: `Bearer ${key}` }),
        };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL(paths[target], origin), {
      method: "GET",
      headers,
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status === 429) {
      await response.body?.cancel();
      return result(
        "degraded",
        "Supabase is rate limiting monitoring requests (HTTP 429).",
      );
    }
    if (response.status >= 500) {
      await response.body?.cancel();
      return result("outage", "Supabase returned a server error.");
    }
    if (!response.ok) {
      await response.body?.cancel();
      return gap(
        "Supabase monitoring access failed; check collector configuration.",
      );
    }
    const body = await boundedText(response);
    if (target === "capacity" || target === "limits") {
      const usage = capacity(body);
      if (!usage)
        return gap("Database capacity metrics are incomplete or invalid.");
      if (target === "limits") {
        const formatBytes = (value) => {
          if (value < 1024 ** 2) return `${Math.round(value / 1024)} KiB`;
          if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
          return `${(value / 1024 ** 3).toFixed(2)} GiB`;
        };
        return result(
          usage.connections >= 0.8 || usage.disk >= 0.8
            ? "degraded"
            : "operational",
          `Live Supabase product limits: database disk ${formatBytes(usage.diskUsage.used)} / ${formatBytes(usage.diskUsage.limit)} (${Math.round(usage.disk * 100)}%); busiest database connection pool ${Math.round(usage.connection.used)} / ${Math.round(usage.connection.limit)} (${Math.round(usage.connections * 100)}%); ${Math.round(usage.authUsers)} Auth users; ${Math.round(usage.realtimeSubscriptions)} active Realtime subscriptions; ${Math.round(usage.poolerActiveClients)} / ${Math.round(usage.poolerClientLimit)} pooler client connections. Organization plan allowances, MAU, egress and Storage billing usage require a separate Management API billing credential and are not inferred.`,
        );
      }
      const resource =
        usage.connections >= usage.disk ? "connection" : "filesystem";
      if (usage.connections >= 0.95 || usage.disk >= 0.95)
        return result(
          "degraded",
          `Database ${resource} capacity is at least 95% utilized.`,
        );
      if (usage.connections >= 0.8 || usage.disk >= 0.8)
        return result(
          "degraded",
          `Database ${resource} capacity is at least 80% utilized.`,
        );
      return result(
        "operational",
        "Database connections and disk have more than 20% headroom.",
      );
    }
    const parsed = JSON.parse(body);
    if (
      target === "database" &&
      (!Array.isArray(parsed) ||
        parsed.length > 1 ||
        parsed.some((row) => !row || typeof row.id !== "string"))
    )
      return gap("Database read returned an unexpected response.");
    if (
      target === "auth" &&
      (!parsed ||
        typeof parsed !== "object" ||
        parsed.name !== "GoTrue" ||
        typeof parsed.version !== "string")
    )
      return gap("Authentication health returned an unexpected response.");
    if (Date.now() - started >= 3000)
      return result(
        "degraded",
        "Supabase responded slowly to the read-only health check.",
      );
    return result(
      "operational",
      target === "database"
        ? "Read-only database query succeeded."
        : "Authentication health endpoint responded successfully.",
    );
  } catch {
    return gap(
      "Supabase health could not be verified; request failed, timed out, or returned invalid data.",
    );
  } finally {
    clearTimeout(timer);
  }
}
