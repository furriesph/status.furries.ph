# AI agent guide

This repository is the public Furries PH status site. Its job is to report observed availability honestly and remain useful when other platform services fail.

## Read first

Read the Memory Bank in order: `memory-bank/projectbrief.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`, `activeContext.md`, `progress.md`, then `memory-bank/tasks/_index.md` and relevant tasks. Read matching files in `.github/instructions/` before changing code. Consult `package.json` for actual commands.

## Architecture and boundaries

- Use React 19, React Router 8 in SPA mode, Vite 8, TypeScript, Tailwind CSS 4 and pnpm 10.9, matching Partners v2.
- Keep the public site static. The Node collector runs outside the browser, and GitHub Actions schedules collection. Cloudflare Pages serves `build/client`.
- HTTP probes establish public endpoint reachability only. A successful login page cannot certify authentication, moderation, social publishing, payments or another protected workflow.
- Every platform surface belongs in the service inventory, including capabilities that currently have no safe probe. Use reviewed platform reads, operational receipt/count telemetry and media probes. Genuinely missing, stale or unverifiable evidence is `unknown` with `monitoring-gap` evidence; do not disguise a gap as degradation. Explicit prelaunch entries use `not_launched`.
- A missing check, a failed collector, or data older than 15 minutes must never become a healthy result. Keep historical observations measured; never invent uptime or backfill successes.
- Retain 30 days of observations. Any history percentage is the proportion of recorded samples, not continuous uptime or an SLA.
- Incident records are operator statements with affected service IDs and timestamped updates. Preserve resolved incident history and distinguish scheduled maintenance from current impact.
- No browser credentials, provider keys, client authentication, private identifiers or sensitive incident details. Authorized server-only Supabase and Cloudflare probes use collector secrets; never expose credentials, query rows, raw provider payloads, or provider identifiers. Reviewed aggregate request counts and headroom summaries may be public.

## Working agreement

- Keep changes bounded and document behavior changes in the Memory Bank, task log, changelog and runbook as appropriate.
- Update the existing task when continuing work; create `TASK###-slug.md` and update the task index for a new tracked task.
- Run `pnpm typecheck`, `pnpm test`, `pnpm validate:data` and `pnpm build` for relevant implementation changes. Use `pnpm monitor:watch` for continuous local preview updates. Run `pnpm monitor` only when intending to collect fresh endpoint and provider observations.
- For UI changes, inspect rendered desktop and mobile behavior and provide screenshots. Maintain keyboard access, visible focus, readable contrast and text labels alongside status colors.
- Report local checks, real endpoint observations, deployed site verification and CI execution separately. A successful build is not deployment.
- Do not publish, change DNS or add cloud resources without authorization. Never commit secrets or generated diagnostic files containing private information.

See `docs/runbook.md` for operating procedures and `SECURITY.md` for disclosure guidance.
