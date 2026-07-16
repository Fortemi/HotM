---
title: Fortemi v2026.7.1 HotM UX Workflow Scenarios
status: proposed
date: 2026-07-14
artifact_type: workflow-scenarios
related_artifacts:
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
---

# Fortemi v2026.7.1 HotM UX Workflow Scenarios

## Purpose

Define workflow-level acceptance scenarios for the HotM UX updates required by the current Fortemi server surface. This artifact translates route-family gaps into actor-visible behavior, degraded states, and test hooks so implementation issues do not close with API clients alone.

## Actors

| Actor | Role in these scenarios |
| --- | --- |
| Knowledge user | Uses notes, search, attachments, and the agent in day-to-day workflows. |
| Operator/Admin | Configures server-facing workflows: health, ingest, receivers, sources, backup, and diagnostics. |
| Agent runtime | Uses Fortemi-backed tools only when capability, role, and server support allow it. |
| Fortemi server | Provides the v2026.7.1 route families and capability/degraded-state responses. |

## Global Preconditions

- HotM is connected to a Fortemi server compatible with the audited baseline or a clearly detected newer/older version.
- Capability metadata is loaded or the UI is in an explicit unknown/unavailable state.
- Production-affecting controls are disabled unless capability, role/scope, and issue-specific readiness checks pass.
- Secret-bearing values are redacted or copy-once according to the risk register and test plan.

## Scenario UX-FORTEMI-001: Native Streaming Chat

Trace: FORTEMI-2026-07-REQ-002, #242, #254, #258.

**Primary actor:** Knowledge user.

**Preconditions:**
- Fortemi reports `POST /api/v1/chat/stream` support.
- The selected provider/model is available.

**Main flow:**
1. User sends a prompt in the Agent surface.
2. HotM starts a POST stream against Fortemi.
3. Partial assistant text appears as `delta` events arrive.
4. A Stop control cancels the stream without losing the session.
5. A terminal `done` event marks the response complete.
6. Tool availability remains constrained by the capability-gated registry.

**Alternate/degraded flows:**
- Streaming unsupported: fall back to synchronous `/chat` and show a non-blocking unavailable reason.
- GPU busy or `503`: preserve the prompt and show retry.
- Stream `error`: keep partial text visibly incomplete and show terminal error state.
- User cancel: mark the message cancelled and keep partial content distinct from completed content.

**Test hooks:**
- Delta/done/error fixtures.
- Abort/cancel behavior.
- 503 fallback.
- Unsupported capability fallback.
- No unsupported tool claims in prompt/tool copy.

## Scenario UX-FORTEMI-002: Streaming Health and Backpressure Review

Trace: FORTEMI-2026-07-REQ-003, #254.

**Primary actor:** Operator/Admin.

**Preconditions:**
- Admin/API Surface or Realtime Debug can query `GET /api/v1/health/streaming`.

**Main flow:**
1. Admin opens API Surface or Realtime Debug.
2. HotM loads streaming health.
3. Chat stream, ingest stream, realtime event, and connector blocks render if present.
4. Counters and degraded states are summarized without exposing private endpoints or credentials.
5. Missing blocks render as `unknown`, not healthy.

**Alternate/degraded flows:**
- Malformed response: render degraded parser state and keep the rest of Admin usable.
- Backpressure or recent `429`: mark ingest stream degraded and show retry-after guidance when present.
- Connector lag/errors: summarize lag and errors without connector secrets.

**Test hooks:**
- Populated, missing, degraded, and malformed payload fixtures.
- Redaction assertions for connector/private endpoint fields.
- Unknown-state assertions for omitted blocks.

## Scenario UX-FORTEMI-003: Stream Ingest With Short-Lived Token

Trace: FORTEMI-2026-07-REQ-004, #255, #257, #258.

**Primary actor:** Operator/Admin.

