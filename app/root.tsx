import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { PawPrint, ExternalLink } from "lucide-react";
import { statusUrl } from "./lib/status";
import "./styles.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#faf8fc" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to status
        </a>
        <header className="topbar">
          <div className="shell topbar-inner">
            <a href="/" className="brand">
              <PawPrint aria-hidden="true" />
              <strong>furries.ph</strong>
              <span>/ status</span>
            </a>
            <nav aria-label="External resources">
              <a href="https://furries.ph">
                Platform <ExternalLink size={13} />
              </a>
              <a href={statusUrl}>Status JSON</a>
            </nav>
          </div>
        </header>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function App() {
  return <Outlet />;
}
export function HydrateFallback() {
  return (
    <main id="main" className="shell">
      <h1>Platform status</h1>
      <p>Loading status information…</p>
      <p>
        <a href={statusUrl}>View the status JSON feed</a>
      </p>
    </main>
  );
}
export function ErrorBoundary() {
  return (
    <main id="main" className="shell">
      <h1>Status page unavailable</h1>
      <p>
        Monitoring failure: we could not display status information. Service health is unknown until fresh checks are available.
      </p>
      <a href={statusUrl}>View the status JSON feed</a>
    </main>
  );
}
