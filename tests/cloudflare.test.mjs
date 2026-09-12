import test from "node:test";
import assert from "node:assert/strict";
import { probeCloudflare } from "../scripts/probes/cloudflare.mjs";
import { resolveCloudflareLocalAuth } from "../scripts/cloudflare-local-auth.mjs";
const env = {
  CLOUDFLARE_API_TOKEN: "private-token",
  CLOUDFLARE_ACCOUNT_ID: "private-account",
  CLOUDFLARE_WORKER_NAME: "private-worker",
};
const now = () => new Date("2026-09-10T12:00:00Z");
const service = {
  id: "worker",
  check: { kind: "cloudflare", target: "workers" },
};
const row = (status = "success", requests = 100, errors = 0) => ({
  dimensions: { status },
  sum: { requests, errors, subrequests: 200 },
});
const response = (rows) =>
  Response.json({
    data: { viewer: { accounts: [{ workersInvocationsAdaptive: rows }] } },
    errors: null,
  });
const inventoryResponse = (url) => {
  const counts = new Map([
    ["workers/scripts", 6],
    ["pages/projects", 10],
    ["storage/kv/namespaces", 1],
    ["r2/buckets", 1],
    ["workers/durable_objects/namespaces", 4],
    ["d1/database", 0],
    ["queues", 0],
  ]);
  const entry = [...counts].find(([path]) => String(url).includes(path));
  assert.ok(entry, `unexpected account endpoint ${url}`);
  const body = {
    success: true,
    result: Array(entry[1]).fill({}),
    result_info: { total_count: entry[1] },
  };
  if (String(url).includes("r2/buckets"))
    body.result = { buckets: Array(entry[1]).fill({}) };
  return Response.json(body);
};
test("Cloudflare missing credentials fails visibly without network or private details", async () => {
  const result = await probeCloudflare(service, {
    env: {},
    now,
    fetchImpl: () => assert.fail(),
  });
  assert.equal(result.status, "unknown");
  assert.equal(result.evidence, "monitoring-gap");
});
test("Worker runtime success, exceptions and resource limits are distinguished", async () => {
  for (const [rows, status, pattern] of [
    [[row()], "operational", /no execution/],
    [
      [row(), row("scriptThrewException", 2, 2)],
      "degraded",
      /execution failures/,
    ],
    [[row("exceededResources", 2, 2)], "outage", /resource-limit/],
  ]) {
    const result = await probeCloudflare(service, {
      env,
      now,
      fetchImpl: async () => response(rows),
    });
    assert.equal(result.status, status);
    assert.match(result.message, pattern);
    assert.doesNotMatch(JSON.stringify(result), /private-/);
  }
});
test("Empty, partial, malformed, denied and rate-limited analytics cannot be healthy", async () => {
  for (const make of [
    () => response([]),
    () => response([row("success", 0)]),
    () => response([{ sum: { requests: 10 } }]),
    () =>
      Response.json({
        errors: [{ message: "private-token" }],
        data: { viewer: {} },
      }),
    () => new Response("", { status: 403 }),
    () => new Response("", { status: 429 }),
    () => response(Array(100).fill(row())),
  ]) {
    const result = await probeCloudflare(service, {
      env,
      now,
      fetchImpl: async () => make(),
    });
    assert.equal(result.status, "unknown");
    assert.equal(result.evidence, "monitoring-gap");
    assert.doesNotMatch(JSON.stringify(result), /private-token/);
  }
});
test("Request budget scope is account-wide and zone 429 detects throttling", async () => {
  const calls = [];
  const result = await probeCloudflare(
    { id: "limits", check: { kind: "cloudflare", target: "requests" } },
    {
      env: {
        ...env,
        CLOUDFLARE_DAILY_REQUEST_LIMIT: "100",
        CLOUDFLARE_ZONE_ID: "zone",
      },
      now,
      fetchImpl: async (_, options) => {
        if (options.method === "GET") return inventoryResponse(_);
        const body = JSON.parse(options.body);
        calls.push(body);
        return body.query.includes("MonitorZone")
          ? Response.json({
              data: {
                viewer: {
                  zones: [
                    {
                      httpRequestsAdaptiveGroups: [
                        { count: 2, dimensions: { edgeResponseStatus: 429 } },
                      ],
                    },
                  ],
                },
              },
            })
          : response([row("success", 90)]);
      },
    },
  );
  assert.equal(result.status, "degraded");
  assert.match(result.message, /approaching/);
  assert.match(result.message, /429/);
  assert.match(result.message, /90 \/ 100/);
  assert.match(result.message, /2 HTTP 429/);
  assert.equal(calls[0].variables.script, undefined);
  assert.doesNotMatch(calls[0].query, /scriptName/);
});

