---
title: SAD Addendum - Fortemi v2026.7.1 Integration Architecture
status: proposed
date: 2026-07-14
artifact_type: software-architecture-document-addendum
related_artifacts:
  - .aiwg/architecture/software-architecture-doc.md
  - .aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/reports/fortemi-hotm-integration-audit-2026-08-15.md
---

# SAD Addendum - Fortemi v2026.7.1 Integration Architecture

## 1. Purpose

This addendum updates the HotM Software Architecture Document for the Fortemi server API and capability surface. The 2026-08-15 audit evaluates HotM `bf00c6c5334707621e8c6fd96bfcff908ee1f770` against the Fortemi checkout and route inventory at `48bc0a0b`; the consumed OpenAPI and AsyncAPI artifacts remain pinned to producer `5ea08229c9f1565122df5f8e6906e89d98dc7e75`.

The original SAD remains the baseline for the local-first HotM architecture. This addendum defines the target integration architecture across API clients, UX surfaces, realtime streams, admin controls, agent tools, compatibility guards, and route coverage verification. It does not assert that the target is implemented merely because a matching route or client method exists.

### 1.1 Current-State Qualification

The generated 202-route inventory proves route discovery and client/surface disposition only. It does not, by itself, prove:

- OpenAPI request/response schema compatibility.
- AsyncAPI event-envelope or event-payload compatibility.
- Knowledge Shard import/export losslessness.
- compatibility-revision or minimum-client negotiation.
- cross-language JWT claim behavior.

Those properties remain target-state gates until the executable controls in the API contract test addendum pass against a pinned Fortemi producer.

### 1.2 2026-08-15 Audit Status

The architecture is not yet verified as a complete server umbrella. The
following independent gates are open:

| Boundary | Architectural gap | Issue |
| --- | --- | --- |
| Compatibility | The parser is display-oriented; startup and remote mutations are not admitted through a pinned, API-version-aware fail-closed decision. | #286 |
| Realtime context | SSE and WebSocket do not preserve the REST bearer, memory, and tenant context or independently reject cross-context events. | #285 |
| Event payloads | Event names and envelope identity are pinned, but every AsyncAPI payload is not validated on both transports. | #288 |
| Operation coverage | Route prefixes and source-file existence can classify an operation as covered without typed request/response, auth, UI, agent, or live proof. | #290 |
| Umbrella UX | Supported server capabilities still lack user/operator workflows or explicit exclusions. | #287 |
| Agent authority | Privilege metadata and Node auth fixtures are not installed as mandatory server-side tool-execution controls. | #123, #231 |
| Portable data | Revision-21 `full-v1` is pinned as a receipt-bound opt-in; `record-v1` remains unadvertised and unsupported. | #292 delivered |
| Browser verification | The mocked browser suite has 36 unexpected failures and is not currently a reliable release gate. | #291 |

The exact OpenAPI pin remains healthy at 193 paths and 251 operations, and the
exact AsyncAPI pin remains healthy at 48 event names. Those passing artifact
identity checks do not waive any open gate above.

## 2. Architectural Drivers

| Driver | Implication |
| --- | --- |
| Complete current-server capability awareness | HotM must maintain a route inventory and map each route family to UI, API client, agent tool, or documented exclusion. |
| Local-first continuity | Missing advanced server features must not break core note capture/search/archive workflows. |
| Capability-gated production controls | Unknown, preview, unavailable, or degraded server states must disable production-affecting actions. |
| Streaming-first server additions | HotM needs reusable POST-SSE/ReadableStream plumbing for chat stream and ingest stream. |
| Operator visibility | Admin/realtime views must show health, backpressure, connector, and compatibility state without developer tools. |
| Secret hygiene | UI, logs, fixtures, and agent tool output must not expose API keys, ingest tokens, webhook secrets, connector credentials, tenant secrets, raw private paths, or KMS identifiers. |

## 3. System Context Delta

### 3.1 Existing Context

