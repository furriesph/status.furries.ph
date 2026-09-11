---
applyTo: "app/**,scripts/**,config/**,public/**"
---

# Status integrity

Treat genuinely absent, invalid and stale evidence as Unknown with monitoring-gap evidence. Reserve degraded and outage for observed impact; never relabel unavailable telemetry as a service failure. Replace placeholder signals with reviewed real telemetry where available. Explicit prelaunch services use not_launched; historical dates without samples display neutral No data. Distinguish direct, dependency and monitoring-gap evidence; a healthy dependency never certifies a workflow. Display observation timestamps. Never infer protected workflow health from a public shell or invent historical samples. Retain measured observations for the configured 30-day window and describe sample-based percentages accurately.

Use stable service IDs and validate incident references. Keep scheduled maintenance distinct from active impact. Preserve timestamped incident updates and resolved history. Treat messages and incident content as plain untrusted text; never render them as unchecked HTML.

Keep network collection outside the browser and bound timeouts and response handling. Never publish secrets, authenticated response bodies or private endpoint details. Tests should cover failures, stale data, invalid records and history boundaries where affected.
