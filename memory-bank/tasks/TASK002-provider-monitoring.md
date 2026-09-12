# TASK002 - Provider, database and capacity monitoring

**Status:** Active - integration verification and configuration gaps tracked
**Created:** 2026-09-10

## Request

Detect Supabase database issues, Cloudflare incidents, API/request limits and uptime problems; replace missing instrumentation with real telemetry; retain Unknown where evidence is genuinely unavailable (latest user policy).

## Acceptance criteria

- Real server-only Supabase read/auth/capacity checks and separate public provider incident feeds.
- Cloudflare account runtime and request-budget analytics, zone response errors, public endpoint limits and latency signals.
- Unknown only for genuinely unavailable/invalid/stale/insufficient evidence; degraded/outage require observed impact. Explicit lifecycle is not_launched; historical absent dates are No data.
- Real platform read, operations receipt/count and media probes replace all registry heartbeat placeholders; conservative dependency propagation.
- Collector secrets remain private, public summaries contain no raw rows/metrics/identifiers.
- Tests, data validation, build, rendered browser checks and live evidence are recorded separately from production activation.

## Subtasks

- [x] Implement provider/database/capacity and heartbeat checks.
- [x] Update schema, 40-service inventory and frontend evidence presentation.
- [x] Update AI guidance and operational configuration documentation.
- [x] Verify live Supabase query/auth/capacity and public provider feeds.
- [x] Complete final rendered verification for the latest telemetry revision (previous browser pass is historical).
- [ ] Resolve external Telegram authorization and account-budget visibility, and obtain missing execution evidence without inventing health.
- [x] Live-verify Cloudflare account telemetry with authorized existing encrypted Wrangler OAuth.
- [x] Replace placeholder heartbeat inventory with reviewed real platform/operations/media probes.

## Progress log

### 2026-09-12 - Cloudflare-owned production cadence

GitHub's internal schedule is removed. The existing Partners API Cloudflare Cron dispatches the collector six times per hour using an organization GitHub App installation token restricted to this repository and `Actions: write`. The installation permission remains a live configuration check before dispatch is certified; no status evidence is fabricated while it is absent.

### 2026-09-10

Plan recorded in docs/provider-monitoring-plan.md. Server-only checks and v2 semantics implemented. Supabase query/auth/capacity and public provider feeds verified live locally; Cloudflare account token is absent, so account checks report degraded monitoring rather than fabricated success. Heartbeat inputs have an explicit local file contract; the workflow has no heartbeat file producer. Production Actions, hosting and DNS are not established by this task's source changes.

Final local integration checks passed: typecheck, 37 tests, live collection of 39 observations, data validation and production build. Playwright verified desktop/mobile rendering, stale/error/invalid feeds, incident override and recovery. Public artifact secret comparison passed. Future heartbeat timestamps are rejected independently. Evidence and remaining live gates are recorded in docs/provider-monitoring-verification.md. Account analytics and protected workflow producers remain outstanding; the task is not fully live-certified.

### 2026-09-10 - latest user policy and live telemetry

Unknown restored for genuinely unavailable evidence. Real platform reads, operational receipt/count queries and media checks replace every registry heartbeat placeholder. All read paths verified live locally; Cloudflare encrypted local OAuth supports Worker and zone analytics, with noninteractive refresh integrated. Current suite: 52 passing tests. Cloudflare billing discovery is denied HTTP 403; plan quotas are not invented. Idle workflows retain Unknown, while missing ready SMS devices/SIMs is an observed readiness degradation. Local monitor:watch refreshes the preview. Final browser verification is pending; task remains Active.

### Final local verification — 2026-09-10
57 tests, typecheck, live collection, schema validation and build passed. Desktop/mobile Playwright verified 39 rendered observations, unknown/stale/failure behavior and recovery. Secret comparison passed. CMS gate/shell mismatch corrected. Continuous local preview collector running. Detailed current evidence and unresolved external barriers: docs/actual-telemetry-verification.md.

### Live account budget update — 2026-09-10
The collector now reads the actual Worker settings. The live `standard` usage model supplies a 10,000,000 included monthly request allotment; account-wide request analytics populate the remaining value. The local Partner API token and every distinct historical Telegram candidate returned HTTP 401, so no revoked credential was copied. Full suite: 58 tests, monitor, validation, typecheck and build passed.

### Collector publication lock — 2026-09-10
Added an exclusive local publication lock so the local watcher and an on-demand collection cannot collide while replacing status artifacts on Windows. Parallel collector verification, the full suite, data validation and build passed.

