# TASK001 — Platform status site and monitoring readiness

**Status:** Complete — repository readiness; production activation separate
**Created:** 2026-09-10

## Request

Create `status.furries.ph` for all Furries PH platform services using the Partners v2 stack and make the repository AI-ready.

## Acceptance criteria

- Inventory includes public surfaces and explicitly unknown internal capabilities.
- Collector uses bounded public probes and retains measured history without fabricated uptime.
- Responsive dashboard displays current state, freshness, history, incidents and maintenance.
- Scheduled monitoring and static hosting are configured with documented activation steps.
- AI instructions, Memory Bank, contribution guidance and runbook exist.
- Relevant types, tests, data validation, build and rendered desktop/mobile behavior are verified.

## Subtasks

- [x] Implement service inventory, collector, incident validation and history.
- [x] Implement responsive status UI and public data output.
- [x] Configure CI, scheduled monitoring and static hosting instructions.
- [x] Add AI repository guidance and operational documentation.
- [x] Record final local and rendered verification evidence.

Production activation is a separate follow-up: configure Git remote, publish source, enable Actions, configure Pages data URLs, and verify DNS/HTTPS and scheduled runs.

## Progress log

### 2026-09-10

Implementation plan created. Documentation establishes a 15-minute stale threshold, 30-day measured sample history, incident JSON workflow and explicit separation of repository readiness from production activation.

Completed 34-entry inventory and independent monitoring. Type checking, 13 Node tests, schema validation and production build passed. Playwright verified the production build at 1440×1100 and 390×844, including stale/unavailable/invalid feeds, incident override, future maintenance, RSS deep links, filtering and recovery. See `docs/verification.md`. Final local collection at 2026-09-09T20:32:57.292Z: 10 operational public checks, 24 unknown entries. No remote or cloud resources configured.

### 2026-09-10 - Superseded status policy

This completed task is a historical record. TASK002 extends the 34-entry inventory to 39 components with real provider/resource, platform, operational and media monitoring. Its latest policy preserves Unknown for genuinely unavailable evidence and adds explicit not-launched lifecycle states. Earlier counts are historical observations, not current service health.