**Preconditions:**
- Operator has permission to mint ingest tokens.
- Backup > Stream Ingest is enabled by capability metadata.

**Main flow:**
1. Operator opens Backup > Stream Ingest.
2. Operator mints a short-lived ingest token.
3. HotM displays the token copy-once and does not persist it in transcript, logs, or snapshots.
4. Operator starts an NDJSON ingest stream.
5. HotM renders `ack`, `progress`, `error`, and `done` rows.
6. Completion links to jobs or import result summaries where available.

**Alternate/degraded flows:**
- `401`: token missing or expired; route to mint-token flow.
- `410`: cursor expired; explain restart requirement.
- `429`: show backpressure/rate-limit state and retry-after if present.
- Malformed line: mark line failed without implying the whole stream failed.
- Agent request for ingest: deny or route to Backup until #258 accepts an agent tool.

**Test hooks:**
- Token mint/revoke.
- Copy-once/redaction.
- NDJSON frame parser.
- 401/410/429 states.
- Cursor redaction.

## Scenario UX-FORTEMI-004: Incoming Receiver and Inbound Source Administration

Trace: FORTEMI-2026-07-REQ-005, FORTEMI-2026-07-REQ-006, #256, #258.

**Primary actor:** Operator/Admin.

**Preconditions:**
- Admin has receiver/source management permission.
- Runtime capability states for inbound external sources are loaded.

**Main flow:**
1. Admin opens Admin > Webhooks.
2. HotM separates Outbound Hooks, Incoming Receivers, and Inbound Sources.
3. Admin creates or edits an incoming receiver with provider/schema fields.
4. HotM validates a sample payload and shows JSON-pointer errors.
5. Admin views inbound sources with enabled, disabled, cost-gated, lag, and error states.

**Alternate/degraded flows:**
- Inbound external sources disabled: create controls are disabled with reason text.
- Receiver secret exists: show only copy-once newly-created secret or redacted stored secret.
- Delete connector: require confirmation and clarify that upstream resources are not deleted by HotM.
- Agent request for create/delete: deny or route to Admin until #258 accepts a mutating tool.

**Test hooks:**
- Receiver list/create/get/patch/delete.
- Payload validation errors.
- Outbound vs incoming label assertions.
- Disabled/cost-gated source fixtures.
- Secret redaction snapshots.

## Scenario UX-FORTEMI-005: Backup, TUS, and Portable Shard Parity

Trace: FORTEMI-2026-07-REQ-007, FORTEMI-2026-07-REQ-010, #257.

**Primary actor:** Operator/Admin.

**Preconditions:**
- Backup and attachment capabilities are loaded.
- User has appropriate permission for export/import operations.

**Main flow:**
1. Admin opens Backup.
2. HotM groups actions by Knowledge shard, Database backup, Memory backup, Knowledge archive, and Metadata.
3. Admin starts an upload/download/import/export action.
4. HotM shows provenance, checksum, progress, and job state where the server exposes them.
5. Attachment upload uses TUS progress and resume behavior.

**Alternate/degraded flows:**
- Offset mismatch: show resume guidance and do not discard selected file.
- No checksum-extension support: do not claim TUS checksum validation unless the server advertises the extension; non-TUS checksum failures still mark the operation failed and require retry.
- Termination/cancel: show cancelled state and preserve route back to retry.
- Portable shard import: state that attachment records/bytes are not restored unless server behavior changes.
- Unsupported backup route: disabled with explicit documented-exclusion or partial-coverage reason.

**Test hooks:**
- TUS POST/OPTIONS/GET/HEAD/PATCH/DELETE.
- Offset/no-checksum-extension boundary/termination/resume.
- Backup database/memory/knowledge archive routes.
- Portable sidecar limitation copy assertion.

## Scenario UX-FORTEMI-006: Capability-Gated Agent Tool Use

Trace: FORTEMI-2026-07-REQ-012, #258, FTI-008.

