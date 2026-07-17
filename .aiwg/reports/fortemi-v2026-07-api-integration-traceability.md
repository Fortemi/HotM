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
---

# Fortemi v2026.7.1 API Integration Traceability

## Generated Inventory

The generated inventory `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md` extracts 200 route declarations from the latest Fortemi source checkout at commit `f6733252`.

The evidence strength of current `covered` rows is audited in `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md`. Its result is limited to route-family evidence and must not be read as OpenAPI, AsyncAPI, Knowledge Shard, compatibility-negotiation, or auth-fixture conformance.

The current machine-readable route-family evidence map is `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json`.

| Status | Count | Traceability disposition |
| --- | ---: | --- |
| covered | 186 | Existing HotM API/UI/agent route-disposition evidence found. |
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
| Events SSE and WebSocket fallback | `ui/src/api/events.ts`, `ui/src/services/realtimeEventBus.ts`, `websocket.ts` | Covered for current UI event families |
| Inference config/providers/audit/test-connection | `ui/src/api/inference.ts`; InferenceSettings and audit log | Covered |
| Outbound webhooks | `ui/src/api/webhooks.ts`; Admin WebhooksPanel | Covered |
| Document types | `ui/src/api/documents.ts`; Admin DocumentTypesPanel | Covered |
| Attachments and TUS upload | `ui/src/api/attachments.ts`, `ui/src/services/tusUploader.ts`, upload store, `JobQueueMonitor` | Covered; preserve TUS verb, resume, termination, degraded-state, and no checksum-extension tests |
| Backup/import/export/status/list/snapshot/restore | `ui/src/api/backup.ts`, `knowledgeShard.ts`; pinned `core-v1` fixture; BackupManager and focused Backup/TUS tests | Route coverage plus `core-v1` profile/schema preflight; clean-server semantic roundtrip remains open |
| System compatibility | `ui/src/api/systemCompatibility.ts`; ApiCapabilitiesPanel | Covered for compatibility guard |
| Native Fortemi chat stream | `ui/src/api/chat.ts` native stream client and `ui/src/components/agent/useAgentChat.ts` Fortemi provider path cover `/chat/stream`. | Covered |
| Streaming health counters | `ui/src/api/health.ts` and `ApiCapabilitiesPanel` cover `/health/streaming` telemetry blocks. | Covered |
| Ingest stream/tokens | `ui/src/api/ingest.ts` and Backup > Stream NDJSON Import cover token mint/revoke plus `/ingest/stream` SSE parsing/upload. | Covered |
| Incoming webhook receivers | `ui/src/api/webhooks.ts` and Admin WebhooksPanel cover receiver lifecycle and validation metadata. | Covered |
| Inbound external sources | `ui/src/api/webhooks.ts` and Admin WebhooksPanel cover source list/create/delete metadata. | Covered |
| Vision/audio ad-hoc tools | Attachment preview actions and typed clients cover image description and audio/video transcription. | Covered; agent-tool exposure remains gated by #258 |
| Realtime calls/Twilio | Typed `/calls/{id}` client and Admin API Surface redacted diagnostics are covered; Twilio realtime WebSocket diagnostics are documented as excluded with no helper/product claim. | Covered plus documented exclusion; agent-tool exposure remains gated by #258 |
| Agent tools | `agent-proxy/src/tools.ts` covers notes/search/collections/concepts/archives/attachments/jobs and exports route-family/capability metadata plus deferred/excluded tool decisions; `GET /api/agent/chat` exposes the metadata. | Metadata/gating scaffold covered; new diagnostic tools remain deferred |

## Requirement Trace

