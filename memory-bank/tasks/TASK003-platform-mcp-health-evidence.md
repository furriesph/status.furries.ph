# TASK003 — MCP availability monitoring and evidence-safe status projection

**Status:** Pending\
**Added / Created:** 2026-10-07\
**Updated:** 2026-10-07\
**Programme:** FPH-MCP-2026-10\
**Suggested owner role:** Status maintainers; no individual assigned.\
**Implementation:** Not Started — 0%. Planning/research is complete; it is excluded from implementation percentage.

## Original Request

> I want you to research how to create an MCP server for the entire furries ph platform and make tasks in affected repos with step by step and phse by phase plans that will server as the anchor for progression and implementationn tracking and logs.

## Objective

Monitor MCP transport/auth/dependency availability and expose public-safe observed status through the hosted API tool, retaining an independent static status site.

## Thought Process

A shared standards-based MCP interface should extend current authoritative services and permissions. This repository retains its present ownership and runtime. Useful domain projections and canonical commands provide a stable interface; a large generic executor would bypass the platform's carefully separated roles. The plan therefore starts with contracts and read-only evidence, then adds approved writes and release proof in stages. These are design recommendations, not claims of implemented or approved production configuration.

## Scope and boundaries

- **Proposed reads:** Published observed MCP/service availability, timestamps, incidents and safe aggregate diagnostics; authenticated execution probes are distinct observations.
- **Proposed writes:** Service inventory, bounded collector probes and runbook updates; incident authoring remains existing human operator work.
- **Held / human-only boundary:** No client provider credentials, raw protected probe responses, production write probes or claims that HTTP 200/401 proves protected workflows; status collector privilege exceptions do not become MCP tools.
- Preserve unrelated work and current APIs/clients. Do not add a new account/database/provider authority.
- Application permissions, privacy projections, approval/consent and resource scope remain checked at every invocation; tool visibility is not the authorization boundary.
- Research/task creation is the delivered scope of this session. Runtime packages, tools, migrations, UI and deployments are future implementation work.

## Anchors and dependencies

- [Master roadmap and phase gates](../../../partners-api/docs/mcp/platform-mcp-programme.md)
- [Research and fetched primary sources](../../../partners-api/docs/mcp/research-2026-10-07.md)
- [Cross-repo tracker](../../../partners-api/docs/mcp/platform-mcp-tracker.json)
- [Append-only programme log](../../../partners-api/docs/mcp/progress-log.md)

P0 inventory/design can start independently. Protected implementation depends on API P1; reads on relevant P2/P3 adapters; writes on API/domain P4/P5 controls. Certification and publication wait for the actual supported slice.

**Related repository tasks:**

- [partners-api TASK055](../../../partners-api/memory-bank/tasks/TASK055-platform-mcp-gateway.md)
- [docs.furries.ph TASK027](../../../docs.furries.ph/memory-bank/tasks/TASK027-platform-mcp-developer-operations.md)

## Source evidence to reread before implementation

- [config/services.json](../../config/services.json)
- [scripts/collect-status.mjs](../../scripts/collect-status.mjs)
- [app/lib/status.ts](../../app/lib/status.ts)
- [app/lib/types.ts](../../app/lib/types.ts)
- [docs/runbook.md](../../docs/runbook.md)

Also reread AGENTS.md, applicable instructions, current package.json, core Memory Bank and related tasks. Local source and proposed designs do not establish deployed behavior. Baseline inspected HEAD: `dccc13b`; the tree had 0 existing changed/untracked paths at inventory. These counts are preservation context, not evidence that existing changes are part of this task.

## Implementation Plan

Execute the earliest eligible unchecked step. Keep shared interfaces, dependency manifests, migrations and phase-status integration under one owner; independent domain work may proceed only after its prerequisites.

### P0 — Evidence and freshness decision

- [ ] **P0.1** Add the MCP service to the proposed inventory and define transport, metadata/auth and per-domain execution evidence separately.
- [ ] **P0.2** Resolve the documented 15-minute versus implemented 30-minute stale threshold with the operator; record the authoritative rule before release.
- [ ] **P0.3** Document privileged collector exceptions and keep them isolated from MCP data-plane access.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P0 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

### P1 — Probe contract

- [ ] **P1.1** Define anonymous metadata/transport checks with bounded timeouts and no token output.
- [ ] **P1.2** Design optional server-only synthetic read probe credentials with least privilege and revocation.
- [ ] **P1.3** Keep status collection independent so a gateway outage cannot remove its own incident history.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P1 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

### P2 — Read-only pilot

- [ ] **P2.1** Project only published snapshot/incident fields through the API, preserving observedAt and freshness.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P2 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

### P3 — Approved domain reads

- [ ] **P3.1** Distinguish operational/degraded/outage/maintenance/unknown/not_launched from actual evidence.
- [ ] **P3.2** Ensure an expired or absent protected execution probe stays Unknown even if the transport is reachable.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P3 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

### P4 — Collector integration

- [ ] **P4.1** Add bounded read-only MCP checks through the existing collector/cadence without mutating platform records.
- [ ] **P4.2** Validate response schema and classify auth failure, rate limit, timeout and malformed metadata separately.
- [ ] **P4.3** Keep token/grant IDs/private result bodies out of published artifacts and logs.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P4 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

