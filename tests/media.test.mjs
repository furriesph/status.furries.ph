import test from "node:test";
import assert from "node:assert/strict";
import { probeMedia } from "../scripts/probes/media.mjs";
const s = {
  id: "media",
  check: { url: "https://api.furries.ph/api/img/test.webp" },
};
test("media checks image payload and HTTP failures without exposing body", async () => {
  const valid = () =>
    new Response(Buffer.from("RIFF0000WEBPpayload"), {
      headers: { "content-type": "image/webp" },
    });
  assert.equal(
    (await probeMedia(s, { fetchImpl: async () => valid() })).status,
    "operational",
  );
  for (const code of [429, 503]) {
    const r = await probeMedia(s, {
      fetchImpl: async () => new Response("private", { status: code }),
    });
    assert.equal(r.status, code === 429 ? "degraded" : "outage");
    assert.ok(!r.message.includes("private"));
  }
  assert.equal(
    (
      await probeMedia(s, {
        fetchImpl: async () =>
          new Response("not image", {
            headers: { "content-type": "image/webp" },
          }),
      })
    ).status,
    "degraded",
  );
  assert.equal(
    (
      await probeMedia(
        { ...s, check: { url: "https://example.com/a" } },
        {
          fetchImpl: async () => {
            throw Error("must not fetch");
          },
        },
      )
    ).status,
    "unknown",
  );
});
