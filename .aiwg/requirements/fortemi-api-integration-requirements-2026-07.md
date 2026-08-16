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
  - .aiwg/reports/fortemi-hotm-integration-audit-2026-08-15.md
---

# Fortemi API Integration Requirements - v2026.7.1

## Scope

This requirements baseline covers HotM alignment with Fortemi. The 2026-08-15 audit uses HotM `bf00c6c5334707621e8c6fd96bfcff908ee1f770`, the Fortemi checkout at `48bc0a0b`, producer-owned contract artifacts pinned at `5ea08229c9f1565122df5f8e6906e89d98dc7e75`, server route declarations in `crates/matric-api/src/main.rs`, HotM clients under `ui/src/api`, and the agent tool boundary under `agent-proxy/src`.

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
| FORTEMI-2026-07-REQ-016 | HotM must enforce compatibility contract revision, server API revision, minimum-client constraints, and supported auth claim-contract versions before enabling server mutations. | P0 | Pinned producer profile/source verification plus UI and agent-proxy fixtures cover compatible, unknown, malformed, unavailable, client-too-old, server-too-old/new, and unsupported-auth responses with denial before dispatch. |
| FORTEMI-2026-07-REQ-017 | HotM's Node auth verifier must pin the `fortemi-auth` claim-contract version and pass the same versioned fixtures as the Rust implementation before parity is claimed. | P0 | Cross-language fixture receipt covers issuer/audience/algorithm validation, tenant derivation, scopes, time claims, error taxonomy, and redaction. |
| FORTEMI-2026-07-REQ-018 | HotM realtime SSE and WebSocket transports must preserve authenticated bearer, memory, and tenant context and reject cross-context events. | P0 | Authenticated two-memory/two-tenant tests prove isolation, reconnect continuity, and credential/context redaction on both transports. |
| FORTEMI-2026-07-REQ-019 | HotM agent privileges must be enforced at the server-side tool execution boundary; UI mode and tool metadata are not authorization. | P0 | Forged mode, replayed confirmation, altered arguments, unknown tool, destructive/admin, and concurrent-session tests fail closed. |
| FORTEMI-2026-07-REQ-020 | Integration coverage must be recorded per OpenAPI operation with independent request, response, auth/context, UI, agent, and live evidence. | P0 | The generated operation matrix rejects prefix/file-only coverage and fails on unclassified or stale evidence. |
| FORTEMI-2026-07-REQ-021 | Every supported Fortemi capability must have a verifiable HotM user/operator workflow, a privilege-gated agent workflow, or an explicit documented exclusion. | P1 | Browser scenarios cover each implemented family and the operation matrix contains no implicit gaps. |
| FORTEMI-2026-07-REQ-022 | Knowledge Shard authority refresh must include current contract revision/profile metadata and preserve profile-specific claims. | P0 | Revision-21 `core-v1`/`full-v1` checks and clean-server golden receipts pass; `record-v1`, suite-wide, and complete-backup claims remain false until separately proven. |
| FORTEMI-2026-07-REQ-023 | The deterministic mocked browser suite must be a reliable required integration gate. | P1 | All non-quarantined Playwright scenarios pass with pinned contract fixtures; quarantines are issue-backed and cannot hide core note/search/tag failures. |

## 2026-08-15 Audit Disposition

Requirements 013 through 023 are independent release gates. Artifact identity
currently passes for the pinned OpenAPI and AsyncAPI inputs, but full integration
closure is blocked by #285 through #292, plus the existing runtime authority
work in #123 and #231. A green route inventory cannot satisfy these requirements.

## Realtime Requirement Receipt

`FORTEMI-2026-07-REQ-014` is partially implemented for the sidecar-pinned producer commit
`5ea08229c9f1565122df5f8e6906e89d98dc7e75` by:

- `ui/src/api/contracts/fortemi-event-catalog.json`, which records the 48 exact
  namespaced event types, default subscription prefixes, producer source path, and
  source checksum, plus the reproducible generated AsyncAPI digest;
- `ui/src/api/events.ts`, which registers the exact SSE catalog and preserves the
  canonical top-level envelope fields;
- `ui/src/services/realtimeEventBus.ts`, which applies the same envelope and exact
  mapping to SSE and WebSocket input and retains unknown events as `Unknown`; and
- `.aiwg/testing/scripts/verify-fortemi-event-catalog.mjs`, plus the realtime
  Vitest suite, which gate source/catalog drift and both consumer paths on pull
  requests and delivered `main` revisions.

