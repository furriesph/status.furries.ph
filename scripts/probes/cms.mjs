// CMS deliberately redirects signed-out HTML requests. Check that contract, not the destination page.
export async function probeCms(
  service,
  { fetchImpl = fetch, now = () => new Date(), timeoutMs = 10000 } = {},
) {
  const start = performance.now(),
    signal = AbortSignal.timeout(timeoutMs);
  const result = (status, message, evidence = "direct") => ({
    serviceId: service.id,
    status,
    message,
    evidence,
    checkedAt: now().toISOString(),
    latencyMs: Math.round(performance.now() - start),
  });
  try {
    const gate = await fetchImpl("https://cms.furries.ph/", {
      redirect: "manual",
      signal,
      headers: { Accept: "text/html" },
    });
    await gate.body?.cancel();
    if (gate.status === 429)
      return result("degraded", "CMS access gate is rate limited.");
    if (gate.status >= 500)
      return result("outage", "CMS access gate returned a server error.");
    if (
      gate.status !== 302 ||
      !["https://partners.furries.ph", "https://partners.furries.ph/"].includes(
        gate.headers.get("location"),
      ) ||
      !gate.headers.get("cache-control")?.includes("no-store")
    )
      return result(
        "degraded",
        "CMS signed-out access gate did not match its expected redirect and cache policy.",
      );
    const shell = await fetchImpl("https://cms.furries.ph/", {
      redirect: "manual",
      signal,
      headers: { Accept: "*/*" },
    });
    if (shell.status !== 200) {
      await shell.body?.cancel();
      return result(
        shell.status >= 500 ? "outage" : "degraded",
        `CMS shell returned HTTP ${shell.status}.`,
      );
    }
    const reader = shell.body?.getReader();
    if (!reader)
      return result(
        "unknown",
        "CMS shell content could not be checked.",
        "monitoring-gap",
      );
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1048576)
          return result(
            "unknown",
            "CMS shell exceeded the verification bound.",
            "monitoring-gap",
          );
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
    if (!text.toLowerCase().includes("sanity"))
      return result(
        "degraded",
        "CMS shell did not contain the expected application content.",
      );
    return result(
      "operational",
      "CMS signed-out access gate and Sanity shell responded as configured. Authenticated editing and SSO were not exercised.",
    );
  } catch {
    return result(
      "outage",
      "CMS gate or shell could not be reached within the request deadline.",
    );
  }
}
