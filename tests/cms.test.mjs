import test from "node:test";
import assert from "node:assert/strict";
import { probeCms } from "../scripts/probes/cms.mjs";
test("CMS expects its signed-out redirect and independently verifies the shell", async () => {
  let calls = 0;
  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://cms.furries.ph/");
    assert.equal(init.redirect, "manual");
    calls++;
    return init.headers.Accept === "text/html"
      ? new Response(null, {
          status: 302,
          headers: {
            location: "https://partners.furries.ph",
            "cache-control": "no-store",
          },
        })
      : new Response("<html>Sanity</html>");
  };
  assert.equal(
    (await probeCms({ id: "cms" }, { fetchImpl })).status,
    "operational",
  );
  assert.equal(calls, 2);
});
test("CMS does not follow unexpected redirects or accept gate errors as healthy", async () => {
  for (const [status, expected] of [
    [302, "degraded"],
    [503, "outage"],
    [429, "degraded"],
  ]) {
    let calls = 0;
    const r = await probeCms(
      { id: "cms" },
      {
        fetchImpl: async () => {
          calls++;
          return new Response(null, {
            status,
            headers: { location: "https://example.com" },
          });
        },
      },
    );
    assert.equal(r.status, expected);
    assert.equal(calls, 1);
  }
});
