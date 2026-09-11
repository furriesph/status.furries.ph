import { CalendarDays, FileText, Rss } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { feedUrl } from "../lib/status";
import type { Incident, Service } from "../lib/types";

export function IncidentEntry({
  incident,
  services,
}: {
  incident: Incident;
  services: Service[];
}) {
  return (
    <article className="incident-entry" id={`incident-${incident.id}`}>
      <div className="incident-meta">
        <span className={`status-label ${incident.impact}`}>
          {incident.status}
        </span>
        <time dateTime={incident.startedAt}>
          {new Date(incident.startedAt).toLocaleString()}
        </time>
      </div>
      <h3>{incident.title}</h3>
      <p className="fine">
        {incident.serviceIds
          .map((id) => services.find((s) => s.id === id)?.name ?? id)
          .join(" · ")}
      </p>
      {incident.endsAt && (
        <p className="fine">
          Planned end: {new Date(incident.endsAt).toLocaleString()}
        </p>
      )}
      <ol className="updates">
        {incident.updates
          .slice()
          .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
          .map((update, index) => (
            <li key={`${update.at}-${index}`}>
              <time dateTime={update.at}>
                {new Date(update.at).toLocaleString()}
              </time>
              <div className="public-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                  {update.message}
                </ReactMarkdown>
              </div>
            </li>
          ))}
      </ol>
    </article>
  );
}
export function UpdatesPanel({
  incidents,
  services,
  now,
  unavailable,
}: {
  incidents: Incident[];
  services: Service[];
  now: number;
  unavailable: boolean;
}) {
  const recent = incidents
    .filter((i) => i.status !== "scheduled")
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, 3);
  const upcoming = incidents.filter(
    (i) =>
      i.status === "scheduled" && (!i.endsAt || Date.parse(i.endsAt) > now),
  );
  return (
    <aside className="updates-panel panel">
      <h2>Latest updates</h2>
      {unavailable && <p className="notice">Updates may be out of date.</p>}
      {recent.length ? (
        recent.map((incident) => (
          <IncidentEntry
            key={incident.id}
            incident={incident}
            services={services}
          />
        ))
      ) : (
        <div className="empty">
          <FileText aria-hidden="true" />
          <h3>No published incidents</h3>
          <p>Incident updates will appear here.</p>
        </div>
      )}
      <div className="maintenance">
        <h2>Scheduled maintenance</h2>
        {upcoming.length ? (
          upcoming.map((incident) => (
            <IncidentEntry
              key={incident.id}
              incident={incident}
              services={services}
            />
          ))
        ) : (
          <div className="empty">
            <CalendarDays aria-hidden="true" />
            <h3>No maintenance scheduled</h3>
            <p>We’ll post details here when maintenance is planned.</p>
          </div>
        )}
      </div>
      <a className="feed-link" href={feedUrl}>
        <Rss size={15} /> Subscribe via RSS
      </a>
    </aside>
  );
}
