// Collector-only. GraphQL bodies, identifiers and credentials never enter public results.
// Sources: developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/
// and developers.cloudflare.com/workers/observability/metrics-and-analytics/
const ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const API = "https://api.cloudflare.com/client/v4";
const DAY = 86_400_000;
const number = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export async function probeCloudflare(
  service,
  {
    fetchImpl = fetch,
    env = process.env,
    now = () => new Date(),
    timeoutMs = 10000,
  } = {},
) {
  const date = now();
  const started = performance.now();
  const result = (status, message, evidence = "direct") => ({
    serviceId: service.id,
    status,
    checkedAt: date.toISOString(),
    latencyMs: Math.round(performance.now() - started),
    message,
    evidence,
  });
  const gap = (message) => result("unknown", message, "monitoring-gap");
  if (!["workers", "requests"].includes(service.check?.target))
    return gap("Cloudflare monitoring target is invalid.");
  if (
    !env.CLOUDFLARE_API_TOKEN ||
    !env.CLOUDFLARE_ACCOUNT_ID ||
    (service.check?.target === "workers" && !env.CLOUDFLARE_WORKER_NAME)
  )
    return gap(
      "Cloudflare account analytics monitoring needs collector credentials and scope.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  async function query(query, variables) {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 429 ? "rate-limit" : "analytics");
    }
    // Limit even authenticated upstream responses; no provider body is echoed.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("analytics");
    let size = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256_000) {
        await reader.cancel();
        throw new Error("analytics");
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      body.errors != null &&
      (!Array.isArray(body.errors) || body.errors.length)
    )
      throw new Error("analytics");
    if (!body.data?.viewer) throw new Error("analytics");
    return body.data.viewer;
  }
  async function liveAccountInventory() {
    const paths = [
      ["Worker scripts", "workers/scripts?per_page=100"],
      ["Pages projects", "pages/projects"],
      ["KV namespaces", "storage/kv/namespaces?per_page=100"],
      ["R2 buckets", "r2/buckets?per_page=100", "buckets"],
      ["Durable Object namespaces", "workers/durable_objects/namespaces?per_page=100"],
      ["D1 databases", "d1/database?per_page=100"],
      ["Queues", "queues?per_page=100"],
    ];
    const read = async ([label, path, collectionKey]) => {
      const response = await fetchImpl(
        `${API}/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/${path}`,
        {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
          headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("inventory");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("inventory");
      let size = 0;
      const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 128_000) throw new Error("inventory");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new Error("inventory");
      }
      const total = body?.result_info?.total_count;
      const collection = collectionKey ? body?.result?.[collectionKey] : body?.result;
      if (body?.success !== true || !Array.isArray(collection))
        throw new Error("inventory");
      if (number(total)) return { label, count: total };
      return { label, count: collection.length };
    };
    return Promise.all(paths.map(read));
  }
  async function workers(start, end, scoped) {
    const viewer = await query(
      `query Monitor($account: string, $start: string, $end: string${scoped ? ", $script: string" : ""}) {
      viewer { accounts(filter: {accountTag: $account}) {
        workersInvocationsAdaptive(limit: 100, filter: {datetime_geq: $start, datetime_lt: $end${scoped ? ", scriptName: $script" : ""}}) {
          dimensions { status } sum { requests errors subrequests }
        }
      }}
    }`,
      {
        account: env.CLOUDFLARE_ACCOUNT_ID,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        ...(scoped ? { script: env.CLOUDFLARE_WORKER_NAME } : {}),
      },
    );
    if (viewer.accounts?.length !== 1) throw new Error("analytics");
    const rows = viewer.accounts[0].workersInvocationsAdaptive;
    if (!Array.isArray(rows) || !rows.length || rows.length >= 100)
      throw new Error("analytics");
    let requests = 0,
      errors = 0,
      resources = 0,
      cpuTimeUs = 0;
    for (const row of rows) {
      if (
        !number(row.sum?.requests) ||
        !number(row.sum?.errors) ||
        !number(row.sum?.subrequests) ||
        typeof row.dimensions?.status !== "string" ||
        row.sum.errors > row.sum.requests
      )
        throw new Error("analytics");
      requests += row.sum.requests;
      if (number(row.sum?.cpuTimeUs)) cpuTimeUs += row.sum.cpuTimeUs;
      const status = row.dimensions.status;
      errors += ["success", "clientDisconnected"].includes(status)
        ? row.sum.errors
        : Math.max(row.sum.errors, row.sum.requests);
      if (/exceeded|limit|memory|cpu/i.test(status))
        resources += row.sum.requests;
    }
    return { requests, errors, resources, cpuTimeUs };
  }
  try {
    if (service.check?.target === "workers") {
      const metrics = await workers(
        date.getTime() - 15 * 60_000,
        date.getTime(),
        true,
      );
      if (!metrics.requests)
        return gap(
          "No recent Worker invocation evidence; runtime monitoring needs traffic.",
        );
      if (metrics.errors)
        return result(
          metrics.errors >= metrics.requests ? "outage" : "degraded",
          metrics.resources
            ? `Worker resource-limit failures: ${metrics.resources}; execution failures: ${metrics.errors} / ${metrics.requests} observed requests in the last 15 minutes (analytics estimates).`
            : `Worker execution failures: ${metrics.errors} / ${metrics.requests} observed requests in the last 15 minutes (analytics estimates).`,
        );
      return result(
        "operational",
        `${metrics.requests} recent Worker invocations show no execution failures (analytics estimate). Application HTTP responses are checked separately.`,
      );
    }
    const daily = env.CLOUDFLARE_DAILY_REQUEST_LIMIT;
    const observabilityDaily = env.CLOUDFLARE_DAILY_OBSERVABILITY_LIMIT;
    const buildMinutesMonthly = env.CLOUDFLARE_MONTHLY_BUILD_MINUTES_LIMIT;
    if (
      ![daily, observabilityDaily, buildMinutesMonthly]
        .filter(Boolean)
        .every(
          (value) =>
            /^\d+$/.test(value) &&
            Number.isSafeInteger(Number(value)) &&
            Number(value) > 0,
        )
    )
      return gap(
        "Cloudflare request monitoring has invalid configured usage limits.",
      );
    const details = [],
      warnings = [],
      gaps = [];
    const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const dayUsage = await workers(startOfDay, date.getTime(), false);
    if (daily) {
      details.push(
        `Cloudflare dashboard Worker requests today: ${dayUsage.requests} / ${Number(daily)} (analytics estimate; account quota).`,
      );
      if (dayUsage.requests >= Number(daily) * 0.8)
        warnings.push(
          `Daily Worker request usage ${dayUsage.requests >= Number(daily) ? "has reached" : "is approaching"} the account quota (analytics estimate).`,
        );
    } else {
      details.push(`Cloudflare Worker requests today: ${dayUsage.requests} (analytics estimate; account quota is not configured).`);
    }
    details.push(`Cloudflare Worker CPU time today: ${Math.round(dayUsage.cpuTimeUs / 1000)} ms (analytics estimate).`);
    if (observabilityDaily)
      details.push(`Cloudflare dashboard Observability events today: unavailable / ${Number(observabilityDaily)}; the collector credential is denied Workers Observability read access, so event use is not estimated.`);
    if (buildMinutesMonthly)
      details.push(`Cloudflare dashboard Workers build minutes this month: unavailable / ${Number(buildMinutesMonthly)}; the current Cloudflare analytics API credential does not expose build-minute use.`);
    try {
      const inventory = await liveAccountInventory();
      const count = (label) => inventory.find((item) => item.label === label).count;
      details.push(
        `Live Cloudflare account inventory: ${count("Worker scripts")} Worker scripts, ${count("Pages projects")} Pages projects, ${count("KV namespaces")} KV namespaces, ${count("R2 buckets")} R2 buckets and ${count("Durable Object namespaces")} Durable Object namespaces; ${count("D1 databases")} D1 databases and ${count("Queues")} Queues.`,
      );
      details.push(
        "Daily limit scope for active products: static Pages assets are free and unlimited. Product billing usage is unavailable to this collector; account dashboard quotas are published only when explicitly configured from the account plan.",
      );
    } catch {
      gaps.push(
        "Live Cloudflare product inventory is unavailable; per-product daily limit scope could not be confirmed.",
      );
    }
    if (!env.CLOUDFLARE_ZONE_ID)
      gaps.push("Zone response-code monitoring is not configured.");
    else {
      try {
        const viewer = await query(
          `query MonitorZone($zone: string, $start: Time, $end: Time) {
          viewer { zones(filter: {zoneTag: $zone}) {
            httpRequestsAdaptiveGroups(limit: 1000, filter: {datetime_geq: $start, datetime_lt: $end}) {
              count dimensions { edgeResponseStatus }
            }
          }}
        }`,
          {
            zone: env.CLOUDFLARE_ZONE_ID,
            start: new Date(date.getTime() - 15 * 60_000).toISOString(),
            end: date.toISOString(),
          },
        );
        const rows =
          viewer.zones?.length === 1
            ? viewer.zones[0].httpRequestsAdaptiveGroups
            : null;
        if (
          !Array.isArray(rows) ||
          !rows.length ||
          rows.length >= 1000 ||
          rows.some(
            (row) =>
              !number(row.count) ||
              !Number.isInteger(row.dimensions?.edgeResponseStatus),
          )
        )
          throw new Error("analytics");
        if (!rows.some((row) => row.count > 0)) throw new Error("analytics");
        const total = rows.reduce((sum, row) => sum + row.count, 0);
        const throttled = rows
          .filter((row) => row.dimensions.edgeResponseStatus === 429)
          .reduce((sum, row) => sum + row.count, 0);
        const failed = rows
          .filter((row) => row.dimensions.edgeResponseStatus >= 500)
          .reduce((sum, row) => sum + row.count, 0);
        details.push(
          `Last 15 minutes across the zone: ${total} responses, ${throttled} HTTP 429, ${failed} HTTP 5xx (analytics estimates).`,
        );
        if (throttled > 0)
          warnings.push(
            "HTTP 429 rate-limited responses observed across the monitored zone.",
          );
        if (failed > 0)
          warnings.push(
            "HTTP server errors observed across the monitored zone.",
          );
      } catch {
        gaps.push(
          "Zone response-code analytics are unavailable or incomplete.",
        );
      }
    }
    if (warnings.length)
      return result("degraded", [...warnings, ...details, ...gaps].join(" "));
    if (gaps.length) return gap([...gaps, ...details].join(" "));
    return result(
      "operational",
      `Account request usage is below configured warning levels. ${details.join(" ")} Analytics are sampled estimates, not billing totals.`,
    );
  } catch (error) {
    return gap(
      error.message === "rate-limit"
        ? "Cloudflare analytics API request limit reached; monitoring evidence is unavailable."
        : "Cloudflare analytics are unavailable, denied, empty or incomplete; monitoring evidence is unavailable.",
    );
  } finally {
    clearTimeout(timer);
  }
}
