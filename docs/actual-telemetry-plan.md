# Actual telemetry correction

The user clarified on 2026-09-10 that Unknown is valid when health cannot be established. Replacing missing evidence with Degraded did not satisfy the request. This report precedes the corrective implementation.

Priority fixes:

1. Restore Unknown for genuinely missing, invalid or stale observations, distinct from observed degradation.
2. Replace placeholder workflow heartbeat checks with real, read-only production data and service checks wherever authorized access exists. Describe precisely what was exercised and what remains unmeasured.
3. Locate and verify authorized Cloudflare analytics configuration without disclosing credentials. Discover actual account and Worker scopes rather than assuming them.
4. Inspect delivery queues, worker execution records, media proxy responses and provider readiness to populate operational details. Do not send messages, charge payments or manufacture activity to obtain green results.
5. Preserve successful direct observations when a broad provider incident does not establish project impact. Surface provider risk separately.
6. Verify each inventory entry against live evidence and retain specific Unknown reasons for any genuine external barrier. Do not mark the request complete with unresolved placeholders.

Validation includes adapter tests, live reads, full snapshot validation, production build and desktop/mobile browser evidence. Prior no-unknown policy is superseded by this user correction.
