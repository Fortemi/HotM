---
title: Fortemi API Integration Requirements - v2026.7.1
status: proposed
date: 2026-07-14
artifact_type: requirements
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/architecture/impact/fortemi-api-contract-drift-2026-07.md
  - .aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/planning/fortemi-v2026-07-hotm-integration-plan.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/reports/fortemi-v2026-07-api-integration-traceability.md
---

# Fortemi API Integration Requirements - v2026.7.1

## Scope

This requirements baseline covers HotM alignment with the current Fortemi server checkout at `/home/roctinam/dev/fortemi/fortemi`, commit `f6733252`, with latest release tag `v2026.7.1` dated 2026-07-13. The audit uses server route declarations in `crates/matric-api/src/main.rs`, release notes in `docs/releases/v2026.7.1-announcement.md`, and HotM client modules under `ui/src/api` plus `agent-proxy/src/tools.ts`.

## Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| FORTEMI-2026-07-REQ-001 | HotM must maintain a generated or source-derived contract inventory for all Fortemi `GET/POST/PATCH/PUT/DELETE/HEAD/OPTIONS` routes and compare it with HotM API-client coverage before release. | P0 | Contract inventory test or script reports server routes, HotM client routes, intentional exclusions, and gaps. |
| FORTEMI-2026-07-REQ-002 | HotM agent/chat UX must consume `POST /api/v1/chat/stream` with a POST-capable SSE parser, including `delta`, `done`, `error`, 503 GPU-busy handling, cancellation, and reconnect behavior. | P0 | Component tests and integration tests cover token streaming, terminal events, cancellation, and fallback to synchronous `/chat`. |
| FORTEMI-2026-07-REQ-003 | HotM must expose streaming health and event health from `GET /api/v1/health/streaming`, including chat counters, ingest backpressure counters, connector lag/error counters, and client degraded states. | P1 | Admin/realtime panels render populated, missing, and degraded health blocks without crashing. |
| FORTEMI-2026-07-REQ-004 | HotM must support operator-visible NDJSON ingest workflows for `POST /api/v1/ingest/stream`, `POST /api/v1/ingest/tokens`, and `DELETE /api/v1/ingest/tokens/{token_id}` where the UX needs bulk import or agent streaming. | P1 | Tests cover token mint/revoke, line ack/progress/error/done frames, 401/410/429 handling, and `X-Ingest-Cursor` resume guidance. |
| FORTEMI-2026-07-REQ-005 | HotM Admin must distinguish outbound webhooks from incoming webhook receivers and support incoming receiver list/create/get/patch/delete plus payload validation where operators configure external callbacks. | P1 | Admin tests cover receiver lifecycle, HMAC/schema/idempotency help text, and validation failure display. |
| FORTEMI-2026-07-REQ-006 | HotM Admin must surface inbound external event sources (`/api/v1/inbound-sources`) as opt-in connector controls with disabled-by-default posture when `INBOUND_EXTERNAL_SOURCES_ENABLED=false`. | P1 | Tests cover list/create/delete, disabled/cost-gated state, connector health, and DLQ/error messaging. |
| FORTEMI-2026-07-REQ-007 | HotM attachment UX must continue to use TUS for large media and add explicit coverage for current TUS verbs (`POST`, `OPTIONS`, `GET`, `HEAD`, `PATCH`, `DELETE`) and server offset/checksum errors. | P1 | Upload tests cover resume offset, termination, checksum mismatch, and desktop adapter path. |
| FORTEMI-2026-07-REQ-008 | HotM must support included ad-hoc media routes through attachment-safe actions and keep agent exposure gated. | P2 | ADR-011 and #259 evidence record image description and audio/video transcription as attachment preview actions with unsupported-media and redaction tests. |
| FORTEMI-2026-07-REQ-009 | HotM must bound realtime call routes by exposing redacted REST call diagnostics and documenting Twilio live WebSocket diagnostics as excluded. | P2 | Admin API Surface tests cover `GET /api/v1/calls/{id}` lookup without raw transcript/provider ID rendering; route inventory records Twilio realtime as a documented exclusion. |
| FORTEMI-2026-07-REQ-010 | HotM backup/archive UX must document and cover the full current backup family, including database download, memory-scoped download, knowledge archive download/upload, metadata update, and portable byte-sidecar limitations. | P1 | Backup tests and docs cover implemented endpoints and list unsupported reference-only shard boundaries. |
| FORTEMI-2026-07-REQ-011 | HotM must preserve fail-closed auth/degraded-mode behavior: API keys, OAuth, compatibility metadata, and capability gates must not expose or enable production actions from unknown, preview, or unavailable states. | P0 | Existing compatibility tests plus new route coverage tests verify disabled-by-default behavior and redaction. |
| FORTEMI-2026-07-REQ-012 | HotM agent-proxy tools must be reviewed against current Fortemi capabilities and either extended or explicitly bounded so the assistant can use supported notes/search/archive/attachment/inference/ingest tools without hallucinating unavailable operations. | P1 | Tool inventory maps agent tools to server endpoints and identifies next tool additions with tests. |
| FORTEMI-2026-07-REQ-013 | HotM must pin and validate the Fortemi-owned canonical OpenAPI contract; route presence must not be treated as request/response schema compatibility. | P0 | Breaking-diff control plus typed consumer tests cover bodies, parameters, nullability, statuses, errors, and security requirements. |
| FORTEMI-2026-07-REQ-014 | HotM realtime consumers must conform to the Fortemi-owned AsyncAPI event envelope and payload catalog across SSE and WebSocket transports. | P0 | Golden event fixtures verify top-level `event_type`, identifiers, timestamps, resource references, and metadata; unknown events remain unknown and are not coerced to another event type. |
| FORTEMI-2026-07-REQ-015 | HotM backup/shard workflows must negotiate canonical Knowledge Shard schema version, `min_reader_version`, and profile, and must not claim lossless portability before cross-repository round trips pass. | P0 | Server-export -> HotM -> server-import golden suites preserve declared identities, relationships, null/tombstone semantics, timestamps, counts/checksums, and attachment bytes or produce a blocking loss report. |
| FORTEMI-2026-07-REQ-016 | HotM must enforce compatibility contract revision, server API revision, and minimum-client constraints before enabling server mutations. | P0 | Fixture matrix covers supported, unknown, malformed, and client-too-old responses with fail-closed production controls. |
| FORTEMI-2026-07-REQ-017 | HotM's Node auth verifier must pin the `fortemi-auth` claim-contract version and pass the same versioned fixtures as the Rust implementation before parity is claimed. | P0 | Cross-language fixture receipt covers issuer/audience/algorithm validation, tenant derivation, scopes, time claims, error taxonomy, and redaction. |

