# Status operations runbook

## Activate monitoring and hosting

The repository is prepared for operation; local source and a successful build do not prove production activation. At initial setup there is no configured Git remote.

1. Create or choose the public GitHub repository, configure the remote and publish the reviewed source.
2. Enable GitHub Actions, review the monitoring workflow and allow `GITHUB_TOKEN` contents-write permission. The workflow publishes data to `status-data`; configure the provider secrets and variables listed below for project monitoring. The schedule is owned by the existing `partners-api` Cloudflare Cron Trigger: the organization GitHub App must be installed for this repository with **Actions: Read and write**, so it can dispatch `monitor.yml` at UTC minutes 07, 17, 27, 37, 47 and 57.
3. Create the Cloudflare Pages project for the static SPA. Build with `pnpm build`; serve `build/client`. The production site reads the public GitHub Contents API for the `status-data` branch and requests raw JSON with its public media type; it does not require a browser token. Set `VITE_FEED_URL=https://raw.githubusercontent.com/OWNER/REPO/status-data/feed.xml` only if a different public RSS mirror is needed. Confirm SPA fallback routing.
4. Trigger the monitoring workflow manually and inspect collection and history persistence. Deploy the frontend separately through Pages. Then inspect the next Cloudflare-Cron-dispatched run; Actions queueing and raw-file CDN caching can add latency.
5. Open the deployed site, verify current observation timestamps, inspect a service detail and the public JSON output, and check refresh on a nested route if applicable. Verify desktop and mobile layouts.
6. Configure the `status.furries.ph` domain and DNS through Cloudflare only when authorized. Verify HTTPS and a fresh snapshot from the custom domain.
7. Observe subsequent scheduled runs and confirm history survives on the `status-data` branch. The frontend reads its configured public URL, so observations update without rebuilding the site. Local development defaults to `/status.json`.

Keep four distinct records: local checks, collector observations, successful scheduled workflow runs and deployed custom-domain verification. A registry change also needs a frontend rebuild because the display inventory is bundled with the application.

