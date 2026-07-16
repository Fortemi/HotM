---
title: Fortemi v2026.7.1 Implementation Roadmap
status: proposed
date: 2026-07-14
artifact_type: implementation-roadmap
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/planning/fortemi-v2026-07-hotm-integration-plan.md
  - .aiwg/planning/fortemi-v2026-07-issue-dependency-map.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/risks/fortemi-v2026-07-integration-risk-register.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
  - .aiwg/reports/fortemi-v2026-07-api-integration-traceability.md
  - .aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md
---

# Fortemi v2026.7.1 Implementation Roadmap

## Purpose

Sequence the remaining publication work after the HotM implementation evidence for Fortemi v2026.7.1. This roadmap uses the generated route inventory at Fortemi commit `f6733252`, latest release tag `v2026.7.1`, and the route-family proof checklist in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.

The evidence-strength baseline for existing coverage is recorded in `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md`.

The verifier evidence-map seed is `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json`.

Integration risks and retirement evidence are tracked in `.aiwg/risks/fortemi-v2026-07-integration-risk-register.md`.

Agent-tool route-family coverage and #258 candidate decisions are tracked in `.aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md`.

Workflow-level acceptance scenarios for the UX slices are tracked in `.aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md`.

Issue-level critical path, parallelization windows, and gate blockers are tracked in `.aiwg/planning/fortemi-v2026-07-issue-dependency-map.md`.

## Current Baseline

| Inventory status | Count | Implementation meaning |
| --- | ---: | --- |
| covered | 186 | Preserve coverage and regression tests. |
| partial | 0 | Reopen only if route drift or evidence review finds missing parity. |
| gap | 0 | No uncovered route family remains after #242/#254/#255/#256 evidence; keep this at zero in the verifier. |
| decision_needed | 0 | No unresolved product/UX disposition remains in the current verifier baseline. |
| documented_exclusion | 14 | Keep excluded until a product slice changes the claim boundary. |

## Roadmap Phases

| Phase | Objective | Primary issues | Depends on | Exit evidence |
| --- | --- | --- | --- | --- |
| 0 | Formalize the Fortemi route inventory verifier and CI guard. | #253 | Current route inventory script and artifact baseline. | CI or local verifier fails on unclassified route families and records status-count changes intentionally. |
| 1 | Add shared stream transport primitives for POST-SSE, abort, terminal events, retry metadata, and normalized degraded states. | #242, #255 | #253 baseline for route expectations. | Stream helper tests cover delta/done/error, abort, 401/410/429/503, and unsupported fallback behavior. |
| 2 | Implement native Fortemi chat streaming and streaming health telemetry. | #242, #254 | Phase 1 stream transport. | Agent uses `/api/v1/chat/stream` when supported; Admin/API Surface or Realtime Debug renders `/health/streaming` blocks and degraded states. |
| 3 | Implement ingest stream/tokens and backup/attachment parity. | #255, #257 | Phase 1 stream transport; Phase 2 health state patterns. | Backup exposes tokenized stream ingest; TUS and backup/download/knowledge-archive parity tests cover current Fortemi route family and sidecar limitation copy. |
| 4 | Implement incoming receiver and inbound source Admin controls. | #256 | Phase 0 verifier; compatibility and redaction guard patterns. | Admin > Webhooks distinguishes outbound hooks, incoming receivers, and inbound sources with validation, disabled/cost-gated states, and secret redaction. |
| 5 | Refresh agent tool coverage against current Fortemi capabilities. | #258 | Phases 2-4 for stable API/client primitives. | Agent tool matrix maps tools to endpoint families; unsupported capabilities are disabled with reasons; prompt/tool descriptions match enabled tools. |
| 6 | Preserve ADR-011 media/call dispositions and keep agent exposure gated. | #259 | #258 for later tool disposition; #254 for diagnostics health context. | Vision/audio attachment actions and REST call diagnostics are covered; Twilio realtime is a documented exclusion with tests/rationale. |
| 7 | Refresh gate and traceability evidence. | #243, #253 | Phases 0-6. | Gate report includes command output and test evidence for every closed issue; route inventory has no gaps without issue-backed disposition. |

