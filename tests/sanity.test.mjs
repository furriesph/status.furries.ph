import test from "node:test";
import assert from "node:assert/strict";
import { probeSanity } from "../scripts/probes/sanity.mjs";

const service = { id: "sanity-media-pools", check: { kind: "sanity", target: "media-pools" } };
const env = { SANITY_PROJECT_ID: "publicproj", SANITY_DATASET: "production", SANITY_API_VERSION: "2026-05-19" };
const now = () => new Date("2026-09-13T00:00:00Z");

test("Sanity media pools publish only aggregate live counts", async () => {
  let url;
  const result = await probeSanity(service, {
    env,
    now,
    fetchImpl: async (request) => {
      url = new URL(request);
      return Response.json({ result: { images: 113, files: 1, documents: 114, imageBytes: 37813544, fileBytes: 8044 } });
    },
  });
  assert.equal(result.status, "operational");
  assert.match(result.message, /113 image assets \/ 36\.06 MiB; 1 file assets \/ 7\.9 KiB; 114 documents/);
  assert.equal(url.hostname, "publicproj.api.sanity.io");
  assert.equal(url.pathname, "/v2026-05-19/data/query/production");
  assert.match(url.searchParams.get("query"), /sanity\.imageAsset/);
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
