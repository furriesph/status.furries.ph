import test from "node:test";
import assert from "node:assert/strict";
import {
  validateServices,
  validateIncidents,
  validateSnapshot,
  reconcilePrevious,
  probe,
  collect,
  retainHistory,
  renderFeed,
} from "../scripts/status-core.mjs";
const service = {
  id: "website",
  name: "Website",
  group: "Public",
  description: "Public surface",
  check: { kind: "http", url: "https://furries.ph/", contains: "furries" },
};
const now = Date.parse("2026-09-09T00:00:00Z");
test("service validation rejects duplicates, unsafe URLs and missing assertions", () => {
  assert.equal(validateServices([service]).length, 1);
  assert.throws(() => validateServices([service, service]));
  for (const url of [
    "http://furries.ph/",
    "https://evil.example/",
    "https://furries.ph/?token=secret",
    "https://furries.ph:9999/",
    "https://name:pass@furries.ph/",
  ])
    assert.throws(() =>
      validateServices([{ ...service, check: { ...service.check, url } }]),
    );
  assert.throws(() =>
    validateServices([
      { ...service, check: { kind: "http", url: "https://furries.ph/" } },
    ]),
  );
});
test("probes require both successful status and matching content", async () => {
  for (const [code, body, expected] of [
    [200, "Furries PH", "operational"],
    [200, "error", "degraded"],
    [503, "Furries", "outage"],
    [403, "Furries", "degraded"],
    [302, "", "unknown"],
  ]) {
    const result = await probe(service, {
      fetchImpl: async (_url, options) => {
        assert.equal(options.redirect, "manual");
        return new Response(body, { status: code });
      },
    });
    assert.equal(result.status, expected);
  }
});
test("timeout/network failures never report healthy or expose errors", async () => {
  const result = await probe(service, {
    fetchImpl: async () => {
      throw new Error("private upstream information");
    },
  });
  assert.equal(result.status, "outage");
  assert.ok(!result.message.includes("private"));
});
test("oversized bodies leave health unknown and stream failures are not healthy", async () => {
  assert.equal(
    (
      await probe(service, {
        fetchImpl: async () => new Response("furries".repeat(160000)),
      })
    ).status,
    "unknown",
  );
  assert.equal(
    (
      await probe(service, {
        fetchImpl: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("stream failure"));
              },
            }),
          ),
      })
    ).status,
    "outage",
  );
});
test("missing heartbeat checks never make HTTP requests", async () => {
  const result = await probe(
    { ...service, check: { kind: "heartbeat", signal: "website" } },
    { fetchImpl: () => assert.fail("unexpected request") },
  );
  assert.equal(result.status, "unknown");
});
test("collector concurrency is bounded and order preserved", async () => {
  let active = 0,
    peak = 0;
  const rows = await collect(
    Array.from({ length: 11 }, (_, i) => ({ ...service, id: `s-${i}` })),
    {
      fetchImpl: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return new Response("furries");
      },
    },
  );
  assert.ok(peak <= 4);
  assert.equal(rows[10].serviceId, "s-10");
});
test("history prunes old and future samples and deduplicates", () => {
  const rows = [-31, -29, -1, 1].map((days) => ({
    serviceId: "website",
    status: "operational",
    latencyMs: 20,
    checkedAt: new Date(now + days * 86400000).toISOString(),
  }));
  assert.equal(retainHistory([], [...rows, rows[2]], now).length, 2);
  assert.equal(retainHistory([], [...rows, rows[2]], now)[1].checks, 1);
  assert.equal(retainHistory([], rows, now, rows).length, 0);
});
test("daily aggregates retain worst status, honest counts and bounded size", () => {
  const rows = ["operational", "degraded", "operational", "outage"].map(
    (status, index) => ({
      serviceId: "website",
      status,
      latencyMs: 1,
      checkedAt: new Date(now - index * 1000 - 1000).toISOString(),
    }),
  );
  const daily = retainHistory(
    [],
    [...rows, { ...rows[0], serviceId: "manual", latencyMs: null }],
    now,
  );
  assert.equal(daily.length, 1);
  assert.equal(daily[0].status, "outage");
  assert.equal(daily[0].checks, 4);
  assert.equal(daily[0].operationalChecks, 2);
  assert.throws(() =>
    retainHistory(
      [{ ...daily[0], checks: Number.MAX_SAFE_INTEGER }],
      rows,
      now,
    ),
  );
  const snapshot = {
    schemaVersion: 2,
    generatedAt: new Date(now).toISOString(),
    observations: [{ ...rows[0], message: "Sample" }],
    history: daily,
    incidents: [],
  };
  validateSnapshot(snapshot, [service]);
  for (const update of [
    { checks: -1 },
    { checks: 1.5 },
    { operationalChecks: 5 },
    { status: "operational" },
    { date: "2026-02-30" },
  ])
    assert.throws(() =>
      validateSnapshot({ ...snapshot, history: [{ ...daily[0], ...update }] }, [
        service,
      ]),
    );
});
const incident = {
  id: "test",
  title: "Delay",
  status: "investigating",
  impact: "degraded",
  serviceIds: ["website"],
  startedAt: "2026-09-08T00:00:00Z",
  updates: [
    { at: "2026-09-08T00:00:00Z", message: "Investigating <issue> & impact" },
  ],
};
test("incident state, references and chronology are validated", () => {
  validateIncidents([incident], [service], now);
  for (const change of [
    { serviceIds: ["missing"] },
    { status: "resolved" },
    { updates: [] },
    { startedAt: "bad" },
    { status: "scheduled" },
    { resolvedAt: "2026-09-08T01:00:00Z" },
  ])
    assert.throws(() =>
      validateIncidents([{ ...incident, ...change }], [service], now),
    );
  assert.throws(() =>
    validateIncidents(
      [{ ...incident, startedAt: "2026-02-30T00:00:00Z" }],
      [service],
      now,
    ),
  );
  assert.throws(() =>
    validateIncidents(
      [{ ...incident, privateToken: "never publish" }],
      [service],
      now,
    ),
  );
  assert.throws(() =>
    validateIncidents(
      [{ ...incident, updates: [incident.updates[0], incident.updates[0]] }],
      [service],
      now,
    ),
  );
});
test("RSS escapes operator content", () => {
  const feed = renderFeed([incident]);
  assert.ok(feed.includes("&lt;issue&gt; &amp; impact"));
  assert.ok(!feed.includes("<issue>"));
});
test("RSS links to individual incidents with encoded identifiers", () => {
  assert.ok(
    renderFeed([{ ...incident, id: "maintenance / one" }]).includes(
      "https://status.furries.ph/#incident-maintenance%20%2F%20one",
    ),
  );
});
test("initial snapshots cannot claim operational and must cover all services", () => {
  const initial = {
    schemaVersion: 2,
    generatedAt: null,
    observations: [
      {
        serviceId: "website",
        status: "degraded",
        checkedAt: new Date(now).toISOString(),
        latencyMs: null,
        message: "Not monitored",
      },
    ],
    history: [],
    incidents: [],
  };
  validateSnapshot(initial, [service]);
  assert.throws(() =>
    validateSnapshot({ ...initial, observations: [] }, [service]),
  );
  assert.throws(() =>
    validateSnapshot(
      {
        ...initial,
        observations: [{ ...initial.observations[0], status: "operational" }],
      },
      [service],
    ),
  );
});
test("registry reconciliation accepts additions and removals but rejects corruption", () => {
  const row = {
    serviceId: "website",
    status: "degraded",
    checkedAt: new Date(now).toISOString(),
    latencyMs: null,
    message: "Not monitored",
  };
  const day = {
    serviceId: "website",
    date: "2026-09-09",
    status: "operational",
    checks: 1,
    operationalChecks: 1,
  };
  const old = {
    schemaVersion: 2,
    generatedAt: new Date(now).toISOString(),
    observations: [row, { ...row, serviceId: "retired" }],
    history: [day, { ...day, serviceId: "retired" }],
    incidents: [],
  };
  const current = [service, { ...service, id: "added" }];
  assert.deepEqual(reconcilePrevious(old, current), [day]);
  assert.throws(() =>
    reconcilePrevious(
      { ...old, history: [{ ...day, status: "bogus" }] },
      current,
    ),
  );
  assert.throws(() =>
    reconcilePrevious(
      { ...old, history: [{ ...day, serviceId: "unrecorded" }] },
      current,
    ),
  );
  assert.throws(() =>
    reconcilePrevious({ ...old, observations: [row, row] }, current),
  );
  assert.throws(() =>
    reconcilePrevious(
      { ...old, history: [{ ...day, unexpected: "not allowed" }] },
      current,
    ),
  );
  assert.throws(() =>
    reconcilePrevious({ ...old, history: [day, day] }, current),
  );
});
