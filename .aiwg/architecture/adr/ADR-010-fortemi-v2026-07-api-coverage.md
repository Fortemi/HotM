---
title: "ADR-010: Fortemi v2026.7.1 API Coverage Strategy"
status: accepted
date: 2026-07-14
artifact_type: adr
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/architecture/impact/fortemi-api-contract-drift-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/reports/fortemi-hotm-integration-audit-2026-08-15.md
---

# ADR-010: Fortemi v2026.7.1 API Coverage Strategy

## Current Delivery Checkpoint: Cycle99

Cycle98 corrected selected-note controls at 320, 390, 768 and 1440 pixels,
including wrapped tabs/actions, long titles and bounded regeneration menus.
Cycle99 reverified the unchanged UI source: 2178 tests, typecheck and build pass.
The mobile clipping limitations in older cycle entries below are historical.
Real-device usability, remaining context/lifecycle acceptance, exact-head CI,
producer/consumer delivery pins and released-artifact qualification remain
separate gates. The suite remains NO-GO. See the Cycle98 test-plan entry.

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

## Cycle96 Context-Owned Views And Requests

An opaque data-context revision identifies the effective bearer, tenant hint and
selected archive in memory only. Owned subscriptions observe same-tab changes and
relevant storage events; no credential is placed in React keys or event payloads.
App keys its context-owned desktop/mobile subtree, including media provider, to
this revision. A change discards the previous component state, selection, drafts
and media session. Local persistent data is not erased or guessed to be current.

HTTP requests capture a context before admission, own an AbortController and
subscriptions, check before each attempt and after fetch/decode, and release
subscriptions in finally. Stale work returns ContextChangedError without retry.
This does not undo a mutation already dispatched to the server or qualify every
delayed caller/transport. The compatibility gate separately fences old success,
failure and finally handlers by generation, invalidates cached snapshots on context
change, and protects explicit reset against late completion.

Cycle96 proves400focused/2133full UI assertions, typecheck/build, and eleven actual
browser controls with unchanged production asset bytes and the real daemon. Note
selection resolves the correct producer-owned IDs for A/public, A/archive and
B/public; foreign selection denial and logout clear old note-list/selection content.
One browser access per fixture note and four subsequent Core enrichment reads
are checked separately. No producer runtime/wire change or immutable pin promotion.

Full session isolation remains incomplete: external jobEventStore persistence and
pause state are still unscoped; other external/persisted stores need review. Selected
note controls clip at390px and compress the title, so mobile usability is NOT_PASS
despite correct note identity and nonblank pixels. Nonempty browser replay, native/
default administration, all consumer/lifecycle/CI/delivery/release gates remain.
Source rollback only, no persisted-schema migration. Suite NO-GO remains.

## Cycle95 Session Notifications And Browser Boundary

Token/tenant setters now emit credential-free change notifications only on effective
changes. Owned subscriptions also observe relevant cross-tab localStorage changes,
reset stale tenant overrides, and are removed on close. Memory subscriptions cover
both native selection events and cross-tab storage. The realtime service replaces
streams/cursors and fences old callbacks; useWebSocket resets its own queue view.

This is not application-wide state isolation. The unchanged jobEventStore persists
and hydrates unscoped hotm.jobStore data and accepts unfenced pause responses.
The actual browser also retains tenant A's note list after switching to tenant B;
only the SSE stream changes, with no replacement notes GET. HallOfMind and other
data views need session/selection invalidation and stale async-result fencing.
No prior-tenant cache may be treated as current merely because a stream reconnects.

Cycle95 source-bound production UI passes six actual-browser stream lifecycle
checks against an owned hosted daemon: initial admission, cross-tab archive change,
foreign-memory denial after token/tenant change, new tenant default, automatic
reconnect and logout. Desktop/mobile screenshots are nonblank without horizontal
page overflow, but explicitly show the stale note-list defect. Browser streams
receive no application events; nonempty replay and native/default-admin lifecycle
are not qualified. Unit326/full2102, typecheck/build and real Core HTTP regression
pass. No producer runtime/wire change or delivered pin promotion. Source rollback
is the migration path; suite NO-GO and independent delivery/release gates remain.

