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
---

# SAD Addendum - Fortemi v2026.7.1 Integration Architecture

## 1. Purpose

This addendum updates the HotM Software Architecture Document for the Fortemi server API and capability surface audited at Fortemi commit `f6733252`, release tag `v2026.7.1`.

The original SAD remains the baseline for the local-first HotM architecture. This addendum defines the target integration architecture across API clients, UX surfaces, realtime streams, admin controls, agent tools, compatibility guards, and route coverage verification. It does not assert that the target is implemented merely because a matching route or client method exists.

### 1.1 Current-State Qualification

The generated 200-route inventory proves route discovery and client/surface disposition only. It does not, by itself, prove:

- OpenAPI request/response schema compatibility.
- AsyncAPI event-envelope or event-payload compatibility.
- Knowledge Shard import/export losslessness.
- compatibility-revision or minimum-client negotiation.
- cross-language JWT claim behavior.

Those properties remain target-state gates until the executable controls in the API contract test addendum pass against a pinned Fortemi producer.

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

The route inventory extracts 200 server route declarations and classifies their HotM disposition:

| Status | Count | Architectural meaning |
| --- | ---: | --- |
| covered | 186 | Existing HotM architecture has a consuming module, surface, tool, or compatibility-bound route-disposition evidence. This is not schema or semantic conformance. |
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

- Regenerate inventory from Fortemi source or running `/openapi.yaml`.
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

The catalog fixture and source verifier pin this behavior to sidecar commit
`98c9b29deee43b9c5bd96278f1f96837595882cd`. The verifier extracts all 48 names
from `ServerEvent::namespaced_event_type` after validating the source checksum,
then compares the exact set with the consumer fixture. The fixture also pins the
AsyncAPI generator source and the reproducible canonical YAML digest
`f6a6fbc39af52b713b6f5c40dbb6e46baeb8a1b352a19288e79073863766bdf4`.

#### Knowledge Shard Consumer Implementation (HotM #269)

`ui/src/api/knowledgeShard.ts` is the local fail-closed boundary for the
Fortemi-owned `core-v1` schema `1.0.0`. It performs gzip/TAR manifest inspection
with a 1 MiB manifest bound and validates exact format, profile, strict
schema/minimum-reader versions, supported component inventory, counts, and
checksum declarations before `ui/src/api/backup.ts` submits an upload. Export
requests use only the delivered `include` parameter; the former consumer-only
`format` and `include_deleted` parameters are not sent.

Backup Manager displays the declared profile/schema and renders producer or
local validation failures without claiming full recovery. The fixture is pinned
to Fortemi commit `2eb5c6b739b3bb6a042a35050a3ae89960dd3ed4` with SHA-256
`4ed7e3b7d4845122653c95bcf2508a7f440cf067fe64ca493f0785519b9300f1`.
This implementation does not satisfy the cross-repository clean-server
roundtrip or attachment-byte gates.

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
| Route inventory drifts from Fortemi implementation | Regenerate inventory from source or `/openapi.yaml`; fail on unclassified families. |
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
| Whether route inventory is source-derived, live `/openapi.yaml` derived, or both in CI | #253 |

## 10. Acceptance

This addendum is accepted when:

- Route inventory remains regenerable with zero unclassified route families.
- P0/P1 gaps are tracked by issues with acceptance criteria.
- The v2026.7.1 API test addendum defines verification for covered, partial, gap, decision-needed, and documented-exclusion statuses, with the current baseline at zero gap and zero decision-needed rows.
- Implementation PRs update this addendum or supersede it when route families move between statuses.
- Implementation follows the roadmap dependency order so shared stream transport, capability guards, and redaction patterns are established before dependent UX and agent tools claim coverage.
- Route-family proof expectations stay aligned with `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.
- OpenAPI, AsyncAPI/SSE, Knowledge Shard, compatibility negotiation, and auth fixture gates are reported independently and pass for the release pairing.
- Documentation and UI never equate `covered` route status with schema compatibility, semantic compatibility, or lossless data portability.

### OpenAPI Consumer Boundary

`ui/src/api/contracts/fortemi-openapi.yaml` is an exact consumer copy of
Fortemi commit `cb1899368d763920091dd2fd5c22066d27e9fad0`,
`contracts/openapi/openapi.yaml`, SHA-256
`654db79e541a1a9117acf599476eb8ef4559b7e8d8f3ac7c471034ee383e705a`.
`.aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs` compares the copy to
the producer Git object, validates OpenAPI metadata and security, fingerprints
all delivered operations and component schemas, runs focused breaking
mutations, and writes an exact producer/consumer CI receipt.

The executable UI boundary validates the typed call response and
`ProblemDetails` error schema. It corrected `ui/src/api/calls.ts` from unrelated
media transcript fields to the producer-owned `TranscriptSegment` shape. The
gate fails closed on unaccepted contract versions or semantic drift and
coordinates with the compatibility gate rather than replacing it.

The current artifact contains response schemas for only 6 of 310 response
entries. This component therefore supplies a pinned semantic drift boundary and
focused typed coverage, not full response compatibility for every operation.
