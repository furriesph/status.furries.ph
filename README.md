# Furries PH Status

A public status dashboard for the Furries PH platform, including the API, registration, partner dashboard, social and moderation surfaces. It separates public reachability checks from capabilities that require additional monitoring so that an available web shell does not imply a working authenticated workflow.

Built with React 19, React Router 8 (SPA mode), Vite 8, TypeScript and Tailwind CSS 4, using pnpm 10.9 to match Partners v2.

## Local development

Use the Node version declared by the repository and install pnpm 10.9. `package.json` is the source of truth for commands.

```sh
pnpm install
pnpm dev
```

```sh
pnpm typecheck
pnpm test
pnpm validate:data
pnpm build
```

Collect fresh observations from the configured endpoints and provider APIs:

```sh
pnpm monitor
```

Collection makes network requests and updates generated public status data. Inspect the resulting diff before committing it. For a continuously refreshed local preview, run `pnpm monitor:watch` alongside `pnpm dev` or `pnpm preview`; it collects every 10 minutes by default and updates an existing preview build. Set `STATUS_MONITOR_INTERVAL_SECONDS` between 300 and 3600 only when a different local cadence is required.

## What the status means

- **Operational:** the configured check passed at its recorded time.
- **Degraded / outage:** the configured check or an active incident reports impact.
- **Maintenance:** a relevant maintenance record reports planned impact.
- **Unknown:** evidence is genuinely unavailable, invalid, stale or insufficient for the stated workflow; the detail explains why.
- **Not launched:** an explicitly configured prelaunch service.

The page identifies evidence and last-check times. Expanding a service shows three time-aware progress bars for observation freshness, the 3-second response-time budget and recorded 30-day success, followed by product capacity bars where the collector has a real ceiling. Each detail also separates observed evidence, possible causes and the next check. A striped bar means the collector has a count but no actual quota; it never estimates a limit. Observations older than 30 minutes are stale. History retains up to 30 days of measured samples; gaps are not successes. Sample availability is not continuous uptime or an SLA.

Daily UTC aggregates preserve the worst observed status and actual check counts while keeping the public feed small. Expand any service for its history and monitoring scope.

Internal workflows require fresh service-owned evidence even while their public landing pages respond successfully. Real platform reads, queue receipts and media checks replace heartbeat placeholders. Readable empty LAN, publishing and job queues report an idle operational state while explicitly not certifying live execution or delivery. Historical dates without samples display neutral No data. Review the inventory when a platform surface is added, renamed or retired.

## Monitoring and hosting

The existing `partners-api` Cloudflare Cron Trigger dispatches the GitHub Actions collector every 10 minutes (UTC minutes 07, 17, 27, 37, 47 and 57); GitHub Actions only runs the requested collection and publishes `status.json` and `feed.xml` to the public `status-data` branch. This makes at most 144 scheduled Cloudflare-account collections per day; browser refreshes only read the published feed every 10 minutes and do not call Cloudflare account APIs. Cloudflare delivery, Actions queueing and raw-file CDN caching can delay fresh data; the page's stale indicator is part of the operating model. The organization GitHub App needs `Actions: write` only for this repository, while the workflow needs `GITHUB_TOKEN` contents-write permission for `status-data`. Supabase project probes and Cloudflare account analytics require collector-only credentials. Copy `.env.monitor.example` to the ignored `.env.monitor.local`; `pnpm monitor` loads this and ignored `.env.cloudflare.local`. Follow the runbook for local Wrangler refresh and GitHub secret mappings. Public provider incident feeds need no credentials.

Deploy as a static Cloudflare Pages project using `pnpm build` and output directory `build/client`. In production the app reads the public GitHub Contents API for the `status-data` branch, using its raw-media response with a short cache. The downloadable JSON and RSS links point to the public raw branch files. Configure `VITE_FEED_URL` as the corresponding `feed.xml` URL if a different public mirror is needed. Never add a browser token. Observation updates do not require a site rebuild. Local development defaults to `/status.json`. Set up `status.furries.ph` in the hosting dashboard only after a preview passes verification.

Repository setup and local checks do not establish that monitoring, DNS or production hosting are active. Verify each separately using the [runbook](docs/runbook.md).

## Repository guidance

- [AGENTS.md](AGENTS.md): instructions for AI contributors.
- [Memory Bank](memory-bank/projectbrief.md): architecture, current context and tracked tasks.
- [Runbook](docs/runbook.md): checks, incidents, maintenance and recovery.
- [Contributing](CONTRIBUTING.md) and [security policy](SECURITY.md).
- [Implementation plan](docs/implementation-plan.md).

## Infrastructure coverage

The 42-entry registry includes real Supabase read-only database queries, GoTrue readiness, database connection/storage headroom, live Supabase product capacity, Cloudflare Worker execution failures, live daily Worker usage, the live Cloudflare product inventory, zone HTTP 429/server errors, separate Discord and Telegram readiness, manual payment reconciliation and provider incident feeds. HTTP probes also detect rate limiting and slow responses. Every incident exposed by the configured Supabase and Cloudflare public summary feeds is automatically published as a scoped provider incident record, alongside operator-authored Markdown records. Generated records remain as resolved history once a successful later provider feed no longer lists them. They identify provider-wide impact without claiming that every dependent Furries PH workflow is affected. Supabase product limits publish live database disk and connection ceilings, Auth-user count, Realtime subscriptions and pooler capacity without exposing raw metrics. The collector reads the Worker usage model from Cloudflare: Standard has no daily request cap and includes 10 million requests monthly. It publishes the actual daily Worker count, verifies the active Workers, Pages, KV, R2, Durable Objects, D1 and Queues inventory, and describes each active product's daily-limit rule. Account analytics are sampled evidence, not exact billing totals; the UI labels unavailable quota as unavailable instead of turning it into a percentage.

Local live verification has confirmed Supabase query/auth/capacity, platform data reads, operational count queries, media delivery, Cloudflare Worker/zone analytics and both public provider feeds. Successful reads do not certify writes, payment checkout or idle delivery workflows. Cloudflare plan discovery returned HTTP 403; no request quota is invented. SMS telemetry observed no ready device/SIM. This does not establish scheduled production monitoring or deployment. See [TASK002](memory-bank/tasks/TASK002-provider-monitoring.md).
