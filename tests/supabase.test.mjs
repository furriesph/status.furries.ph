import test from "node:test";
import assert from "node:assert/strict";
import { probeSupabase } from "../scripts/probes/supabase.mjs";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_PRIVATE",
};
const service = (target) => ({
  id: `supabase-${target}`,
  check: { kind: "supabase", target },
});
const probe = (target, body, status = 200, options = {}) =>
  probeSupabase(service(target), {
    env,
    fetchImpl: async () => new Response(body, { status }),
    ...options,
  });
const metrics = (connections = 20, available = 70) =>
  `max_connections_connection_count{server="db"} 100\nconnection_stats_connection_count{server="db",username="PRIVATE"} ${connections}\ndirect_connection_stats_connection_count{server="db"} 0\nnode_filesystem_size_bytes{mountpoint="/data"} 100\nnode_filesystem_avail_bytes{mountpoint="/data"} ${available}\n`;
const productMetrics = () =>
  metrics().replace(
    'node_filesystem_size_bytes{mountpoint="/data"} 100\nnode_filesystem_avail_bytes{mountpoint="/data"} 70',
    'node_filesystem_size_bytes{mountpoint="/data"} 102400\nnode_filesystem_avail_bytes{mountpoint="/data"} 71680',
  ) +
  "auth_users_user_count 42\nrealtime_postgres_changes_total_subscriptions 3\npgbouncer_config_max_client_connections 200\npgbouncer_pools_client_active_connections 7\n";

