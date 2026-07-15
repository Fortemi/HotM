---
title: Fortemi v2026.7.1 HotM Integration Risk Register
status: proposed
date: 2026-07-15
artifact_type: risk-register
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/fortemi-route-verifier-spec-2026-07.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
---

# Fortemi v2026.7.1 HotM Integration Risk Register

## Purpose

Track risks that can prevent HotM from reaching seamless integration with the current Fortemi server API, feature, and tool surface. This register is scoped to the Fortemi `v2026.7.1` audit baseline at commit `f6733252` and the HotM planning baseline at commit `ce42f9d`.

Risk scoring follows the SDLC risk-management cycle:

| Priority | Score | Meaning |
| --- | ---: | --- |
| P0 Show Stopper | 21-25 | Project cannot proceed without resolution. |
| P1 High | 16-20 | Major impact to schedule, scope, or quality. |
| P2 Medium | 11-15 | Moderate impact; workaround or staged mitigation exists. |
| P3 Low | 1-10 | Minor impact; accept and monitor. |

## Active Risks

| Risk ID | Title | Category | Prob. | Impact | Score | Priority | Status | Owner | Target | Traceability |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| FTI-001 | Route inventory drift outpaces HotM coverage evidence | Technical | 4 | 4 | 16 | P1 High | Mitigated locally | HotM integration lead | Before closing #253 | #253, ADR-010, verifier spec |
| FTI-002 | Stream transport duplication creates inconsistent chat and ingest UX | Technical | 4 | 4 | 16 | P1 High | Mitigated locally | Frontend lead | Before closing #242/#255 | #242, #255, roadmap phases 1-3 |
| FTI-003 | Capability or role gating enables unsupported production actions | Security | 3 | 5 | 15 | P2 Medium | Mitigated locally | Security/UX lead | Before enabling new Admin actions | #244, #247, #256, #257, #258 |
| FTI-004 | Secret-bearing surfaces leak tokens, webhook secrets, ingest cursors, or tenant diagnostics | Security | 3 | 5 | 15 | P2 Medium | Mitigated locally | Security/QA lead | Before closing #255/#256/#257/#258 | #255, #256, #257, #258 |
| FTI-005 | Mixed media/call dispositions remain family-level only and block accurate closeout | Architecture | 4 | 3 | 12 | P2 Medium | Retired locally | Architecture owner | Before closing #259 | ADR-011, #259, verifier spec |
| FTI-006 | Partial backup/TUS/archive coverage leads to overstated portability claims | Product/Technical | 4 | 4 | 16 | P1 High | Mitigated locally | Backup/attachments owner | Before closing #257 | #257, capability matrix |
| FTI-007 | Weak covered families hide missing route-level tests | Quality | 4 | 3 | 12 | P2 Medium | Retired locally | QA lead | Before gate PASS | #253, coverage evidence audit |
| FTI-008 | Agent tool descriptions imply unavailable Fortemi operations | Product/Safety | 3 | 4 | 12 | P2 Medium | Mitigated locally | Agent tooling owner | Before closing #258 | #258, #259 |

## Risk Details

### FTI-001: Route inventory drift outpaces HotM coverage evidence

**Description:** Fortemi can add, remove, or alter routes while HotM still reports the previous status counts, producing stale UX claims or missed implementation work.

**Mitigation plan:**
- Implement `.aiwg/testing/fortemi-route-verifier-spec-2026-07.md` under #253.
- Fail on unclassified routes, evidence-map parity mismatches, missing trackers, stale evidence paths, and undocumented status drift.
- Require route inventory and capability matrix updates in implementation PRs that change any route-family status.

**Contingency:** Treat any verifier drift as a gate blocker and keep affected route families in `gap`, `partial`, or `decision_needed` until reviewed.

**Retirement evidence:** CI or documented local preflight output proves route count, family count, status counts, and evidence-map parity for the current Fortemi baseline.

