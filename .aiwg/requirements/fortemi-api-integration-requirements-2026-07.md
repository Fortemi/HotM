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

## Current Delivery Checkpoint: Cycle99

Selected-note controls satisfy the automated layout/menu assertions at 320,
390, 768 and 1440 pixels in Cycle98; earlier clipping observations are historical.
Cycle99 repeats 2178 UI tests, typecheck and build on unchanged runtime source.
This does not satisfy physical-device usability or AI-output evaluation, full
session isolation, released producer/consumer acceptance or suite portability.
Those requirements remain open independently of source delivery and CI.

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

## Cycle96 Session Requirement Evidence

HotM#1 / Fortemi#1091 / Core#405: context-owned React views and in-flight HTTP work
now invalidate together across effective token/tenant/archive changes. Stale
admission must never submit an old intent under new credentials; stale replies
and retry continuations must not restore prior-context data. Compatibility caches
and pending preflights must invalidate without old completions changing new state.
Tests include A-B-A and explicit gate reset, with owned subscription disposal.

Actual browser note selections use correct A/public, A/archive and B/public IDs;
foreign archive denial and logout clear previous content. Full requirement is not
complete: external job persistence/unfenced pause state and other persisted stores
remain, as do mobile clipped controls, nonempty browser replay/native/default-admin
and independent immutable delivered-axis gates. No full session or release claim.

## Cycle95 Session Isolation Requirement

HotM#1, Fortemi#1091 and Core#405 retain separate delivered-axis gates.
Effective token/tenant and selected-memory changes, including cross-tab storage,
must close old streams, discard cursors/pending work and clear every context-owned
view/cache. Pending asynchronous responses must not restore prior-context data.
Legacy unscoped job persistence cannot establish cache ownership.

Cycle95 passes stream notifications/replacement and useWebSocket queue reset tests,
plus six actual browser stream controls. It does not satisfy the complete requirement:
jobEventStore remains unscoped and the real note navigator retains the previous
tenant's list after switching. Native lifecycle, nonempty reconnect replay, live
independent-default administration and all delivery/release gates remain.

## Scope

Cycle94 implements selected-memory reader adoption: only the producer context
endpoint, bounded4096byte JSON, exact fields, canonical name/schema separation,
current selection checks and no retry/inventory/guessed fallback. Preserve the
producer's public/default alias semantics without generalizing them. Require
generated-schema agreement, real request/auth/error/size controls, unchanged
application context replacement and actual-server admission/SSE receipts before
delivery. No local test or candidate pin qualifies a released hosted application.

Cycle93 candidate dependency: consume producer-owned selected-memory read
metadata under read authority, not admin inventory. Preserve exact header/name
and event-schema binding, no local default guess, no failed-lookup fallback and
fresh authorization on each stream. Consumer implementation/pin/live gates
remain pending against `GET /api/v1/memory/context`; producer presence alone
does not satisfy these requirements.

