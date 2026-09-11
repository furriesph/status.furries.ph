# Technical context

Stack: React 19, React Router 8 SPA mode, Vite 8, TypeScript, Tailwind CSS 4 and pnpm 10.9, aligned with Partners v2. Consult `package.json` and the lockfile for exact installed versions and runnable scripts.

Commands: `pnpm dev`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm monitor`, `pnpm monitor:watch`, `pnpm validate:data`.

Hosting target: Cloudflare Pages; output: `build/client`. Monitoring target: scheduled GitHub Actions every 10 minutes at explicit off-peak minute marks. A published snapshot remains current for 30 minutes to accommodate normal GitHub Actions queue delay, then becomes Unknown. The workflow atomically retains `status.json` and `feed.xml` on the public `status-data` branch. Collector-only provider credentials are required for project telemetry; see .env.monitor.example and the runbook for GitHub secret mappings. No browser secrets or deployment credentials are needed for collection.

The production browser fetches the public GitHub Contents API for `status-data` with GitHub's raw-media response, which has a short public cache. Downloadable JSON and RSS links use public raw branch files. Never authenticate public browser data access with a token. Local status URL defaults to `/status.json`.

No live deployment is established by scaffolding. Initial repository inspection found no configured Git remote. Activation requirements and incident procedures are in `docs/runbook.md`.

Local monitoring loads ignored .env.monitor.local and .env.cloudflare.local. LOCAL_CLOUDFLARE_AUTH=wrangler refreshes existing encrypted local OAuth noninteractively; CI needs a dedicated analytics token. The watch command refreshes the local preview every 10 minutes by default, clamped to 5 minutes through 1 hour.