## Dependency Matrix

| Work item | Blocks | Blocked by | Notes |
| --- | --- | --- | --- |
| #253 Contract verifier | All implementation-pass claims | None | Should land first so later PRs update route status intentionally. |
| Shared stream transport | #242, #255 | #253 recommended | Can be implemented as part of #242 if kept reusable. |
| #242 Native chat stream | #254 UX consistency, #258 agent capability claims | Shared stream transport | Implemented for Fortemi Agent stream; preserve tests and fallback behavior. |
| #254 Streaming health | #255 degraded-state UX, #259 call diagnostics if included | #253, stream/error normalization patterns | Admin health should support missing blocks as unknown. |
| #255 Ingest stream/tokens | #257 import workflows, #258 ingest tool | Shared stream transport | Backup is the first UX surface; agent tool can follow. |
| #256 Incoming/inbound Admin | #258 incoming/inbound diagnostics tool | #253, compatibility/redaction guards | Keep outbound webhooks conceptually separate. |
| #257 Backup/attachment parity | #258 backup/archive diagnostics tool | #253, #255 if stream ingest enters Backup | Must preserve portable byte-sidecar limitation wording. |
| #258 Agent tool refresh | #259 tool disposition decisions | #242, #255, #256, #257 | Agent tools must reflect capability gates and role/scope state. |
| #259 Vision/audio/calls disposition | Final media/call coverage evidence | ADR-011, #254 and #258 recommended | Vision/audio attachment actions and REST call diagnostics are covered; Twilio realtime remains a documented exclusion. |

## Risk Retirement Dependencies

| Risk | Must be retired or mitigated by | Blocking implication |
| --- | --- | --- |
| FTI-001 Route inventory drift | #253 | Local verifier evidence and CI wiring exist; final closure still needs a passing live CI receipt or accepted local-preflight-only decision. |
| FTI-002 Stream transport duplication | #242/#255 | Local chat stream and ingest stream tests pass; preserve parser/degraded-state evidence. |
| FTI-003 Capability/role gating | #244/#247/#256/#257/#258 | Production-affecting controls stay disabled from unknown or insufficient-role states. |
| FTI-004 Secret exposure | #255/#256/#257/#258 | Secret-bearing surfaces cannot close without redaction tests. |
| FTI-005 Mixed media/call dispositions | #253/#259 | `realtime_calls` is resolved with route-level evidence: `/calls/{id}` is covered by redacted Admin diagnostics, while `/realtime/twilio/{provider_call_id}` is a documented exclusion. |
| FTI-006 Backup/TUS/archive claim drift | #257 | Local backup/archive/TUS parity and copy assertions pass; keep evidence attached to closeout. |
| FTI-007 Weak covered-family evidence | #253 | Retired locally: evidence audit reports zero weak covered families. |
| FTI-008 Agent tool overclaiming | #258 | Metadata/gating scaffold is implemented; new diagnostic tools stay deferred until disabled-state/redaction fixtures are accepted. |

## Route-Family Closeout Rules

- A `gap` route family closes only when HotM has typed API/client support plus UX/tool coverage, or the family is reclassified as a documented exclusion with rationale.
- A `partial` route family closes only when route-level parity and tests cover the current Fortemi route family, or the missing routes are explicitly excluded.
- A `decision_needed` route closes only after an issue records a product disposition and the route inventory status changes accordingly; the current verifier baseline has none.
- A `documented_exclusion` route family stays excluded until a new implementation issue changes the claim boundary.

## Remaining Publication Slice

1. Publish tracker comments or PR closeout text for the locally implemented slices.
2. Capture a passing live `fortemi-route-inventory` CI receipt or document an accepted local-preflight-only gate.
3. Keep the current validation command set attached to the closeout packet.
4. Rerun route inventory before final closure if Fortemi changes past commit `f6733252`.

This order preserves the current local implementation evidence and published tracker receipts while making the remaining CI/local-preflight policy requirement explicit.

Each phase should update the capability surface matrix when route-family status or proof expectations change.
