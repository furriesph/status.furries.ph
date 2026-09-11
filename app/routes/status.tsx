import { useEffect, useState } from "react";
import { Check, CircleHelp, RefreshCw, Search, AlertTriangle } from "lucide-react";
import catalog from "../../config/services.json";
import { ServiceRow } from "../components/service-row";
import { IncidentEntry, UpdatesPanel } from "../components/incidents";
import {
  isFresh,
  labels,
  monitoringGap,
  serviceStatus,
  severity,
} from "../lib/status";
import { useStatus } from "../lib/use-status";
import type { Service, Status } from "../lib/types";

const services = catalog as Service[];
const groups = [...new Set(services.map((service) => service.group))];
export function meta() {
  return [
    { title: "Furries PH — Platform status" },
    {
      name: "description",
      content:
        "Current service availability, incidents, maintenance and observed history across the Furries PH platform.",
    },
  ];
}
export default function StatusPage() {
  const { snapshot, loading, error, now, refresh } = useStatus(services);
  const [tab, setTab] = useState("Services");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All services");
  useEffect(() => {
    const sync = () => {
      if (window.location.hash.startsWith("#incident-"))
        setTab("Incident history");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (
      tab !== "Incident history" ||
      !window.location.hash.startsWith("#incident-")
    )
      return;
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [tab, snapshot]);
  const stale =
    snapshot.generatedAt !== null && !isFresh(snapshot.generatedAt, now);
  const unavailable = !!error || stale;
  const statuses = services.map((service) =>
    serviceStatus(service, snapshot, now, unavailable),
  );
  const overall = statuses.reduce<Status>(
    (worst, s) => (severity[s] > severity[worst] ? s : worst),
    "operational",
  );
  const gaps = services.filter((service) =>
    monitoringGap(service, snapshot, now, unavailable),
  );
  const affected = services.filter(
    (service, index) =>
      ["degraded", "outage", "maintenance"].includes(statuses[index]),
  );
  const title = error
    ? "Monitoring failure: status updates unavailable"
    : stale || !snapshot.generatedAt
      ? "Monitoring failure: fresh checks needed"
      : overall === "operational"
        ? "All monitored services operational"
        : overall === "maintenance"
          ? "Scheduled maintenance in progress"
          : gaps.length && !affected.length
            ? "Monitoring coverage needs attention"
            : "Some services need attention";
  const subtitle =
    error ??
    (stale || !snapshot.generatedAt
      ? "Service health is unknown until fresh monitoring evidence is available."
      : `${statuses.filter((status) => status === "operational").length} operational | ${affected.length} service issues | ${statuses.filter((status) => status === "unknown").length} unknown (${gaps.length} monitoring gaps) | ${statuses.filter((status) => status === "not_launched").length} not launched`);
  const visible = services.filter(
    (service) =>
      (group === "All services" || service.group === group) &&
      `${service.name} ${service.description} ${service.group}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <main className="shell" id="main">
      <div className="page-heading">
        <div>
          <h1>Platform status</h1>
          <p>Availability across the Furries PH platform.</p>
        </div>
        <button
          className="refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "spin" : ""} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <section className={`summary-banner ${overall}`} aria-live="polite">
        <div className="summary-icon">
          {overall === "operational" ? <Check /> : overall === "unknown" ? <CircleHelp /> : <AlertTriangle />}
        </div>
        <div className="summary-copy">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <dl className="summary-stats">
          <div>
            <dt>Last checked</dt>
            <dd
              title={
                snapshot.generatedAt
                  ? new Date(snapshot.generatedAt).toLocaleString()
                  : undefined
              }
            >
              {snapshot.generatedAt
                ? new Date(snapshot.generatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <dt>History</dt>
            <dd>30 days</dd>
          </div>
          <div>
            <dt>Page refresh</dt>
            <dd>10 min</dd>
          </div>
        </dl>
      </section>
      <nav className="section-nav" aria-label="Status views">
        {["Services", "Incident history", "About monitoring"].map((item) => (
          <button
            key={item}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "Services" ? (
        <div className="status-layout">
          <section aria-label="Platform services">
            <div className="section-title">
              <h2>Services</h2>
              <span>
                {visible.length} of {services.length}
              </span>
            </div>
            <label className="search">
              <Search size={18} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a service"
                aria-label="Find a service"
              />
            </label>
            <div className="filters" aria-label="Service categories">
              {["All services", ...groups].map((item) => (
                <button
                  key={item}
                  aria-pressed={group === item}
                  onClick={() => setGroup(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {groups.map((name) => {
              const rows = visible.filter((service) => service.group === name);
              return rows.length ? (
                <section className="service-group panel" key={name}>
                  <h2>{name}</h2>
                  {rows.map((service) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      snapshot={snapshot}
                      now={now}
                      unavailable={unavailable}
                    />
                  ))}
                </section>
              ) : null;
            })}
            {!visible.length && (
              <div className="panel no-results">
                <h3>No matching services</h3>
                <p>Try a different name or category.</p>
                <button
                  className="refresh"
                  onClick={() => {
                    setQuery("");
                    setGroup("All services");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
          <UpdatesPanel
            incidents={snapshot.incidents}
            services={services}
            now={now}
            unavailable={unavailable}
          />
        </div>
      ) : tab === "Incident history" ? (
        <section className="panel reading">
          <h2>Incident history</h2>
          <p>Published updates and maintenance across the platform.</p>
          {unavailable && (
            <p className="notice">The incident feed may be out of date.</p>
          )}
          {snapshot.incidents.length ? (
            snapshot.incidents
              .slice()
              .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
              .map((incident) => (
                <IncidentEntry
                  key={incident.id}
                  incident={incident}
                  services={services}
                />
              ))
          ) : (
            <div className="empty">
              <h3>No published incidents</h3>
              <p>
                No incident records are available in this feed. This does not
                confirm uninterrupted service.
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="panel reading">
          <h2>About monitoring</h2>
          <h3>What these checks tell you</h3>
          <p>
            Public website checks confirm an expected HTTP response. They do not
            prove that sign-in, registrations, payments, moderation actions, or
            message delivery work. Those capabilities have separate entries and
            remain Unknown when their monitoring evidence is missing.
          </p>
          <h3>Database, infrastructure, and limits</h3>
          <p>
            Database checks test a dedicated Supabase query, authentication
            readiness, and database capacity. Cloudflare checks inspect Worker
            errors and request-limit signals. Provider incident feeds describe
            shared infrastructure incidents; they do not certify a particular
            Furries PH account. Expand any service to see the scope and evidence
            behind its status.
          </p>
          <h3>Fresh information matters</h3>
          <p>
            The collector runs every 10 minutes. Scheduling and feed caching
            can delay updates. This page refreshes every 10 minutes;
            observations older than 15 minutes become Unknown with a
            monitoring-failure explanation. A failed feed request does the same.
          </p>
          <h3>History without guesswork</h3>
          <p>
            Each bar represents one UTC day and shows the most severe observed
            status. Gray patterned bars mean no samples. Expand a service for
            daily counts. Successful-check percentages describe observations,
            not continuous uptime; gaps between checks are unobserved.
          </p>
          <h3>Incidents and maintenance</h3>
          <p>
            Published incidents override check results for affected services
            while active. Upcoming maintenance is announced separately and
            starts affecting status at its scheduled time. Operator updates are
            published through the incident feed.
          </p>
          <h3>Coverage</h3>
          <p>
            All {services.length} listed services and capabilities are included
            in the overview. Entries without a safe public probe remain visible
            as Unknown with a monitoring-gap explanation. Provider integrations and local event
            systems need their own fresh evidence. Services explicitly not
            launched are labeled separately.
          </p>
        </section>
      )}
      <footer className="page-footer">
        <div className="legend">
          {(Object.keys(labels) as Status[]).map((status) => (
            <span key={status} className={`status-label ${status}`}>
              <i />
              {labels[status]}
            </span>
          ))}
        </div>
        <p>Times shown in your local timezone. History days use UTC.</p>
      </footer>
    </main>
  );
}