## Realtime Requirement Receipt

`FORTEMI-2026-07-REQ-014` is implemented for the sidecar-pinned producer commit
`98c9b29deee43b9c5bd96278f1f96837595882cd` by:

- `ui/src/api/contracts/fortemi-event-catalog.json`, which records the 48 exact
  namespaced event types, default subscription prefixes, producer source path, and
  source checksum, plus the reproducible generated AsyncAPI digest;
- `ui/src/api/events.ts`, which registers the exact SSE catalog and preserves the
  canonical top-level envelope fields;
- `ui/src/services/realtimeEventBus.ts`, which applies the same envelope and exact
  mapping to SSE and WebSocket input and retains unknown events as `Unknown`; and
- `.aiwg/testing/scripts/verify-fortemi-event-catalog.mjs`, plus the realtime
  Vitest suite, which gate source/catalog drift and both consumer paths.

The delivered inference availability payload uses the producer field `available`;
the former consumer-only `reachable` and `provider_id` event fields are not part of
this contract.

## Knowledge Shard Requirement Receipt

`FORTEMI-2026-07-REQ-015` is implemented for the selected `core-v1` profile
against Fortemi contract revision 19 at
`81fbeaf065df3818edd046ed8a744f10eeb00e6f`. HotM vendors exact producer
manifests for registered schemas `1.0.0`, `1.1.0`, and `1.2.0`, serializes only
the supported `include` query, validates the declared profile/schema/minimum
reader/components/counts/checksums before upload, and shows profile/schema plus
actionable failures in Backup Manager.