Cycle92 realtime refinement (HotM#1 / Fortemi#1091 / Core#405): hosted streams
must send the selected archive name while validating envelope memory against
server-resolved schema metadata. Missing, conflicting or inaccessible metadata
fails closed without fallback to another archive. Default resolution must follow
the producer's tenant-visible default/public behavior. Archive switches must
replace transport/cursor, ignore stale asynchronous admission/callbacks, discard
pending old-context events and reset queue view state. Wrong tenant/memory or
unattributed queue data must not dispatch or advance replay; transport controls
must not override conflicting attribution. These are consumer integration
requirements, not new wire or authorization semantics.

The current inventory-backed default resolver does not yet satisfy the hosted
reader requirement: actual lookup returns503 at the route migration gate, and
the collection policy requires admin scope. Qualification requires a scoped
producer read/default-resolution path under the reader's existing authority;
increasing fixture privileges or inventing mappings is not acceptance.

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
| FORTEMI-2026-07-REQ-007 | HotM remote attachment UX must use TUS for byte transfer and cover the pinned create/options/head/patch/delete operations plus finalization, offset, expiry, and size failures. | P1 | Upload tests cover metadata validation, resume offset, termination, auth expiry, size limits, cancellation, redaction, and the desktop fetch adapter. |
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
| FORTEMI-2026-07-REQ-024 | Every sensitive credential, PKE, binary/media, backup, and TUS operation must have an exact owner-backed security decision; disabled exclusions must remain visible and non-invocable. | P0 | The generated 41-row decision table and operation catalog prove 5 typed TUS workflows, 5 browser/native media handoffs, and 31 disabled exclusions; CI rejects row/count/state drift. |

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
`0dd28a9255e2b53363f93e2e288777631709eb05`. HotM vendors the exact generated
OpenAPI artifact at SHA-256
`652bcce252719e5c0ced015beae02e41380c56dccaa5dc071d369b3ac6fdd858`
and pins semantic fingerprint
`1b22c57274341f5693ff1f3a5511cb441d6f78f7e010e39fc1c05cc15b94cfe4`.
The verifier covers parameters, bodies, response/status declarations, component
schemas, errors, nullability, enums, and security; skew fixtures accept exact
`2026.9.0` revision `2` and reject breaking `2027.0.0`.

The typed call boundary now matches the delivered `CallDetailResponse` and
`TranscriptSegment` schemas and rejects malformed producer examples. All 254
operations carry a schema-bearing shared RFC 9457 rate-limit boundary; the
verifier rejects its removal or media/schema drift. CI emits exact producer and
consumer commits. Undeclared success payloads remain undeclared rather than
being inferred from descriptions. Contract revision `2`, version `2026.9.0`,
contains 254 schema-bearing operations.

## 2026-08-15 Verification Baseline

REQ-020 is now enforced by the generated method/path/operation-ID matrix at
`.aiwg/api/compatibility/fortemi-v2026-07-operation-coverage.json`. Its seven
dimensions are independent, and an operation cannot become integrated from
route or file-presence evidence. The pinned baseline is 254 operations: 1
integrated, 222 partial, and 31 documented exclusions. REQ-021 therefore
remains open for the partial workflows even though all 204 routes have a
disposition.

REQ-014 has schema-derived coverage for all 48 pinned event schemas over SSE and
WebSocket, including required-field, enum, nullability, and identifier-format
negative mutations. Malformed known and unknown future events remain `Unknown`
with bounded raw-event preservation. The packaged Fortemi pin does not provide
producer-owned positive examples. The independent producer-corpus gate below
adds that portion of REQ-014; delivery and CI are required before closing #288.

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
the signed `fortemi-auth` release and exact Rust/Node corpus receipts do not
establish producer runtime admission or database isolation. These bounds keep
#231 open.

REQ-018 now has header-only fetch SSE context, replay, all-events subscription,
tenant/memory rejection, and redaction tests. Scoped WebSocket is deliberately
disabled because current Fortemi does not preserve auth, tenant, memory, or the
canonical envelope on that transport; Fortemi #953 blocks full two-transport
closure of #285.

REQ-021 now has a complete product-disposition ledger and operator catalog for
254 operations, with a CI stale-ledger check. The ledger records 130 UI, 10
agent, 5 external handoff, 1 typed shared-client, 77 diagnostic, and 31 excluded rows, but does not convert partial/gap
operation conformance into support. #287 remains open for family workflows and
browser receipts.

Fortemi/fortemi#61 supersedes the #294 removal decision with the pinned
`POST /api/v1/notes/{id}/links#create_note_link` operation and the
`manual-note-link-v1` contract. The UI API exposes a typed, compatibility-gated
shared-client method for explicit links only. Primary UI and agent invocation
remain documented exclusions; server-generated semantic/wiki links remain a
separate Fortemi behavior. Request and response dimensions are conformant,
auth/context is partial, and supported-platform live cells remain gaps or
explicit deferrals without a broad compatibility claim.

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
result before #297 was 1 integrated, 249 partial, and 1 gap with zero verifier
diagnostics.

## Sensitive Operation Requirement Receipt (2026-08-16)

REQ-024 is implemented by the generated 41-row decision table and schema-v2
operation ledger. Every row names a decision, owner, enabled state, rationale,
blocker, and evidence. Five TUS rows are typed UI workflows and five media rows
are browser/native handoffs. The remaining 31 rows are visible, disabled
documented exclusions.

Remote attachments use TUS for all sizes. Legacy multipart attachment upload,
database backup base64 upload, and base64 Knowledge Shard import are disabled.
Focused tests cover cancellation, resume offsets, TUS range/content headers,
advertised maximum size, malformed metadata, expired authorization, and
redaction of producer bodies, bearer values, upload URLs, tenant identifiers,
and local paths. No decision upgrades request, response, auth, live, or
Knowledge Shard conformance. The signed auth release and shared fixture receipts
cover only the named contract profile; OAuth operations remain excluded pending
producer payload, runtime admission, and hosted tenant-isolation evidence.

The current generated operation result is 1 integrated, 222 partial, and 31
documented exclusions with zero verifier diagnostics.

## Agent Operation Evidence Receipt (2026-08-16)

REQ-019 and REQ-020 now record conformant local agent evidence for 12 exact
pinned operations. The verifier checks every curated primary operation against
its method/path tuple, and the agent test suite checks every declared endpoint
against the pinned 254-operation ledger. This caught and corrected
`get_related` from `/notes/{id}/similar` to the canonical
`/notes/{id}/related` operation.

`create_job` is partial rather than a gap because the typed client and
privilege-gated `revise_note` workflow have exact request and bounded response
tests. Its response remains partial because the pinned `201` response has no
schema. UI, operation-specific authorization, and live evidence remain
unclaimed. The existing authenticated asset run is workflow-level evidence
only, so REQ-020 still reports all 254 live dimensions as gaps.


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