HotM is a React/Tauri desktop and web UI consuming a Fortemi API base URL, with optional desktop adapter behavior and an agent-proxy for provider and tool execution. The main Fortemi integration points are:

- `ui/src/api/*` typed API modules.
- `ui/src/services/realtimeEventBus.ts` and `websocket.ts` for SSE/WS convergence.
- Admin panels for compatibility, inference, document types, webhooks, archives, backup, and jobs.
- `agent-proxy/src/tools.ts` for server-side Fortemi tool calls from the embedded assistant.

### 3.2 New Fortemi v2026.7.1 Integration Context

The route inventory extracts 202 server route declarations and classifies their HotM disposition:

| Status | Count | Architectural meaning |
| --- | ---: | --- |
| covered | 188 | Existing HotM architecture has a consuming module, surface, tool, or compatibility-bound route-disposition evidence. This is not schema or semantic conformance. |
| partial | 0 | No current verifier rows remain partial; future partial rows must be issue-backed before closure. |
| gap | 0 | No undisposed route family remains in the current verifier baseline; independent contract gates may still be open. |
| decision_needed | 0 | No current route requires a new product/UX disposition before implementation or exclusion. |
| documented_exclusion | 14 | Route family is outside current HotM UX claims and must remain explicitly excluded. |

## 4. Component Architecture Delta

### 4.1 API Client Layer

Add or extend typed modules for these route families:

| Route family | Target module | Notes |
| --- | --- | --- |
| `/api/v1/chat/stream` | `ui/src/api/chat.ts` or new stream helper | POST-SSE parser; fallback to sync chat. |
| `/api/v1/health/streaming` | `ui/src/api/health.ts` | Chat/ingest/connector counters and degraded states. |
| `/api/v1/ingest/stream`, `/api/v1/ingest/tokens` | new `ui/src/api/ingest.ts` | Token mint/revoke plus NDJSON stream client. |
| `/api/v1/webhooks/incoming*` | extend `ui/src/api/webhooks.ts` or new `incoming-webhooks.ts` | Keep outbound and incoming concepts distinct. |
| `/api/v1/inbound-sources*` | new `ui/src/api/inboundSources.ts` | Cost-gated connector lifecycle. |
| backup/database/memory/knowledge-archive routes | extend `ui/src/api/backup.ts` | Full current backup family and sidecar limitations. |
| vision/audio/calls | Proposed by ADR-011; owned by #259 | Vision/audio attachment actions are implemented; calls remain Admin/Realtime Debug diagnostics or exclusion; Twilio realtime initially excluded unless diagnostics require it. |

### 4.2 Stream Transport Layer

HotM should add a reusable POST stream reader with these responsibilities:

- Send request bodies for POST-based SSE endpoints.
- Parse SSE-style `event:` / `data:` frames and NDJSON-like payloads where applicable.
- Support abort/cancel through `AbortController`.
- Surface terminal `done` and `error` events.
- Preserve retry and resume metadata such as `Last-Event-ID` and `X-Ingest-Cursor` without inventing client-authoritative cursors.
- Normalize 401, 410, 429, and 503 into user-facing degraded states.

Consumers:

- Native Fortemi chat stream (#242).
- Inference stream if a shared parser is practical.
- NDJSON ingest stream (#255).

### 4.3 Admin / Operator UX Layer

Admin should remain the home for operator-facing server controls:

- API Surface / Compatibility: compatibility and route coverage summary.
- Streaming Health: chat tokens/drops/disconnects, ingest backpressure/rate limit, inbound connector lag/errors (#254).
- Incoming Webhook Receivers: HMAC/schema/idempotency receiver lifecycle (#256).
- Inbound Sources: Redis Stream/SSE/Kafka connector lifecycle and cost-gated disabled state (#256).
- Backup / Archives: full current backup family and portable sidecar boundary (#257).
- Inference: existing config/providers/audit surface remains covered.

The detailed route-family to UX-surface mapping is maintained in `.aiwg/design/fortemi-v2026-07-ux-integration-addendum.md`.

The route-family proof checklist is maintained in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.

### 4.4 Agent Tool Layer

Agent tools must be capability-aware:

- Existing tools cover notes, search, collections, concepts, archives, attachments, and jobs.
- New tools require explicit decision and tests before exposure: ingest, inference provider status/test, backup/archive diagnostics, incoming/inbound diagnostics, vision/audio, and call diagnostics (#258).
- Tool descriptions must not imply operations that are absent from the connected Fortemi server.

### 4.5 Compatibility / Coverage Layer

The route coverage inventory becomes a standing architecture control:

- Regenerate inventory from Fortemi source or running `/api/v1/operator/openapi.yaml`.
- Reject unclassified route families in CI once the verifier is formalized.
- Require every P0/P1 route family to be covered, partial with issue, or documented exclusion with rationale.
- Keep `docs/openapi.json` from acting as sole source of truth until it is canonical OpenAPI object shape.

Route inventory and interoperability are separate controls. HotM uses these conformance axes:

| Axis | Producer authority | HotM obligation | Passing evidence |
| --- | --- | --- | --- |
| Route inventory | Fortemi router/OpenAPI paths | Classify every route as consumed, deferred, or excluded. | Generated inventory with no unclassified route. |
| HTTP schema/semantics | Fortemi canonical OpenAPI | Pin the producer revision, detect breaking schema changes, and verify typed client serialization/deserialization. | OpenAPI diff plus consumer contract tests. |
| Realtime semantics | Fortemi canonical AsyncAPI | Consume the declared top-level event envelope and payload catalog without reinterpreting unknown events. | AsyncAPI diff plus SSE/WS fixture tests. |
| Portable data | Fortemi canonical Knowledge Shard schema and profile registry | Submit only declared profiles, validate version negotiation, and report unsupported or lossy imports. | Cross-repository golden round trips. |
| Runtime compatibility | `GET /api/v1/system/compatibility` | Enforce contract revision, server API revision, and minimum supported client before enabling production actions. | Compatibility matrix tests. |
| Authentication | `fortemi-auth` claim contract | Keep Rust and Node verifiers aligned to the same versioned fixtures; fail closed on unknown contract versions. | Cross-language fixture suite and downstream receipts. |

### 4.6 Canonical Contract Consumption

- **OpenAPI:** Fortemi owns the canonical generated document. HotM pins its checksum or source revision and treats route presence as only the first gate. Breaking request, response, status, security, or nullability changes block release until the client and fixtures are updated.
- **AsyncAPI/SSE:** Fortemi owns the event envelope and catalog. HotM consumes the top-level `event_type`, event identifier, timestamp, memory/tenant scope, structured actor, entity references, correlation/causation IDs, and payload version as declared. Unknown events remain explicitly unknown with bounded diagnostics; they are not coerced into a known event such as `QueueStatus`.
- **Knowledge Shard:** Fortemi owns shard schema versions, `min_reader_version`, profile identifiers, component rules, counts, checksums, and attachment sidecar rules. HotM must not label a backup portable or lossless until a server-export -> HotM -> server-import golden round trip preserves declared identities, relationships, null/tombstone semantics, timestamps, and attachment bytes.
- **Compatibility:** a successful HTTP response is insufficient. HotM must compare compatibility contract revision, server API revision, declared minimum client, capability state, and auth requirements before enabling mutations.
- **Auth:** `fortemi-auth` is currently the specification authority, not a proven runtime dependency. HotM's Node verifier remains independently implemented and cannot claim parity until both implementations pass the same versioned fixtures.

#### Realtime Consumer Implementation (HotM #268)

HotM's shared realtime boundary is implemented in `ui/src/api/events.ts` and
`ui/src/services/realtimeEventBus.ts`. It consumes the actual Fortemi
`EventEnvelope` top-level fields, including structured actor, entity references,
correlation/causation IDs, and payload version. Exact namespaced catalog entries
map into bounded UI buckets; exact legacy `ServerEvent::event_type` values remain
supported for WebSocket compatibility. No substring or fuzzy event matching is
permitted, and unrecognized input remains `Unknown`.

The catalog fixture and source verifier pin this behavior to delivered sidecar commit
`5ea08229c9f1565122df5f8e6906e89d98dc7e75`. The verifier extracts all 48 names
from `ServerEvent::namespaced_event_type` after validating the source checksum,
then compares the exact set with the consumer fixture. The fixture also pins the
AsyncAPI generator source and the reproducible canonical YAML digest
`f6a6fbc39af52b713b6f5c40dbb6e46baeb8a1b352a19288e79073863766bdf4`.
Those source and generated-document digests are byte-identical to the earlier
`98c9b29deee43b9c5bd96278f1f96837595882cd` receipt. The cross-repository
verifier runs for pull requests and delivered `main` revisions.

#### Knowledge Shard Consumer Implementation (HotM #269)

`ui/src/api/knowledgeShard.ts` is the local fail-closed boundary for the
Fortemi-owned `core-v1` profile. It performs gzip/TAR manifest inspection with
a 1 MiB manifest bound and validates exact format, profile, strict
schema/minimum-reader versions, supported component inventory, counts, and
checksum declarations before `ui/src/api/backup.ts` submits an upload. The
accepted schema window is the exact registered migration chain `1.0.0`,
`1.1.0`, and `1.2.0`; other same-major versions and next-major inputs remain
unsupported. Export requests use only the delivered `include` parameter; the
former consumer-only `format` and `include_deleted` parameters are not sent.

Backup Manager displays the declared profile/schema and renders producer or
local validation failures without claiming full recovery. The machine receipt
pins contract revision 19 and all three core manifest fixtures at Fortemi
commit `48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`; the current 1.2 manifest
SHA-256 is
`246b89d6ca1d2e2c4a19b650e4cebe7825b69d39306280e281f4a94c80c2b008`.
The visible clean-server and repeated-import semantic receipt remains scoped to
`core-v1`; it does not establish attachment-byte or richer-profile recovery.

#### Exact full-v1 Recovery Extension (HotM #272)

The `core-v1` migration window remains intact. A distinct recovery path now
accepts only the revision-21 advertised opt-in `2.0.0/full-v1`, pinned at
Fortemi commit `48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425` with the advertisement,
runtime, and paired receipts. Its local streaming TAR inspector bounds
compressed size (50 MiB), uncompressed size (200 MiB), entries (64), entry
size (50 MiB), manifest size (1 MiB), and entry-name length (255 bytes), and
requires the complete 33-component, 34-count-field, and 33-checksum inventory.

Full export is a pass-through byte stream from Fortemi to an operator-selected
file-system writable. Full import is a two-stage server transaction: signed
zero-mutation dry-run first, then the same archive is submitted for mutation
only after preflight succeeds. Fortemi remains responsible for signature
trust, component/blob digest and length, sidecar reference, presence-semantic,
and clean-destination transactional validation.

The authoritative evidence is
`ui/src/api/contracts/fortemi-knowledge-shard-receipt.json`; it explicitly
sets `fullV1Interoperability=true` only for the named exact cell and keeps
`suiteWide` and `completeBackup` false. Immutable sidecar
`sidecar-336df3ed834b` emitted `signature.json`; the released HotM streaming
consumer passed it unchanged to a public-key-only clean Fortemi destination.
Required-signature dry-run, two imports, exact 33-component/34-count-field and
attachment-byte re-export, plus eight zero-mutation rejection classes passed.
The earlier unsigned preflight remains a historical receipt, not the current
disposition.

The revision-21 verifier rejects unknown revisions, missing or altered opt-in
advertisement, unsupported profile tuples, and evidence checksum drift.
`record-v1` remains unsupported; the scoped claims remain
`suiteWide=false` and `completeBackup=false`.

#### Compatibility Runtime Admission (HotM #244/#286)

The UI and agent-proxy pin Fortemi commit
`48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`, the producer
`platform-matrix.json` profile, and the response implementation source in
`fortemi-system-compatibility-receipt.json`. The verifier checks both consumer
receipts byte-for-byte and validates the pinned producer Git objects. This is
profile/source evidence, not a standalone response-schema claim.

The compatibility client enforces schema `1`, revision `2026-07-06`, Fortemi
API range `>=2026.7.0 <2027.0.0`, SemVer 2 precedence, and the producer's
minimum HotM client before capability normalization. Startup begins a cached
preflight without blocking rendering. Every JSON, multipart, streaming,
root-OAuth, legacy-client, and agent-tool mutation awaits the same admission
decision before dispatch. Typed malformed, unknown, too-old, too-new,
minimum-client, unavailable, and auth-contract failures block with zero remote
mutation while reads and local UI remain available.

Authenticated mode also requires the exact contract `1.1.0`, profile
`rust-node-jwt-v1`, and signed release `v2026.8.1`. Fortemi's pinned response
source emits the superseded `1.0.0`/`v2026.7.0` tuple, so authenticated remote
mutations fail closed until producer metadata advances. This does not establish
`fortemi-auth` runtime parity; REQ-017 and #231 remain independent.

## 5. Data and State Impact

| State | Impact |
| --- | --- |
| Chat stream messages | UI needs incremental draft state, terminal state, cancellation state, and fallback state. |
| Ingest tokens | Copy-once or short-lived handling; never persist or render token after creation unless explicitly acknowledged. |
| Ingest cursor | Resume hint only; server remains authoritative. |
| Incoming webhook secrets | Show once at creation or never show raw secret after registration. |
| Inbound source credentials | Redacted in all UI and logs. |
| Knowledge Shard and sidecar metadata | Display declared profile/version and any loss report; do not claim portability, losslessness, or byte restoration until cross-repository golden tests pass. |

## 6. Security Architecture Delta

- Treat incoming receiver HMAC secrets, ingest bearer tokens, API keys, connector credentials, OAuth tokens, tenant identifiers, KMS identifiers, and private file/object paths as sensitive.
- Unknown compatibility state disables production actions.
- Compatibility admission is cached per configured server; changing server configuration recreates the client and decision.
- Preview capability state permits fixture/demo rendering only, not production mutation.
- Agent tools must not bypass UI capability gates for production-affecting operations.
- Stream error payloads must be sanitized before rendering or logging.

## 7. Deployment / Compatibility Impact

HotM must support at least these server profiles:

| Profile | Expected behavior |
| --- | --- |
| Older local sidecar | Core workflows remain available; new route families disabled/unavailable. |
| Fortemi v2026.7.1 local/bundle | Current route inventory applies; all covered/partial/gap states visible. |
| Hosted/single-tenant | Compatibility guard and auth role/scope gates decide enabled controls. |
| Inbound sources disabled | Connector controls render disabled/cost-gated state. |
| Intel/vLLM deployment | Inference config/status should represent provider state; HotM does not manage host vLLM deployment directly. |

## 8. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Route inventory drifts from Fortemi implementation | Regenerate inventory from source or `/api/v1/operator/openapi.yaml`; fail on unclassified families. |
| Streaming endpoints hang UI state | Shared stream reader with terminal-event and abort tests. |
| Advanced features break local-first workflows | Capability-gated disabled states; sync chat/core notes fallback. |
| Secret leakage in Admin or agent tool output | Redaction tests and copy-once token/secret handling. |
| Overstated portable shard support | Backup UX must state current reference-only import/export boundary. |
| Route coverage mistaken for compatibility | Report route, OpenAPI, AsyncAPI, shard, compatibility, and auth gates independently. |
| Event envelope drift | Pin AsyncAPI revision and exercise server-owned envelope fixtures over both SSE and WS paths. |
| Auth contract drift | Pin claim-contract version and run the same fixture manifest in Rust and Node before release. |

## 9. Open Architecture Decisions

| Decision | Issue |
| --- | --- |
| Implement or explicitly exclude ADR-011 proposed vision/audio/call dispositions | #259 |
| Preserve route-level mixed-disposition support for covered call detail while Twilio realtime remains excluded | #253 |
| Which new Fortemi operations become agent tools | #258 |
| Whether route inventory is source-derived, live `/api/v1/operator/openapi.yaml` derived, or both in CI | #253 |

## 10. Acceptance

### Supported-Platform Consumer Conformance

Fortemi owns and enforces the OpenAPI, AsyncAPI, authentication,
compatibility, live persistence, and Knowledge Shard contracts. React/core and
HotM consume those pinned contracts; HotM does not define an alternate schema
or server policy.

The authority-owned platform matrix requires the same authenticated,
receipt-producing consumer journey on Linux x86_64, Linux arm64, and native
macOS arm64 on `mutsu`. Linux arm64 executes in mutsu's native Colima VM and
uses the immutable `aarch64-unknown-linux-gnu` Fortemi sidecar. Windows is the
only deferred operating system because no Windows execution authority is
available; [Fortemi #1096](https://git.integrolabs.net/Fortemi/fortemi/issues/1096)
owns that future native Windows validation without weakening the required
Unix cells.

HotM `2026.7.1` consumes Fortemi runtime
`5ea08229c9f1565122df5f8e6906e89d98dc7e75` (`v2026.7.19`),
React/core `5cab4ea2d3d4bb985ea0d38f8bcb1ea790b32cf7`
(`@fortemi/core@2026.7.15`), and immutable sidecar
`sidecar-5ea08229c9f1`. The Fortemi authority-owned matrix binds those inputs
to the exact HotM release commit and is the source of the three platform
receipts and required aggregate. The consumer does not redefine that
authority.

These receipts prove the declared contract surface and exact
`2.0.0/full-v1` path only at their bound revisions. They do not prove a
launched GUI or native dialogs, complete backup, universal portability, or one
schema spanning the AIWG static index, Knowledge Shard transfer, and live
Fortemi persistence planes.

This addendum is accepted when:

- Route inventory remains regenerable with zero unclassified route families.
- P0/P1 gaps are tracked by issues with acceptance criteria.
- The v2026.7.1 API test addendum defines verification for covered, partial, gap, decision-needed, and documented-exclusion statuses, with the current baseline at zero gap and zero decision-needed rows.
- Implementation PRs update this addendum or supersede it when route families move between statuses.
- Implementation follows the roadmap dependency order so shared stream transport, capability guards, and redaction patterns are established before dependent UX and agent tools claim coverage.
- Route-family proof expectations stay aligned with `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.
- OpenAPI, AsyncAPI/SSE, Knowledge Shard, compatibility negotiation, and auth fixture gates are reported independently and pass for the release pairing.
- The compatibility profile/source verifier and UI/agent-proxy mutation denial tests pass before runtime compatibility is marked green.
- Documentation and UI never equate `covered` route status with schema compatibility, semantic compatibility, or lossless data portability.

### OpenAPI Consumer Boundary

`ui/src/api/contracts/fortemi-openapi.yaml` is an exact consumer copy of
Fortemi commit `5ea08229c9f1565122df5f8e6906e89d98dc7e75`,
`contracts/openapi/openapi.yaml`, SHA-256
`9d2d5ea05f21a71d416d713a5cadd2c4f76086a3494105280d50ec328c4056fd`.
`.aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs` compares the copy to
the producer Git object, validates OpenAPI metadata and security, fingerprints
all delivered operations and component schemas, runs focused breaking
mutations, and writes an exact producer/consumer CI receipt.

The executable UI boundary validates the typed call response and
`ProblemDetails` error schema. It corrected `ui/src/api/calls.ts` from unrelated
media transcript fields to the producer-owned `TranscriptSegment` shape. The
gate fails closed on unaccepted contract versions or semantic drift and
coordinates with the compatibility gate rather than replacing it.

The current artifact has 257 schema-bearing responses across 563 entries and a
schema-bearing shared RFC 9457 rate-limit response on all 251 operations. The
verifier rejects any operation that loses this shared boundary. Focused typed
success coverage remains limited to producer-declared schemas and does not
infer payload types from response descriptions.

### Operation, Event, and Browser Evidence Update (2026-08-15)

`.aiwg/testing/scripts/fortemi-route-coverage.py --check` now generates an
OpenAPI operation matrix in addition to the route-disposition inventory. The
matrix keys evidence by HTTP method, path, and operation ID and evaluates route,
request, response, auth/context, UI, agent, and live-receipt dimensions
independently. At the pinned 251-operation baseline it reports 1 integrated,
249 partial, and 1 gap operation. Those counts are the architecture baseline;
the 188 covered route dispositions remain discovery evidence only.

The realtime boundary now validates all 48 pinned event schemas using
schema-derived positive fixtures and missing-required, enum, nullability, and
identifier-format mutations through both SSE and WebSocket decoders. Malformed
known events and unknown future events normalize to `Unknown` while preserving
bounded raw data. The pinned producer checkout contains no producer-owned
example corpus, so #288 remains open and this evidence is not described as a
producer-example or full payload-conformance receipt.

The deterministic mocked browser gate runs desktop (1280 px) and mobile
(390 px) projects with retries disabled. It publishes the exact HotM revision,
fixture/test digest, report, and failure media and is required by both publish
jobs. This gate verifies mocked UI integration only; live Fortemi and launched
Tauri receipts remain separate controls.

### Auth, Realtime, and Umbrella Boundary Update (2026-08-15)

The agent proxy now admits chat, privilege-sync, and confirmation requests
through compatibility-aware authentication before body parsing. Hosted mode
requires the pinned `2026.8.1` auth identity, an accepted claim-contract
version, RS256 issuer/audience/JWKS verification, tenant consistency, and an
identity-bound privilege session. Unknown auth metadata fails closed while the
producer-advertised `anonymous_local` profile preserves local workflows.
The signed `fortemi-auth` release and exact Rust/Node corpus receipts satisfy
the named contract profile only. Hosted promotion remains blocked on producer
runtime admission metadata and live tenant-isolation evidence.

#### Auth packaging and admission update (2026-08-24)

The public CE agent proxy owns the independently implemented Node verifier,
shared error/status mapping, reusable remote JWKS resolver, `TenantStore`
interface, and fail-closed unavailable default. Its executable composition root
now supplies an internal PostgreSQL tenant-registry adapter when a dedicated
least-privilege connection is configured. The adapter consumes Fortemi commit
`65a77ccd380e19f4fb23ff14286d7f9880fb8308`'s system-scoped ID/status lookup,
uses a parameterized UUID query, validates every returned field, and maps all
dependency or shape faults to authoritative `tenant_store_unavailable`/503.

Hosted mode performs active-tenant admission after cryptographic verification
for every request; missing, suspended, and soft-deleted tenants all produce
`unknown_tenant`, so response status and body do not enumerate registry state.
The consumer admits only contract `1.1.0`, profile `rust-node-jwt-v1`, signed
release `v2026.8.1`. The pinned signed producer source advertises that accepted
tuple. Promotion still requires a live Fortemi receipt proving
JWT to `AuthContext` to transaction-scoped tenant setting to forced RLS,
including cross-tenant denial.

Fetch SSE is the scoped realtime transport. Authorization,
`X-Fortemi-Memory`, tenant filtering, and `Last-Event-ID` are header/context
state rather than persisted credential query parameters. No event-type filter
means all events, and unknown events remain unknown. The legacy WebSocket is
allowed only for an explicitly advertised unscoped `anonymous_local` profile;
scoped WebSocket use remains excluded pending Fortemi #953.

The generated disposition ledger classifies all 251 pinned operations: 130 UI
workflows, 10 curated agent workflows, 5 external browser/native handoffs, 75
read-only operator diagnostics, and 31 documented protocol exclusions.
Privilege classes are 65 admin, 21 delete,
96 read, and 69 write. This is product-disposition evidence only and does not
alter request, response, auth, or live conformance. The #294 authority review
compared the pinned OpenAPI producer revision and current Fortemi
`48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`: both expose only authenticated
GET link/backlink reads. Direct user-authored link mutation is therefore a
removed product contract, not a deferred HotM client operation. HotM keeps
semantic and wiki-link creation server-owned and exposes no create/delete link
method, agent tool, prompt claim, or static API specification.

### Core And Operator Workflow Amendment (2026-08-16)

Issues #295 and #296 add two compatibility-admitted Admin surfaces backed by
exact pinned operations. The core lifecycle surface promotes 60 entries across
notes, provenance, collections, templates, document types, jobs, SKOS, and
graph workflows. The operator console promotes 76 entries across compatibility,
inference, health, storage, jobs, webhooks/inbound sources, backup/archive,
embeddings, and graph maintenance. After 18 overlaps, this is 118 unique
method/path/operation-ID tuples.

Both surfaces use bounded typed decoders, redacted receipts, independent
partial/unauthorized/unavailable/incompatible states, and confirmation for
every mutation exposed by the operator console or destructive core workflow.
Compatibility admission fails closed for remote mutation while local-only
workflows remain available. Mocked desktop/mobile receipts establish UI
behavior only. Operation-specific authorization, agent workflows, and live
Fortemi outcomes remain independent gaps, so these rows remain `partial` in the
operation conformance ledger.

Secret-bearing webhook/inbound creation, credential/key administration,
binary backup/archive transfer, and Knowledge Shard transfer are not promoted
by these amendments. They remain within #297's explicit authorization and
profile-specific verification boundary.

### Sensitive Operation Boundary Amendment (2026-08-16)

Issue #297 classifies exactly 41 credential, PKE, attachment/media, backup, and
TUS operations in
`.aiwg/security/fortemi-sensitive-operation-decisions-2026-08.md`. Five TUS
operations are typed UI workflows, five media reads are authenticated
browser/Tauri protocol handoffs, and 31 operations remain disabled documented
exclusions. The generated ledger records decision owner, enabled state,
rationale, blockers, and evidence for each row and CI rejects count drift or an
enabled exclusion.

Remote browser uploads use TUS for all file sizes. Browser/Tauri primitives
carry bytes directly; the legacy multipart attachment method, JSON/base64
database upload, and base64 Knowledge Shard import are disabled. Transfer
errors are reduced to bounded status classes before reaching UI, telemetry, or
generic error surfaces. Producer bodies, bearer artifacts, upload URLs, tenant
identifiers, local paths, and binary content are not rendered or forwarded to
the generic agent boundary.

This amendment does not promote API-key, OAuth, PKE, or underspecified backup
operations. Their pinned success responses or binary media declarations are
incomplete. The required public Rust workspace, CI, signed release, and shared
Rust/Node fixture receipts now exist, but they do not prove the producer OAuth
payloads, runtime admission metadata, or hosted persistence isolation. Local-only
workflows remain available when compatibility or auth admission fails closed.

### Agent Contract Reconciliation Amendment (2026-08-16)

Issue #298 adds a generated agent-evidence projection over 12 exact pinned
operations and enforces operation-ID/method/path identity for the 11 curated
primary agent operations. Agent metadata tests additionally require every
declared endpoint, including secondary note-tag and attachment reads, to exist
in the pinned operation ledger. The `get_related` implementation now uses the
canonical `GET /api/v1/notes/{id}/related` route and accepts its wrapped
`related` result without exposing the producer's context summary.

`POST /api/v1/jobs#create_job` is admitted only through the typed client and
the constrained, privilege-gated `revise_note` workflow. It is `partial`:
request and local agent evidence are conformant, response and auth/context are
partial, and UI/live remain gaps. No generic arbitrary-job agent input is
introduced. The aggregate matrix is 1 integrated, 219 partial, 0 gaps, and 31
documented exclusions, with 12 conformant agent dimensions. All 251 live
dimensions remain gaps because the authenticated asset workflow receipt is not
an immutable exact-operation receipt.
