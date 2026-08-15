---
title: Fortemi v2026.7.1 API Integration Traceability
status: proposed
date: 2026-07-14
artifact_type: traceability-report
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
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/security/fortemi-v2026-07-security-redaction-controls.md
  - .aiwg/risks/fortemi-v2026-07-integration-risk-register.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
  - .aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md
  - .aiwg/reports/fortemi-v2026-07-artifact-index.md
  - .aiwg/planning/fortemi-v2026-07-hotm-integration-plan.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/planning/fortemi-v2026-07-issue-dependency-map.md
  - .aiwg/testing/fortemi-route-verifier-spec-2026-07.md
  - .aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md
  - .aiwg/reports/fortemi-hotm-integration-audit-2026-08-15.md
---

# Fortemi v2026.7.1 API Integration Traceability

## Generated Inventory

The generated inventory `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md` extracts 202 route declarations from Fortemi source `48bc0a0b`.

The evidence strength of current `covered` rows is audited in `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md`. Its result is limited to route-family evidence and must not be read as OpenAPI, AsyncAPI, Knowledge Shard, compatibility-negotiation, or auth-fixture conformance.

The current machine-readable route-family evidence map is `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json`.

| Status | Count | Traceability disposition |
| --- | ---: | --- |
| covered | 188 | Existing HotM API/UI/agent route-disposition evidence found. This is not operation conformance. |
| partial | 0 | No current verifier rows remain partial. |
| gap | 0 | No undisposed route family remains in the current generated verifier baseline. |
| decision_needed | 0 | No unresolved UX/product disposition remains in the current verifier baseline. |
| documented_exclusion | 14 | Excluded from current HotM claims; must remain documented. |

## Coverage Snapshot

All `Covered` entries below refer to route/surface disposition only unless a separate executable contract receipt is cited.

| Server capability family | HotM evidence | Status |
| --- | --- | --- |
| Notes, tags, versions, links, related, status | `ui/src/api/notes.ts`, `extended.ts`, `versions.ts`, `links.ts`, `tags.ts`; main UI components | Covered |
| Search and federated search | `ui/src/api/search.ts`; Search UI; agent-proxy search tool | Covered |
| Archives/memories and memory routing | `ui/src/api/archives.ts`, `memory-context.ts`; ArchiveManager | Covered |
| Jobs and pause/resume | `ui/src/api/jobs.ts`, `extended.ts`; Job panels/store | Covered |
| Events SSE and WebSocket fallback | `ui/src/api/events.ts`, `ui/src/services/realtimeEventBus.ts`, `websocket.ts` | Route-disposed; authenticated context and per-event payload conformance remain open in #285/#288 |
| Inference config/providers/audit/test-connection | `ui/src/api/inference.ts`; InferenceSettings and audit log | Covered |
| Outbound webhooks | `ui/src/api/webhooks.ts`; Admin WebhooksPanel | Covered |
| Document types | `ui/src/api/documents.ts`; Admin DocumentTypesPanel | Covered |
| Attachments and TUS upload | `ui/src/api/attachments.ts`, `ui/src/services/tusUploader.ts`, upload store, `JobQueueMonitor` | Covered; preserve TUS verb, resume, termination, degraded-state, and no checksum-extension tests |
| Backup/import/export/status/list/snapshot/restore | `ui/src/api/backup.ts`, `knowledgeShard.ts`; revision-19 `core-v1` plus revision-21 receipt-bound exact `2.0.0/full-v1`; BackupManager and focused Backup/TUS tests | Profile-specific bounded evidence; `record-v1`, suite-wide, and complete-backup claims remain false |
| System compatibility | UI/proxy compatibility receipts; `ui/src/api/systemCompatibility.ts`; `agent-proxy/src/compatibility.ts`; verifier and focused tests; ApiCapabilitiesPanel | Runtime admission delivered for #286: pinned profile/source, SemVer/API/minimum/auth checks, startup preflight, and denial before all remote mutation paths; authenticated mode remains blocked until Fortemi advertises claim-contract `1` |
| Native Fortemi chat stream | `ui/src/api/chat.ts` native stream client and `ui/src/components/agent/useAgentChat.ts` Fortemi provider path cover `/chat/stream`. | Covered |
| Streaming health counters | `ui/src/api/health.ts` and `ApiCapabilitiesPanel` cover `/health/streaming` telemetry blocks. | Covered |
| Ingest stream/tokens | `ui/src/api/ingest.ts` and Backup > Stream NDJSON Import cover token mint/revoke plus `/ingest/stream` SSE parsing/upload. | Covered |
| Incoming webhook receivers | `ui/src/api/webhooks.ts` and Admin WebhooksPanel cover receiver lifecycle and validation metadata. | Covered |
| Inbound external sources | `ui/src/api/webhooks.ts` and Admin WebhooksPanel cover source list/create/delete metadata. | Covered |
| Vision/audio ad-hoc tools | Attachment preview actions and typed clients cover image description and audio/video transcription. | Covered; agent-tool exposure remains gated by #258 |
| Realtime calls/Twilio | Typed `/calls/{id}` client and Admin API Surface redacted diagnostics are covered; Twilio realtime WebSocket diagnostics are documented as excluded with no helper/product claim. | Covered plus documented exclusion; agent-tool exposure remains gated by #258 |
| Agent tools | `agent-proxy/src/tools.ts` covers notes/search/collections/concepts/archives/attachments/jobs and exports route-family/capability metadata plus deferred/excluded tool decisions; `GET /api/agent/chat` exposes the metadata. | Metadata scaffold only; runtime privilege/auth enforcement remains open in #123/#231 |

