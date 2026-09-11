# System patterns

- Static SPA frontend with collection performed independently in Node.
- Declarative service inventory in `config/services.json` and Markdown incident source files in `content/incidents/`. The collector accepts common Markdown extensions, parses constrained front matter and a final `## Updates` section, then validates the generated incident records before publication.
- Typed snapshot contract in `app/lib/types.ts`.
- Scheduled GitHub Actions collection writes historical data atomically and publishes the public artifacts to the public `status-data` branch; static frontend deployment is separate and does not repeat for every observation.
- Fifteen-minute freshness threshold and up to 30 days of measured history.
- Snapshot v2: HTTP, Supabase query/auth/capacity, Cloudflare account analytics, provider incident feeds, reviewed platform reads, operational counts/receipts, media and lifecycle probes. Missing or expired evidence is Unknown; declared dependency failures propagate without certifying workflows.
- Incidents have stable IDs, affected service IDs and timestamped public-safe updates. Operator Markdown records are merged with every incident exposed by the Supabase/Cloudflare public summary feeds; generated records stay scoped to their provider component, exclude raw provider payload bodies and persist as resolved history after a successful later feed no longer lists them.

Keep collector observations distinct from operator incident declarations. No authentication secrets or provider credentials belong in the client or published data.
