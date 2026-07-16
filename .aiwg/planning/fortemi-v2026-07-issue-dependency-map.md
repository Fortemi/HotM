---
title: Fortemi v2026.7.1 Issue Dependency Map
status: proposed
date: 2026-07-14
artifact_type: issue-dependency-map
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/security/fortemi-v2026-07-security-redaction-controls.md
  - .aiwg/risks/fortemi-v2026-07-integration-risk-register.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
  - .aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md
  - .aiwg/reports/fortemi-v2026-07-artifact-index.md
---

# Fortemi v2026.7.1 Issue Dependency Map

## Purpose

Record the issue-level critical path for moving HotM from the Fortemi v2026.7.1 planning baseline to implementation evidence. This map complements the implementation roadmap by making tracker dependencies, parallelization windows, and gate blockers explicit for #242, #253, #254, #255, #256, #257, #258, and #259.

Current validation baseline:

| Item | Count |
| --- | ---: |
| Fortemi routes | 200 |
| Route families | 36 |
| Covered routes | 186 |
| Partial routes | 0 |
| Gap routes | 0 |
| Decision-needed routes | 0 |
| Documented-exclusion routes | 14 |

## Critical Path

1. **#253 route verifier and evidence guard remains the publication critical path.** Local verifier output is clean and CI wiring exists; a passing live CI receipt or an accepted local-preflight-only decision is still required for final gate closure.
2. **#242 native Fortemi streaming chat is implemented locally.** Preserve parser, resume, fallback, and Agent UX tests in PR packaging.
3. **#254 streaming health is implemented locally.** Preserve populated, missing, malformed, and unavailable endpoint tests.
4. **#255 ingest stream and tokens are implemented locally.** Backup remains the first UX surface; agent ingest tool exposure waits for a later #258 decision.
5. **#256 incoming receivers and inbound sources are implemented locally.** Preserve separate Admin models for outbound hooks, incoming receivers, and inbound sources.
6. **#257 backup, TUS, and portable shard parity are implemented locally.** Preserve attachment-byte sidecar limitation copy and TUS no-checksum-extension tests.
7. **#258 agent tool metadata/gating scaffold is implemented locally.** New diagnostic tools remain deferred until disabled-state and redaction fixtures are accepted.
8. **#259 vision/audio/call disposition is implemented locally.** Vision/audio and REST call diagnostics are covered; Twilio realtime remains a documented exclusion.

## Dependency Table

| Issue | Blocks | Blocked by | Required closeout evidence |
| --- | --- | --- | --- |
| #253 route verifier and evidence parity | All implementation-pass claims; route-family status changes for #242/#254/#255/#256/#257/#258/#259 | None | Local or CI verifier output for route extraction, unclassified-family failure, evidence-map parity, stale path detection, missing tracker detection, weak-evidence reporting, and mixed-disposition support. |
| #242 native Fortemi streaming chat | #254 UX consistency, #255 stream parser reuse, #258 chat tool/capability claims | #253 recommended | Shared stream helper tests for delta/done/error/abort/401/410/429/503/fallback plus Agent UX evidence for `/api/v1/chat/stream`. |
| #254 streaming health/backpressure | #256 connector health summary, #259 call diagnostics if operator diagnostics are accepted | #253 and stream/degraded-state patterns from #242 | Typed `/api/v1/health/streaming` parser, Admin/Realtime Debug rendering, populated/missing/degraded/malformed fixture tests. |
| #255 ingest stream/tokens | #257 Backup stream ingest, #258 ingest tool candidate | Shared stream parser from #242 | Token mint/revoke client coverage, NDJSON stream handling for ack/progress/done/error, copy-once/redaction assertions, unsupported fallback states. |
| #256 incoming receivers/inbound sources | #258 incoming/inbound diagnostics tools | #253 and security/redaction controls | Admin lifecycle coverage for receiver/source create/update/delete/test/list states, secret masking, cost-gated/disabled handling, outbound-hook separation. |
| #257 backup/TUS/portable shard parity | #258 backup/archive diagnostics tools can consume the covered boundary | #253; #255 if stream ingest enters Backup | TUS verb/error tests, backup/download/archive UX parity tests, sidecar limitation copy assertions, and redaction checks for paths and archive identifiers are covered. |
| #258 agent tool refresh | Final agent coverage claim; #259 media/call tool decisions | #242, #255, #256, #257 for implemented primitives | Capability-gated tool registry, role/scope-disabled states, prompt/tool description alignment, redaction tests, explicit non-tool rationale for excluded families. |
| #259 vision/audio/realtime calls | Final media/call evidence preservation | ADR-011 acceptance; #258 for later agent surfaces; #254 for call telemetry context | Attachment preview UX for vision/audio, redacted call detail diagnostics, and Twilio realtime documented-exclusion tests/rationale. |

## Parallelization Windows

| Window | Can proceed in parallel | Guardrail |
| --- | --- | --- |
| A | #253 verifier skeleton and #242 stream parser | Hold the current route inventory baseline fixed until #253 can report intentional status changes. |
| B | #254 streaming health and #255 ingest stream fixtures | Share degraded-state and stream parser semantics once #242 parser shape stabilizes. |
| C | #256 incoming/inbound Admin and #257 backup/TUS parity | Both must satisfy security controls and update the capability matrix when route-family proof changes. |
| D | #258 agent registry scaffolding while #242/#255/#256/#257 implement primitives | Keep new tools disabled or hidden until capability, role/scope, and route-family evidence are available. |
| E | #259 media/call disposition follow-through after typed client layer lands | Keep call-detail diagnostics covered only with redaction tests; keep Twilio realtime as a documented exclusion until a future implementation slice intentionally changes the claim boundary. |

## Gate Blockers

The Fortemi integration gate cannot move from local implementation evidence and published tracker receipts to final CI/local-preflight policy closure until:

- #253 route verifier output is adopted in CI or explicitly accepted as a local preflight.
- Every `gap`, `partial`, `decision_needed`, and weak covered-family row remains at zero for the current Fortemi checkout.
- Documented exclusions remain intentional, with Twilio realtime outside the current HotM claim boundary.
- The gate, route inventory, capability matrix, workflow scenarios, scenario test matrix, risk register, handoff, and traceability report stay synchronized with the current verifier output.

## Update Rules

- If an issue changes a route-family status, update the route inventory, capability matrix, traceability report, and gate report in the same change.
- If an issue changes workflow behavior, update the workflow scenarios and scenario test matrix before closing the issue.
- If an issue touches tokens, connector secrets, archive paths, provider identifiers, transcripts, call identifiers, or agent output, update or satisfy the security/redaction controls.
- If a risk is retired, update the risk register with the command, test, review, or design evidence that proves retirement.
- If Fortemi advances past this baseline, rerun the route generator and re-evaluate this dependency map before starting a new implementation pass.
