import { Activity, ChevronDown, ExternalLink, Gauge, Stethoscope } from "lucide-react";
import {
  activeIncident,
  dailyHistory,
  labels,
  monitoringGap,
  serviceStatus,
} from "../lib/status";
import type { Service, Snapshot } from "../lib/types";

const FRESHNESS_WINDOW_MS = 15 * 60_000;
const SLOW_RESPONSE_MS = 3_000;

type Metric = {
  label: string;
  value: string;
  percent: number | null;
  note: string;
  tone?: "good" | "watch" | "bad" | "neutral";
};

export function ServiceRow({
  service,
  snapshot,
  now,
  unavailable,
}: {
  service: Service;
  snapshot: Snapshot;
  now: number;
  unavailable: boolean;
}) {
  const status = serviceStatus(service, snapshot, now, unavailable);
  const observation = snapshot.observations.find(
    (o) => o.serviceId === service.id,
  );
  const gap = monitoringGap(service, snapshot, now, unavailable);
  const incidents = snapshot.incidents.filter(
    (incident) =>
      incident.serviceIds.includes(service.id) && activeIncident(incident, now),
  );
  const scope = checkScope(service);
  const days = dailyHistory(snapshot.history, service.id, now);
  const sampleCount = days.reduce((sum, day) => sum + day.samples, 0);
  const success = sampleCount
    ? (days.reduce((sum, day) => sum + day.operationalChecks, 0) /
        sampleCount) *
      100
    : null;
  const metrics = serviceMetrics(service, observation, success, now);
  const diagnosis = diagnose(service, observation?.message, status, gap);
  return (
    <details className="service-row">
      <summary>
        <div className="service-copy">
          <h3>{service.name}</h3>
          <p>{service.description}</p>
        </div>
        <span className={`status-label ${status}`}>
          <i />
          {labels[status]}
        </span>
        <div
          className="history-mini"
          aria-label="30 days of observed status; expand for details"
        >
          <div className="bars">
            {days.map((day) => (
              <span
                key={day.date}
                className={`bar ${day.status ?? "no-data"}`}
                title={`${day.date} UTC: ${day.status ? labels[day.status] : "No data"}, ${day.samples} checks`}
              />
            ))}
          </div>
          <div className="history-axis">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
        <ChevronDown className="disclosure" size={16} aria-hidden="true" />
      </summary>
      <div className="service-detail">
        <section className="diagnostic-intro">
          <span className="diagnostic-kicker"><Activity size={14} /> What is measured</span>
          <p>{scope}</p>
        </section>
        {gap && <p className="notice">{gap}</p>}
        {incidents.map((incident) => (
          <p className="notice" key={incident.id}>
            Active{" "}
            {incident.status === "scheduled" ? "maintenance" : "incident"}:{" "}
            {incident.title}
          </p>
        ))}
        <section className="signal-panel" aria-label={`${service.name} live signals`}>
          <div className="signal-panel-heading">
            <div>
              <span className="diagnostic-kicker"><Gauge size={14} /> Live signals</span>
              <p>Progress uses observed limits and windows only; an unavailable quota is never estimated.</p>
            </div>
            <span>Updated {observation ? formatAge(now - Date.parse(observation.checkedAt)) : "never"}</span>
          </div>
          <div className="metric-list">
            {metrics.map((metric) => (
              <MetricBar key={metric.label} metric={metric} />
            ))}
          </div>
        </section>
        <section className="diagnosis-panel" aria-label={`${service.name} diagnosis`}>
          <span className="diagnostic-kicker"><Stethoscope size={14} /> Diagnosis</span>
          <dl>
            <div>
              <dt>Observed evidence</dt>
              <dd>{diagnosis.evidence}</dd>
            </div>
            <div>
              <dt>Possible causes</dt>
              <dd>{diagnosis.causes}</dd>
            </div>
            <div>
              <dt>Next check</dt>
              <dd>{diagnosis.next}</dd>
            </div>
          </dl>
        </section>
        <p className="fine">
          Sample success is not time-based uptime. Gaps between checks are
          unobserved. History days use UTC.
        </p>
        {service.url && (
          <a href={service.url} target="_blank" rel="noreferrer">
            Open service <ExternalLink size={13} />
          </a>
        )}
        <details className="daily-details">
          <summary>Daily check history</summary>
          <div className="daily-grid">
            {days
              .slice()
              .reverse()
              .map((day) => (
                <div key={day.date}>
                  <time>{day.date}</time>
                  <span className={day.status ?? "no-data"}>
                    {day.status ? labels[day.status] : "No data"}
                  </span>
                  <span>{day.samples} checks</span>
                </div>
              ))}
          </div>
        </details>
      </div>
    </details>
  );
}

