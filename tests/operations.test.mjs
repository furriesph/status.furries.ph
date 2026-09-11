import test from "node:test";
import assert from "node:assert/strict";
import {
  probeOperations,
  operationTargets,
} from "../scripts/probes/operations.mjs";
const now = () => new Date("2026-09-10T00:00:00Z");
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};
function fixture(fn = () => 0) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      assert.equal(options.method, "HEAD");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.prefer, "count=exact");
      assert.equal(options.body, undefined);
      calls.push(new URL(url));
      return new Response(null, {
        headers: { "content-range": `*/${fn(new URL(url))}` },
      });
    },
  };
}
const run = (target, options = {}) =>
  probeOperations(
    { id: target, check: { kind: "operations", target } },
    { now, env, ...options },
  );
test("quiet telemetry does not invent workflow uptime; requests are count-only", async () => {
  for (const target of operationTargets.filter(
    (t) => !["sms", "payments"].includes(t),
  )) {
    const f = fixture();
    const result = await run(target, f);
    assert.equal(result.status, "unknown", target);
    assert.equal(result.evidence, "monitoring-gap");
    assert.ok(f.calls.length);
  }
});
test("recent success on every email path establishes scoped dispatch evidence", async () => {
  const f = fixture((url) =>
    ["eq.sent", "eq.delivered"].includes(url.searchParams.get("status"))
      ? 1
      : 0,
  );
  const result = await run("email", f);
  assert.equal(result.status, "operational");
  assert.match(result.message, /not inbox delivery/);
});
test("failure and overdue work overrides recent queue successes", async () => {
  for (const match of ["eq.failed", "in.(pending,retry)"]) {
    const f = fixture((url) =>
      url.searchParams.get("status") === match ? 1 : 0,
    );
    assert.equal((await run("linked-messaging", f)).status, "degraded");
  }
});
test("null due dates use creation age and future scheduled work is not overdue", async () => {
  const f = fixture();
  await run("email", f);
  const due = f.calls
    .find((url) => url.searchParams.has("or"))
    .searchParams.get("or");
  assert.equal(
    due,
    "(next_attempt_at.lt.2026-09-09T23:45:00.000Z,and(next_attempt_at.is.null,created_at.lt.2026-09-09T23:45:00.000Z))",
  );
});
test("SMS missing live readiness is a measured degradation, not an unknown queue", async () => {
  const result = await run("sms", fixture());
  assert.equal(result.status, "degraded");
  assert.match(result.message, /0 fresh permitted online/);
});
test("LAN missing heartbeat on an active unexpired session is degraded", async () => {
  const f = fixture((url) =>
    url.pathname.endsWith("sessions") && !url.searchParams.has("last_seen_at")
      ? 1
      : 0,
  );
  assert.equal((await run("lan", f)).status, "degraded");
});
test("manual payment reconciliation remains operational without an external checkout provider", async () => {
  const result = await run(
    "payments",
    fixture(() => 1),
  );
  assert.equal(result.status, "operational");
  assert.match(result.message, /No hosted external checkout provider is configured/);
});
test("missing credentials, denied counts and malformed counts remain unknown and sanitized", async () => {
  assert.equal((await run("email", { env: {} })).status, "unknown");
  for (const response of [
    new Response(null, { status: 403 }),
    new Response(null, { headers: { "content-range": "*/invalid" } }),
  ]) {
    const result = await run("email", { fetchImpl: async () => response });
    assert.equal(result.status, "unknown");
    assert.doesNotMatch(
      JSON.stringify(result),
      /sb_secret_test|example.supabase/,
    );
  }
});

test("idle queues can use read-only bot identity readiness without sending", async () => {
  const calls = [];
  const result = await run("linked-messaging", {
    env: {
      ...env,
      TELEGRAM_BOT_TOKEN: "secret-telegram",
      DISCORD_BOT_TOKEN: "secret-discord",
    },
    fetchImpl: async (url, options) => {
      calls.push(options.method);
      if (options.method === "HEAD")
        return new Response(null, { headers: { "content-range": "*/0" } });
      assert.equal(options.method, "GET");
      const body = String(url).includes("telegram.org")
        ? { ok: true, result: { is_bot: true, id: 123 } }
        : { id: "private-bot-id", bot: true };
      return Response.json(body);
    },
  });
  assert.equal(result.status, "operational");
  assert.equal(calls.filter((method) => method === "GET").length, 2);
  assert.doesNotMatch(
    JSON.stringify(result),
    /secret-telegram|secret-discord|private-bot-id/,
  );
  assert.match(result.message, /not tested/);
});
test("Discord and Telegram readiness are reported independently", async () => {
  for (const [target, body, expected] of [
    ["discord", { id: "private-bot-id", bot: true }, "operational"],
    ["telegram", null, "unknown"],
  ]) {
    const result = await run(target, {
      env: {
        ...env,
        DISCORD_BOT_TOKEN: "secret-discord",
        TELEGRAM_BOT_TOKEN: "secret-telegram",
      },
      fetchImpl: async (url, options) => {
        if (options.method === "HEAD")
          return new Response(null, { headers: { "content-range": "*/0" } });
        return body ? Response.json(body) : new Response(null, { status: 401 });
      },
    });
    assert.equal(result.status, expected);
    assert.doesNotMatch(JSON.stringify(result), /secret|private-bot-id/);
  }
});
test("provider readiness rate limit remains degraded even when queues are idle", async () => {
  const result = await run("linked-messaging", {
    env: { ...env, TELEGRAM_BOT_TOKEN: "secret", DISCORD_BOT_TOKEN: "secret" },
    fetchImpl: async (_url, options) =>
      options.method === "HEAD"
        ? new Response(null, { headers: { "content-range": "*/0" } })
        : new Response(null, { status: 429 }),
  });
  assert.equal(result.status, "degraded");
});

test("denied collector credentials remain unknown despite successful receipt history", async () => {
  for (const status of [401, 403]) {
    const result = await run("linked-messaging", {
      env: {
        ...env,
        TELEGRAM_BOT_TOKEN: "secret",
        DISCORD_BOT_TOKEN: "secret",
      },
      fetchImpl: async (url, options) => {
        if (options.method === "GET") return new Response(null, { status });
        return new Response(null, {
          headers: {
            "content-range":
              new URL(url).searchParams.get("status") === "eq.delivered"
                ? "*/2"
                : "*/0",
          },
        });
      },
    });
    assert.equal(result.status, "unknown");
    assert.equal(result.evidence, "monitoring-gap");
    assert.match(result.message, /production credential parity is unverified/);
    assert.match(result.message, /4 successful/);
  }
});