## Context

HotM previously integrated the Fortemi v2026.5.x surface. Fortemi now ships v2026.7.1, with major additions in streaming chat, streaming ingest, incoming webhook receivers, inbound event-source connectors, TUS uploads, upgrade safety, and Intel/vLLM deployment support. HotM also has an existing compatibility guard path and enterprise capability-gated UX plan.

The current HotM API client is broad but not exhaustive. A seamless integration target requires a formal coverage model: each server capability must be implemented in UI/API client/agent tooling, or explicitly excluded with rationale and a tracker item.

The current route inventory generated from Fortemi source commit `48bc0a0b` extracts 202
Fortemi route declarations and classifies them as 188 covered, 0 partial, 0 gap,
0 decision-needed, and 14 documented exclusions. The added `/livez` and `/readyz` probes are
classified under health, while the operator OpenAPI and AsyncAPI paths replace the removed root
document paths under `contract_docs`. That classification establishes route disposition, not
request/response, event, portable-data, compatibility-negotiation, or authentication conformance.

The route-family proof checklist for moving those classifications to implementation evidence is maintained in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.

### 2026-08-15 Audit Amendment

The route count remains useful for discovery and disposition, but the current
classifier can derive `covered` from route prefixes and source-file existence.
That cannot support an operation-level integration claim. #290 therefore owns
a method/path/operation-ID evidence model with independent request, response,
auth/context, UI, agent, and live-receipt states. #287 owns the resulting
umbrella-interface gaps.