### P5 — Operations and incidents

- [ ] **P5.1** Document tool/domain disable, grant revocation and gateway rollout/rollback incident signals.
- [ ] **P5.2** Use delivery counts/receipts only as the existing observational contract permits; avoid certifying dormant jobs.
- [ ] **P5.3** Preserve incident history and service dependencies without generating fake uptime samples.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P5 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

### P6 — Failure certification

- [ ] **P6.1** Test stale/missing snapshots, gateway outage, bad auth metadata, revoked probe grant and client timeout.
- [ ] **P6.2** Assert transport health never upgrades a missing workflow observation.
- [ ] **P6.3** Run full local status checks; capture screenshots if inventory/status UI presentation changes.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P6 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

### P7 — Monitoring activation

- [ ] **P7.1** Deploy status through Git integration and verify collector Actions/cadence plus public artifact freshness separately.
- [ ] **P7.2** Keep MCP in not_launched/Unknown until each corresponding observation is available.
- [ ] **P7.3** Record actual monitoring/hosted evidence in task/index and central release gates.

**Exit:** Record this phase's result, changed files, exact checks and applicable evidence in the progress table/log; satisfy P7 in the [master gate table](../../../partners-api/docs/mcp/platform-mcp-programme.md#phase-gates-and-execution-order) before dependent work.

## Acceptance criteria

- [ ] Every in-scope family is mapped to the authoritative command/query, actor permission, exact resource key, private-field projection and released/held classification.
- [ ] Enabled reads agree with ordinary API/UI behavior for the same actor; privacy/denial cases pass with bounded schema/pagination/freshness.
- [ ] Approved writes preserve canonical state, current validation, expected versions, audit and retry receipts; uncertain outcomes recover without duplicate effects.
- [ ] Revoked account/grant/membership/capability and expired required MFA fail even after earlier discovery or preview.
- [ ] Current first-party workflows function before and after any shared-command change.
- [ ] Held/provider/offline policies remain enforced; approval, deployment and downstream delivery are not inferred from fixtures.
- [ ] Any later visual or UX change includes desktop/mobile screenshots and relevant interaction/accessibility checks.
- [ ] Each shipped cohort has exact local, installed-client, source/deployment, authenticated-hosted and applicable provider/physical evidence, plus a rollback path.
- [ ] Task/index/master tracker and dated logs accurately show completed work and remaining gates.

## Progress Tracking

**Overall Status:** Not Started — 0% implementation.\
**Planning:** Complete — cited research, owner mapping and ordered task anchor created.

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| R0 | Research and durable task plan | Complete | 2026-10-07 | Planning only; runtime/client/hosted behavior unverified. |
| P0 | Evidence and freshness decision | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |
| P1 | Probe contract | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |
| P2 | Read-only pilot | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |
| P3 | Approved domain reads | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |
| P4 | Collector integration | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |
| P5 | Operations and incidents | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |
| P6 | Failure certification | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |
| P7 | Monitoring activation | Not Started | 2026-10-07 | Evidence required before completion; see phase steps and master gate. |

## Validation

Current runnable commands for this repository, verified against the current manifest or installed-tool dependencies. Run from this repository when the relevant implementation/content is changed:

```powershell
pnpm typecheck
pnpm test
pnpm validate:data
pnpm build
git diff --check
```

These commands are future implementation checks and were not run merely to claim this plan works. No MCP conformance/evaluation script currently exists in this repository; the API task must add and execute an appropriate entry before recording protocol success. Choose existing focused domain suites for changed paths and record them by exact name. Do not run historic Astro checks for canonical React apps.

Planning validation checks task/index uniqueness, local/cross-repo/source links, required structure, phase IDs, available command names, truthful zero implementation state and preservation of prior index/update content. See the final dated validation entry in the central log.

## Progress Log

### 2026-10-07 — Research and planning anchor

- Created this task from current repository guidance/source and primary MCP, Cloudflare, OpenAI and Supabase research.
- Recorded owner scope, ordered phase steps, dependencies, acceptance evidence, held operations and actual repository commands.
- Added the task to this repository's index and the shared programme tracker.
- Runtime implementation has not started. No dependencies, migrations, cloud resources, OAuth clients/grants, external messages or deployment were created.
- Next eligible work: P0.1, after reconciling the current working tree and related task contracts.

### Entry template for future sessions

```text
Date/time (Asia/Singapore), phase and step IDs:
Status change / concise outcome:
Changed files and source revision:
Decision and rationale:
Commands/checks; pass/fail; safe evidence path:
Evidence level and exact proof boundary:
Failure/recovery or dependency/blocker:
Next eligible step:
Task table, index and master tracker updated:
```

Append logs; do not erase prior failures or unverified gates. Update Updated/status, phase step checkboxes, subtask table and index together. Keep credentials, personal data, real recipient lists and protected runtime audit payloads out of task files.

## Next steps

Resume **P0.1**. Publish the exact domain route/permission/field inventory into the central coverage ledger, resolve the applicable open design decisions, then complete that phase's exit evidence before starting dependent implementation.
