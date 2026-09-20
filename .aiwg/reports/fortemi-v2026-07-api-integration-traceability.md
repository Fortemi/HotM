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

## Cycle98 Mobile Note Controls

Selected-note tabs now grow to contain wrapped rows. Preview/original/edit
headers wrap instead of compressing titles beside fixed-width actions. Compact
star/copy/regeneration controls retain accessible names, tooltips and44px heights;
the regeneration popover is constrained to available viewport width/height.
Long unbroken titles wrap; the edit title input has an explicit accessible name.
This is a UI-only correction, not a producer or integration contract change.

533focused/2178full UI tests, typecheck/build and the actual-daemon HTTP regression
pass. The previous immutable UI build fails the new320px tab-containment check:
the title is about82px wide and Regenerate extends past the viewport. The fixed
production build passes24layout/menu groups at320/390/768/1440px and18browser
controls overall, with long-title,44px action, overlap, menu reachability and
focus-return checks. Screenshots are nonblank and visually inspected. Menu
actions are opened/trial-clicked only; no regeneration or note write is dispatched.
Core220groups/293requests/655durable audit rows and previous job/cache checks pass.

Evidence: suite Cycle98 candidate, layout-red and layout-green receipts.
Automated selected-note layout acceptance is PASS, not physical-device,
human usability or AI-output quality acceptance. Per the operator, discuss
needed human evaluations next; do not start inference/model acceptance or widen
the lane autonomously. Full lane/CI/delivery/release gates and all prior holds,
suite NO-GO and public-readiness boundaries remain; candidate is unreleased.

## Cycle97 Context-Owned Job Cache: Phase2

The job cache now uses a strict, bounded v2 envelope and an opaque owner derived
from endpoint, effective session/tenant hint, selection, and server-resolved
archive name/schema. Current read-authorized context resolution must succeed
before hydration. Foreign, malformed, oversized and legacy unknown-owner data
is never hydrated; existing bytes are preserved. The owner is a cache
discriminator, not authentication or encryption. Live updates during admission
win over the saved snapshot; stale admission/digest completions cannot hydrate.
Effective API endpoint changes also invalidate requests, views and streams.
Buffered event coalescers and dedup state reset on context changes; reentrant
listeners cannot receive an in-flight event from the previous context.

Final500focused/2177full UI tests, typecheck and build pass with zero unhandled
errors. The production browser against the actual owned hosted daemon passes
17controls, including three real model-free worker jobs, matching visible job
content, same-context reload while the real jobs endpoint returns503, separate
tenant/archive cache owners, foreign-context/logout clearing, and unchanged
legacy/local-only bytes. Automatic reconnect sends a cursor from a nonempty
live stream. This is not proof of a nonempty replay response.

The producer runtime, OpenAPI and installed Core package are unchanged. The
harness adds only three predefined job controls with bounded file handshakes.
Core220groups/293requests and655durable audit rows pass. Ten serial Phase2 jobs
are terminal:4PASS,5failures and1intentional stop; failed receipts are retained.
The runner now rejects duplicate cache/deadline options instead of silently
replacing an earlier value. Eight runner tests pass; containment is unchanged.

This is a source-bound candidate, not delivered compatibility or full session
isolation. Default/archive administration without a client context change,
other persisted stores, nonempty replay, native and full lifecycle/every-consumer
acceptance remain. The390px selected-note toolbar still clips and compresses its
title; mobile usability is NOT_PASS. No authority/profile/pin promotion or
destructive data migration. Source rollback is possible, but old code would
restore its old unscoped-cache behavior; preserved legacy data is not safe to
rehydrate merely because rollback was chosen. Full CI/delivery/release sweep,
publication holds and suite NO-GO remain. Evidence: suite Cycle97
phase2-summary.json and browser-third/browser-receipt.json.

## Cycle97 Live Job Store Lifetime: First Stage