The delivered inference availability payload uses the producer field `available`;
the former consumer-only `reachable` and `provider_id` event fields are not part of
this contract. Event and AsyncAPI source checksums are unchanged from the earlier
`98c9b29deee43b9c5bd96278f1f96837595882cd` receipt.

The catalog and envelope receipt does not validate each event payload schema or
authenticated memory/tenant context. Those remaining requirements are tracked
in #285 and #288.

## Knowledge Shard Requirement Receipt

`FORTEMI-2026-07-REQ-015` retains the selected `core-v1` profile
against Fortemi contract revision 19 at
`48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`. HotM vendors exact producer
manifests for registered schemas `1.0.0`, `1.1.0`, and `1.2.0`, serializes only
the supported `include` query, validates the declared profile/schema/minimum
reader/components/counts/checksums before upload, and shows profile/schema plus
actionable failures in Backup Manager.

The visible server-export -> HotM -> clean-server-import and repeated-import
receipt proves semantic equality for the selected byte-free `core-v1` profile.
The separate HotM #272 recovery path consumes exact `2.0.0/full-v1` against
authority commit `48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`, revision 21.
It streams export bytes without a complete archive buffer, requires all 33
components and 34 count fields, and performs a signed Fortemi zero-mutation
dry-run before any mutating upload. The pinned runtime and paired receipts
cover component/blob digest, length, references, limits, repeated imports,
presence states, and clean Fortemi recovery. The HotM receipt remains scoped:
immutable sidecar `sidecar-336df3ed834b` emitted a signed archive, the released
HotM consumer passed bounded streaming inspection, and a public-key-only clean
Fortemi destination passed required-signature dry-run, two imports, exact
33-component/34-count-field/attachment-byte re-export, and eight zero-mutation
rejections. `fullV1Interoperability` is true only for this named exact cell;
`suiteWide` and `completeBackup` remain false.

Revision-19 `core-v1` remains the default migration-window authority.
Revision-21 advertises exact `2.0.0/full-v1` only as a receipt-bound opt-in;
`2.0.0/record-v1` remains unadvertised and unsupported. The verifier binds the
advertisement to its runtime and cross-repository receipts and preserves
`suiteWide=false` and `completeBackup=false`.

## Compatibility Requirement Receipt

`FORTEMI-2026-07-REQ-016` has runtime evidence for schema `1`, revision
`2026-07-06`, Fortemi API range `>=2026.7.0 <2027.0.0`, SemVer 2 ordering, the
producer minimum-client field, and auth claim-contract version `1`. The UI
starts a non-blocking cached preflight and denies shared-client, multipart,
streaming, root-OAuth, legacy-wrapper, and agent-proxy mutations before network
dispatch on any unknown or incompatible state. Reads and local rendering remain
available.

The consumer receipt pins Fortemi commit `48bc0a0b`, its compatibility profile,
and response source; the CI verifier checks both consumer copies and producer
checksums. This proves bounded admission behavior only. OpenAPI, AsyncAPI,
Knowledge Shard, and cross-language auth parity remain separate gates. Because
the current producer does not advertise a claim-contract version,
authenticated remote mutations intentionally fail closed.

## Current Coverage Summary

HotM already has meaningful route and UI coverage for notes, search, archives/memories, jobs, events, inference config/audit/providers/test-connection, outbound webhooks, document types, attachments including TUS upload support, backup basics, concepts/SKOS, collections, templates, embedding sets/configs, health, and system compatibility. This statement is not a schema, semantic, losslessness, negotiation, or auth-parity claim.

The current implementation baseline has broad local route and component evidence, but the 2026-08-15 audit reopened operation-level conformance, realtime context/payloads, compatibility admission, agent authority, Knowledge Shard authority, umbrella UX, and browser verification. The owning issues are #123, #231, and #285 through #292.

## Route Inventory Baseline

The generated coverage inventory at `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md`
extracts 202 Fortemi route declarations from `crates/matric-api/src/main.rs` at delivered sidecar
commit `48bc0a0b`.

