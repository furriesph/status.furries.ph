const urls = {
  supabase: "https://status.supabase.com/api/v2/summary.json",
  cloudflare: "https://www.cloudflarestatus.com/api/v2/summary.json",
};
const map = {
  operational: "operational",
  degraded_performance: "degraded",
  partial_outage: "degraded",
  major_outage: "outage",
  under_maintenance: "maintenance",
};
const providerImpact = {
  none: "operational",
  minor: "degraded",
  major: "outage",
  critical: "outage",
  maintenance: "maintenance",
};
const severity = { operational: 0, maintenance: 1, degraded: 2, outage: 3 };
const incidentStatus = new Set([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "scheduled",
]);

function publicText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return text && text.length <= 180 ? text : fallback;
}

function timestamp(value, fallback) {
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function currentStatus(value) {
  if (incidentStatus.has(value)) return value;
  return value === "postmortem" ? "resolved" : "investigating";
}

function incidentImpact(incident) {
  const value =
    providerImpact[incident.impact] ??
    map[incident.impact] ??
    map[incident.status];
  if (value) return value;
  return currentStatus(incident.status) === "resolved" ? "operational" : "degraded";
}

export function providerIncidents(service, data, checkedAt) {
  if (!Array.isArray(data.incidents)) return [];
  const provider = service.check.provider;
  const providerName = provider === "supabase" ? "Supabase" : "Cloudflare";
  return data.incidents.flatMap((incident) => {
    if (!incident || typeof incident !== "object") return [];
    const impact = incidentImpact(incident);
    const id = publicText(incident.id, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (!id) return [];
    const startedAt = timestamp(incident.started_at ?? incident.created_at, checkedAt);
    const updatedAt = timestamp(incident.updated_at, startedAt);
    const status = currentStatus(incident.status);
    const resolvedAt = status === "resolved" && incident.resolved_at
      ? timestamp(incident.resolved_at, checkedAt)
      : undefined;
    return [{
      id: `provider-${provider}-${id}`,
      title: `${providerName} provider incident: ${publicText(incident.name, "Provider-reported service impact")}`,
      status,
      impact,
      serviceIds: [service.id],
      startedAt,
      ...(resolvedAt ? { resolvedAt } : {}),
      updates: [{
        at: resolvedAt ?? updatedAt,
        message: `${providerName}'s public status feed reports ${impact} provider-wide impact. This is automated provider evidence and does not by itself confirm impact to every Furries PH workflow.`,
      }],
    }];
  });
}

function isGeneratedProviderIncident(incident) {
  return /^provider-(supabase|cloudflare)-[a-z0-9]/.test(incident?.id ?? "");
}

/**
 * Preserve provider-reported incident history. A missing record resolves only
 * after a successful feed read for its provider service, never after a timeout.
 */
export function reconcileProviderIncidents(previous, syncs, nowIso) {
  const successfulServices = new Set(
    syncs.filter((sync) => sync.complete).map((sync) => sync.serviceId),
  );
  const current = new Map(
    syncs.flatMap((sync) => (sync.complete ? sync.incidents : []))
      .map((incident) => [incident.id, incident]),
  );
  const output = [];
  for (const incident of previous.filter(isGeneratedProviderIncident)) {
    const replacement = current.get(incident.id);
    if (replacement) {
      output.push(replacement);
      current.delete(incident.id);
      continue;
    }
    if (
      incident.status !== "resolved" &&
      successfulServices.has(incident.serviceIds[0])
    ) {
      output.push({
        ...incident,
        status: "resolved",
        resolvedAt: nowIso,
        updates: [
          ...incident.updates,
          {
            at: nowIso,
            message: "The provider's public status feed no longer lists this incident. It is retained as resolved provider history; direct application impact remains separately monitored.",
          },
        ],
      });
    } else output.push(incident);
  }
  output.push(...current.values());
  return output.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export async function probeProvider(
  service,
  { fetchImpl = fetch, now = () => new Date(), timeoutMs = 10000 } = {},
) {
  const observation = {
    serviceId: service.id,
    status: "unknown",
    checkedAt: now().toISOString(),
    latencyMs: null,
    message: "Provider monitoring is unavailable.",
    evidence: "monitoring-gap",
  };
  const start = performance.now();
  try {
    if (!urls[service.check.provider]) return observation;
    const response = await fetchImpl(urls[service.check.provider], {
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    observation.latencyMs = Math.round(performance.now() - start);
    if (!response.ok) {
      await response.body?.cancel();
      return {
        ...observation,
        message:
          response.status === 429
            ? "Provider status feed is rate limited; incident visibility is degraded."
            : "Provider status feed did not return a successful response.",
      };
    }
    const reader = response.body?.getReader();
    if (!reader) return observation;
    let text = "",
      bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 2_000_000)
          return {
            ...observation,
            message: "Provider monitoring returned an oversized response.",
          };
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
    const data = JSON.parse(text);
    const providerIncidentSync = Array.isArray(data.incidents)
      ? providerIncidents(service, data, observation.checkedAt)
      : undefined;
    if (!Array.isArray(data.components) || !service.check.components?.length)
      return providerIncidentSync
        ? { ...observation, providerIncidentSync }
        : observation;
    const selected = service.check.components.map((name) =>
      data.components.find((component) => component.name === name),
    );
    if (
      selected.some(
        (component) => !component || !Object.hasOwn(map, component.status),
      )
    )
      return {
        ...observation,
        ...(providerIncidentSync ? { providerIncidentSync } : {}),
        message:
          "Provider monitoring is missing an expected component or reports an unsupported state.",
      };
    const status = selected.reduce(
      (worst, component) =>
        severity[map[component.status]] > severity[worst]
          ? map[component.status]
          : worst,
      "operational",
    );
    const affected = selected
      .filter((component) => component.status !== "operational")
      .map((component) => component.name);
    return {
      ...observation,
      status,
      evidence: "dependency",
      ...(providerIncidentSync ? { providerIncidentSync } : {}),
      message: affected.length
        ? `Provider reports ${status} for ${affected.join(", ")}. This is provider-wide evidence, not confirmation of project impact.`
        : "Selected provider components report operational. Project-specific checks are evaluated separately.",
    };
  } catch {
    return {
      ...observation,
      latencyMs: Math.round(performance.now() - start),
      message: "Provider monitoring could not be read within its deadline.",
    };
  }
}