## Requirement Trace

| Requirement | Evidence now | Issue / next action |
| --- | --- | --- |
| FORTEMI-2026-07-REQ-001 | Source-route extraction exists and reports 202 dispositions; local `docs/openapi.json` is not authority. | Replace route-prefix evidence with operation-level conformance in #290. |
| FORTEMI-2026-07-REQ-002 | `ui/src/api/chat.ts`, `ui/src/api/__tests__/chat.test.ts`, and `ui/src/components/agent/__tests__/useAgentChat.test.ts` cover native stream parsing and active Agent fallback behavior. | Preserve #242 tests; #258 still owns broader agent tool registry claims. |
| FORTEMI-2026-07-REQ-003 | Realtime event bus, Admin API Surface streaming-health card, and focused parser/component tests exist. | Preserve #254 streaming-health evidence while continuing incoming/inbound implementation. |
| FORTEMI-2026-07-REQ-004 | `ui/src/api/ingest.ts` and Backup Manager tests cover token mint/revoke, stream frames, progress summary, token revocation, and no-secret rendering. | Keep agent ingest tools gated by #258. |
| FORTEMI-2026-07-REQ-005 | Outbound webhooks and incoming receivers are covered by `ui/src/api/webhooks.ts`, Admin WebhooksPanel, and focused tests. | Preserve #256 receiver lifecycle and redaction tests. |
| FORTEMI-2026-07-REQ-006 | Inbound source controls are covered by `ui/src/api/webhooks.ts`, Admin WebhooksPanel, and focused tests. | Preserve #256 disabled/cost-gated source metadata tests. |
| FORTEMI-2026-07-REQ-007 | TUS uploader, upload store, JobQueueMonitor, and focused tests cover creation query, discovery, resume, patch, termination, finalization, offset mismatch, chunk-too-large, and expired/not-found recovery. | Preserve #257 TUS parity evidence. |
| FORTEMI-2026-07-REQ-008 | `ui/src/api/mediaTools.ts` plus AttachmentsPanel preview actions cover image description and audio/video transcription. | Keep agent exposure gated by #258. |
| FORTEMI-2026-07-REQ-009 | `ui/src/api/calls.ts` plus ApiCapabilitiesPanel call diagnostics cover REST call detail; Twilio realtime is a documented exclusion. | Preserve route-level mixed-disposition evidence under #253/#259. |
| FORTEMI-2026-07-REQ-010 | BackupManager and backup API tests cover backup/archive route parity, sidecar limitation copy, metadata, snapshots, downloads, uploads, restore, import, list/detail/swap, and route-group controls. | Preserve #257 backup/archive evidence. |
| FORTEMI-2026-07-REQ-011 | Runtime compatibility admission denies unknown/incompatible UI and agent-proxy mutations before dispatch while local/read workflows remain available. | Preserve typed block-state and zero-dispatch tests. |
| FORTEMI-2026-07-REQ-012 | Agent tools have route-family/capability metadata and explicit non-tool boundaries. | Enforce authority in #123/#231 and complete the umbrella workflow inventory in #287/#290. |
| FORTEMI-2026-07-REQ-013 | Exact Fortemi OpenAPI artifact and semantic fingerprint are pinned; all 251 operations require the schema-bearing shared RFC 9457 error boundary. | Preserve the receipt and add operation-complete typed/workflow evidence in #290. |
| FORTEMI-2026-07-REQ-014 | SSE/WS clients preserve the canonical envelope and unknown events remain unknown. | Prove authenticated context in #285 and every payload schema in #288. |
| FORTEMI-2026-07-REQ-015 | Fortemi `48bc0a0b` pins revision-19 `core-v1` and revision-21 advertised exact `2.0.0/full-v1` with runtime/interop receipt binding. | Keep `suiteWide=false`, `completeBackup=false`, and `record-v1` unsupported. |
| FORTEMI-2026-07-REQ-016 | Fortemi `48bc0a0b` profile/source receipts, schema/revision, SemVer API range, minimum client, auth claim-contract policy, startup preflight, and UI/proxy mutation gates are executable and CI-verified. | #286 delivered; keep authenticated writes fail-closed until producer metadata advertises supported claim-contract `1`. |
| FORTEMI-2026-07-REQ-017 | Node fixtures exist, but mandatory runtime middleware, a released authority identity, and shared Rust/Node receipts are incomplete. | #231. |
| FORTEMI-2026-07-REQ-018 | REST carries bearer and memory context; SSE/WS do not preserve the same context or prove cross-context isolation. | #285. |
| FORTEMI-2026-07-REQ-019 | UI privilege mode and tool metadata exist; agent-proxy does not enforce them before tool execution. | #123; coordinate mandatory runtime auth with #231. |
| FORTEMI-2026-07-REQ-020 | Route inventory reports 188 covered dispositions, but prefix/file evidence can overstate typed and executable integration. | #290. |
| FORTEMI-2026-07-REQ-021 | Several supported Fortemi operation families remain API-only, agent-only, diagnostic-only, or absent from verifiable UX. | #287. |
| FORTEMI-2026-07-REQ-022 | Revision-21 authority, opt-in advertisement, schema/profile inventory, runtime receipt, and paired receipt are pinned and fail closed on drift. | #292 delivered; preserve profile-specific and bounded claims. |
| FORTEMI-2026-07-REQ-023 | UI unit tests pass, but the mocked Playwright run has 36 unexpected failures of 46 tests. | #291. |

