import test from "node:test";
import assert from "node:assert/strict";
import { probeSanity } from "../scripts/probes/sanity.mjs";

const service = { id: "sanity-media-pools", check: { kind: "sanity", target: "media-pools" } };
const env = { SANITY_PROJECT_ID: "publicproj", SANITY_DATASET: "production", SANITY_API_VERSION: "2026-05-19" };
const now = () => new Date("2026-09-13T00:00:00Z");

test("Sanity media pools publish aggregate live counts and configured pool counters", async () => {
  let url;
  const result = await probeSanity(service, {
    env: { ...env, SANITY_ASSET_POOL_LIMIT_BYTES: "107374182400", SANITY_DOCUMENT_POOL_LIMIT: "10000" },
    now,
    fetchImpl: async (request) => {
      url = new URL(request);
      return new Response(JSON.stringify({ result: { images: 113, files: 1, documents: 114, imageBytes: 37813544, fileBytes: 8044 } }), {
        headers: { "content-type": "application/json", "ratelimit-limit": "500", "ratelimit-remaining": "497" },
      });
    },
  });
  assert.equal(result.status, "operational");
  assert.match(result.message, /113 image assets \/ 36\.06 MiB; 1 file assets \/ 7\.9 KiB; 114 documents/);
  assert.match(result.message, /shared assets 37821588 B \/ 107374182400 B \(0%\); documents 114 \/ 10000 \(1%\)/);
  assert.match(result.message, /Direct Content Lake API rate window: 3 \/ 500 used \(1%\); 497 remaining/);
  assert.equal(url.hostname, "publicproj.api.sanity.io");
  assert.equal(url.pathname, "/v2026-05-19/data/query/production");
  assert.match(url.searchParams.get("query"), /sanity\.imageAsset/);
});

test("Sanity does not invent plan allowances or a rate window", async () => {
  const result = await probeSanity(service, {
    env,
    now,
    fetchImpl: async () => Response.json({ result: { images: 1, files: 2, documents: 3, imageBytes: 4, fileBytes: 5 } }),
  });
  assert.match(result.message, /shared assets 9 B \/ unavailable; documents 3 \/ unavailable/);
  assert.match(result.message, /rate window is not exposed/);
});

test("Sanity missing settings and denied, oversized or malformed responses stay unknown", async () => {
  const cases = [
    { env: {}, fetchImpl: () => assert.fail() },
    { env, fetchImpl: async () => new Response("", { status: 403 }) },
    { env, fetchImpl: async () => Response.json({ result: { images: -1 } }) },
    { env, fetchImpl: async () => new Response("x".repeat(128 * 1024 + 1), { status: 200 }) },
  ];
  for (const options of cases) {
    const result = await probeSanity(service, { ...options, now });
    assert.equal(result.status, "unknown");
    assert.equal(result.evidence, "monitoring-gap");
  }
});

test("Sanity rate limits and upstream errors have meaningful states", async () => {
  const rateLimited = await probeSanity(service, { env, now, fetchImpl: async () => new Response("", { status: 429 }) });
  const unavailable = await probeSanity(service, { env, now, fetchImpl: async () => new Response("", { status: 503 }) });
  assert.equal(rateLimited.status, "degraded");
  assert.equal(unavailable.status, "outage");
});
