import type {
  DailyHistory,
  Incident,
  Observation,
  Service,
  Snapshot,
  Status,
} from "./types";

export const STALE_MS = 15 * 60 * 1000;
export const labels: Record<Status, string> = {
  operational: "Operational",
  unknown: "Unknown",
  degraded: "Degraded",
  outage: "Outage",
  maintenance: "Maintenance",
  not_launched: "Not launched",
};
export const severity: Record<Status, number> = {
  operational: 0,
  unknown: 1,
  not_launched: 1,
  maintenance: 2,
  degraded: 3,
  outage: 4,
};
function publicUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return value;
  } catch {
    /* Invalid configuration uses local data. */
  }
  return fallback;
}
export const statusUrl = publicUrl(
  import.meta.env.VITE_STATUS_URL,
  "/status.json",
);
export const feedUrl = publicUrl(import.meta.env.VITE_FEED_URL, "/feed.xml");
export const emptySnapshot: Snapshot = {
  schemaVersion: 2,
  generatedAt: null,
  observations: [],
  history: [],
  incidents: [],
};
const isDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
export function parseSnapshot(value: unknown, services: Service[]): Snapshot {
  const ids = new Set(services.map((service) => service.id));
  function observation(v: unknown): v is Observation {
    return (
      isObject(v) &&
      typeof v.serviceId === "string" &&
      ids.has(v.serviceId) &&
      typeof v.status === "string" &&
      Object.hasOwn(labels, v.status) &&
      isDate(v.checkedAt) &&
      (v.latencyMs === null ||
        (typeof v.latencyMs === "number" &&
          Number.isFinite(v.latencyMs) &&
          v.latencyMs >= 0)) &&
      typeof v.message === "string" &&
      (v.evidence === undefined ||
        ["direct", "dependency", "monitoring-gap"].includes(String(v.evidence)))
    );
  }
  function incident(v: unknown): v is Incident {
    return (
      isObject(v) &&
      typeof v.id === "string" &&
      typeof v.title === "string" &&
      [
        "investigating",
        "identified",
        "monitoring",
        "resolved",
        "scheduled",
      ].includes(String(v.status)) &&
      ["operational", "degraded", "outage", "maintenance"].includes(String(v.impact)) &&
      Array.isArray(v.serviceIds) &&
      v.serviceIds.length > 0 &&
      v.serviceIds.every((id) => typeof id === "string" && ids.has(id)) &&
      isDate(v.startedAt) &&
      (v.resolvedAt === undefined || isDate(v.resolvedAt)) &&
      (v.endsAt === undefined || isDate(v.endsAt)) &&
      Array.isArray(v.updates) &&
      v.updates.length > 0 &&
      v.updates.every(
        (update) =>
          isObject(update) &&
          isDate(update.at) &&
          typeof update.message === "string",
      )
    );
  }
  function daily(v: unknown): v is DailyHistory {
    return (
      isObject(v) &&
      typeof v.serviceId === "string" &&
      ids.has(v.serviceId) &&
      typeof v.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
      isDate(`${v.date}T00:00:00Z`) &&
      typeof v.status === "string" &&
      Object.hasOwn(labels, v.status) &&
      typeof v.checks === "number" &&
      Number.isSafeInteger(v.checks) &&
      v.checks > 0 &&
      typeof v.operationalChecks === "number" &&
      Number.isSafeInteger(v.operationalChecks) &&
      v.operationalChecks >= 0 &&
      v.operationalChecks <= v.checks &&
      (v.status === "operational") === (v.checks === v.operationalChecks)
    );
  }
  if (
    !isObject(value) ||
    value.schemaVersion !== 2 ||
    !(value.generatedAt === null || isDate(value.generatedAt)) ||
    !Array.isArray(value.observations) ||
    !value.observations.every(observation) ||
    !Array.isArray(value.history) ||
    !value.history.every(daily) ||
    !Array.isArray(value.incidents) ||
    !value.incidents.every(incident) ||
    new Set(value.observations.map((o) => o.serviceId)).size !==
      value.observations.length ||
    new Set(value.history.map((o) => `${o.serviceId}:${o.date}`)).size !==
      value.history.length
  )
    throw new Error("The status feed is invalid.");
  return value as unknown as Snapshot;
}
export function isFresh(at: string | null, now: number) {
  const time = at ? Date.parse(at) : NaN;
  return (
    Number.isFinite(time) && now - time <= STALE_MS && time <= now + 60_000
  );
}
export function activeIncident(incident: Incident, now: number) {
  if (incident.status === "resolved" || Date.parse(incident.startedAt) > now)
    return false;
  return (
    incident.status !== "scheduled" ||
    !incident.endsAt ||
    Date.parse(incident.endsAt) > now
  );
}
export function serviceStatus(
  service: Service,
  snapshot: Snapshot,
  now: number,
  unavailable = false,
): Status {
  const observation = snapshot.observations.find(
    (o) => o.serviceId === service.id,
  );
  let status: Status =
    !unavailable &&
    isFresh(snapshot.generatedAt, now) &&
    observation &&
    isFresh(observation.checkedAt, now)
      ? observation.evidence === "monitoring-gap"
        ? "unknown"
        : observation.status
      : "unknown";
  for (const incident of snapshot.incidents)
    if (
      incident.serviceIds.includes(service.id) &&
      activeIncident(incident, now) &&
      severity[incident.impact] > severity[status]
    )
      status = incident.impact;
  return status;
}
export function dailyHistory(
  history: DailyHistory[],
  serviceId: string,
  now: number,
) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 30 }, (_, index) => {
    const start = today.getTime() - (29 - index) * 86_400_000;
    const date = new Date(start).toISOString().slice(0, 10);
    const day = history.find(
      (o) => o.serviceId === serviceId && o.date === date,
    );
    return {
      date,
      status: day?.status ?? null,
      samples: day?.checks ?? 0,
      operationalChecks: day?.operationalChecks ?? 0,
    };
  });
}

export function monitoringGap(
  service: Service,
  snapshot: Snapshot,
  now: number,
  unavailable = false,
): string | null {
  if (unavailable)
    return "Monitoring failure: the current status feed could not be verified.";
  if (!isFresh(snapshot.generatedAt, now))
    return "Monitoring failure: status updates are missing or older than 15 minutes.";
  const observation = snapshot.observations.find(
    (item) => item.serviceId === service.id,
  );
  if (!observation || !isFresh(observation.checkedAt, now))
    return "Monitoring failure: a fresh service check is missing.";
  return observation.evidence === "monitoring-gap" || observation.status === "unknown" ? observation.message : null;
}