function MetricBar({ metric }: { metric: Metric }) {
  const percent = metric.percent === null ? null : Math.round(metric.percent);
  return (
    <div className={`metric-bar ${metric.tone ?? "neutral"}`}>
      <div className="metric-copy">
        <strong>{metric.label}</strong>
        <span>{metric.value}</span>
      </div>
      {percent === null ? (
        <div className="metric-track unavailable" aria-label={`${metric.label}: ${metric.value}`}>
          <i />
        </div>
      ) : (
        <div
          className="metric-track"
          role="progressbar"
          aria-label={metric.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.max(0, percent))}
          aria-valuetext={metric.value}
        >
          <i style={{ width: `${Math.min(100, Math.max(1, percent))}%` }} />
        </div>
      )}
      <p>{metric.note}</p>
    </div>
  );
}

function serviceMetrics(
  service: Service,
  observation: Snapshot["observations"][number] | undefined,
  success: number | null,
  now: number,
): Metric[] {
  const metrics: Metric[] = [];
  if (observation) {
    const age = Math.max(0, now - Date.parse(observation.checkedAt));
    metrics.push({
      label: "Freshness window",
      value: `${formatAge(age)} of 15 min`,
      percent: (age / FRESHNESS_WINDOW_MS) * 100,
      note: age < FRESHNESS_WINDOW_MS ? "Fresh observation." : "Observation is stale; health is no longer current.",
      tone: age < FRESHNESS_WINDOW_MS * 0.8 ? "good" : "watch",
    });
    if (observation.latencyMs != null) {
      metrics.push({
        label: "Response-time budget",
        value: `${Math.round(observation.latencyMs).toLocaleString()} ms of ${SLOW_RESPONSE_MS.toLocaleString()} ms`,
        percent: (observation.latencyMs / SLOW_RESPONSE_MS) * 100,
        note: observation.latencyMs < SLOW_RESPONSE_MS ? "Within the collector slow-response threshold." : "At or beyond the collector slow-response threshold.",
        tone: observation.latencyMs < SLOW_RESPONSE_MS * 0.8 ? "good" : observation.latencyMs < SLOW_RESPONSE_MS ? "watch" : "bad",
      });
    }
  }
  if (success !== null)
    metrics.push({
      label: "Observed success · 30 days",
      value: `${success.toFixed(2)}%`,
      percent: success,
      note: "Recorded checks only; this is not continuous uptime.",
      tone: success >= 99 ? "good" : success >= 95 ? "watch" : "bad",
    });
  metrics.push(...productMetrics(service, observation?.message ?? ""));
  return metrics;
}