Deployment references: [React Router SPA hosting](https://reactrouter.com/how-to/spa) and [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

History is stored as daily aggregates for 30 UTC dates: worst observed status, total checks and successful checks. Historical days without samples display No data; no success samples are invented. This bounds the public feed while preserving real check counts.

## Daily interpretation

The inventory lives in `config/services.json`. Each entry has a stable ID, display name, group, description and an HTTP, Supabase, Cloudflare, provider-feed, platform-read, operational-telemetry, media or lifecycle check. The current registry contains no heartbeat placeholders.

An HTTP result establishes only the configured URL's expected response at the recorded time. A responding dashboard login screen does not validate sign-in, authorization, data access or mutations. Protected capabilities use bounded reads or operational receipts with explicit scope. Missing recent successes in an idle workflow remain Unknown. Never mark them operational merely to complete coverage.

Data is stale after 30 minutes. Treat stale or missing observations as Unknown monitoring gaps and investigate collection/deployment before interpreting old green results. The 30-day history contains recorded samples only. A sample availability percentage is not continuous uptime: missed runs and sparse evidence limit what it establishes.

## Collect and validate locally

```sh
pnpm monitor
pnpm validate:data
pnpm typecheck
pnpm test
pnpm build
```

The monitor makes real endpoint and provider network requests and writes generated status artifacts. Inspect its output and diff. A local DNS or network failure is an observation from that collector environment, not automatic proof of a global outage.

## Publish an incident or schedule maintenance

Authorized operators prepare, validate and publish public incident and maintenance records as Markdown files in `content/incidents/`. The collector parses their front matter and `## Updates` section, then writes the validated public feed. Public updates render the Markdown extension flavor set: CommonMark plus GitHub-flavored tables, task lists, strikethrough, footnotes, autolinks and hard breaks. Raw HTML and executable component markup remain text, never executable output. Exact templates, writing guidance and end-to-end procedure live only in the ignored local `.operator/` directory, so they are not included in the public site, public data feed or repository history. Do not create a hidden browser route for these materials: this static site has no server-side authentication.

Published records use valid existing service IDs, UTC timestamps, timestamped public-safe updates and an explicit resolution only after direct verification. The collector publishes reviewed records to `status-data`; an edit is not public until it is committed, pushed, collected and visible through the configured public data URL.

## Add or change a service

1. Review the real public hostname and intended capability with the platform inventory.
2. Add or update `config/services.json`; keep existing IDs stable so history and incidents remain linked.
3. Prefer a dedicated public health endpoint. If using a page response, label the scope as reachability. Use `expectedStatus` or `contains` only when the expected response is stable and meaningful.
4. For protected or uninstrumented capabilities, add a reviewed real read/receipt probe with a documented scope. Do not introduce placeholder signals solely to fill the inventory. Provider probes are server-only; never add browser credentials.
5. Run validation and collector tests, then deliberately collect and inspect fresh evidence. Verify the inventory, group and detail view in the rendered page.

## Investigate stale data or failed deployment

- Check the last successful Actions run, the Partners API Cron Trigger and the GitHub App installation's `Actions: write` permission for this repository.
- Check repository write permissions and history persistence steps. Preserve existing history when repairing the pipeline.
- Check the collector's exit state, DNS/network access and endpoint errors. Do not overwrite failures with synthetic successes.
- Check the configured public data URLs, branch visibility and CDN caching. If the frontend itself failed to publish, inspect Pages build/deploy logs without copying secrets into issues.
- Compare generated data timestamps with the deployed response. A current local snapshot and stale deployed snapshot indicate a publication problem.
- Rerun after fixing the cause and verify fresh public output. Retain gaps honestly.

If collection cannot be restored immediately, the Unknown monitoring-gap presentation must remain visible. Publish an incident for the monitoring problem where appropriate.

## Rollback and verification

Revert a faulty application or configuration change through version control, rerun checks and deploy the corrected build. Preserve measured history and incident records; do not roll them back blindly with code. Verify a fresh collector run, visible status timestamps, affected services, incident state and public output after recovery.

Do not treat HTTP reachability, local builds, passing unit tests or a deployed static page as certification of the complete Furries PH platform.

## Provider configuration and local refresh

Copy `.env.monitor.example` to `.env.monitor.local` for local use. This file is ignored. Use the package command to load both local configuration files:

```sh
pnpm monitor
```

`pnpm monitor` automatically loads `.env.monitor.local` and `.env.cloudflare.local` when present; existing process environment variables take precedence. Set `LOCAL_CLOUDFLARE_AUTH=wrangler` only for local collection to refresh authorized existing Wrangler OAuth through `scripts/cloudflare-local-auth.mjs`. The helper reads Windows encrypted credentials through Wrangler, captures output privately, runs noninteractively and never opens a login browser. It requires the sibling partners-api Wrangler installation. It is disabled in CI; configure a dedicated analytics token for scheduled collection. `pnpm monitor:watch` collects every 10 minutes by default and copies fresh artifacts to an existing preview build. `STATUS_MONITOR_INTERVAL_SECONDS` is clamped to 5 minutes through 1 hour. Keep all provider configuration out of `VITE_` variables and public artifacts.

| Collector variable | GitHub configuration | Purpose |
| --- | --- | --- |
| SUPABASE_URL | Secret environment variable | Project HTTPS origin |
| SUPABASE_SECRET_KEY | Secret environment variable | Preferred project secret key |
| SUPABASE_SERVICE_ROLE_KEY | Secret environment variable | Legacy service-role fallback; omit if preferred key is set |
| CLOUDFLARE_API_TOKEN | Secret environment variable | Account-scoped monitoring token; Cloudflare requires the Write-labelled Workers Observability permission to query telemetry |
| CLOUDFLARE_ACCOUNT_ID | Secret environment variable | Account scope |
| CLOUDFLARE_ZONE_ID | Secret environment variable | Zone response-code scope |
| CLOUDFLARE_WORKER_NAME | Environment variable | Worker scope; defaults to partners-api |
| CLOUDFLARE_DAILY_REQUEST_LIMIT | Environment variable | Optional lower daily operating alert budget |
| CLOUDFLARE_MONTHLY_REQUEST_LIMIT | Environment variable | Optional lower monthly operating alert budget; blank derives the live Standard inclusion |
| CLOUDFLARE_DAILY_OBSERVABILITY_LIMIT | Environment variable | Dashboard Observability-event daily allowance |
| CLOUDFLARE_MONTHLY_BUILD_MINUTES_LIMIT | Environment variable | Dashboard Workers-build-minute monthly allowance |
| STATUS_SLOW_RESPONSE_MS | Environment variable | HTTP slow-response threshold; default 3000 ms |
| LOCAL_CLOUDFLARE_AUTH | Local only | Set to wrangler to use existing refreshable local OAuth |
| GAS_EMAIL_WEBHOOK_URL | Secret environment variable | Read-only email gateway readiness URL |
| DISCORD_BOT_TOKEN | Secret environment variable | Read-only bot identity verification |
| TELEGRAM_BOT_TOKEN | Secret environment variable | Read-only bot identity verification |

Configure the zone for response-code coverage. Set account dashboard allowances as repository variables after confirming them in Cloudflare: Workers requests per day, Observability events per day and Workers build minutes per month. The collector uses account-wide Workers analytics for the live request count and CPU time, and warns at 80% of the configured request allowance. Cloudflare's Observability query API requires the account-scoped **Workers Observability: Write** permission even though the collector only makes read/query requests; retain the existing analytics and inventory read permissions, then add that one Cloudflare-required permission. The current permitted API does not expose build-minute use, so those cards show their real allowance with unavailable use until that evidence is available; they never infer event or build consumption. Each collection also inventories Worker scripts, Pages projects, KV namespaces, R2 buckets, Durable Object namespaces, D1 databases and Queues through the account API. Static Pages assets are free and unlimited. Product billing usage remains unavailable unless the collector receives separate Billing Read access. Missing permissions, empty analytics or missing zone scope remain explicit Unknown monitoring gaps unless independent direct evidence proves impact. Analytics estimate observed usage and are not billing totals or a guarantee that every account limit is covered. Worker checks inspect a 15-minute window for runtime errors/resource-limit outcomes. Request checks also warn on observed zone 429/server errors.

The configured Cloudflare token currently has Workers and zone analytics access, but the Workers Observability REST endpoint returns HTTP 403. Replace `STATUS_CLOUDFLARE_API_TOKEN` with a token restricted to this account that retains the working analytics and inventory reads and adds **Account → Workers Observability → Write**. Cloudflare documents this write-labelled permission as the required scope for telemetry queries; the status collector only queries telemetry and has no mutation path. Do not use a Global API key. Billing Read remains optional and is only needed to inspect subscriptions or invoices.

Supabase uses a bounded GET of `/rest/v1/partners?select=id&limit=1` to exercise an existing table read, `/auth/v1/health` for GoTrue readiness, and `/customer/v1/privileged/metrics` for connection and database-volume headroom. The product-limits component publishes only aggregate database disk use/capacity, busiest database connection pool, Auth-user count, Realtime subscriptions and pooler clients/ceiling; it never publishes raw metrics, labels, rows or credentials. Organization plan allowances, MAU, egress and Storage billing use are not inferred because they require a separate Management API billing credential. Database connections and disk warn at 80% and report a stronger summary at 95%; capacity warnings do not imply database failure. Auth readiness does not exercise user sign-in, MFA or token refresh.

Legacy heartbeat support (unused by the current registry): a heartbeat file is an array of records with `serviceId` matching the inventory check's `signal`, `status` (operational/degraded/outage/maintenance), `checkedAt` (ISO timestamp), and a short public-safe `message`. One matching record is required. Records older than 15 minutes, dated in the future, duplicated, or malformed are rejected. The collector publishes a fixed summary, never arbitrary fields or the raw submitted message. The producer must actually test the declared workflow; never write success records solely to clear gaps. To use producers in Actions, add a reviewed step that obtains fresh signals securely and sets the file path; the supplied workflow does not fabricate or transport those signals.

Provider incident feeds are separate shared-infrastructure evidence. Every incident exposed by the configured Supabase and Cloudflare public summary feeds becomes a generated status record for the matching provider component. The collector retains those records and marks an active record resolved only after a successful later feed no longer lists it; a failed, rate-limited or malformed feed preserves the previous record unchanged. A matching manual Markdown record with the same ID wins, and provider payload bodies are never copied into the public feed. A provider-wide incident may affect declared dependents, but does not certify impact to every project workflow; a green provider feed never certifies this project's database or workflows. Missing credentials are monitoring faults, not evidence of a provider outage. Explicit lifecycle entries alone can be Not launched.

## Verification boundary for TASK002

Local live checks have validated Supabase database/auth/capacity, platform data reads, operational count queries, media image delivery, Cloudflare Worker and zone analytics, and both provider incident feeds. Existing encrypted Wrangler OAuth unlocked account telemetry. Account subscriptions returned HTTP 403 (provider code 10000); Worker settings exposed standard usage without explicit limits, so plan quota discovery remains unavailable. No arbitrary daily/monthly quota is configured. Idle workflows retain Unknown because successful queries alone do not prove recent delivery. SMS readiness reports observed missing fresh online devices or verified active SIMs. The current suite has 52 passing tests; final browser verification for the latest telemetry changes remains pending. Scheduled production activation requires separate evidence. Retain this distinction when publishing operational reports; fixture tests, configured workflows and a local build do not prove deployed collection.

## Workflow telemetry scope

Platform probes read at most one identifier from reviewed operational tables; registration, social and survey probes additionally check public discovery responses. These establish data availability, not protected writes or authorization correctness. Media monitoring verifies an existing image payload through the public API proxy; it does not upload assets or test protected files.

Operational probes use count-only database HEAD requests over a 15-minute window. Email covers blast/provider-acceptance and planning outbox records; linked messaging covers Discord and Telegram planning receipts. Background jobs cover asset webhooks and the planning outbox; social publishing covers recorded provider publication, not federation inbox delivery. Failures and overdue work cause degradation; readable empty jobs, publishing and LAN datasets are reported as idle operational states while stating that active execution is not exercised. Payment confirmations may be manual, so they never certify external checkout availability. Active LAN synchronization requires a recent session heartbeat and projected operation pair. SMS checks fresh permitted devices, verified active SIMs and recorded delivery receipts without sending a message.