The central job store now resets live job/queue/step/pause/staleness state on
effective session, tenant-hint or archive changes, including cross-tab storage
and logout. Subscriptions are replaced with revision-bound callbacks so old
callbacks cannot repopulate the reset view. Pause refreshes reject obsolete
context and out-of-order same-context completions. Idempotent disposal removes
only this store's subscriptions and timer; shared transport is not stopped.
HMR and test teardown call disposal. Connection/staleness-only notifications
no longer rewrite the saved job data.

The 11 regression failures reproduced before the fix. Final focused30 and
broader426 tests, full2145 UI tests, typecheck and production build pass with
zero unhandled errors, inside three serial bounded jobs. No browser/daemon
acceptance was rerun for this stage. Source rollback is available.

This is not complete job-store or application isolation: legacy unscoped
hotm.jobStore hydration still exists, and persistence needs explicit ownership,
same-context reload preservation and rejection of foreign/unknown ownership.
Buffered event delivery to newly registered listeners also needs adversarial
coverage. Do not infer those properties from tests of old callback closures.
Mobile clipping, nonempty browser replay and the full lane/CI/delivery/release
gates remain. No wire/schema/pin promotion; suite NO-GO is unchanged.

## Cycle96 Candidate Trace

HotM#1 / Fortemi#1091 / Core#405: opaque context revision, keyed desktop/mobile
subtree, abort/continuation-safe HTTP client and generation-safe compatibility
gate implemented. Final400focused/2133full UI/typecheck/build PASS. Eleven actual
browser stream/note-identity/clearing controls PASS; one audited browser read per
fixture then four Core enrichment reads. Core220groups/293requests/635audit rows.

External unscoped job store and persisted-store review remain; mobile selected-note
controls visibly clip. This is not full session/mobile/native/lifecycle or immutable
delivered qualification. Cycle96 evidence preserves RED, teardown and audit-baseline
failures. No release/closure/pin promotion; suite NO-GO and full original20scope remain.

## Cycle95 Candidate Trace

HotM#1 / Fortemi#1091 / Core#405: auth/memory notifications, cross-tab subscription
ownership, stream replacement and hook queue invalidation implemented. Final326/
2102 UI tests and production build pass. Source-bound real browser passes six
stream controls; real worker metadata/SSE and installed Core regression also pass.

Application-wide session isolation remains NOT_PASS: unchanged central job cache
has no session ownership/fencing and the launched note navigator retains tenant A
notes after a B switch. Native/full event replay/default-admin/delivered-pin gates
remain independent. Suite evidence: lane-b-delivery-20260913-cycle95. No release,
closure or full compatibility claim; previous failed receipts and NO-GO preserved.

## Cycle93 Producer Dependency

### v2026.9.10 route reconciliation

The current exact producer pin is Fortemi `v2026.9.10` source
`306bae55a41eff7e4f8b8349304765322865e6cc`: 202 OpenAPI paths, 261 operations,
and 211 source routes across 36 families. The route result is 193 covered and
18 documented exclusions. The operation result is 1 integrated, 225 partial,
0 gaps, and 35 documented exclusions. All 261 live dimensions remain gaps.
The product ledger records 130 UI workflows, 10 agent workflows, 5 external
handoffs, 2 typed shared-client operations, 79 operator diagnostics, and 35
documented exclusions.

The delivered `GET /api/v1/memory/context` route is covered by the bounded
`archives.context()` client and focused real-client context tests. The four
`/api/v1/lifecycle-purge` orchestration routes are documented exclusions:
HotM exposes the separately contracted single-note purge workflow, but does not
claim bulk preview, begin, status, or resume controls in its UI or agent surface.
This classification is inventory and operation-disposition evidence only; it
does not promote operation-specific authorization, live lifecycle, or suite
portability claims.

HotM#1 / Fortemi#1091 / Core#405 Cycle94 update: candidate resolver and bounded
HTTP context method adopt the producer read endpoint. Tests cover exact decoding,
errors and byte limits while preserving selection/cursor/queue behavior. The
suite Cycle94 generated-schema and actual-server receipts own exact results;
old Cycle92 failure and Cycle93 producer-only receipts remain. Core runtime is
unchanged. Candidate reconciliation does not replace immutable delivered pins
or satisfy browser/native/full lifecycle/CI/releases.

