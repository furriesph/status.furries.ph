# Contributing

Read `AGENTS.md`, the Memory Bank and the matching `.github/instructions/` files before editing. Use `package.json` as the command reference.

Keep service IDs stable because observations and incidents refer to them. New services need a clear description, group and honest check strategy. Prefer a reviewed public health endpoint. If only a landing page is available, describe that limitation. If no safe check exists, use a service-owned heartbeat whose absence produces degraded monitoring. Use lifecycle only for a verified prelaunch component.

Status messages and incident updates must be suitable for public display. Never include secrets or private customer details. Do not remove outage history to make metrics look better or fill gaps with assumed successes.

Validate relevant changes:

```sh
pnpm typecheck
pnpm test
pnpm validate:data
pnpm build
```

Use `pnpm monitor` to verify deliberate probe changes against configured endpoints and providers and inspect generated output. For UI changes, attach desktop and mobile screenshots and verify keyboard navigation and status text. A new dependency should have a concrete need.

Describe the user-visible behavior, validation results and monitoring or deployment limitations in the pull request. Update `CHANGELOG.md`, `docs/runbook.md` and Memory Bank records when behavior or operations change. Production deployment and DNS configuration require explicit authorization.