**Current evidence:** `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh` passes locally for Fortemi commit `f6733252`, tag `v2026.7.1`, 200 routes, 36 families, 186 covered routes, 14 documented exclusions, and clean diagnostics. Tracker comments are published; CI adoption or accepted local-preflight policy remains open.

### FTI-002: Stream transport duplication creates inconsistent chat and ingest UX

**Description:** Native chat streaming and NDJSON ingest both need POST streaming, abort behavior, terminal events, retry metadata, and degraded-state handling. Implementing separate parsers risks divergent behavior and duplicated bugs.

**Mitigation plan:**
- Land shared stream primitives through #242 or an explicit shared transport slice.
- Reuse the same parser/error-state model for #242 native chat streaming and #255 stream ingest.
- Add fixture tests for delta/progress, done, error, abort, 401, 410, 429, and 503 states.

**Contingency:** Keep ingest stream UX behind capability gating until shared stream behavior is proven.

**Retirement evidence:** Focused stream helper tests and at least one consuming path each for chat and ingest pass with the same degraded-state vocabulary.

**Current evidence:** `ui/src/api/__tests__/chat.test.ts`, `ui/src/api/__tests__/ingest.test.ts`, and Backup/Agent tests pass locally; the full UI suite and typecheck also pass.

### FTI-003: Capability or role gating enables unsupported production actions

**Description:** New Admin actions for incoming receivers, inbound sources, backup/archive, inference, and agent tools can become visible before server capability, role/scope, or product maturity is sufficient.

**Mitigation plan:**
- Normalize compatibility metadata before enabling advanced flows.
- Disable production-affecting actions from unknown, preview-only, unavailable, or insufficient-role states.
- Add fixture coverage for local sidecar, single-tenant, hosted admin, insufficient role, incompatible API, and unreachable API states.

**Contingency:** Render diagnostics-only views until capability and role gates pass.

**Retirement evidence:** Capability-gated UI tests show disabled states and reason text across Admin and agent surfaces.

**Current evidence:** Admin capability, Webhooks, Backup, OAuth diagnostics, and agent metadata tests pass locally. Production-affecting agent diagnostic tools remain deferred unless role/capability/redaction fixtures are accepted.

### FTI-004: Secret-bearing surfaces leak tokens, webhook secrets, ingest cursors, or tenant diagnostics

**Description:** Ingest tokens, webhook receiver secrets, API keys, tenant diagnostics, and support data can appear in UI, logs, agent messages, or test snapshots if redaction rules are inconsistent.

**Mitigation plan:**
- Treat tokens, secrets, private paths, connector credentials, tenant/auth diagnostics, and ingest cursors as redacted by default.
- Keep API keys and one-time secrets copy-once where appropriate.
- Add snapshot and fixture checks that assert sensitive literals are absent from rendered UI and agent tool output.

**Contingency:** Keep affected flows disabled or diagnostics-only until redaction tests exist.

**Retirement evidence:** Redaction tests pass for #255, #256, #257, and #258 fixtures.

**Current evidence:** Stream ingest token tests, incoming/inbound receiver tests, backup/archive path/copy tests, media/call redaction tests, and agent non-tool boundary tests pass locally.

### FTI-005: Mixed media/call dispositions remain family-level only and block accurate closeout

**Description:** `realtime_calls` includes a likely included diagnostic route and a likely excluded Twilio realtime route. A family-only status model forces either overstated coverage or persistent `decision_needed`.

**Mitigation plan:**
- Apply ADR-011 proposed dispositions under #259.
- Add route-level overrides or split the family in the #253 verifier before closing mixed-disposition families.
- Keep the family `decision_needed` until the verifier can represent the final route-level decisions.

**Contingency:** Document both routes as excluded until an implementation slice accepts call diagnostics.

**Retirement evidence:** Route inventory distinguishes `GET /api/v1/calls/{id}` from `GET /api/v1/realtime/twilio/{provider_call_id}` with issue-backed route-level statuses.

