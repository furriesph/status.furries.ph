## 2026-09-13 - Correct Cloudflare account telemetry

- Replaced the collector's Cloudflare account and zone configuration with the active production account. Account telemetry now reports live Workers, Pages and storage inventory. The request-limits service stays known when a supplemental optional meter is unavailable; Workers Observability aggregates are queried through Cloudflare's required write-scoped API and shown only when a verified total is returned.

# Progress

## 2026-09-12 - Cloudflare-owned collector cadence

- Removed the GitHub Actions schedule. The existing `partners-api` Cloudflare Worker Cron now dispatches `monitor.yml` six times per hour with a short-lived, repository-scoped organization GitHub App token. The collector still owns provider reads and immutable observation/history publication. The App installation needs `Actions: write` on `furriesph/status.furries.ph`; until that live configuration is verified, stale monitoring remains an honest visible failure state.

## 2026-09-10

- Initial implementation plan recorded before code changes.
- AI guidance, contribution/security templates and operational documentation added.
- Frontend and monitoring implementation completed in TASK001: 34 components, 30-day daily aggregates, incidents, maintenance and independent scheduled publication.
- `pnpm typecheck`, `pnpm test` (13 tests), `pnpm validate:data` and `pnpm build` passed. Production UI verified in Playwright at desktop/mobile sizes, including failure and incident fixtures; screenshots retained in ignored `output/`.
- Local collector observed 10 operational public endpoints and 24 unknown entries at 2026-09-09T20:32:57.292Z. See `docs/verification.md` for evidence boundaries.
- Production activation remains separate: remote publication, Actions, deployment configuration, DNS and live verification are not implied by repository readiness.

## TASK002 - 2026-09-10 (historical interim policy; superseded below)

Supersedes the initial unknown-state policy and 34-entry inventory above with 39 components and explicit degraded monitoring gaps. Added real Supabase database/auth/capacity probes, Cloudflare runtime/request analytics, provider incidents and expiring service heartbeat ingestion. Snapshot v2 and UI distinguish evidence and historical No data. Local live Supabase query/auth/capacity and both public provider feeds validated; Cloudflare account telemetry is unverified without an authorized token. Production activation remains separate. Integration checks and final evidence are tracked in TASK002.

## TASK002 latest telemetry revision - 2026-09-10

- Restored Unknown for genuinely unavailable or insufficient evidence; earlier blanket degraded-monitoring semantics are superseded.
- Replaced every registry heartbeat placeholder with real platform reads, operational telemetry or public media delivery checks; inventory remains 39.
- All live read paths succeeded, including Cloudflare Worker/zone analytics through existing encrypted Wrangler OAuth. Local refresh uses LOCAL_CLOUDFLARE_AUTH=wrangler; monitor:watch maintains fresh local preview data.
- Cloudflare billing subscriptions returned HTTP 403; no plan quota invented. Idle delivery/payment/LAN paths retain honest Unknown where read success does not prove workflow availability. SMS readiness lacks a fresh ready device/SIM.
- Current test suite: 52 passing. Final browser verification of this revision remains pending; TASK002 stays active. Production activation remains separate.