The server candidate provides selected name/schema at read-authorized
`GET /api/v1/memory/context` and tenant-qualified default uniqueness. Producer
source/tests/OpenAPI are tracked in the suite Cycle93 checkpoint and server
selected-memory-context impact. HotM runtime remains the unchanged Cycle92
candidate; endpoint adoption, authoritative pins and actual-server admission
are pending. No operation/live/release dimension is promoted by this entry.

## Cycle92 Realtime Context Candidate

HotM#1 / Fortemi#1091 / Core#405 map ADR-010's name/schema separation to
`ui/src/api/realtime-context.ts`, `events.ts` and `services/websocket.ts`.
The archive resolver, application service/parser and rendered queue tests are
separate from the actual-server resolver/client fixture and released receipts.
Pending-event cancellation is implemented by `RealtimeEventBus.clearPending`.
Existing OpenAPI/AsyncAPI/catalog/producer-fixture/sidecar pins are unchanged.
The suite Cycle92 checkpoint owns final exact-source results, cleanup and release
dispositions; this entry does not promote operation conformance or close the
integration epic. Full lifecycle, every-consumer, release and suite NO-GO remain.

Final local result: 279 focused /2066 full UI tests, typecheck, production build
and48 producer events on four mocked transports PASS. Actual hosted result:
NOT_PASS, `GET /api/v1/archives`503 before any SSE request. Producer archive
handlers remain unmigrated; listing is also admin-only. The next acceptance
must resolve both the tenant-transaction and reader/default-contract dependency
without weakening either guard. No delivered hosted receipt is claimed here.

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
| FORTEMI-2026-07-REQ-013 | Exact Fortemi OpenAPI artifact and semantic fingerprint are pinned; all 254 operations require the schema-bearing shared RFC 9457 error boundary. | Preserve the receipt and add operation-complete typed/workflow evidence in #290. |
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
| `ui/src/api/contracts/fortemi-openapi.yaml` | Exact Fortemi OpenAPI 3.1 artifact from commit `0dd28a9255e2b53363f93e2e288777631709eb05`. | Generated producer receipt; 254/254 schema-bearing operations |
| `.aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs` | Byte, semantic, negative-mutation, version-skew, and exact CI receipt gate. | Implemented |
| `ui/src/api/__tests__/delivered-openapi-contract.test.ts` | Typed calls serializer/response and `ProblemDetails` boundary against the delivered artifact. | Implemented |

The exact artifact SHA-256 is
`652bcce252719e5c0ced015beae02e41380c56dccaa5dc071d369b3ac6fdd858`;
the `hotm-openapi-v1` semantic SHA-256 is
`1b22c57274341f5693ff1f3a5511cb441d6f78f7e010e39fc1c05cc15b94cfe4`.
All 254 operations are schema-bearing through the shared RFC 9457 `429`
boundary; 271 of 581 response entries contain schemas.

## 2026-08-15 Executable Evidence Update

| Requirement | Executable evidence | Result / remaining work |
| --- | --- | --- |
| REQ-020 operation conformance | `.aiwg/testing/scripts/fortemi-route-coverage.py`, `.aiwg/testing/data/fortemi-operation-conformance-v2026-07.json`, generated operation JSON/Markdown, focused verifier tests | 254 operations: 1 integrated, 222 partial, 31 documented exclusions; zero verifier diagnostics. #290 establishes the evidence model but does not convert partial/excluded rows into support claims. |
| REQ-014 AsyncAPI payloads | `.aiwg/testing/scripts/verify-fortemi-asyncapi-payloads.mjs`, schema-derived event fixtures/rules, event and realtime-bus tests, conformance receipt; independent producer transport gate below | 48 schema-derived examples and malformed-known rejection remain intact. The new gate adds 48 producer examples per transport path; exact-source CI and delivery are required before closing #288. |
| REQ-023 mocked browser gate | `.gitea/workflows/ui-ci.yml`, `ui/scripts/playwright-mocked-ci.config.cjs`, receipt writer, deterministic browser scenarios | Required desktop/mobile gate with zero retries, exact revision/digest receipt, and failure artifacts. This is mocked UI evidence only. |