## Artifact Trace

| Artifact | Trace role | Status |
| --- | --- | --- |
| `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md` | Current endpoint inventory and route-family status classification. | Generated |
| `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` | Machine-readable source/test/UI evidence metadata for route-family verifier work. | Proposed |
| `.aiwg/requirements/fortemi-api-integration-requirements-2026-07.md` | Requirements baseline for seamless current-server integration. | Proposed |
| `.aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md` | Workflow-level actors, main/alternate/degraded flows, and test hooks for the v2026.7.1 UX slices. | Proposed |
| `.aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md` | Coverage strategy decision for UI/API/tool/exclusion tiers. | Proposed |
| `.aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md` | Accepted disposition for vision, audio, call detail, and Twilio realtime routes. | Accepted |
| `.aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md` | SAD-style component and security architecture delta. | Proposed |
| `.aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md` | Agent tool registry baseline, candidate tool decisions, non-tool boundaries, and #258 closeout checklist. | Proposed |
| `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md` | Route-family surface disposition and proof checklist for seamless integration. | Proposed |
| `.aiwg/design/fortemi-v2026-07-ux-integration-addendum.md` | UX surface and workflow mapping for current covered, partial, and documented-exclusion route families. | Proposed |
| `.aiwg/architecture/impact/fortemi-api-contract-drift-2026-07.md` | Impact analysis for route/API drift from v2026.5.x to v2026.7.1. | Proposed |
| `.aiwg/planning/fortemi-v2026-07-hotm-integration-plan.md` | Work package sequencing and exit criteria. | Proposed |
| `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md` | Implementation phases, dependency matrix, and route-family closeout rules. | Proposed |
| `.aiwg/planning/fortemi-v2026-07-issue-dependency-map.md` | Issue-level critical path, parallelization windows, gate blockers, and update rules. | Proposed |
| `.aiwg/testing/api-contract-test-plan-addendum-2026-07.md` | Verification strategy for route inventory and new route families. | Proposed |
| `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md` | Scenario-to-test traceability matrix, planned test targets, fixture states, and redaction assertions. | Proposed |
| `.aiwg/security/fortemi-v2026-07-security-redaction-controls.md` | Fortemi-specific sensitive-data inventory, fail-closed/degraded-mode matrix, and redaction controls. | Proposed |
| `.aiwg/risks/fortemi-v2026-07-integration-risk-register.md` | Risk register for route drift, stream transport, capability gating, redaction, mixed dispositions, backup parity, weak evidence, and agent-tool overclaims. | Proposed |
| `.aiwg/testing/fortemi-route-verifier-spec-2026-07.md` | Proposed #253 verifier contract, pass/fail controls, and mixed-disposition support requirement. | Proposed |
| `.aiwg/gates/fortemi-api-integration-gate-2026-07-14.md` | Planning gate decision and implementation-pass criteria. | Planning pass / implementation open |
| `.aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md` | Conditional implementation handoff package with work order, blockers, and baseline verification commands. | Conditional |
| `.aiwg/reports/fortemi-v2026-07-artifact-index.md` | Navigation index for the full Fortemi v2026.7.1 planning package. | Proposed |
| `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md` | Evidence-strength audit separating strong code/test proof from weak or planning-only route-family coverage. | Proposed |
| `.aiwg/reports/fortemi-hotm-integration-audit-2026-08-15.md` | Current producer-pin, executable-gate, and umbrella-interface audit with Gitea owners. | Open findings |
| `ui/src/api/contracts/fortemi-system-compatibility-receipt.json` and `agent-proxy/src/contracts/fortemi-system-compatibility-receipt.json` | Identical consumer policy pin for Fortemi compatibility profile and response source at `48bc0a0b`. | Implemented / CI verified |
| `.aiwg/testing/scripts/verify-fortemi-system-compatibility-contract.mjs` | Verifies producer Git-object checksums, profile revision/schema, source markers, and consumer receipt identity. | Implemented / required SDLC gate |

