# Verification evidence — 2026-09-10

## Implemented scope

34 service and capability entries, a bounded public HTTP collector, validated operator incidents, RSS incident deep links, retained daily history, independent scheduled publication, static React Router frontend and AI contributor guidance.

Source stack verified from the sibling Partners v2 package and configuration: React 19, React Router 8 framework SPA mode, Vite 8, TypeScript, Tailwind 4 and pnpm 10.9. Source files are formatted for maintainability.

## Live observations

Local collector at 2026-09-09T20:32:57.292Z: 10 public probes operational and 24 entries unknown. These are historical observations from this machine, not certification of production workflows. CMS redirects are not followed; protected workflows lack safe probes; the admin portal is an unlaunched scaffold. No production outage is inferred for an undeployed surface.

The API probe checks its public country-list response, not database, authentication or transactional readiness. The snapshot naturally becomes stale after 15 minutes unless collection runs again.

## Browser verification

Built-in Browser/IAB connections timed out twice; Playwright Chromium was used as the documented fallback. Desktop 1440×1100 and mobile 390×844 were inspected. The generated reference is 1435×1100; the five-pixel viewport difference is immaterial.

Verified the complete inventory count, search, category filtering, clear-filter empty state, service disclosure, daily history, methodology view, incident empty state and mobile overflow. Controlled browser-only fixtures verified stale data, unavailable JSON, malformed JSON schema, active incident override, future maintenance, incident RSS anchors and feed recovery. No fixture incident was written to public data. No page runtime errors occurred in the completed interaction pass; an intentional 503 was expected in the unavailable-feed fixture.

## Visual fidelity ledger

| Comparison | Reference and final decision |
| --- | --- |
| Layout | Retained centered shell, summary strip, horizontal views, service list and right-hand updates panel. Mobile stacks panels and reflows history. |
| Palette | Preserved pale lavender background, white panels, navy headings and blue interactions. Fixed summary heading inheriting muted unknown color. |
| Typography | Explicit sans-serif title, body and control scales; compact operational type aligned with Partners v2. |
| Controls and icons | Retained search, refresh and filter controls; Lucide paw, refresh, disclosure, file and calendar icons. Question icon clarifies unknown status. |
| Content | Replaced concept placeholder status with actual observations and expanded the illustrative subset to all 34 inventory entries. Concise capability descriptions replace repeated probe disclaimers; detailed limitations remain inside service disclosure. |
| History | Retained narrow daily bars; patterned gray denotes missing/unknown observations. Counts and dates are available in the expanded view. |
| Copy and scope deviations | Above-fold navigation/title/subtitle match. Intentional additions: complete inventory categories, inventory count, RSS subscription, real summary counts and service disclosures. No invented healthy history. |

The implementation was visually compared with the generated concept using image inspection. The listed functional/data-driven differences are intentional; no clipping, unreadable controls or horizontal mobile overflow remained.

## Deployment boundary

No Git remote exists; no remote CI/cron, Cloudflare project, custom domain or live hosted status page was activated. The runbook lists concrete activation steps. Local validation and public endpoint observations do not establish deployed readiness.

## Final validation

Type checking, all 13 collector tests, data validation and the production build passed. The browser interaction suite also passed against the production preview on port 4431. Final desktop and mobile screenshots are in output/status-desktop.png and output/status-mobile.png. The generated concept was displayed and visually inspected during implementation; its temporary tool-managed file is no longer available after the tool-session reset. The final screenshots are retained locally.