| Status | Count | Meaning |
| --- | ---: | --- |
| covered | 188 | HotM has API, UI, agent-tool, or compatibility route-disposition evidence for the route family. |
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
`5ea08229c9f1565122df5f8e6906e89d98dc7e75`. HotM vendors the exact generated
OpenAPI artifact at SHA-256
`9d2d5ea05f21a71d416d713a5cadd2c4f76086a3494105280d50ec328c4056fd`
and pins semantic fingerprint
`6e84af14c4f0aebb885123b19dfa639ddfda5e73ef08d0ebbb9ca7ca8db9e633`.
The verifier covers parameters, bodies, response/status declarations, component
schemas, errors, nullability, enums, and security; skew fixtures accept
`2026.2.8` and `2026.2.9` and reject breaking `2027.0.0`.

The typed call boundary now matches the delivered `CallDetailResponse` and
`TranscriptSegment` schemas and rejects malformed producer examples. All 251
operations carry a schema-bearing shared RFC 9457 rate-limit boundary; the
verifier rejects its removal or media/schema drift. CI emits exact producer and
consumer commits. Undeclared success payloads remain undeclared rather than
being inferred from descriptions.

## 2026-08-15 Verification Baseline

REQ-020 is now enforced by the generated method/path/operation-ID matrix at
`.aiwg/api/compatibility/fortemi-v2026-07-operation-coverage.json`. Its seven
dimensions are independent, and an operation cannot become integrated from
route or file-presence evidence. The pinned baseline is 251 operations: 1
integrated, 249 partial, and 1 gap. REQ-021 therefore remains open for the
partial/gap workflows even though all 202 routes have a disposition.

REQ-014 has schema-derived coverage for all 48 pinned event schemas over SSE and
WebSocket, including required-field, enum, nullability, and identifier-format
negative mutations. Malformed known and unknown future events remain `Unknown`
with bounded raw-event preservation. Because the pinned Fortemi checkout does
not provide producer-owned positive examples, #288 and the producer-example
portion of REQ-014 remain open.

REQ-023 is implemented as a required two-project mocked Playwright gate at
1280 px and 390 px with zero retries. The gate records the exact HotM revision
and fixture/test digest and uploads reports and failure media. It does not
satisfy live Fortemi, launched Tauri, compatibility, or auth/context receipts.

## Auth, Realtime, and Umbrella Implementation Receipt

REQ-017 and REQ-019 now have runtime consumer evidence in the agent proxy:
pre-parse admission, RS256 issuer/audience/JWKS verification, accepted
claim-contract enforcement, tenant consistency, identity-bound privilege
sessions, context forwarding, one-shot confirmations, and redacted errors.
Hosted operation still fails closed because the current required-auth
compatibility payload does not advertise an accepted claim-contract version;
`fortemi-auth` remains specification-only pending the repository contract's
release condition. These bounds keep #231 open.

REQ-018 now has header-only fetch SSE context, replay, all-events subscription,
tenant/memory rejection, and redaction tests. Scoped WebSocket is deliberately
disabled because current Fortemi does not preserve auth, tenant, memory, or the
canonical envelope on that transport; Fortemi #953 blocks full two-transport
closure of #285.

REQ-021 now has a complete product-disposition ledger and operator catalog for
251 operations, with a CI stale-ledger check. The ledger records 16 UI, 11
agent, 183 diagnostic, and 41 excluded rows, but does not convert partial/gap
operation conformance into support. #287 remains open for family workflows and
browser receipts.

The #294 contract decision removes direct link mutation from HotM. The pinned
and current producer authorities contain only GET link/backlink operations, so
the UI API exposes no create/delete methods and both agent registries omit the
historical tool. Server-generated semantic/wiki links remain a separate
Fortemi behavior. Any future mutation requires a new pinned operation with
request, response, auth/context, privilege, altered-argument, and live evidence
before it can satisfy these requirements.

## Core And Operator Workflow Receipt (2026-08-16)

REQ-020 and REQ-021 gain executable request, response, and responsive UI
evidence for 118 unique pinned operations: 60 #295 core entries and 76 #296
operator entries with 18 overlaps. Exact tuple checks reject contract drift;
bounded decoders reject malformed or oversized responses; remote mutation is
compatibility-admitted; destructive and operator mutations require explicit
confirmation; rendered receipts exclude raw credentials, tenant identifiers,
paths, webhook secrets, and server error bodies.

These operations remain `partial`, not fully integrated, until their
operation-specific authorization and live-server receipts exist. Agent
coverage remains independent. Secret/key administration, secret-bearing
webhook/inbound creation, binary backup/archive movement, and Knowledge Shard
transfer remain outside promotion and under #297. The generated 251-operation
result is therefore 1 integrated, 249 partial, and 1 gap with zero verifier
diagnostics.