| Requirement | Evidence now | Issue / next action |
| --- | --- | --- |
| FORTEMI-2026-07-REQ-001 | Manual source-route extraction completed during audit; local `docs/openapi.json` not canonical. | Formalize contract inventory verifier in #253. |
| FORTEMI-2026-07-REQ-002 | `ui/src/api/chat.ts`, `ui/src/api/__tests__/chat.test.ts`, and `ui/src/components/agent/__tests__/useAgentChat.test.ts` cover native stream parsing and active Agent fallback behavior. | Preserve #242 tests; #258 still owns broader agent tool registry claims. |
| FORTEMI-2026-07-REQ-003 | Realtime event bus, Admin API Surface streaming-health card, and focused parser/component tests exist. | Preserve #254 streaming-health evidence while continuing incoming/inbound implementation. |
| FORTEMI-2026-07-REQ-004 | `ui/src/api/ingest.ts` and Backup Manager tests cover token mint/revoke, stream frames, progress summary, token revocation, and no-secret rendering. | Keep agent ingest tools gated by #258. |
| FORTEMI-2026-07-REQ-005 | Outbound webhooks and incoming receivers are covered by `ui/src/api/webhooks.ts`, Admin WebhooksPanel, and focused tests. | Preserve #256 receiver lifecycle and redaction tests. |
| FORTEMI-2026-07-REQ-006 | Inbound source controls are covered by `ui/src/api/webhooks.ts`, Admin WebhooksPanel, and focused tests. | Preserve #256 disabled/cost-gated source metadata tests. |
| FORTEMI-2026-07-REQ-007 | TUS uploader, upload store, JobQueueMonitor, and focused tests cover creation query, discovery, resume, patch, termination, finalization, offset mismatch, chunk-too-large, and expired/not-found recovery. | Preserve #257 TUS parity evidence. |
| FORTEMI-2026-07-REQ-008 | `ui/src/api/mediaTools.ts` plus AttachmentsPanel preview actions cover image description and audio/video transcription. | Keep agent exposure gated by #258. |
| FORTEMI-2026-07-REQ-009 | `ui/src/api/calls.ts` plus ApiCapabilitiesPanel call diagnostics cover REST call detail; Twilio realtime is a documented exclusion. | Preserve route-level mixed-disposition evidence under #253/#259. |
| FORTEMI-2026-07-REQ-010 | BackupManager and backup API tests cover backup/archive route parity, sidecar limitation copy, metadata, snapshots, downloads, uploads, restore, import, list/detail/swap, and route-group controls. | Preserve #257 backup/archive evidence. |
| FORTEMI-2026-07-REQ-011 | Compatibility guard docs and tests exist. | Keep #244/#252/#253 active. |
| FORTEMI-2026-07-REQ-012 | Agent tools are selective and now have route-family/capability metadata, intent-set tests, no-MCP-parity-copy tests, and explicit non-tool boundaries for credential, PKE, rate-limit, Twilio, destructive backup, and purge-style operations. | Preserve #258 metadata tests; add disabled-state/redaction fixtures before enabling any new diagnostic tools. |
| FORTEMI-2026-07-REQ-013 | Exact Fortemi OpenAPI artifact and semantic fingerprint are pinned; negative semantic/skew fixtures and a typed call/error boundary pass. The delivered artifact has response schemas for only 6 of 310 response entries. | Keep Fortemi #1060 and HotM #270 open until producer response schemas and matching consumer boundaries cover the required API surface. |
| FORTEMI-2026-07-REQ-014 | SSE/WS clients exist; canonical AsyncAPI envelope/catalog conformance is not established by route coverage. | Add producer-owned event fixtures and unknown-event non-coercion tests. |
| FORTEMI-2026-07-REQ-015 | Pinned Fortemi `core-v1` fixture, exact `include` serialization, local gzip/TAR manifest inspection, profile/schema UI, unsupported-contract rejection, and server-error tests are implemented. | Add clean-server semantic round trips, historical migration, atomicity, embeddings, and attachment-byte receipts before any lossless claim. |
| FORTEMI-2026-07-REQ-016 | Compatibility display/normalization exists; contract-revision and minimum-client enforcement require a versioned fixture receipt. | Add negotiation matrix and fail-closed mutation tests. |
| FORTEMI-2026-07-REQ-017 | A claim-contract document exists; Rust workspace/release and shared Rust/Node fixture receipts are not present. | Pin the contract version and run shared fixtures in both repositories. |

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

## Completion Gate

This traceability report records local route/surface evidence for the Fortemi v2026.7.1 baseline. Full integration closure requires live receipts for the route verifier and each independent OpenAPI, AsyncAPI/SSE, Knowledge Shard, compatibility-negotiation, and cross-language auth gate. A local-preflight-only decision for route inventory cannot waive the other gates.

## OpenAPI Consumer Evidence

| Artifact | Trace role | Status |
| --- | --- | --- |
| `ui/src/api/contracts/fortemi-openapi.yaml` | Exact Fortemi OpenAPI 3.1 artifact from commit `cb1899368d763920091dd2fd5c22066d27e9fad0`. | Generated producer receipt; partial response-schema coverage |
| `.aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs` | Byte, semantic, negative-mutation, version-skew, and exact CI receipt gate. | Implemented |
| `ui/src/api/__tests__/delivered-openapi-contract.test.ts` | Typed calls serializer/response and `ProblemDetails` boundary against the delivered artifact. | Implemented |

The exact artifact SHA-256 is
`654db79e541a1a9117acf599476eb8ef4559b7e8d8f3ac7c471034ee383e705a`;
the `hotm-openapi-v1` semantic SHA-256 is
`b67ce9d3b557f435b85c533344a18b2c902df9e7d374200e21d9224791e4aaf8`.
Only 6 of 310 response entries are schema-bearing, so this trace remains partial.