test("bounded database read authenticates without redirect or secret bearer misuse", async () => {
  let calls = 0;
  const result = await probe("database", "", 200, {
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url.pathname, "/rest/v1/partners");
      assert.equal(url.searchParams.get("limit"), "1");
      assert.equal(url.searchParams.get("select"), "id");
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.apikey, env.SUPABASE_SECRET_KEY);
      assert.equal(init.headers.authorization, undefined);
      return Response.json([{ id: "PRIVATE-ROW-ID" }]);
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "operational");
  assert.equal(result.evidence, "direct");
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});
test("legacy key uses bearer for REST and Basic for capacity", async () => {
  const legacy = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: "PRIVATE",
  };
  for (const target of ["database", "capacity"])
    await probe(target, "", 200, {
      env: legacy,
      fetchImpl: async (_, init) => {
        assert.equal(
          init.headers.authorization,
          target === "capacity"
            ? `Basic ${Buffer.from("service_role:PRIVATE").toString("base64")}`
            : "Bearer PRIVATE",
        );
        return new Response(target === "capacity" ? metrics() : "[]");
      },
    });
});
test("auth requires actual GoTrue health response", async () => {
  assert.equal(
    (await probe("auth", '{"name":"GoTrue","version":"v2"}')).status,
    "operational",
  );
  for (const body of [
    "{}",
    "[]",
    '{"name":"other","version":"v2"}',
    "<html>success</html>",
  ])
    assert.equal((await probe("auth", body)).evidence, "monitoring-gap");
});
test("capacity detects connection and disk saturation and missing metrics", async () => {
  assert.equal((await probe("capacity", metrics())).status, "operational");
  for (const body of [
    metrics(80),
    metrics(95),
    metrics(20, 20),
    metrics(20, 5),
  ])
    assert.equal((await probe("capacity", body)).status, "degraded");
  for (const body of [
    "",
    "{}",
    metrics().replace("node_filesystem_avail_bytes", "missing_metric"),
    metrics().replace(" 100", " NaN"),
  ])
    assert.equal((await probe("capacity", body)).evidence, "monitoring-gap");
});
test("product limits publish live product capacity without inventing billing allowances", async () => {
  const result = await probe("limits", productMetrics());
  assert.equal(result.status, "operational");
  assert.match(result.message, /database disk 30 KiB \/ 100 KiB \(30%\)/);
  assert.match(result.message, /20 \/ 100 \(20%\)/);
  assert.match(result.message, /42 Auth users/);
  assert.match(result.message, /3 active Realtime subscriptions/);
  assert.match(result.message, /7 \/ 200 pooler client connections/);
  assert.match(result.message, /separate management analytics credential is required/);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
});
test("product limits include verified Management API activity and configured Auth limits", async () => {
  const management = {
    ...env,
    SUPABASE_MANAGEMENT_TOKEN: "MANAGEMENT_PRIVATE",
    SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  };
  const result = await probe("limits", productMetrics(), 200, {
    env: management,
    fetchImpl: async (url, init) => {
      const endpoint = new URL(url);
      if (endpoint.hostname === "example.supabase.co")
        return new Response(productMetrics());
      assert.equal(endpoint.hostname, "api.supabase.com");
      assert.equal(init.headers.authorization, "Bearer MANAGEMENT_PRIVATE");
      if (endpoint.pathname.endsWith("/usage.api-counts"))
        return Response.json({
          result: [
            {
              timestamp: "2026-09-12T00:00:00Z",
              total_auth_requests: 1,
              total_realtime_requests: 2,
              total_rest_requests: 3,
              total_storage_requests: 4,
            },
          ],
        });
      if (endpoint.pathname.endsWith("/config/auth"))
        return Response.json({
          rate_limit_anonymous_users: 30,
          rate_limit_email_sent: 150,
          rate_limit_sms_sent: 30,
          rate_limit_token_refresh: 150,
          rate_limit_verify: 30,
          rate_limit_otp: 30,
          rate_limit_web3: 30,
        });
      throw Error(`Unexpected Management API request: ${endpoint.pathname}`);
    },
  });
  assert.equal(result.status, "operational");
  assert.match(result.message, /latest 1 one-minute samples: Auth 1; Realtime 2; REST 3; Storage 4/);
  assert.match(result.message, /anonymous users 30; email sends 150; SMS sends 30/);
  assert.doesNotMatch(JSON.stringify(result), /MANAGEMENT_PRIVATE/);
});
test("product limits degrade with the same 80% capacity threshold", async () => {
  const result = await probe("limits", productMetrics().replace(" 20\n", " 80\n"));
  assert.equal(result.status, "degraded");
});
test("capacity does not average away a saturated database server", async () => {
  const body =
    metrics(99) +
    'max_connections_connection_count{server="replica"} 1000\nconnection_stats_connection_count{server="replica"} 1\ndirect_connection_stats_connection_count{server="replica"} 0\n';
  assert.equal((await probe("capacity", body)).status, "degraded");
});
test("capacity excludes root images, virtual mounts and read-only auxiliary volumes", async () => {
  const extra = (labels, readonly = 0) =>
    `node_filesystem_size_bytes{${labels}} 100\nnode_filesystem_avail_bytes{${labels}} 0\nnode_filesystem_readonly{${labels}} ${readonly}\n`;
  const body =
    metrics() +
    extra('mountpoint="/",fstype="ext4"') +
    extra('mountpoint="/data/cache",fstype="tmpfs"') +
    extra('mountpoint="/data/image",fstype="ext4"', 1);
  assert.equal((await probe("capacity", body)).status, "operational");
  assert.equal(
    (await probe("capacity", metrics().replaceAll("/data", "/"))).evidence,
    "monitoring-gap",
  );
  assert.equal(
    (
      await probe(
        "capacity",
        metrics() + 'node_filesystem_readonly{mountpoint="/data"} 1\n',
      )
    ).evidence,
    "monitoring-gap",
  );
});
test("capacity checks direct Postgres connection headroom and requires its metrics", async () => {
  assert.equal(
    (
      await probe(
        "capacity",
        metrics().replace(
          'direct_connection_stats_connection_count{server="db"} 0',
          'direct_connection_stats_connection_count{server="db"} 95',
        ),
      )
    ).status,
    "degraded",
  );
  assert.equal(
    (
      await probe(
        "capacity",
        metrics().replace(
          "direct_connection_stats_connection_count",
          "missing_metric",
        ),
      )
    ).evidence,
    "monitoring-gap",
  );
});
test("rate limits and server errors are direct evidence without response leakage", async () => {
  for (const [http, status] of [
    [429, "degraded"],
    [500, "outage"],
    [503, "outage"],
  ]) {
    const result = await probe("database", "PRIVATE", http);
    assert.equal(result.status, status);
    assert.equal(result.evidence, "direct");
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  }
});
test("configuration, auth failures, redirects, invalid rows and malformed responses remain unknown", async () => {
  const cases = [
    probe("database", "[]", 200, { env: {} }),
    probe("database", "[]", 200, {
      env: { ...env, SUPABASE_URL: "http://example.com" },
    }),
    probe("database", "PRIVATE", 401),
    probe("database", "PRIVATE", 302),
    probe("database", "{}"),
    probe("database", "[{}]"),
    probe("database", "PRIVATE"),
    probe("database", "x".repeat(2 * 1024 * 1024 + 1)),
  ];
  for (const result of await Promise.all(cases)) {
    assert.equal(result.status, "unknown");
    assert.equal(result.evidence, "monitoring-gap");
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  }
});
test("failed requests sanitize errors and timeout aborts fetch", async () => {
  const result = await probe("database", "", 200, {
    fetchImpl: async () => {
      throw Error("PRIVATE");
    },
  });
  assert.equal(result.evidence, "monitoring-gap");
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  const timed = await probe("database", "", 200, {
    timeoutMs: 5,
    fetchImpl: async (_, init) =>
      new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(Error("PRIVATE"))),
      ),
  });
  assert.equal(timed.status, "unknown");
});