function productMetrics(service: Service, message: string): Metric[] {
  if (service.id === "supabase-product-limits") {
    const disk = /database disk [^()]+\((\d+)%\)/i.exec(message);
    const connections = /connection pool (\d+)\s*\/\s*(\d+)\s*\((\d+)%\)/i.exec(message);
    const pooler = /(\d+)\s*\/\s*(\d+) pooler client connections/i.exec(message);
    const authUsers = /(\d+) Auth users/i.exec(message);
    const realtime = /(\d+) active Realtime subscriptions/i.exec(message);
    return [
      disk && {
        label: "Database disk",
        value: disk[0].replace(/^database disk /i, ""),
        percent: Number(disk[1]),
        note: "Live database filesystem capacity.",
        tone: capacityTone(Number(disk[1])),
      },
      connections && {
        label: "Database connections",
        value: `${connections[1]} / ${connections[2]}`,
        percent: Number(connections[3]),
        note: "Busiest observed database connection pool.",
        tone: capacityTone(Number(connections[3])),
      },
      pooler && {
        label: "Pooler clients",
        value: `${pooler[1]} / ${pooler[2]}`,
        percent: (Number(pooler[1]) / Number(pooler[2])) * 100,
        note: "Live client connections through the database pooler.",
        tone: capacityTone((Number(pooler[1]) / Number(pooler[2])) * 100),
      },
      authUsers && {
        label: "Auth users",
        value: authUsers[1],
        percent: null,
        note: "Current user count; plan MAU allowance is unavailable to the collector.",
        tone: "neutral" as const,
      },
      realtime && {
        label: "Realtime subscriptions",
        value: realtime[1],
        percent: null,
        note: "Live active subscriptions. A plan allowance is unavailable to the collector.",
        tone: "neutral" as const,
      },
    ].filter(Boolean) as Metric[];
  }
  if (service.id === "request-limits") {
    const monthly = /Monthly account requests:\s*(\d+)\s*\/\s*(\d+)/i.exec(message);
    const daily = /Daily account Worker requests:\s*(\d+)/i.exec(message);
    const zone = /Last 15 minutes across the zone:\s*(\d+) responses,\s*(\d+) HTTP 429,\s*(\d+) HTTP 5xx/i.exec(message);
    const inventory = /Live Cloudflare account inventory:\s*(\d+) Worker scripts,\s*(\d+) Pages projects,\s*(\d+) KV namespaces,\s*(\d+) R2 buckets and\s*(\d+) Durable Object namespaces;\s*(\d+) D1 databases and\s*(\d+) Queues/i.exec(message);
    return [
      monthly && {
        label: "Workers Standard monthly inclusion",
        value: `${Number(monthly[1]).toLocaleString()} / ${Number(monthly[2]).toLocaleString()} requests`,
        percent: (Number(monthly[1]) / Number(monthly[2])) * 100,
        note: "Included-use threshold. Standard has no daily hard request cap.",
        tone: capacityTone((Number(monthly[1]) / Number(monthly[2])) * 100),
      },
      daily && {
        label: "Worker requests today",
        value: Number(daily[1]).toLocaleString(),
        percent: null,
        note: "Observed UTC-day use. No Cloudflare daily hard request cap on Workers Standard.",
        tone: "neutral" as const,
      },
      zone && {
        label: "Zone responses · 15 min",
        value: Number(zone[1]).toLocaleString(),
        percent: null,
        note: "Cloudflare response-count analytics for the monitored zone.",
        tone: "neutral" as const,
      },
      zone && {
        label: "Rate-limited responses · 15 min",
        value: Number(zone[2]).toLocaleString(),
        percent: Number(zone[1]) ? (Number(zone[2]) / Number(zone[1])) * 100 : 0,
        note: "HTTP 429 responses observed by Cloudflare across the monitored zone.",
        tone: Number(zone[2]) ? "bad" as const : "good" as const,
      },
      zone && {
        label: "Server errors · 15 min",
        value: Number(zone[3]).toLocaleString(),
        percent: Number(zone[1]) ? (Number(zone[3]) / Number(zone[1])) * 100 : 0,
        note: "HTTP 5xx responses observed by Cloudflare across the monitored zone.",
        tone: Number(zone[3]) ? "bad" as const : "good" as const,
      },
      inventory && {
        label: "Account products",
        value: `${inventory[1]} Workers · ${inventory[2]} Pages · ${inventory[3]} KV · ${inventory[4]} R2 · ${inventory[5]} DO · ${inventory[6]} D1 · ${inventory[7]} Queues`,
        percent: null,
        note: "Live account inventory. Product billing totals are not exposed by the configured read-only credential.",
        tone: "neutral" as const,
      },
    ].filter(Boolean) as Metric[];
  }
  const window = /Last 15 min:\s*(\d+) successful,\s*(\d+) failed;\s*(\d+) overdue\/stalled/i.exec(message);
  if (window) {
    const [successes, failures, overdue] = window.slice(1).map(Number);
    const total = successes + failures + overdue;
    return [{
      label: "15-minute workflow outcomes",
      value: total ? `${successes} successful · ${failures} failed · ${overdue} overdue` : "No completed work in this window",
      percent: total ? (successes / total) * 100 : null,
      note: total ? "Recorded delivery outcomes in the latest 15-minute window." : "No activity does not establish delivery health.",
      tone: total ? (failures || overdue ? "bad" : "good") : "neutral",
    }];
  }
  return [];
}

function capacityTone(percent: number): Metric["tone"] {
  return percent >= 95 ? "bad" : percent >= 80 ? "watch" : "good";
}