## Completion Gate

This traceability report records local route/surface evidence for the Fortemi v2026.7.1 baseline. Full integration closure requires live receipts for the route verifier and each independent OpenAPI, AsyncAPI/SSE, Knowledge Shard, compatibility-negotiation, and cross-language auth gate. A local-preflight-only decision for route inventory cannot waive the other gates.

## OpenAPI Consumer Evidence

| Artifact | Trace role | Status |
| --- | --- | --- |
| `ui/src/api/contracts/fortemi-openapi.yaml` | Exact Fortemi OpenAPI 3.1 artifact from commit `5ea08229c9f1565122df5f8e6906e89d98dc7e75`. | Generated producer receipt; 251/251 schema-bearing operations |
| `.aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs` | Byte, semantic, negative-mutation, version-skew, and exact CI receipt gate. | Implemented |
| `ui/src/api/__tests__/delivered-openapi-contract.test.ts` | Typed calls serializer/response and `ProblemDetails` boundary against the delivered artifact. | Implemented |

The exact artifact SHA-256 is
`9d2d5ea05f21a71d416d713a5cadd2c4f76086a3494105280d50ec328c4056fd`;
the `hotm-openapi-v1` semantic SHA-256 is
`6e84af14c4f0aebb885123b19dfa639ddfda5e73ef08d0ebbb9ca7ca8db9e633`.
All 251 operations are schema-bearing through the shared RFC 9457 `429`
boundary; 257 of 563 response entries contain schemas.

## 2026-08-15 Executable Evidence Update

| Requirement | Executable evidence | Result / remaining work |
| --- | --- | --- |
| REQ-020 operation conformance | `.aiwg/testing/scripts/fortemi-route-coverage.py`, `.aiwg/testing/data/fortemi-operation-conformance-v2026-07.json`, generated operation JSON/Markdown, focused verifier tests | 251 operations: 1 integrated, 238 partial, 12 gap; zero verifier diagnostics. #290 establishes the evidence model but does not convert partial/gap rows into support claims. |
| REQ-014 AsyncAPI payloads | `.aiwg/testing/scripts/verify-fortemi-asyncapi-payloads.mjs`, schema-derived event fixtures/rules, event and realtime-bus tests, conformance receipt | 48 valid schemas pass both decoders; malformed known events remain unknown. Producer-owned examples are absent, so #288 remains open. |
| REQ-023 mocked browser gate | `.gitea/workflows/ui-ci.yml`, `ui/scripts/playwright-mocked-ci.config.cjs`, receipt writer, deterministic browser scenarios | Required desktop/mobile gate with zero retries, exact revision/digest receipt, and failure artifacts. This is mocked UI evidence only. |

The operation report is authoritative for integration disposition; the route
report remains authoritative only for route discovery/disposition. Neither the
AsyncAPI schema-derived receipt nor mocked browser result supplies live,
compatibility, Knowledge Shard, or authentication evidence.
