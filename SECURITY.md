# Security policy

Do not publish credentials, private operational details, personal data or exploit instructions in a public issue or incident record.

Report security vulnerabilities through GitHub's private vulnerability reporting feature if it is enabled for this repository. Otherwise contact the repository maintainers through an established private channel. This repository does not imply that a particular reporting feature or response-time commitment has been configured.

Include the affected code or endpoint, reproducible steps, impact and a minimal redacted example. Do not access another person's account or run destructive tests.

The public status site serves static data and carries no platform authentication. Collectors access reviewed public HTTP endpoints and authorized Supabase/Cloudflare APIs with bounded requests. Provider credentials stay in collector environment variables or GitHub secrets; never use VITE_ variables for them. Supabase query results and raw metrics are discarded after validation. Cloudflare tokens require only the analytics read permissions available to the configured account and zone. Reject private network targets, redirect credential forwarding and arbitrary heartbeat fields. Status data, incidents, feed text and probe errors are public; redact sensitive details before publication.

Dependency changes and workflow write permissions deserve review. Protect production branches and use the least permissions required. Public endpoint reachability is not security certification or a guarantee of protected workflow availability.