test("Local auth uses encrypted Wrangler store without interactive login or inherited token", async () => {
  const resolved = await resolveCloudflareLocalAuth({
    env: { CLOUDFLARE_API_TOKEN: "expired", CLOUDFLARE_ACCOUNT_ID: "scope" },
    execFileImpl: async (_, args, options) => {
      assert.deepEqual(args.slice(1), ["auth", "token", "--json"]);
      assert.equal(options.env.CI, "true");
      assert.equal(options.env.CLOUDFLARE_API_TOKEN, "");
      assert.equal(options.windowsHide, true);
      return {
        stdout: JSON.stringify({ type: "oauth", token: "fresh-private" }),
      };
    },
  });
  assert.equal(resolved.CLOUDFLARE_API_TOKEN, "fresh-private");
  assert.equal(resolved.CLOUDFLARE_ACCOUNT_ID, "scope");
});

test("Local auth rejects CI and sanitizes subprocess failures", async () => {
  await assert.rejects(
    resolveCloudflareLocalAuth({
      env: { CI: "true" },
      execFileImpl: () => assert.fail(),
    }),
    /disabled in CI/,
  );
  await assert.rejects(
    resolveCloudflareLocalAuth({
      env: {},
      execFileImpl: () => {
        throw Error("private-token");
      },
    }),
    (error) =>
      !error.message.includes("private-token") &&
      error.message.includes("could not be read"),
  );
});
test("Daily usage uses one bounded query and missing zone remains a gap", async () => {
  const windows = [];
  const result = await probeCloudflare(
    { id: "limits", check: { kind: "cloudflare", target: "requests" } },
    {
      env: { ...env, CLOUDFLARE_DAILY_REQUEST_LIMIT: "10000" },
      now,
      fetchImpl: async (_, options) => {
        if (options.method === "GET") return inventoryResponse(_);
        const { variables } = JSON.parse(options.body);
        windows.push(variables);
        return response([row()]);
      },
    },
  );
  assert.equal(windows.length, 1);
  assert.equal(result.evidence, "monitoring-gap");
});
test("Healthy quotas need configured budgets and recent valid zone data", async () => {
  const result = await probeCloudflare(
    { id: "limits", check: { kind: "cloudflare", target: "requests" } },
    {
      env: {
        ...env,
        CLOUDFLARE_DAILY_REQUEST_LIMIT: "10000",
        CLOUDFLARE_ZONE_ID: "zone",
      },
      now,
      fetchImpl: async (_, options) =>
        options.method === "GET"
          ? inventoryResponse(_)
          : JSON.parse(options.body).query.includes("MonitorZone")
          ? Response.json({
              data: {
                viewer: {
                  zones: [
                    {
                      httpRequestsAdaptiveGroups: [
                        { count: 20, dimensions: { edgeResponseStatus: 200 } },
                      ],
                    },
                  ],
                },
              },
            })
          : response([row()]),
    },
  );
  assert.equal(result.status, "operational");
});
test("Unconfigured quotas remain explicitly unavailable instead of inferred", async () => {
  const result = await probeCloudflare(
    { id: "limits", check: { kind: "cloudflare", target: "requests" } },
    {
      env: { ...env, CLOUDFLARE_ZONE_ID: "zone" },
      now,
      fetchImpl: async (url, options) => {
        if (options.method === "GET") return inventoryResponse(url);
        return JSON.parse(options.body).query.includes("MonitorZone")
          ? Response.json({
              data: {
                viewer: {
                  zones: [
                    {
                      httpRequestsAdaptiveGroups: [
                        { count: 20, dimensions: { edgeResponseStatus: 200 } },
                      ],
                    },
                  ],
                },
              },
            })
          : response([row("success", 100)]);
      },
    },
  );
  assert.equal(result.status, "operational");
  assert.match(result.message, /account quota is not configured/);
});

test("Live account inventory is published without inventing product billing limits", async () => {
  const result = await probeCloudflare(
    { id: "limits", check: { kind: "cloudflare", target: "requests" } },
    {
      env: { ...env, CLOUDFLARE_ZONE_ID: "zone" },
      now,
      fetchImpl: async (url, options) => {
        if (options.method === "GET") return inventoryResponse(url);
        return JSON.parse(options.body).query.includes("MonitorZone")
          ? Response.json({
              data: {
                viewer: {
                  zones: [
                    {
                      httpRequestsAdaptiveGroups: [
                        { count: 20, dimensions: { edgeResponseStatus: 200 } },
                      ],
                    },
                  ],
                },
              },
            })
          : response([row("success", 100)]);
      },
    },
  );
  assert.equal(result.status, "operational");
  assert.match(result.message, /Cloudflare Worker requests today: 100/);
  assert.match(result.message, /6 Worker scripts, 10 Pages projects, 1 KV namespaces, 1 R2 buckets and 4 Durable Object namespaces; 0 D1 databases and 0 Queues/);
  assert.match(result.message, /static Pages assets are free and unlimited/);
  assert.doesNotMatch(JSON.stringify(result), /private-/);
});