The visible server-export -> HotM -> clean-server-import and repeated-import
receipt proves semantic equality for the selected byte-free `core-v1` profile.
No receipt claims embeddings, attachment records/bytes, or richer-profile
recovery.

## Current Coverage Summary

HotM already has meaningful route and UI coverage for notes, search, archives/memories, jobs, events, inference config/audit/providers/test-connection, outbound webhooks, document types, attachments including TUS upload support, backup basics, concepts/SKOS, collections, templates, embedding sets/configs, health, and system compatibility. This statement is not a schema, semantic, losslessness, negotiation, or auth-parity claim.

The original investigation open set was concentrated in full backup/download coverage, agent-tool gating, hosted auth parity, and automated end-to-end contract inventory. The current implementation baseline has local evidence for those P0/P1 slices, and tracker closeout comments are published. Final closure still depends on a live route-verifier CI receipt or accepted local-preflight-only decision.

## Route Inventory Baseline

The generated coverage inventory at `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md` extracts 200 Fortemi route declarations from `crates/matric-api/src/main.rs` at commit `f6733252`.

| Status | Count | Meaning |
| --- | ---: | --- |
| covered | 186 | HotM has API, UI, agent-tool, or compatibility route-disposition evidence for the route family. |
| partial | 0 | No current verifier rows remain partial; future drift must be issue-backed before closure. |
| gap | 0 | No undisposed route family remains in the generated verifier baseline; REQ-013 through REQ-017 remain independent gates. |
| decision_needed | 0 | No current route requires an unresolved product/UX disposition before implementation or exclusion. |
| documented_exclusion | 14 | Route family is currently excluded from HotM UX claims and must remain documented until a product slice is opened. |

## Scope Boundary

This artifact does not assert that every Fortemi server endpoint needs a primary navigation item. "Seamless integration" means every server capability is either represented in UX/API client/tests, exposed through agent tooling, or documented as intentionally not user-facing with a compatibility guard and traceable issue.

The UX disposition for each v2026.7.1 covered and intentionally excluded route family is defined in `.aiwg/design/fortemi-v2026-07-ux-integration-addendum.md`; any future partial row must be added there with an issue-backed surface or exclusion path.

The workflow-level actor, state, alternate-flow, and test-scenario acceptance baseline is defined in `.aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md`.

The implementation order, dependencies, and route-family closeout rules are defined in `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md`.

The route-family proof checklist for seamless integration is defined in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.

The accepted product/UX disposition for vision, audio, and realtime call routes is defined in `.aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md`.

## OpenAPI Requirement Receipt

`FORTEMI-2026-07-REQ-013` is implemented against Fortemi commit
`ec14e0447711c45a8d5c5445ce47a35f26d4346a`. HotM vendors the exact generated
OpenAPI artifact at SHA-256
`4d1f9655c60ed6f97f86c790cab64ea9826ac9ca61084250a3b242fd10a7e30c`
and pins semantic fingerprint
`52ea99780e621b2073e0fb4bd1f0166c1a343c81d548f9856b8b1bc6ca886535`.
The verifier covers parameters, bodies, response/status declarations, component
schemas, errors, nullability, enums, and security; skew fixtures accept
`2026.2.8` and `2026.2.9` and reject breaking `2027.0.0`.

The typed call boundary now matches the delivered `CallDetailResponse` and
`TranscriptSegment` schemas and rejects malformed producer examples. All 249
operations carry a schema-bearing shared RFC 9457 rate-limit boundary; the
verifier rejects its removal or media/schema drift. CI emits exact producer and
consumer commits. Undeclared success payloads remain undeclared rather than
being inferred from descriptions.