**Primary actor:** Knowledge user and Agent runtime.

**Preconditions:**
- Agent settings has loaded the capability-gated tool registry.
- Current user context determines read-only vs mutating tool availability.

**Main flow:**
1. User opens Agent settings or sends a task that may require tools.
2. HotM shows enabled and disabled tool rows with reasons.
3. Agent exposes only tools allowed for the detected intent, server capabilities, and role/scope.
4. Tool descriptions match the enabled subset.
5. Tool results redact sensitive values.

**Alternate/degraded flows:**
- Unsupported server: tool absent or disabled with server-version reason.
- Insufficient role: mutating tool disabled with role/scope reason.
- Preview-only capability: tool disabled unless preview use is explicitly accepted.
- User asks for unsupported operation: assistant explains unavailable operation and offers supported path.

**Test hooks:**
- Exploratory mode read-only tool set.
- Knowledge-action mutating tool set.
- Disabled reason fixtures.
- Prompt/tool description assertions.
- Redaction snapshots.

## Scenario UX-FORTEMI-007: Vision, Audio, and Realtime Call Disposition

Trace: FORTEMI-2026-07-REQ-008, FORTEMI-2026-07-REQ-009, ADR-011, #259.

**Primary actor:** Knowledge user for attachment actions; Operator/Admin for call diagnostics.

**Preconditions:**
- #259 accepts implementation or documented exclusion for each route.
- The route inventory represents `/calls/{id}` as covered by redacted Admin API Surface diagnostics while `/realtime/twilio/{provider_call_id}` remains a documented exclusion.

**Main flow if included:**
1. User opens an attachment preview.
2. HotM offers Describe Image or Transcribe Audio only for supported media and capability state.
3. Result is linked to the attachment or note without exposing sensitive media metadata.
4. Operator opens Admin API Surface call diagnostics for `GET /api/v1/calls/{id}` when a known Fortemi call ID needs inspection.

**Alternate/degraded flows:**
- Unsupported media: action disabled with reason.
- Capability unavailable: action absent or disabled with server reason.
- Twilio realtime route remains excluded: no UI or agent claim is made.
- If Twilio realtime stays excluded, assert that no UI or agent text claims live provider-stream support.

**Test hooks:**
- Supported/unsupported media.
- Capability disabled reason.
- Error/progress rendering.
- Diagnostic redaction.
- No prompt/tool claim for excluded Twilio route.

## Scenario Trace Matrix

| Scenario | Primary issues | Route families | Verification artifact |
| --- | --- | --- | --- |
| UX-FORTEMI-001 | #242, #258 | native_chat_stream, chat_sync, models | API/chat stream tests, agent tool tests |
| UX-FORTEMI-002 | #254 | streaming_health, realtime_events | Admin/realtime health component tests |
| UX-FORTEMI-003 | #255, #257, #258 | streaming_ingest, backup_archive | Stream parser, Backup panel, redaction tests |
| UX-FORTEMI-004 | #256, #258 | incoming_webhook_receivers, inbound_sources, outbound_webhooks | Admin Webhooks tests |
| UX-FORTEMI-005 | #257 | attachments_tus, attachments, backup_archive | TUS/upload and Backup tests |
| UX-FORTEMI-006 | #258 | agent tools across enabled families | Agent tool-set and prompt tests |
| UX-FORTEMI-007 | #259, #253 | vision_tools, audio_tools, realtime_calls | Attachment action, Realtime Debug, verifier tests |

## Closeout Rules

- A scenario cannot be marked implemented until the linked issue has route-level tests or an explicit documented exclusion.
- A workflow with secrets cannot close without redaction tests.
- Agent-facing behavior cannot close unless tool descriptions and prompt suffixes match the enabled capability set.
- Admin workflows cannot close while unknown, preview, unavailable, or insufficient-role states enable production-affecting actions.
- This artifact must be updated when a route family changes status in the capability surface matrix.
