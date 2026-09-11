# Actual platform telemetry verification

2026-09-10, Asia/Singapore. Supersedes the interim no-Unknown policy and earlier provider-monitoring verification report.

## Verified implementation

- All 42 configured components have concrete probes or an explicit prelaunch lifecycle. No registry entry depends on an unpopulated heartbeat file.
- Live Supabase database query, Auth readiness and product capacity metrics pass: database disk, database and pooler connection ceilings/use, Auth-user count and Realtime subscriptions. Twelve platform domains perform bounded data reads; registration, social and survey discovery additionally exercise actual public API routes. These checks do not certify protected writes.
- Public media delivery verifies an existing image payload. CMS checks its expected signed-out redirect and independently verifies the Studio shell; it does not treat a Partners page as proof of Studio health.
- Existing encrypted Wrangler OAuth is privately refreshed for local collection. Live Worker invocation and zone HTTP response analytics return numeric counts; recent zone server errors are surfaced independently of provider-wide incidents. The account inventory confirms 6 Worker scripts, 53 Pages projects, 1 KV namespace, 1 R2 bucket and 4 Durable Object namespaces; D1 and Queues have no resources. The collector publishes actual UTC-day Worker requests and active product daily-limit scope without exposing account identifiers.
- Email gateway readiness and Discord bot identity checks pass. Discord and Telegram have distinct status components, so Telegram credential failure does not hide the verified Discord result. Payment confirmation and reconciliation is a live manual workflow; hosted external checkout is explicitly not launched because no provider is configured. Operational queue counts, backlog and recent receipts populate email, messaging, SMS, publishing, background jobs, payments and LAN details without sending messages or changing records.
- Missing, invalid, stale or insufficient evidence remains Unknown. Provider-wide incidents do not overwrite successful direct project checks.
- Every incident exposed by the public Supabase and Cloudflare summary feeds becomes a generated record scoped to its provider component. Records remain as resolved history when a successful later feed no longer lists them. Automated records show sanitized provider title, state, impact and timing only; provider payload bodies are never published, and the records do not claim impact to every application workflow.
- Local continuous collector is running and updates the existing preview build about once per minute. Production activation is separate.
- Every expanded service now presents the measured scope, time-aware signal bars for freshness, response-time budget and recorded 30-day success, plus observed evidence, possible causes and the next check. Supabase exposes real disk, database-connection and pooler headroom; Cloudflare exposes the Standard monthly inclusion and marks daily request volume as quota-unavailable because Standard has no daily hard request cap. Causes are explicitly diagnostic possibilities, never asserted as facts without evidence.

## Validation

`pnpm typecheck`, `pnpm test` (67 tests), live `pnpm monitor`, `pnpm validate:data`, and `pnpm build` passed. The local status page's Incident history view rendered all five records exposed by the two live provider summary feeds. Playwright verified the rendered progress-bar and diagnostic-detail flow at desktop and 390px mobile widths against the live snapshot, plus local network-mocked safe rendering of a Markdown incident update. Product limits share the capacity component's 80% warning threshold. Configured provider credentials, private origins and account identifiers were compared against every public/build artifact and were absent. Both local secret files are gitignored.

At 2026-09-09T21:13:06Z, collection reported 29 operational, four degraded, five unknown and one not launched. These are observations at that time; the live collector can change them. Screenshots: `output/status-actual-desktop.png`, `output/status-actual-mobile.png`, `output/status-actual-infrastructure.png`.

## Remaining external barriers and insufficient activity

| Area | Actual evidence | Required next step |
| --- | --- | --- |
| Telegram readiness | The current Partner API token and all distinct historical local candidates receive HTTP 401 | Rotate or supply a valid monitoring bot token securely in `.env.monitor.local`; no token should be pasted into chat or public files |
| Cloudflare product billing | Live Worker settings report Standard. The collector publishes daily Worker use and the actual inventory: Workers, Pages, KV, R2 and Durable Objects; active Paid products have monthly billing rules instead of daily hard caps | Billing subscription access still returns HTTP 403, so exact product billing totals remain outside the collector scope |
| SMS | No fresh permitted online device or verified active SIM | Bring a real gateway device and SIM online; monitoring must not enable sending or invent readiness |
| LAN | No active session is currently reported; the collector now reports this as known idle operational state, while clearly stating that active synchronization is not exercised | Verify during an actual connected LAN session to certify live synchronization |
| Payments | No recent manual confirmation records; those records do not prove external checkout availability | Provider-owned readiness/transaction evidence is needed to certify external checkout |
| Publishing and jobs | Queues are readable with no recent successes, failures or overdue work | Reported as known idle operational states; active worker execution remains explicitly outside the measured scope |

The complete request is not claimed finished while these live evidence and authorization gaps remain. Instrumentation findings are separated from actual platform faults and idle activity. No messages, charges, identity changes, database mutations or production deployments were performed.