**Current evidence:** ADR-011 and route inventory preserve REST call diagnostics as covered and Twilio realtime as a documented exclusion; local call diagnostic and no-claim tests pass.

### FTI-006: Partial backup/TUS/archive coverage leads to overstated portability claims

**Description:** HotM already has backup and TUS support, but Fortemi backup/archive and portable attachment-sidecar behavior is broader than the current proof. UX copy can imply byte-level portability the server does not currently restore.

**Mitigation plan:**
- Use #257 to preserve TUS OPTIONS/HEAD/GET/PATCH/DELETE, offset mismatch, size-limit, expired/not-found, no checksum-extension, termination, and resume path tests.
- Add or explicitly exclude database download, memory download, knowledge archive upload/download, and metadata update routes.
- Keep copy explicit that portable imports do not restore attachment records or bytes unless server behavior changes.

**Contingency:** Keep advanced archive operations in diagnostics/documented-exclusion state.

**Retirement evidence:** Backup/TUS route-level tests and copy assertions pass; capability matrix status changes from `partial` only after route parity is proven.

**Current evidence:** Backup API, BackupManager, TUS uploader, upload store, and JobQueueMonitor tests pass locally; route inventory has zero partial rows.

### FTI-007: Weak covered families hide missing route-level tests

**Description:** Weak covered-family evidence has been retired for graph, provenance, models, and contract-doc routes with focused route-level tests. Keep this risk visible until verifier output and tracker comments are published from an authenticated environment.

**Mitigation plan:**
- Use #253 to require exact source/test/UI mapping for covered families.
- Preserve focused graph diagnostics/maintenance, provenance, model discovery, and contract-doc verifier behavior.
- Reclassify any family to `partial` if exact route-level proof cannot be produced.

**Contingency:** Keep gate status conditional if future route inventory changes introduce new weak families.

**Retirement evidence:** Evidence audit now has zero weak covered families; route verifier passes with coherent family metadata.

### FTI-008: Agent tool descriptions imply unavailable Fortemi operations

**Description:** The embedded agent can describe or attempt operations that the connected Fortemi server, role, or HotM API/client layer does not support yet.

**Mitigation plan:**
- Build the #258 tool coverage matrix against route families, capability metadata, and current user context.
- Keep tool enablement behind completed API/client primitives from #242, #255, #256, and #257.
- Explicitly exclude unsafe create/delete operations until capability, role, audit, and redaction controls exist.

**Contingency:** Expose read-only diagnostic summaries instead of mutating tools.

**Retirement evidence:** Agent tool fixtures prove unavailable operations are disabled with reason text and no prompt/tool copy claims unsupported capabilities.

**Current evidence:** `agent-proxy/src/tools.ts` now exports enabled tool metadata plus deferred/excluded decisions, and focused tests prove enabled tools map to route families/intent sets while credential, PKE, rate-limit, Twilio realtime, destructive backup, and purge-style candidates remain absent. Keep this risk open until disabled-reason fixtures exist for any newly enabled diagnostic tool.

## Risk Summary

| Priority | Count | Risk IDs |
| --- | ---: | --- |
| P0 Show Stopper | 0 | - |
| P1 High | 3 mitigated locally | FTI-001, FTI-002, FTI-006 |
| P2 Medium | 3 mitigated locally, 2 retired locally | FTI-003, FTI-004, FTI-008 mitigated; FTI-005, FTI-007 retired |
| P3 Low | 0 | - |

## Gate Rules

- The Fortemi integration gate cannot close while any P1 risk lacks attached local or CI evidence.
- P2 risks may remain open only with issue-backed mitigation, owner, target, and explicit gate disposition.
- Any security risk that affects secret exposure or production action enablement blocks release claims until tests prove the mitigation.
- Any route-family status change must update this register if it retires, downgrades, or creates an integration risk.
