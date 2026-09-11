// Reviewed, server-only read probes. These establish data availability, never
// write success, end-user authorization correctness, payment or message delivery.
export const PLATFORM_TARGETS = Object.freeze({
  admin: { tables: ["partners", "partner_memberships"] },
  ems: { tables: ["events", "event_check_in_records"] },
  eps: { tables: ["planning_projects", "planning_meetings"] },
  finance: {
    tables: ["partner_finance_accounts", "partner_finance_journal_entries"],
  },
  assets: { tables: ["workspace_assets"] },
  hr: { tables: ["event_hr_departments", "event_hr_roster_entries"] },
  pawsports: { tables: ["pawsports", "pawsport_bindings"] },
  reports: { tables: ["incident_reports"] },
  registration: {
    tables: ["regos"],
    publicPath: "/api/rego/events",
    listKey: null,
  },
  dealers: { tables: ["dealers_den_applications", "dealers_den_regos"] },
  "social-workflows": {
    tables: ["social_local_posts"],
    publicPath: "/api/social/public/events?limit=1",
    listKey: "events",
  },
  surveys: {
    tables: ["surveys", "survey_responses"],
    publicPath: "/api/surveys/public-paths",
    listKey: "paths",
  },
});

async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("No response");
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw Error("Response too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function probePlatform(
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
  const target = PLATFORM_TARGETS[service.check.target];
  if (!target || !Object.hasOwn(PLATFORM_TARGETS, service.check.target))
    return gap("No reviewed platform availability probe is configured.");
  let origin;
  try {
    origin = new URL(env.SUPABASE_URL);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/"
    )
      throw Error("Invalid origin");
  } catch {
    return gap("Platform data monitoring configuration is unavailable.");
  }
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return gap("Platform data monitoring credentials are unavailable.");
  const headers = {
    apikey: key,
    ...(key.startsWith("sb_secret_") ? {} : { authorization: `Bearer ${key}` }),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const checks = target.tables.map((table) => ({
      url: new URL(`/rest/v1/${table}?select=id&limit=1`, origin),
      private: true,
    }));
    if (target.publicPath)
      checks.push({
        url: new URL(target.publicPath, "https://api.furries.ph"),
        private: false,
      });
    // Sequential bounded reads reduce load and stop immediately on failure.
    for (const check of checks) {
      const response = await fetchImpl(check.url, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: check.private ? headers : { accept: "application/json" },
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429)
          return result(
            "degraded",
            "Platform read requests are being rate limited (HTTP 429).",
          );
        if (response.status >= 500)
          return result(
            "outage",
            "A platform data or public discovery read returned a server error.",
          );
        return gap(
          "Platform read access is unavailable; monitoring configuration or schema needs review.",
        );
      }
      const body = await readJson(response);
      const rows =
        check.private || target.listKey === null
          ? body
          : body?.[target.listKey];
      if (
        !Array.isArray(rows) ||
        (check.private &&
          (rows.length > 1 ||
            rows.some((row) => !row || typeof row.id !== "string")))
      )
        return gap("Platform read returned an unexpected response.");
    }
    return result(
      "operational",
      target.publicPath
        ? "Data reads and public discovery API responded. Writes and protected actions were not exercised."
        : "Service data reads succeeded. Protected actions and writes were not exercised.",
    );
  } catch {
    return gap(
      "Platform read availability could not be verified; request failed, timed out, or returned invalid data.",
    );
  } finally {
    clearTimeout(timer);
  }
}
