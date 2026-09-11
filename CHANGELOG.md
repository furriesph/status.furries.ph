# Changelog

## Unreleased

- Expand coverage to 39 components with Supabase query/auth/database-capacity probes, Cloudflare runtime/request analytics and public provider incident feeds.
- Detect rate limits, slow HTTP responses, database headroom warnings and configured account request budgets.
- Preserve Unknown for genuinely unavailable/stale/insufficient evidence; add Not launched and neutral historical No data.
- Replace registry heartbeat placeholders with real platform reads, operational count/receipt telemetry and verified media image delivery; retain scoped dependency impact and collector-only secrets.
- Validate Supabase, platform, operational, media and Cloudflare account/zone reads live locally. Add noninteractive existing Wrangler OAuth refresh and continuous local preview collection.
- Keep absent recent workflow successes Unknown and report observed SMS readiness gaps. Cloudflare billing permission blocks plan quota discovery; no quota is invented.
- Show expanded, time-aware progress bars and diagnostic details for every service; publish product headroom only from observed limits and label unavailable quotas plainly.
- Remove the repeated raw-observation facts from expanded rows; live signal bars and diagnosis now present each measurement once.
- Publish incident and maintenance source from Markdown files with common Markdown extensions, validated front matter and safely rendered public updates.
- Render the Markdown extension flavor set for public updates: CommonMark, GFM tables/task lists/strikethrough/footnotes/autolinks, and hard breaks.
- Publish every incident exposed by Supabase and Cloudflare public summary feeds as scoped generated records, retain them as resolved history after a successful absence, and keep provider payload bodies private.
- Reduce scheduled and local continuous collection to a 10-minute default cadence to limit Cloudflare account API usage.
- Publish retained status data from the public repository's scheduled GitHub Actions collector to the `status-data` branch.


- Introduce a public Furries PH status dashboard using the Partners v2 frontend stack.
- Add public endpoint observations, explicit capability coverage, incident records, maintenance and measured history.
- Add scheduled collection, static hosting configuration and machine-readable status output.
- Add AI contributor instructions, a Memory Bank, operational runbook and contribution templates.

Production hosting and scheduled monitoring require separate activation and verification.