function diagnose(
  service: Service,
  message: string | undefined,
  status: string,
  gap: string | null,
) {
  const evidence = message || "No observation has been recorded for this service.";
  if (gap || status === "unknown")
    return {
      evidence,
      causes: "The collector lacks sufficient current evidence for this capability. This can be caused by denied credentials, an unavailable upstream API, a missing active workflow, or incomplete analytics.",
      next: "Restore the stated monitoring access or obtain a fresh service-owned observation. Do not treat an older success as current health.",
    };
  if (["degraded", "outage"].includes(status))
    return {
      evidence,
      causes: issueCauses(message || "", service),
      next: "Review the live signal above, provider incident feed, recent deployment activity and affected dependency health before publishing an incident update.",
    };
  if (status === "not_launched")
    return {
      evidence,
      causes: "This capability is intentionally not configured or deployed, rather than failing at runtime.",
      next: "Complete the documented launch configuration, then replace this lifecycle entry with a real check.",
    };
  return {
    evidence,
    causes: "No observed failure or capacity threshold breach in this sample. This result applies only to the measured scope.",
    next: "Keep watching the live signals and investigate if a threshold, failure count, provider incident, or freshness window changes.",
  };
}

function issueCauses(message: string, service: Service) {
  if (/5xx|server error|execution failures/i.test(message)) return "The affected provider or application runtime returned server-side failures. A recent deployment, dependency outage, resource saturation, or malformed upstream response may be involved.";
  if (/429|rate.limit/i.test(message)) return "The upstream service or edge may be throttling requests, a client may be retrying aggressively, or the configured request budget may be under pressure.";
  if (/capacity|disk|connections/i.test(message)) return "Database connections or disk capacity are nearing the observed threshold. Increased traffic, connection leaks, long-running queries, or storage growth may contribute.";
  if (/SMS/i.test(message)) return "No eligible online SMS device or verified SIM was observed. Device connectivity, permissions, SIM state, or the permitted-gateway configuration may need attention.";
  return `${service.name} has an observed degraded signal. The recorded evidence identifies the affected check; related dependencies and recent operational changes may be contributing.`;
}

function formatAge(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return "unknown age";
  if (milliseconds < 60_000) return `${Math.max(0, Math.round(milliseconds / 1000))} sec`;
  return `${Math.round(milliseconds / 60_000)} min`;
}

function checkScope(service: Service): string {
  switch (service.check.kind) {
    case "http":
      return "Checks the expected public HTTP response. Sign-in, transactions, and message delivery have separate checks.";
    case "platform":
      return "Exercises live service data reads and applicable public discovery routes. Protected actions and writes are not exercised.";
    case "operations":
      return "Inspects live operational readiness, queue backlog and recent receipts. Idle activity is reported explicitly; no synthetic deliveries are created.";
    case "media":
      return "Downloads an existing public image through the platform proxy and verifies its format. Uploads and protected files are not exercised.";
    case "cms":
      return "Validates the expected signed-out redirect without following it, then independently checks the Sanity shell. Authenticated editing and SSO are not exercised.";
    case "supabase":
      return service.check.target === "database"
        ? "Tests database connectivity through a dedicated read-only query. Query errors, timeouts, and rate limits affect this result."
        : service.check.target === "limits"
          ? "Publishes live database disk, database and pooler connection ceilings, Auth-user count and Realtime subscription count. Plan-based billing allowances require separate management access."
        : service.check.target === "auth"
          ? "Tests Supabase authentication service readiness; this does not sign in as a user."
          : "Checks database capacity against configured thresholds. Missing capacity evidence is a monitoring failure.";
    case "cloudflare":
      return service.check.target === "workers"
        ? "Checks recent Cloudflare Worker execution errors and quota outcomes for configured API Workers."
        : "Checks Cloudflare request volume and limit signals against configured account thresholds. Missing account analytics is a monitoring failure.";
    case "provider":
      return `Checks the ${service.check.provider === "supabase" ? "Supabase" : "Cloudflare"} provider incident feed for relevant infrastructure. Shared provider health does not prove account-specific health.`;
    case "heartbeat":
      return "Uses a recent service-owned health signal. The result applies only to the capabilities reported by that signal; absent or expired evidence is a monitoring failure.";
    case "lifecycle":
      return service.check.reason;
  }
}
