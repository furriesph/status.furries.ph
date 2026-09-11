import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  probe,
  collect,
  propagateDependencies,
  validateServices,
  validateSnapshot,
  migrateLegacySnapshot,
} from "../scripts/status-core.mjs";
const service = {
  id: "api",
  name: "API",
  group: "Infrastructure",
  description: "API route",
  check: {
    kind: "http",
    url: "https://api.furries.ph/api/geo/countries",
    contains: "Philippines",
  },
};
test("HTTP limits, Retry-After, edge failures and low request headroom are visible", async () => {
  const scenarios = [
    [429, { "retry-after": "30" }, "limited", "API request limit reached"],
    [200, { "x-ratelimit-remaining": "0" }, "Philippines", "headroom"],
    [
      200,
      { "ratelimit-remaining": "5", "ratelimit-limit": "100" },
      "Philippines",
      "headroom",
    ],
    [522, {}, "private upstream trace", "Cloudflare edge/origin failure"],
  ];
  for (const [status, headers, body, message] of scenarios) {
    const result = await probe(service, {
      fetchImpl: async () => new Response(body, { status, headers }),
    });
    assert.notEqual(result.status, "operational");
    assert.ok(result.message.includes(message));
    assert.ok(!result.message.includes("private"));
  }
  const safe = await probe(service, {
    fetchImpl: async () =>
      new Response("Philippines", {
        headers: { "x-ratelimit-remaining": "75", "x-ratelimit-limit": "100" },
      }),
  });
  assert.equal(safe.status, "operational");
});
test("actual registry dispatch covers every adapter and keeps missing evidence unknown", async () => {
  const services = validateServices(
    JSON.parse(
      fs.readFileSync(
        new URL("../config/services.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const observations = await collect(services, {
    env: {},
    fetchImpl: async () => Response.json({ components: [] }),
  });
  assert.equal(observations.length, services.length);
  assert.ok(observations.some((o) => o.status === "unknown"));
  assert.equal(
    observations.find((o) => o.serviceId === "admin-portal").status,
    "not_launched",
  );
  for (const id of [
    "database",
    "auth",
    "database-capacity",
    "cloudflare-workers",
    "request-limits",
  ])
    assert.equal(
      observations.find((o) => o.serviceId === id).evidence,
      "monitoring-gap",
    );
});
test("dependencies escalate failures but do not turn missing workflow evidence healthy", () => {
  const services = [
    { id: "database", name: "Database" },
    { id: "ems", dependencies: ["database"] },
  ];
  const rows = [
    {
      serviceId: "database",
      status: "outage",
      evidence: "direct",
      message: "Read failed",
    },
    {
      serviceId: "ems",
      status: "degraded",
      evidence: "monitoring-gap",
      message: "No heartbeat",
    },
  ];
  assert.equal(propagateDependencies(services, rows)[1].status, "outage");
  rows[0].status = "operational";
  assert.equal(propagateDependencies(services, rows)[1].status, "degraded");
  rows[0].status = "outage";
  rows[0].evidence = "dependency";
  rows[1].status = "operational";
  assert.equal(propagateDependencies(services, rows)[1].status, "operational");
});
test("dependency registry rejects cycles and missing IDs", () => {
  assert.throws(() =>
    validateServices([{ ...service, dependencies: ["missing"] }]),
  );
  assert.throws(() =>
    validateServices([
      { ...service, dependencies: ["b"] },
      { ...service, id: "b", dependencies: ["api"] },
    ]),
  );
});
test("legacy snapshot migration preserves failed counts and retains unknown in new feeds", () => {
  const sample = {
    serviceId: "api",
    status: "unknown",
    checkedAt: "2026-09-09T00:00:00Z",
    message: "No evidence",
    latencyMs: 1,
  };
  const legacy = {
    schemaVersion: 1,
    generatedAt: sample.checkedAt,
    observations: [sample],
    history: [
      {
        serviceId: "api",
        date: "2026-09-09",
        status: "unknown",
        checks: 3,
        operationalChecks: 0,
      },
    ],
    incidents: [],
  };
  const migrated = migrateLegacySnapshot(legacy);
  validateSnapshot(migrated, [service]);
  assert.equal(migrated.history[0].checks, 3);
  assert.equal(migrated.history[0].operationalChecks, 0);
  assert.equal(migrated.observations[0].status, "unknown");
  assert.doesNotThrow(() =>
    validateSnapshot({ ...legacy, schemaVersion: 2 }, [service]),
  );
});
