# Database, provider and capacity monitoring

> Historical initial plan. The user's later correction permits genuine Unknown and requires real telemetry. See `actual-telemetry-plan.md` for current requirements.

User request: detect Supabase database problems, Cloudflare incidents, API/request limits and other uptime issues, and eliminate unknown statuses.

Implementation requirements:

1. Add real server-side database/auth/resource probes using existing authorized local Supabase configuration. Publish only summarized results, never credentials, rows or raw metrics.
2. Add provider incident checks for Supabase and Cloudflare, independently from project probes.
3. Detect HTTP 429, Retry-After and low remaining rate-limit headers, Cloudflare edge errors, latency degradation, Worker errors/resource-limit outcomes, and configurable usage headroom from authenticated analytics.
4. Replace unknown health with explicit degraded monitoring when evidence is missing, malformed or stale. Do not substitute operational for missing evidence. Historical days without observations display No data, not invented successes.
5. Allow sanitized, expiring service heartbeat evidence for workflows without safe read-only probes. Propagate observed database/API/provider failures to declared dependent services without treating dependencies alone as workflow certification.
6. Add secret-only collector configuration, GitHub secret mappings, migration of existing snapshots, truthful public summaries and tests for limits, failures, missing credentials and stale data.
7. Verify local live signals and browser status states; distinguish provider-wide checks, project-specific evidence, and production activation.

Provider credential absence is a monitored configuration fault (degraded); it is not proof of a provider outage. Scope is read-only monitoring; no load generation, limit exhaustion, application mutations or permission changes.
