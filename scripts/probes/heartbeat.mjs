const states = ["operational", "degraded", "outage", "maintenance"];
export function probeHeartbeat(
  service,
  { signals = [], now = () => new Date() } = {},
) {
  const current = now();
  const base = {
    serviceId: service.id,
    status: "unknown",
    checkedAt: current.toISOString(),
    latencyMs: null,
    message:
      "Health is unknown: a recent service health signal has not been received.",
    evidence: "monitoring-gap",
  };
  const matches = Array.isArray(signals)
    ? signals.filter((signal) => signal?.serviceId === service.check.signal)
    : [];
  if (matches.length !== 1) return base;
  const signal = matches[0];
  const stamp = Date.parse(signal.checkedAt);
  if (
    !states.includes(signal.status) ||
    !Number.isFinite(stamp) ||
    stamp > current.valueOf() ||
    current.valueOf() - stamp > 15 * 60000 ||
    typeof signal.message !== "string" ||
    !signal.message.trim() ||
    signal.message.length > 500 ||
    /https?:\/\/|bearer\s|eyJ[A-Za-z0-9_-]{8}|sb_secret_|sk_live_|[\w.+-]+@[\w.-]+\.[a-z]{2}/i.test(
      signal.message,
    )
  )
    return {
      ...base,
      message:
        "Health is unknown: the supplied health signal is expired or invalid.",
    };
  // Only reviewed, public-safe, short summaries enter the status feed. Never copy arbitrary fields.
  return {
    ...base,
    status: signal.status,
    checkedAt: signal.checkedAt,
    message: `A recent service-owned health check reports ${signal.status}.`,
    evidence: "direct",
  };
}