The operation report is authoritative for integration disposition; the route
report remains authoritative only for route discovery/disposition. Neither the
AsyncAPI schema-derived receipt nor mocked browser result supplies live,
compatibility, Knowledge Shard, or authentication evidence.

## Auth, Realtime, and Umbrella Trace Update

| Requirement | Executable evidence | Result / remaining work |
| --- | --- | --- |
| REQ-017 auth contract | `agent-proxy/src/auth/middleware.ts`, `auth/verify.ts`, compatibility receipt, middleware tests | Mandatory pre-parse consumer enforcement implemented. Required hosted mode denies missing/unknown claim contract; `fortemi-auth` release authority remains unresolved, so #231 stays open. |
| REQ-018 realtime context | `ui/src/api/events.ts`, `ui/src/services/websocket.ts`, Tauri header adapter, event/WS tests | Scoped fetch SSE forwards bearer/memory/replay headers and rejects tenant/memory mismatch. Scoped WS is excluded pending Fortemi #953; #285 stays open. |
| REQ-019 agent privileges | `agent-proxy/src/request-context.ts`, `privileges.ts`, `routes/chat.ts`, UI chat/privilege hooks | Sessions bind to admitted identity; tool execution forwards only admitted context. Existing contract-backed registry is enforced, but all-operation agent acceptance in #123 remains open. |
| REQ-021 umbrella disposition | `scripts/ci/verify-fortemi-operation-dispositions.mjs`, generated 254-row ledger, `OperationCatalogPanel.tsx` | Zero implicit product dispositions: 130 UI, 10 agent, 5 external handoff, 1 typed shared-client operation, 77 diagnostic, 31 excluded. This does not upgrade the #290 conformance dimensions. |
| Manual note-link mutation | pinned OpenAPI/current Fortemi router, `ui/src/api/links.ts`, focused contract/client tests, disposition verifier | Fortemi/fortemi#61 supersedes the #294 removal decision with exact `manual-note-link-v1` authority. HotM exposes only a compatibility-gated typed shared-client method; primary UI and agent invocation remain documented exclusions, and semantic/wiki links remain server-owned. |

## 2026-08-16 Core And Operator Trace Update

