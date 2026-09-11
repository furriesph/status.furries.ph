import test from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORM_TARGETS,
  probePlatform,
} from "../scripts/probes/platform.mjs";
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_PRIVATE",
};
const service = (target) => ({
  id: target,
  check: { kind: "platform", target },
});
test("all platform domains perform reviewed bounded data reads with explicit scope", async () => {
  for (const [target, config] of Object.entries(PLATFORM_TARGETS)) {
    let count = 0;
    const result = await probePlatform(service(target), {
      env,
      fetchImpl: async (url, init) => {
        count++;
        assert.equal(init.method, "GET");
        assert.equal(init.redirect, "error");
        if (url.hostname === "example.supabase.co") {
          assert.equal(url.search, "?select=id&limit=1");
          assert.equal(init.headers.apikey, env.SUPABASE_SECRET_KEY);
          assert.ok(
            config.tables.some((t) => url.pathname === `/rest/v1/${t}`),
          );
          return Response.json([{ id: "PRIVATE-ROW" }]);
        }
        assert.equal(url.hostname, "api.furries.ph");
        assert.equal(init.headers.apikey, undefined);
        assert.equal(init.headers.authorization, undefined);
        return Response.json(config.listKey ? { [config.listKey]: [] } : []);
      },
    });
    assert.equal(
      count,
      config.tables.length + Number(Boolean(config.publicPath)),
    );
    assert.equal(result.status, "operational");
    assert.match(result.message, /not exercised/);
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  }
});
test("no evidence stays unknown; remote failures and throttling stay explicit", async () => {
  for (const [status, expected] of [
    [401, "unknown"],
    [404, "unknown"],
    [302, "unknown"],
    [429, "degraded"],
    [503, "outage"],
  ]) {
    const result = await probePlatform(service("assets"), {
      env,
      fetchImpl: async () => new Response("PRIVATE", { status }),
    });
    assert.equal(result.status, expected);
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  }
  assert.equal(
    (await probePlatform(service("assets"), { env: {} })).status,
    "unknown",
  );
  assert.equal(
    (await probePlatform(service("__proto__"), { env })).status,
    "unknown",
  );
});
test("malformed, excessive and unbounded data never passes", async () => {
  for (const body of [
    "{}",
    "[{}]",
    '[{"id":"1"},{"id":"2"}]',
    "<html>PRIVATE</html>",
    "x".repeat(1024 * 1024 + 1),
  ]) {
    const result = await probePlatform(service("assets"), {
      env,
      fetchImpl: async () => new Response(body),
    });
    assert.equal(result.status, "unknown");
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  }
});
test("network errors and deadlines are sanitized", async () => {
  const result = await probePlatform(service("assets"), {
    env,
    fetchImpl: async () => {
      throw Error("PRIVATE");
    },
  });
  assert.equal(result.status, "unknown");
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  const timed = await probePlatform(service("assets"), {
    env,
    timeoutMs: 5,
    fetchImpl: async (_, init) =>
      new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(Error("PRIVATE"))),
      ),
  });
  assert.equal(timed.status, "unknown");
});
