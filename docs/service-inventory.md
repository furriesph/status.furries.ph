# Platform coverage

The 42-entry registry in `config/services.json` is authoritative. All heartbeat placeholders have been replaced by real platform, operational or media probes. Genuinely unavailable, stale or insufficient evidence is Unknown; observed errors/readiness failures may be degraded or outage. A successful read does not prove protected actions, writes, checkout or delivery. Healthy dependencies do not certify workflows.

| Component | Group | Check |
| --- | --- | --- |
| Furries PH website | Public services | Public HTTP and content assertion |
| RegoSite | Public services | Public HTTP and content assertion |
| Partners dashboard | Public services | Public HTTP and content assertion |
| Socials | Public services | Public HTTP and content assertion |
| Moderation portal | Public services | Public HTTP and content assertion |
| Support portal | Public services | Public HTTP and content assertion |
| Documentation | Public services | Public HTTP and content assertion |
| Content studio | Public services | Expected signed-out redirect and independent Sanity shell assertion |
| Platform waitlist | Public services | Public HTTP and content assertion |
| Signals | Public services | Public HTTP and content assertion |
| Platform API | Infrastructure | Public HTTP and content assertion |
| Administration portal | Public services | Explicit lifecycle |
| Authentication & account security | Infrastructure | Supabase project (auth) |
| Operational database | Infrastructure | Supabase project (database) |
| Media & file delivery | Infrastructure | Public API media proxy image payload |
| Platform administration | Operations | Reviewed service data reads; protected writes untested (admin) |
| Event management (EMS) | Operations | Reviewed service data reads; protected writes untested (ems) |
| Event planning (EPS) | Operations | Reviewed service data reads; protected writes untested (eps) |
| Finance management | Operations | Reviewed service data reads; protected writes untested (finance) |
| Asset management | Operations | Reviewed service data reads; protected writes untested (assets) |
| People & workforce | Operations | Reviewed service data reads; protected writes untested (hr) |
| LAN event operations | Operations | Recent operational count/receipt telemetry; idle success not assumed (lan) |
| Pawsports | Community workflows | Reviewed service data reads; protected writes untested (pawsports) |
| Safety reports & appeals | Community workflows | Reviewed service data reads; protected writes untested (reports) |
| Registration & ticketing | Community workflows | Reviewed service data reads; protected writes untested (registration) |
| Payment records & reconciliation | Community workflows | Manual confirmation and reconciliation records (operations) |
| Hosted external checkout | Community workflows | Explicit lifecycle: no provider configured |
| Dealers, groups & event shop | Community workflows | Reviewed service data reads; protected writes untested (dealers) |
| Social feeds & messaging | Community workflows | Reviewed service data reads; protected writes untested (social-workflows) |
| Social federation & publishing | Community workflows | Recent operational count/receipt telemetry; idle success not assumed (federation) |
| Surveys & feedback | Community workflows | Reviewed service data reads; protected writes untested (surveys) |
| Email delivery | Communications | Recent operational count/receipt telemetry; idle success not assumed (email) |
| Discord delivery | Communications | Discord bot readiness and delivery receipts (operations) |
| Telegram delivery | Communications | Telegram bot readiness and delivery receipts (operations) |
| SMS delivery | Communications | Recent operational count/receipt telemetry; idle success not assumed (sms) |
| Background jobs & webhooks | Infrastructure | Recent operational count/receipt telemetry; idle success not assumed (jobs) |
| Supabase provider | Infrastructure | Shared provider incident feed |
| Cloudflare provider | Infrastructure | Shared provider incident feed |
| Database capacity | Infrastructure | Supabase project (capacity) |
| Supabase product limits | Infrastructure | Supabase metrics (database, Auth, Realtime and pooler capacity) |
| Worker execution health | Infrastructure | Cloudflare account analytics (workers) |
| API request limits | Infrastructure | Cloudflare account analytics (requests) |

Cloudflare Worker and zone analytics, Supabase checks, platform reads, operational queries and media reads were verified locally. Billing discovery returns HTTP 403; quotas remain unconfigured until verified. Idle delivery/LAN/payment telemetry can remain Unknown despite successful reads; SMS reports its observed device/SIM readiness gap. Production collection and deployment require separate activation.