| Requirement | Executable evidence | Result / remaining work |
| --- | --- | --- |
| REQ-020 core workflows (#295) | `core-content-operations.ts`, typed API modules, bounded codecs, lifecycle component tests, desktop/mobile Playwright scenarios | 60 exact entries cover notes, provenance, collections, templates, document types, jobs, SKOS, and graph workflows. Request/response/UI dimensions are conformant; operation auth, agent, and live remain independent. |
| REQ-021 operator workflows (#296) | `operator.ts`, `OperatorConsole.tsx`, focused API/component tests, desktop/mobile Playwright scenarios | 76 exact entries cover non-secret diagnostics and confirmed controls. Responses are bounded/redacted and unknown SSE events remain unknown. Restricted #297 operations are not promoted. |
| Generated operation ledger | operation evidence source, generated coverage JSON/Markdown, product-disposition verifier | The refreshed producer projection contains 254 operations: 1 integrated, 222 partial, and 31 documented exclusions with zero diagnostics. Route matching does not supply any missing dimension. |

Mocked browser receipts verify deterministic rendering and interaction only.
They are not live Fortemi, operation-specific authorization, binary transfer,
Knowledge Shard round-trip, or cross-language auth receipts.

## 2026-08-16 Sensitive Operation Trace Update

| Requirement | Executable evidence | Result / remaining work |
| --- | --- | --- |
| REQ-024 exact decision set | `.aiwg/security/fortemi-sensitive-operation-decisions-2026-08.md`, schema-v2 generated operation ledger, stale-ledger CI verifier | Exactly 41 rows: 5 typed TUS, 5 browser/native media handoffs, 31 disabled exclusions. Each row names its owner and blocker. |
| REQ-007 TUS transport | `tusUploader.ts`, `uploadStore.ts`, `SaveAsNoteButton.tsx`, focused tests | All remote file sizes use TUS; tests cover create/options/head/patch/delete, finalization, cancellation, offset, expiry, max size, malformed metadata, auth expiry, and redaction. |
| REQ-011 sensitive errors | `attachments.ts`, `backup.ts`, Admin auth/catalog panels and focused tests | Producer bodies, bearer artifacts, upload URLs, tenant IDs, local paths, and binary data do not reach generic errors or rendered diagnostics. |
| Continued exclusions | pinned OpenAPI receipt plus exact #297 table | API keys, OAuth, PKE, legacy attachment upload, and underspecified backup routes remain disabled. The signed auth release and exact Rust/Node corpus receipts do not supply missing producer payload, runtime admission, or hosted isolation evidence. |

The 5 media handoffs and 5 TUS workflows are product-disposition evidence, not
operation-specific auth or live receipts. The 31 exclusions stay visible and
disabled in the Operations catalog. Route equality and current Fortemi source
inspection do not alter these boundaries.

## 2026-08-16 Agent Operation Reconciliation

| Requirement | Executable evidence | Result / remaining work |
| --- | --- | --- |
| REQ-019 agent dispatch | `agent-proxy/src/tools.ts`, privilege registry, focused tool/privilege tests, pinned disposition ledger | 12 exact operations have conformant local agent evidence. `get_related` now dispatches canonical `GET /api/v1/notes/{id}/related`; CI rejects unpinned tool endpoints and curated operation-ID/method/path drift. |
| REQ-020 `create_job` | typed jobs client, core-content exact-operation test, constrained `revise_note` tool test | `create_job` is partial, not a gap. Request and local agent dispatch are conformant; response and auth/context are partial; UI and live remain gaps. |
| Generated operation ledger | operation evidence source and generated JSON/Markdown | Current result: 1 integrated, 222 partial, 31 documented exclusions; agent dimensions are 12 conformant, 200 gaps, and 42 exclusions. |
| Live boundary | authenticated asset workflow run and operation matrix | The asset run does not identify immutable exact-operation outcomes. It does not promote TUS, attachment, Knowledge Shard, `create_job`, `create_note_link`, or any other live dimension; all 254 remain gaps. |

The product-disposition ledger records 130 UI workflows, 10 curated agent
workflows, 5 external handoffs, 1 typed shared-client operation, 77 operator
diagnostics, and 31 exclusions.
Product surface ownership and conformance dimensions are independent: the
`list_archives` and `get_note_tags` operations have UI ownership while also
carrying verified local agent evidence.


## Custom CA authority release integration (2026-09-07)

Fortemi/fortemi-auth#50 and Fortemi/fortemi#1144 introduce explicit custom PEM
trust roots for the server's discovery and JWKS HTTPS client. HotM consumes the
new exact authority release `v2026.9.0`, retaining contract `1.1.0`, profile
`rust-node-jwt-v1`, RS256 verification, and the unchanged authority corpus.
The UI and agent proxy must advance their admission receipts together with the
server's advertised tuple. Auth fixtures consume the vendored producer policy.

The current source and consumer conformance receipt is
`.aiwg/reports/fortemi-auth-node-conformance-receipt-2026-09-07.md`.
It pins signed authority `v2026.9.0` and server source
`088932c008af8e4f89ef6055ef85d700001c2dd5`; the canonical source verifier
passes. Server CI/release publication remain separate delivery gates. Earlier
dated receipts retain their original release identities and evidence scope.
Custom certificate configuration belongs to the Fortemi server deployment;
this change adds no browser certificate override. Live hosted authentication,
tenant isolation, and reauthentication/realtime recovery still require the
configured environment and a separate executed receipt.


## Independent live-server AsyncAPI authority (2026-09-07)

`fortemi-live-asyncapi-authority-receipt.json` independently pins the current
server's canonical AsyncAPI document and producer sources. Its verifier reads
exact Git objects, excluding only `info` metadata when comparing the complete
wire document against the packaged baseline. Existing 48-event payload fixtures,
validation rules, event catalog, and desktop sidecar provenance retain their
original identities and run their existing conformance gates. The new CI gate
rejects schema, channel, operation, server, protocol, source-hash, or fixture
coverage drift. This separates live-server compatibility evidence from packaged
sidecar delivery; neither source comparison nor fixtures prove live transport
execution. The live receipt must contain an immutable producer SHA before release.


## Hosted browser session binding (HotM304 / ITops727)

The browser decodes the canonical `fortemi:tenant_id` UUID only as a local
SSE filtering hint; the pinned server still verifies the bearer, issuer,
audience, expiry and tenant. Reloaded and replacement sessions derive their
filter from the current bearer. An unbound bearer reaches the server for its
real 401/403 response, but no authenticated event is dispatched without a
tenant filter, even if the endpoint responds 200. No client hint grants access.
The consumed hosted claim contract remains 1.1.0, authority commit
`cff36d293d73080c186e2f35115dd92a594982d2`; the API and event contracts are unchanged.

Regression evidence: `ui/src/api/__tests__/auth-context-hosted.test.ts` and
`ui/src/api/__tests__/events.test.ts`. Live acceptance remains the unchanged
`ui/scripts/qualify-hosted-realtime.mjs` against the isolated titan deployment.

## Producer-Owned Event Corpus (HotM #288, 2026-09-11)

Consume [Fortemi #1097](https://git.integrolabs.net/Fortemi/fortemi/issues/1097)
at the existing independent live AsyncAPI authority
`c3bfd40b275decd5a24c4e9a656d830a383b3de2`. The exact receipt pin is
`ui/src/api/contracts/fortemi-producer-event-fixture-pin.json`; its SHA-256 is
`2318bf0ff3ba2801929767c9417ed5cc0dd83ffb91ceae7276efcc8979b763aa`.
Producer manifest SHA-256:
`73ce991d31aba0bfaa7d126f9f8ca7cb42d9941fd65ecd67d4dba8d7a4faaada`.
Corpus SHA-256:
`ee09b909863b868b57c3bf95daa47d3e24f84eb7eb487c1d64c0ef40ef4dc6ad`.

The importer reads exact Git objects and verifies the receipt, manifest, all
48 raw fixture hashes, lexicographically concatenated corpus digest, four-schema
inventory, event/variant/schema mapping, envelope revision 1, and payload
revision 1. It compares the full live wire document with the packaged baseline
excluding only informational metadata. Imported JSON values preserve the Rust
producer envelopes; the consolidated HotM file is not an independent authority.

Required commands:

```bash
node --test .aiwg/testing/scripts/producer-event-fixtures.test.mjs
node .aiwg/testing/scripts/verify-fortemi-producer-event-fixtures.mjs ../fortemi
node .aiwg/testing/scripts/verify-fortemi-producer-event-transports.mjs ../fortemi .aiwg/working/producer-event-transports/receipt.json
```

The transport gate executes all 48 examples through EventSource, split-chunk
fetch SSE, and the production WebSocket message handler with canonical envelopes
and legacy payloads. It asserts exact payload and envelope metadata preservation,
including structured actors, nulls, identifiers, tenant, memory and timestamps.
Its receipt binds source/test/lockfile hashes, producer and catalog digests,
event/schema counts, each passed event per transport, and the hashed Vitest report.
The existing negative and unknown-event tests run in the same gate.

SDLC CI rejects byte, pin, mapping, revision, schema and decoder drift and uploads
the transport receipt. Legacy WebSocket fixtures do not grant scoped fallback:
admission still requires unscoped `anonymous_local`. Network boundaries are
mocked; this is not live authorization, tenant isolation, supported-platform,
sidecar replacement, Knowledge Shard, or suite-wide compatibility evidence.
The packaged sidecar and historical schema-derived receipts are unchanged.
[HotM #288](https://git.integrolabs.net/Fortemi/HotM/issues/288) remains open
until exact-source CI and delivery are verified. Suite NO-GO remains.