### Daily Cloudflare product limits — 2026-09-10
The collector now reads the live account inventory on every Cloudflare limits check and publishes actual UTC-day Worker requests alongside the active product rules. The live account has 6 Worker scripts, 53 Pages projects, 1 KV namespace, 1 R2 bucket and 4 Durable Object namespaces; D1 and Queues have zero resources. Workers Standard, Pages Functions, Paid KV and Paid Durable Objects have no daily hard request or operation cap; R2 free usage is monthly. Billing totals remain unavailable because the existing read-only OAuth does not have Billing Read. Full suite: 59 tests, live collection, validation, typecheck and build passed.

### Supabase product limits — 2026-09-10
Added a direct metrics component for live database disk and connection ceilings/use, Auth-user count, Realtime subscriptions and pooler capacity. Live collection reports 451.9 MiB / 1.93 GiB database disk, 13 / 60 busiest database connections, 333 Auth users, 0 Realtime subscriptions and 1 / 200 pooler clients. The product component uses the same 80% capacity-warning threshold as the database capacity component. No local Management API billing credential was found, so organization plan allowances, MAU, egress and Storage billing usage remain stated as unavailable rather than inferred. Full suite: 61 tests, live collection, validation, typecheck and build passed.

### Independent Discord and Telegram readiness — 2026-09-10
Split the former combined messaging component into direct Discord and Telegram status rows. Discord now reports operational from a live read-only bot identity check; Telegram alone retains the HTTP 401 monitoring gap, so a revoked Telegram token cannot turn a verified Discord integration Unknown. Full suite: 62 tests and a live 41-observation collection passed.

### Payment workflow boundary — 2026-09-10
Source inspection confirmed no hosted payment-provider integration is configured. The status inventory now distinguishes operational manual payment confirmation/reconciliation from the explicitly not-launched hosted external checkout capability. Full suite: 62 tests and a live 42-observation collection passed.

### Verbose product diagnostics — 2026-09-10
Every expanded service now has progress bars for the 15-minute freshness window, 3-second response-time budget and recorded 30-day observed-success rate. Supabase adds direct disk, database-connection and pooler headroom. Cloudflare adds the actual Workers Standard monthly inclusion and labels daily Worker use as quota-unavailable because no daily hard cap exists. Each row presents its measured scope, observed evidence, possible causes and a next check; potential causes are visibly diagnostic, not unproven incident claims. Full suite: 62 tests, data validation and production build passed. Playwright confirmed desktop and 390px mobile rendering.

### Duplicate-detail removal — 2026-09-10
Removed the redundant raw observation facts from every expanded row. The signal panel is now the single presentation of timestamps, latency, success and capacity values; Diagnosis remains the single presentation of evidence, possible causes and next checks. Typecheck, 62 tests, data validation and build passed; Playwright confirmed the rendered row.

### Markdown incident publishing — 2026-09-10
Replaced `config/incidents.json` with Markdown source files in `content/incidents/`. The collector discovers common Markdown extensions, parses constrained front matter and a final `## Updates` section, validates the converted records and emits the existing public JSON/RSS feed. The status UI safely renders public Markdown updates without raw HTML. The hidden local operator templates now produce source-ready Markdown records. Full suite: 65 tests, data validation, production build and a browser-mocked Markdown incident rendering check passed.

### Markdown extension flavor set — 2026-09-10
Replaced the hand-written renderer with the full public Markdown extension flavor set: CommonMark plus GFM tables, task lists, strikethrough, footnotes, autolinks and hard breaks. Markdown source can contain those blocks inside an update without breaking collector parsing. Raw HTML and executable component markup remain inert. Full suite: 65 tests, validation, build and a local browser-mocked table/task-list/footnote rendering check passed.

### Persistent provider incident history and rate-aware cadence — 2026-09-11
The collector now publishes every incident exposed by the Supabase and Cloudflare public summary feeds as a generated record scoped to its provider component. A generated record is retained and marked resolved only after a successful later feed no longer lists it; a failed, rate-limited or malformed feed cannot silently remove it. Provider payload bodies remain private and manual Markdown IDs still win. GitHub Actions runs every 10 minutes and writes the retained public snapshot to `status-data`; the browser uses a 10-minute refresh interval. This limits account telemetry to at most 144 collections per day. Full suite: 67 tests, data validation, production build and a live rendered Incident history view with all five current provider records passed.

### 2026-09-13 - Live limit-panel visibility

The public panels now render every currently collected rate/capacity metric: Supabase disk, database connections, pooler clients, Auth users and Realtime subscriptions; Cloudflare monthly included requests, UTC-day Worker requests, zone responses, HTTP 429 and 5xx rates, plus live account product inventory. The collector's Cloudflare Actions credential was refreshed from the active account OAuth token after the previous credential produced unavailable analytics. The remaining management-only Supabase billing allowances are intentionally shown as unavailable rather than estimated.
