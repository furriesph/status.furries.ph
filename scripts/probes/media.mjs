// Exercises an existing public image through the platform proxy, never the storage origin.
export async function probeMedia(
  service,
  { fetchImpl = fetch, now = () => new Date(), timeoutMs = 10000 } = {},
) {
  const start = performance.now();
  const result = (status, message, evidence = "direct") => ({
    serviceId: service.id,
    status,
    message,
    evidence,
    checkedAt: now().toISOString(),
    latencyMs: Math.round(performance.now() - start),
  });
  try {
    const url = new URL(service.check.url);
    if (
      url.origin !== "https://api.furries.ph" ||
      !/^\/api\/img\/[a-zA-Z0-9._-]+$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      return result(
        "unknown",
        "Media probe configuration is invalid.",
        "monitoring-gap",
      );
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "image/*" },
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      return result(
        response.status >= 500
          ? "outage"
          : response.status === 429
            ? "degraded"
            : "unknown",
        `Public media proxy returned HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500
          ? "direct"
          : "monitoring-gap",
      );
    }
    if (
      !/^image\/(webp|png|jpeg)(?:;|$)/i.test(
        response.headers.get("content-type") ?? "",
      )
    ) {
      await response.body?.cancel();
      return result(
        "degraded",
        "Media proxy did not return the expected image format.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      return result(
        "unknown",
        "Media response could not be inspected.",
        "monitoring-gap",
      );
    const parts = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024)
          return result(
            "unknown",
            "Media response exceeded the verification bound.",
            "monitoring-gap",
          );
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const b = Buffer.concat(parts);
    const valid =
      (b.subarray(0, 4).toString() === "RIFF" &&
        b.subarray(8, 12).toString() === "WEBP") ||
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (b[0] === 255 && b[1] === 216 && b[2] === 255);
    if (!valid)
      return result(
        "degraded",
        "Media proxy returned an invalid image payload.",
      );
    return result(
      performance.now() - start > 3000 ? "degraded" : "operational",
      "Public media proxy delivered a verified image payload. Upload and protected-file workflows are not exercised.",
    );
  } catch {
    return result(
      "outage",
      "Public media delivery failed or exceeded its request deadline.",
    );
  }
}
