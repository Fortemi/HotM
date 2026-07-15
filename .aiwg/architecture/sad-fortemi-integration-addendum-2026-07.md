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

This addendum updates the HotM Software Architecture Document for the current Fortemi server API and capability surface as of Fortemi commit `f6733252`, latest release tag `v2026.7.1`.

The original SAD remains the baseline for the local-first HotM architecture. This addendum defines the integration architecture needed for seamless Fortemi server alignment across API clients, UX surfaces, realtime streams, admin controls, agent tools, compatibility guards, and route coverage verification.

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

The route inventory extracts 200 server route declarations and classifies them:

| Status | Count | Architectural meaning |
| --- | ---: | --- |
| covered | 186 | Existing HotM architecture has a consuming module, surface, tool, or compatibility-bound implementation evidence. |
| partial | 0 | No current verifier rows remain partial; future partial rows must be issue-backed before closure. |
| gap | 0 | No uncovered route family remains in the current verifier baseline. |
| decision_needed | 0 | No current route requires a new product/UX architecture decision before implementation or exclusion. |
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

## 5. Data and State Impact

| State | Impact |
| --- | --- |
| Chat stream messages | UI needs incremental draft state, terminal state, cancellation state, and fallback state. |
| Ingest tokens | Copy-once or short-lived handling; never persist or render token after creation unless explicitly acknowledged. |
| Ingest cursor | Resume hint only; server remains authoritative. |
| Incoming webhook secrets | Show once at creation or never show raw secret after registration. |
| Inbound source credentials | Redacted in all UI and logs. |
| Backup sidecar metadata | Display portable sidecar status without claiming byte restore support before server implements it. |

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
