# Status page implementation plan

Approved scope: a public platform status site, matching Partners v2's React 19 / React Router 8 SPA / Vite / TypeScript / Tailwind 4 / pnpm stack, with an AI-ready repository.

The target repository initially contains only Git metadata and .gitattributes. No existing application is replaced.

1. Inventory public platform surfaces and internal capabilities. Separate HTTP reachability from authenticated workflow verification. Never infer workflow health from a login shell.
2. Implement an independent, bounded HTTP collector, validated incident records, retained observations, scheduled monitoring and static hosting configuration.
3. Build an accessible responsive status overview with filtering, service details, measured history, incidents, maintenance, refresh, stale-data handling and a public JSON feed.
4. Add AGENTS.md, Memory Bank, tasks, CI, deployment/runbook documentation, and contribution/security guidance.
5. Validate types, collector edge cases, production build and rendered desktop/mobile interactions. Record deployment separately from local checks.

Acceptance: all inventoried services visible; unknown is never healthy; history contains measured samples only; monitoring failures remain visible; no browser secrets or authenticated probes; no production claims without live evidence.
