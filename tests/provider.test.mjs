import test from "node:test";
import assert from "node:assert/strict";
import {
  probeProvider,
  providerIncidents,
  reconcileProviderIncidents,
} from "../scripts/probes/provider.mjs";
import { probeHeartbeat } from "../scripts/probes/heartbeat.mjs";
const service = {
  id: "provider",
  check: { provider: "supabase", components: ["Database", "API Gateway"] },
};
test("provider components determine status without using unrelated global incidents", async () => {
  for (const [state, expected] of [
    ["operational", "operational"],
    ["degraded_performance", "degraded"],
    ["major_outage", "outage"],
    ["under_maintenance", "maintenance"],
  ]) {
    const result = await probeProvider(service, {
      fetchImpl: async () =>
        Response.json({
          status: { indicator: "critical" },
          components: [
            { name: "Database", status: "operational" },
            { name: "API Gateway", status: state },
          ],
        }),
    });
    assert.equal(result.status, expected);
    assert.equal(result.evidence, "dependency");
  }
});
test("missing, invalid, rate-limited and failed provider feeds degrade monitoring", async () => {
  for (const response of [
    Response.json({ components: [] }),
    Response.json({ components: [{ name: "Database", status: "mystery" }] }),
    new Response("private error", { status: 429 }),
    new Response("private error", { status: 503 }),
    new Response("{"),
  ]) {
    const result = await probeProvider(service, {
      fetchImpl: async () => response,
    });
    assert.equal(result.status, "unknown");
    assert.equal(result.evidence, "monitoring-gap");
    assert.ok(!result.message.includes("private"));
  }
});
test("all provider incidents become scoped generated records without provider payload bodies", () => {
  const checkedAt = "2026-09-10T01:00:00.000Z";
  const incidents = providerIncidents(
    service,
    {
      incidents: [
        {
          id: "supabase-api-42",
          name: "API Gateway latency",
          status: "identified",
          impact: "minor",
          started_at: checkedAt,
          components: [{ name: "API Gateway" }],
          incident_updates: [{ body: "private provider payload" }],
        },
        {
          id: "unrelated-incident",
          name: "Unrelated service",
          status: "identified",
          impact: "major",
          started_at: checkedAt,
          components: [{ name: "Storage" }],
        },
      ],
    },
    checkedAt,
  );
  assert.equal(incidents.length, 2);
  assert.equal(incidents[0].id, "provider-supabase-supabase-api-42");
  assert.equal(incidents[0].impact, "degraded");
  assert.equal(incidents[1].id, "provider-supabase-unrelated-incident");
  assert.equal(incidents[1].impact, "outage");
  assert.deepEqual(incidents[0].serviceIds, ["provider"]);
  assert.ok(!JSON.stringify(incidents).includes("private provider payload"));
});
test("provider incident history resolves only after a successful absence", () => {
  const startedAt = "2026-09-10T01:00:00.000Z";
  const resolvedAt = "2026-09-10T02:00:00.000Z";
  const previous = [{
    id: "provider-supabase-api-42",
    title: "Supabase provider incident: API Gateway latency",
    status: "identified",
    impact: "degraded",
    serviceIds: ["provider"],
    startedAt,
    updates: [{ at: startedAt, message: "Provider reported impact." }],
  }];
  const unavailable = reconcileProviderIncidents(previous, [], resolvedAt);
  assert.equal(unavailable[0].status, "identified");
  const resolved = reconcileProviderIncidents(previous, [{
    serviceId: "provider",
    complete: true,
    incidents: [],
  }], resolvedAt);
  assert.equal(resolved[0].status, "resolved");
  assert.equal(resolved[0].resolvedAt, resolvedAt);
  assert.equal(resolved[0].updates.length, 2);
  const retained = reconcileProviderIncidents(previous, [{
    serviceId: "provider",
    complete: true,
    incidents: previous,
  }], resolvedAt);
  assert.equal(retained[0].status, "identified");
});
test("heartbeat rejects absent, expired, duplicate, unsupported and sensitive signals", () => {
  const now = () => new Date("2026-09-10T01:00:00Z");
  const target = { id: "ems", check: { signal: "ems" } };
  const valid = {
    serviceId: "ems",
    status: "operational",
    checkedAt: now().toISOString(),
    message: "Synthetic health checks passed.",
  };
  for (const signals of [
    [],
    [valid, valid],
    [{ ...valid, status: "unknown" }],
    [{ ...valid, checkedAt: "2026-09-10T00:00:00Z" }],
    [{ ...valid, checkedAt: "2026-09-10T01:00:30Z" }],
    [{ ...valid, message: "Bearer secret" }],
    [{ ...valid, message: "owner@example.com" }],
  ]) {
    const result = probeHeartbeat(target, { now, signals });
    assert.equal(result.status, "unknown");
    assert.equal(result.evidence, "monitoring-gap");
  }
  assert.equal(
    probeHeartbeat(target, { now, signals: [valid] }).status,
    "operational",
  );
});
