# Provider monitoring verification

> Historical verification of the interim no-Unknown policy. Superseded by the user's correction and `actual-telemetry-verification.md`; do not use this report as current configuration or completion evidence.

Verified locally on 2026-09-10 (Asia/Singapore). This records evidence for TASK002; it does not establish a deployed collector or production status site.

| Requirement | Evidence | Result |
| --- | --- | --- |
| Supabase database and Auth | Live bounded table read and GoTrue health request using collector-only configuration | Passed |
| Supabase capacity | Live metrics response; per-server connection headroom and writable database volume parsing | Passed; root image excluded from database-volume calculation |
| Provider incidents | Live Supabase and Cloudflare summary feeds | Working; provider degradation affects dependent status conservatively |
| Cloudflare runtime, limits and request budgets | Six adapter tests plus HTTP/integration tests cover errors, quotas, 429, edge errors, invalid analytics and absent permissions | Tests passed; authenticated account analytics still needs live credentials |
| No unknown current states | Validated 39-entry schema-v2 snapshot and rendered real, stale, invalid and failed feeds | Passed; missing evidence is explicitly degraded monitoring |
| Workflow health | Expiring trusted heartbeat input, dependency and validation tests | Input supported; service-owned producers are not connected |
| Secret isolation | Compared configured Supabase secrets against every public and build/client file; checked local env ignore rule | Passed; no configured key found in published artifacts |
| Browser behavior | Playwright production preview, desktop 1440x1100 and mobile 390x844 | Passed; no horizontal overflow or runtime errors, incident override and recovery verified |

`pnpm typecheck`, `pnpm test` (37 tests), `pnpm monitor` (39 observations), `pnpm validate:data`, and `pnpm build` passed. After tightening future heartbeat rejection, the three provider/heartbeat tests passed again. Future timestamps now degrade the individual signal instead of invalidating the complete snapshot.

Screenshots are retained locally in `output/status-infrastructure-desktop.png` and `output/status-infrastructure-mobile.png`. The Playwright check script is `output/verify-provider-ui.js`. Output files are ignored by Git.

## Remaining live verification

Configure an authorized Cloudflare analytics token, account, Worker, zone and actual request budgets in the ignored `.env.monitor.local`, using `.env.monitor.example` and the runbook. Collect and inspect the authenticated runtime and request observations before claiming account telemetry works live. Missing configuration correctly remains degraded monitoring.

Protected workflows need service-owned checks that exercise their declared capability and supply fresh heartbeat records. HTTP shell reachability and healthy dependencies cannot prove those workflows healthy. Hosting, Git remote publication, scheduled Actions and DNS activation remain separate from this local implementation.
