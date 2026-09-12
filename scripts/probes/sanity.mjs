// Server-only public Content Lake aggregate. Asset identifiers and documents
// never leave this probe; only aggregate media counts and byte totals publish.
const MAX_BODY = 128 * 1024;

function settings(env) {
  const project = env.SANITY_PROJECT_ID;
  const dataset = env.SANITY_DATASET;
  const version = env.SANITY_API_VERSION || "2026-05-19";
  if (
    typeof project !== "string" ||
    !/^[a-z0-9]{8,32}$/i.test(project) ||
    typeof dataset !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(dataset) ||
    typeof version !== "string" ||
    !/^v?20\d\d-\d\d-\d\d$/.test(version)
  )
    return null;
  return { project, dataset, version: version.startsWith("v") ? version : `v${version}` };
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing body");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new Error("oversized body");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const whole = (value) => Number.isSafeInteger(value) && value >= 0;
const positiveWhole = (value) => Number.isSafeInteger(value) && value > 0;
const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
};

function configuredPoolLimits(env) {
  const assetBytes = Number(env.SANITY_ASSET_POOL_LIMIT_BYTES);
  const documents = Number(env.SANITY_DOCUMENT_POOL_LIMIT);
  return {
    assetBytes: positiveWhole(assetBytes) ? assetBytes : null,
    documents: positiveWhole(documents) ? documents : null,
  };
}

function rateWindow(headers) {
  const remaining = Number(
    headers.get("ratelimit-remaining") ?? headers.get("x-ratelimit-remaining"),
  );
  const limit = Number(
    headers.get("ratelimit-limit") ?? headers.get("x-ratelimit-limit"),
  );
  if (!positiveWhole(limit) || !whole(remaining) || remaining > limit) return null;
  return { limit, remaining };
}

export async function probeSanity(
  service,
  { fetchImpl = fetch, env = process.env, now = () => new Date(), timeoutMs = 10000 } = {},
) {
  const started = performance.now();
  const result = (status, message, evidence = "direct") => ({
    serviceId: service.id,
    status,
    checkedAt: now().toISOString(),
    latencyMs: Math.round(performance.now() - started),
    message,
    evidence,
  });
  const config = settings(env);
  if (!config)
    return result("unknown", "Sanity media-pool monitoring needs a valid project, dataset and API version.", "monitoring-gap");
  const query = '{"images":count(*[_type == "sanity.imageAsset"]),"files":count(*[_type == "sanity.fileAsset"]),"documents":count(*[]),"imageBytes":math::sum(*[_type == "sanity.imageAsset"].size),"fileBytes":math::sum(*[_type == "sanity.fileAsset"].size)}';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(
      `https://${config.project}.api.sanity.io/${config.version}/data/query/${config.dataset}`,
    );
    url.searchParams.set("query", query);
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status === 429) {
      await response.body?.cancel();
      return result("degraded", "Sanity is rate limiting the media-pool aggregate query (HTTP 429).");
    }
    if (response.status >= 500) {
      await response.body?.cancel();
      return result("outage", "Sanity returned a server error while reading media-pool aggregates.");
    }
    if (!response.ok) {
      await response.body?.cancel();
      return result("unknown", "Sanity media-pool monitoring access failed; check collector configuration.", "monitoring-gap");
    }
    const data = (await boundedJson(response)).result;
    if (!data || ![data.images, data.files, data.documents, data.imageBytes, data.fileBytes].every(whole))
      throw new Error("invalid aggregate");
    const limits = configuredPoolLimits(env);
    const assets = data.imageBytes + data.fileBytes;
    const assetQuota = limits.assetBytes
      ? `shared assets ${assets} B / ${limits.assetBytes} B (${Math.round((assets / limits.assetBytes) * 100)}%)`
      : `shared assets ${assets} B / unavailable`;
    const documentQuota = limits.documents
      ? `documents ${data.documents} / ${limits.documents} (${Math.round((data.documents / limits.documents) * 100)}%)`
      : `documents ${data.documents} / unavailable`;
    const window = rateWindow(response.headers);
    const rateSummary = window
      ? `Direct Content Lake API rate window: ${window.limit - window.remaining} / ${window.limit} used (${Math.round(((window.limit - window.remaining) / window.limit) * 100)}%); ${window.remaining} remaining.`
      : "Direct Content Lake API rate window is not exposed by the provider response.";
    return result(
      "operational",
      `Live Sanity Content Lake media pools: ${data.images} image assets / ${formatBytes(data.imageBytes)}; ${data.files} file assets / ${formatBytes(data.fileBytes)}; ${data.documents} documents. Live media-pool quotas: ${assetQuota}; ${documentQuota}. ${rateSummary}`,
    );
  } catch {
    return result("unknown", "Sanity media-pool aggregates could not be verified; request failed, timed out, or returned invalid data.", "monitoring-gap");
  } finally {
    clearTimeout(timer);
  }
}