The audit also identifies independent blockers that route coverage cannot
retire: runtime compatibility admission (#286), authenticated realtime context
(#285), per-event AsyncAPI payload validation (#288), agent runtime privilege
and auth enforcement (#123 and #231), current Knowledge Shard revision-21
consumption (#292), and a reliable browser gate (#291). Existing July receipts
remain historical evidence only at their exact pins and named profiles.

## Decision

### Cycle94: Selected-Memory Consumer Adoption

The candidate resolver now uses only GET /api/v1/memory/context through the
normal authenticated selected-memory HTTP client. Responses are capped at4096
bytes and decoded as exactly name/schema_name. Empty, oversized, noncanonical
or mismatched identities and extra fields fail closed. Name lengths count
Unicode code points as the producer schema does. No inventory read, retry,
schema derivation or client-invented public fallback is permitted. The producer's
explicit legacy default alias may return public/public, with no other expansion.
Default selection pins the canonical returned name for the stream.

Generation/session/selection fencing, stream/cursor replacement and pending
events/queue reset remain. Producer authority is the Cycle93 generated OpenAPI
SHA256 0dd9b77e6d42c73197a489c575107c66d8f66755a2f8141a6788c7f4295c3cf1.
Cycle94 compares its schema to the real consumer and records real-client
metadata/SSE acceptance separately from mocked UI tests. This is candidate
reconciliation, not a replacement of delivered authority pins. Those pins, CI,
browser/native lifecycle and releases remain delivery gates. Retain Cycle92's
failed inventory receipt and Cycle93's producer-only boundary. Consumer rollback
is source rollback; absence of the endpoint must fail closed.

### Cycle93: Selected-Memory Read Contract Candidate

The producer candidate adds read-authorized `GET /api/v1/memory/context` with
only `name`/`schema_name` and no-store, resolved through the current tenant's
request transaction and archive routing. Its tenant-qualified default index
allows independent tenant defaults without changing existing rows. Archive
inventory remains admin-only; a read-context lookup must not become a listing
or statistics privilege. The selected identity is a snapshot, never authority
for a later request. Every stream remains independently authorized.

HotM's Cycle92 resolver has NOT yet adopted this endpoint; its real hosted
acceptance remains NOT_PASS. The next consumer change must bind the generated
producer contract, reject malformed/failed lookup without a fallback, update
application/transport fixtures, and obtain actual-server metadata/SSE receipts.
Do not pin an uncommitted producer as delivered authority or promote a candidate
from local producer tests. Core has no dependency on this new read operation.

### Cycle92: Hosted Archive Identity at the Realtime Boundary

The application must separate the archive request name (`X-Fortemi-Memory`)
from the canonical hosted envelope memory (server-returned `schema_name`).
Resolve a selected name through the existing archive API; resolve default
selection through the tenant-visible inventory, with the producer's built-in
public fallback only when no default exists. Reject missing/mismatched metadata
or failed lookup; never derive a schema by prefixing a name. Pin a resolved
default to its explicit name for the stream's lifetime. Personal-mode name
filtering remains supported; this adds no producer wire field or new authority.

Archive changes replace the stream and replay cursor, fence pending admission
and old callbacks, clear coalesced events and reset queue counters. Rejected
tenant/archive events do not advance replay. QueueStatus is scoped application
data, not an attribution-free transport control; resync/lag controls may omit
attribution but may not contradict it. Server authorization remains decisive.

The source-bound Cycle92 checkpoint links HotM#1, Fortemi#1091 and Core#405.
Existing producer-owned event pins/catalog/fixtures and sidecar identities are
unchanged. Application-service tests, full UI regression and private actual-server
client/resolver receipts have distinct scopes; none implies a launched hosted
browser, full lifecycle, auth-parity, release or suite-wide compatibility receipt.
Rollback is consumer source rollback, not a data migration. Suite NO-GO remains.

Cycle92 acceptance is **local PASS / hosted NOT_PASS**. The real candidate
resolver receives HTTP503 from `GET /api/v1/archives` before opening any SSE
stream: the producer's archive handlers have not migrated to the request-owned
tenant transaction. Inventory listing also requires `admin`, while this reader
has `mcp read`; that policy dependency is source-confirmed, not an observed403
after migration. Do not widen reader privileges, bypass the migration gate,
guess schema names or stub metadata to qualify this candidate. A producer-owned
tenant-scoped read/default-resolution contract is a delivery prerequisite.

HotM will adopt a three-tier Fortemi API coverage model:

1. **Primary UX coverage** for user/operator workflows that require direct controls: native streaming chat, streaming health, ingest tokens/stream, incoming receivers, inbound sources, backup/archive, attachments/TUS, inference config, compatibility, notes/search/archive/job surfaces.
2. **Agent/tool coverage** for server capabilities best used through the embedded assistant: search, note creation, retrieval, linking, attachments, archive selection, and future ingest/inference operations.
3. **Documented exclusion** for capabilities that are server-only, deployment-only, or not currently user-facing. Exclusions must have a reason, compatibility behavior, and issue reference.

HotM will not use the local `docs/openapi.json` as the sole source of truth until it is normalized into a canonical OpenAPI object or replaced by upstream `/api/v1/operator/openapi.yaml` generation. Until then, route-source extraction from Fortemi plus focused contract tests is the control.

HotM will maintain independent release gates for:

1. route inventory and product disposition;
2. canonical OpenAPI schema and HTTP semantics;
3. canonical AsyncAPI event envelope and SSE/WS payload semantics;
4. Knowledge Shard schema/profile negotiation and lossless golden round trips;
5. compatibility contract revision, server API revision, and minimum-client enforcement; and
6. versioned cross-language auth claim fixtures.

A green route-inventory gate cannot satisfy any of gates 2-6. User-facing support and portability claims require the gate relevant to that claim.

## Consequences

### Positive

- Fortemi API drift becomes visible before release.
- Enterprise and local UX claims can be tied to endpoint/capability evidence.
- New streaming and ingest surfaces can share parser and degraded-state patterns.
- Agent tools gain a clearer capability boundary.

### Negative

- More CI/test maintenance is required when Fortemi changes route declarations.
- Some server endpoints will remain intentionally non-UI until a product decision is made.
- Generated OpenAPI parity remains a dependency if the team wants schema-level request/response diffing instead of route-level drift checks.
- Release verification becomes multi-axis; a route may be classified `covered` while its schema or semantic gate remains blocked.

## Implementation Notes

- Reuse the existing capability guard for unknown, preview, degraded, and unavailable states.
- Prefer feature-gated Admin panels for operational controls.
- Build POST-SSE parsing once and share it between `/chat/stream`, `/inference/stream`, and `/ingest/stream` where event framing allows.
- Keep local sidecar workflows usable when advanced server capabilities are unavailable.
- Update the capability surface matrix whenever a route family changes coverage tier, UX disposition, or proof requirement.
- Use ADR-011 for the proposed vision/audio/call/Twilio route dispositions until #259 lands implementation or exclusion evidence.
- Consume Fortemi-owned OpenAPI, AsyncAPI, Knowledge Shard, and compatibility artifacts by pinned revision; HotM does not redefine producer semantics locally.
- Treat `fortemi-auth` as a normative specification boundary until Rust workspace, CI, release, and shared downstream fixture evidence exist.

### Supported-Platform Consumer Adherence Gate (HotM #284)

The suite proof treats HotM strictly as a consumer. Fortemi owns and enforces the
OpenAPI, AsyncAPI, authentication, persistence, and Knowledge Shard
`2.0.0/full-v1` authority. `@fortemi/core` consumes that authority and enforces
the browser-side portable-data boundary. HotM must call those APIs through its
production client and must not redefine producer schemas or substitute a
HotM-specific persistence format.

The automated suite matrix in the Fortemi authority repository pins the exact
schema authority, runtime, immutable native sidecar assets, React/core package,
and HotM consumer revisions. For HotM `2026.7.1`, the release inputs are
Fortemi runtime `5ea08229c9f1565122df5f8e6906e89d98dc7e75`
(`v2026.7.19`), React/core
`5cab4ea2d3d4bb985ea0d38f8bcb1ea790b32cf7`
(`@fortemi/core@2026.7.15`), and immutable sidecar
`sidecar-5ea08229c9f1`. The authority-owned matrix adds the exact HotM release
commit and emits the platform and aggregate receipts. These are receipt
identities, not consumer-defined authority.

For each required platform, Linux x86_64 on `matric-builder`, native Linux
arm64 in mutsu's Colima VM, and native macOS arm64 on `mutsu`, the HotM gate
runs authenticated HTTP lifecycle operations, browser TUS upload/download,
headless Tauri commands, signed `full-v1` export, required-signature dry-run,
and mutating import through `createBackupApi`. The recovery memory is exported
before import and must contain zero records and no blobs. Child evidence files
are independently hashed and checked by both the HotM receipt verifier and the
suite aggregate.

Windows is the only deferred operating system because no Windows execution
authority is available. [Fortemi #1096](https://git.integrolabs.net/Fortemi/fortemi/issues/1096)
owns native Windows validation as a separate deferred story. Passing the three
required cells does not establish universal platform portability, complete
backup of all product state, a launched desktop GUI/native-dialog claim, or a
shared schema across the AIWG static index, Knowledge Shard, and Fortemi
persistence planes.

### Realtime Contract Receipt (HotM #268)

The realtime consumer gate is implemented against the delivered sidecar-pinned Fortemi commit
`5ea08229c9f1565122df5f8e6906e89d98dc7e75`. The source-derived catalog at
`ui/src/api/contracts/fortemi-event-catalog.json` records all 48 names returned by
`ServerEvent::namespaced_event_type` and the SHA-256 of
`crates/matric-core/src/events.rs`. The CI verifier rejects revision, checksum, or
catalog drift. The event and AsyncAPI source bytes are unchanged from the earlier
`98c9b29deee43b9c5bd96278f1f96837595882cd` receipt; the repin aligns this
consumer fixture with `release/sidecar-provenance.json`.

The same fixture records the generated AsyncAPI 3.0 YAML receipt. At the pinned
commit, `build_asyncapi_spec("2026.7.1", "https://example.invalid")` produces
45,161 bytes with SHA-256
`f6a6fbc39af52b713b6f5c40dbb6e46baeb8a1b352a19288e79073863766bdf4`;
the generator source SHA-256 is pinned alongside it.

Both SSE and WebSocket inputs pass through the same canonical envelope unwrapping
and exact-name normalization boundary. Unknown or missing event names remain
`Unknown`; they are not converted to queue status. This receipt proves the pinned
catalog, envelope fields, and HotM consumer behavior. It does not replace broader
producer AsyncAPI schema-diff coverage.

### Knowledge Shard Consumer Receipt (HotM #269)

HotM consumes the Fortemi `core-v1` authority at producer commit
`48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`, contract revision 19. The
machine receipt pins exact producer fixtures for schemas `1.0.0`, `1.1.0`, and
`1.2.0`; the current vendored manifest SHA-256 is
`246b89d6ca1d2e2c4a19b650e4cebe7825b69d39306280e281f4a94c80c2b008`.
The client sends only the producer-owned `include` query, reads `manifest.json`
from the gzip/TAR archive, and rejects unsupported format, profile,
unregistered schema, minimum-reader, components, counts, and checksum
declarations before upload.

The visible HotM -> clean-server and repeated-import receipt establishes
semantic equality for the selected `core-v1` profile. The version gate now
retains the registered historical window and consumes current schema 1.2. This
does not establish attachment-byte recovery or `full-v1`/`record-v1`
conformance.

### Full-v1 Recovery Consumer Receipt (HotM #272)

HotM additionally consumes the exact `2.0.0/full-v1` tuple at Fortemi authority
commit `48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`, contract revision 21,
contract SHA-256
`ac417e23181ec80741d776b6b29fa38236091dfa649b01255aaac30ebb53969f`.
The machine receipt pins the receipt-bound opt-in advertisement, 33 component
identifiers, 34 count fields, schema bundle, 220-field presence inventory,
runtime receipt, and paired cross-repository receipt.

The export path requests `schema_version=2.0.0`, `profile=full-v1`, and
`include_blobs=true`, then pipes `Response.body` directly to an
operator-selected writable stream. The browser does not construct a complete
archive `Blob`. Import locally validates the exact tuple, bounded gzip/TAR
structure, complete component/count/checksum inventory, and resource limits.
It then requires a Fortemi `dry_run=true&verify_signature=require` response
before sending `dry_run=false`. Signature, component/blob digest, byte length,
reference, presence-state, and database/blob mutation checks remain at the
Fortemi authority boundary.

The live recovery cell now passes against immutable Fortemi sidecar
`sidecar-336df3ed834b` at commit
`336df3ed834be581d1a0f0a3d252fb48e723b987`. The released HotM consumer
accepted the signed 7,086-byte archive through its bounded streaming
inspector. A public-key-only clean Fortemi destination passed explicit
required-signature dry-run before two mutating imports, then re-exported all
33 component files, 34 count fields, and the attachment sidecar byte-for-byte.
Manifest, component, signature, attachment, missing, oversized, unsupported,
and skewed inputs all returned 400 without changing the destination.

This establishes `fullV1Interoperability=true` only for the named exact
React-fixture -> immutable Fortemi producer -> released HotM pass-through ->
clean Fortemi destination cell. `suiteWide` and `completeBackup` remain false,
and `record-v1` remains unsupported. The historical unsigned preflight receipt
is retained separately from the passing receipt.

The producer advertises only exact `2.0.0/full-v1`; `2.0.0/core-v1` and
`2.0.0/record-v1` are explicitly unadvertised. The consumer verifier fails
closed on any unknown revision, advertisement/evidence drift, or broadened
suite-wide, complete-backup, or parity claim.

### Compatibility Admission Receipt (HotM #244/#286)

`ui/src/api/systemCompatibility.ts` accepts only schema `1` and contract
revision `2026-07-06`. It compares Fortemi's
`minimum_hotm_enterprise_client` with the exact version from
`ui/package.json` before capability normalization and admits only Fortemi API
versions `>=2026.7.0 <2027.0.0` using SemVer 2 precedence. Unsupported schemas,
unknown revisions, malformed values, client-too-old, server-too-old/new,
unavailable, and unsupported auth-contract responses throw typed errors.

The UI starts a non-blocking preflight and gates all shared-client plus direct
multipart/stream/root-OAuth mutations before dispatch. The legacy wrapper and
agent-proxy use the same policy. Focused tests cover correct numeric prerelease
ordering, all typed block states, cached decisions, zero-dispatch denial, and
local/read-only continuity.

The duplicated consumer receipts pin Fortemi commit `48bc0a0b`,
`contracts/suite-conformance/platform-matrix.json`, and the response source;
`.aiwg/testing/scripts/verify-fortemi-system-compatibility-contract.mjs`
verifies both copies and producer checksums in CI. Authenticated mode requires
claim-contract version `1`; the current producer omits it and therefore fails
closed. This receipt is not OpenAPI, AsyncAPI, Knowledge Shard, or
`fortemi-auth` parity evidence.

### OpenAPI Consumer Receipt (HotM #270)

HotM consumes the Fortemi-generated OpenAPI 3.1 artifact at producer commit
`0dd28a9255e2b53363f93e2e288777631709eb05`, stable path
`contracts/openapi/openapi.yaml`, and SHA-256
`652bcce252719e5c0ced015beae02e41380c56dccaa5dc071d369b3ac6fdd858`.
The `hotm-openapi-v1` semantic projection has SHA-256
`1b22c57274341f5693ff1f3a5511cb441d6f78f7e010e39fc1c05cc15b94cfe4`
and compares parameters, request bodies, responses/statuses, component schemas,
nullability, enums, error metadata, and security requirements.

The gate accepts contract revision `2`, exercises current `2026.9.0` and a
rejected breaking `2027.0.0` fixture, and emits a CI
receipt containing exact producer and consumer commits. The delivered call
response schema exposed and corrected a real consumer mismatch: call transcript
segments now use producer fields `id`, `call_id`, `text`, `sequence`,
`created_at`, `speaker_label`, `start_ts`, `end_ts`, and `confidence`.

The producer artifact has 195 paths and 254 operations. All 254 operations now
carry the global middleware's schema-bearing `429 application/problem+json`
boundary. The artifact contains 271 schema-bearing responses across 581
response entries.
The gate requires that shared boundary on every operation and preserves the six
producer-declared typed success schemas. This does not claim typed success
payloads where Fortemi has not declared them.

### Decision Amendment: Executable Operation Evidence

The route-family disposition decision is amended by #290. The normative
coverage record is now generated from the pinned OpenAPI artifact plus
`.aiwg/testing/data/fortemi-operation-conformance-v2026-07.json`. Evidence is
keyed by method, path, and operation ID; mixed dispositions within a route
family are allowed. An operation is `integrated` only when every applicable
request, response, auth/context, UI, agent, and live dimension is conformant.
Missing evidence is reported as `partial` or `gap`, never inferred from a path
prefix or source-file match.

The current generated result is 1 integrated, 249 partial, and 1 gap operation
with zero pin, boundary, evidence-path, or unclassified-operation diagnostics.
Route inventory, OpenAPI, AsyncAPI, Knowledge Shard, compatibility, and auth
remain independent release gates. The schema-derived AsyncAPI transport receipt
does not independently close #288: the packaged revision has no producer-owned
event example corpus. The independent producer-corpus gate below supplies that
separate evidence. The desktop/mobile mocked Playwright gate introduced by
#291 is likewise UI evidence, not live or auth/context evidence.

### Decision Amendment: Authenticated Runtime and Product Disposition

HotM will enforce compatibility and authentication before agent-proxy request
parsing, bind privilege sessions to authenticated tenant/principal/memory
identity, and forward only that admitted bearer and memory context. Required
auth with a missing or unsupported claim-contract revision is denied; an
advertised local `anonymous_local` profile remains usable.

Scoped realtime uses header-capable fetch SSE with `Last-Event-ID` replay and
consumer-side tenant/memory rejection. Legacy WebSocket is not a scoped
fallback until Fortemi #953 supplies auth and canonical envelope context.

The product-disposition control is
`ui/src/api/contracts/fortemi-operation-dispositions.json`, generated and
verified from the #290 operation matrix. Every pinned operation has an explicit
privilege and one of UI workflow, agent workflow, operator diagnostic, or
documented exclusion. This control never upgrades conformance. Historical
explicit-link POST/DELETE claims remain removed. Fortemi #61/#62 now provide
the replacement `POST /api/v1/notes/{id}/links` operation as
`manual-note-link-v1` at the exact producer pin above. HotM consumes it through
the typed shared client only: `{id}` is the source, `to_note_id` is the target,
`explicit` is the sole writable kind, score is optional and bounded, and create
versus replay is represented by the typed `created` response field. Extra
fields and malformed success bodies fail closed. The shared mutation gate must
admit the server contract before dispatch and continues to attach bearer and
selected-memory context.

This amendment does not add a primary UI control or an agent tool. Both are
documented exclusions pending a separate product/workflow decision; read-only
link exploration and server-owned semantic/wiki maintenance remain distinct.
Wrong-scope, wrong-audience, expired, cross-tenant, archived, and missing-note
outcomes remain producer authorization/visibility responsibilities. Linux
x86_64, Linux arm64, and macOS arm64 live consumer cells must bind this same
producer revision before the operation can receive an unqualified live or
supported-platform claim.

### Decision Amendment: Verifiable Umbrella Workflows (2026-08-16)

Accept #295's 60 core entries and #296's 76 operator entries as exact pinned
workflow promotions. Their 18 overlaps produce 118 unique operations. Support
is admitted only when the generated ledger matches method, path, and operation
ID and the runtime compatibility gate accepts the server contract. Response
handling must be bounded and typed or redacted; malformed and oversized
payloads fail closed. Every mutation requires an explicit confirmation in its
rendered workflow.

Before the #297 disposition amendment, the generated conformance result was 1
integrated, 249 partial, and 1 gap.
This count records stronger executable request/response/UI evidence; it does
not upgrade operation-specific auth, agent, or live dimensions. Restricted
secret/key and binary/Knowledge Shard transfer operations remain unpromoted
under #297. Route disposition, matching family names, and mocked browser
receipts remain insufficient to claim full Fortemi conformance.

### Decision Amendment: Sensitive Operations (2026-08-16)

Accept the generated #297 decision ledger as the product boundary for its
exact 41 rows. Five TUS operations are typed UI workflows using
`tus-js-client` and direct browser/Tauri byte transport; five authenticated
attachment/media reads are external browser/native protocol handoffs; and 31
credential, PKE, legacy attachment, and underspecified backup operations are
disabled documented exclusions.

The 31 exclusions cannot be enabled by route inventory, implementation
presence, response prose, or a mocked browser receipt. Promotion requires
producer-owned request, response, and auth artifacts at the pinned revision
and focused consumer verification. OAuth remains excluded while
`fortemi-auth` is specification-only. PKE remains excluded while success
schemas and private-key custody/redaction receipts are absent. Backup and
legacy attachment upload remain excluded where binary media types, headers, or
request/success schemas are absent.

All remote attachment uploads use TUS; uncontracted multipart and large
base64-in-JSON paths are disabled. Transfer failures expose only bounded
categories. Credential material, upload URLs, tenant IDs, local paths, and raw
binary never enter generic agent inputs, logs, telemetry, screenshots, or
generic errors. This decision records 31 explicit exclusions rather than
promoting them: after the #298 reconciliation, the current operation result is
1 integrated, 219 partial, no gaps, and 31 documented exclusions.

## Agent Evidence Reconciliation (2026-08-16)

#298 corrects the curated related-notes tool from the unpinned `/similar`
route to the producer-owned `GET /api/v1/notes/{id}/related` operation and
binds every declared tool endpoint to the pinned operation ledger. Twelve
exact operations now have conformant local agent-dispatch and privilege
evidence. Ten remain assigned to the agent product surface; `list_archives`
and `get_note_tags` retain their UI product disposition while independently
recording agent evidence.

`create_job` moves from `gap` to `partial`: its typed serializer/decoder and
the constrained `revise_note` workflow are verified, but the producer's `201`
response is not schema-bearing and no arbitrary-job UI, operation-specific
authorization receipt, or exact-operation live receipt exists. The generated
result is therefore 1 integrated, 219 partial, 0 gaps, and 31 documented
exclusions. All 251 live dimensions remain gaps; the authenticated asset
workflow run is not reclassified as operation-bound evidence.


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
