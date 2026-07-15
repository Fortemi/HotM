---
title: Fortemi v2026.7.1 UX Integration Addendum
status: proposed
date: 2026-07-14
artifact_type: ux-integration-plan
related_artifacts:
  - docs/ux/fortemi-integration-ux-design.md
  - .aiwg/design/fortemi-feature-ui-integration-plan-2026-05.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
---

# Fortemi v2026.7.1 UX Integration Addendum

## Purpose

Define how HotM should expose the latest Fortemi server capabilities without turning the UI into a raw endpoint browser. This addendum maps the v2026.7.1 route inventory to existing HotM surfaces, identifies new panels/workflows, and records UX decisions needed before implementation.

The route-family completion checklist is maintained in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.

Workflow-level actor, degraded-state, and test-scenario acceptance details are maintained in `.aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md`.

Concrete API/client module boundaries for the implementation slices are maintained in `.aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md`.

## Design Principle

Every Fortemi capability must have exactly one of these UX dispositions:

| Disposition | Meaning |
| --- | --- |
| Primary workflow | A normal user-facing workflow in the main HotM shell. |
| Operator/Admin control | An operator-facing surface under Admin, Backup, Jobs, Archives, or Realtime Debug. |
| Agent tool | A capability exposed through the embedded assistant with capability gating. |
| Background status | A state surfaced as health, activity, progress, or degraded-mode feedback. |
| Documented exclusion | Not presented as supported; traceability records why and where to revisit it. |

Avoid duplicating complex server controls across multiple screens. Keep quick capture, note reading, and search focused; put server operations in Admin/Backup/Jobs/Agent surfaces.

## Existing Navigation Anchors

| Current HotM surface | Current role | New v2026.7.1 fit |
| --- | --- | --- |
| Agent | Assistant chat and tool workflows | Native Fortemi chat stream, future agent tools, tool capability state. |
| Admin > API Surface | Compatibility and server status | Route coverage summary, streaming capability state, degraded feature inventory. |
| Admin > Inference / Audit | Provider/runtime configuration | Preserve current inference config, provider, audit, and event behavior. |
| Admin > Webhooks | Outbound webhook lifecycle | Split into outbound webhooks plus incoming receivers tab/section. |
| Backup | Import/export/reprocess workflows | Full backup/download/knowledge-archive parity and portable sidecar boundary. |
| Attachments | File/media browsing and upload | TUS parity, subtitle/thumbnail/sprite state, optional vision/audio actions if accepted. |
| Jobs | Queue monitoring and pause/resume | Ingest and processing job visibility. |
| Realtime Debug | Operational event/activity state | Streaming health, backpressure, inbound connector lag/errors, resync state. |
| Archives | Memory/archive routing | Per-archive inference and archive-scoped operations remain here. |

## UX Work Packages

### UX-WP1: Native Fortemi Streaming Chat (#242)

Surface: Agent.

User outcome: the user sees assistant output arrive token by token when the connected Fortemi server supports `POST /api/v1/chat/stream`.

States:

| State | UX behavior |
| --- | --- |
| Streaming available | Agent uses native Fortemi stream for Fortemi provider sessions. |
| Streaming unsupported | Agent falls back to synchronous `/chat` or agent-proxy path with a non-blocking status hint. |
| GPU busy / 503 | Show retryable busy state, keep prompt content, offer retry. |
| Stream error | Show terminal error in message row and preserve session. |
| User cancel | Stop reading stream, mark response cancelled, leave partial text distinguishable. |

Primary controls:

- Send.
- Stop.
- Retry.
- Switch provider/settings.

### UX-WP2: Streaming Health and Backpressure (#254)

Surfaces: Admin > API Surface, Realtime Debug, Jobs.

User outcome: operators can tell whether streams are healthy, degraded, backpressured, or losing events without opening developer tools.

Panels:

| Panel | Contents |
| --- | --- |
| Chat stream health | started/completed/errored/disconnect/token/drop counters. |
| Ingest stream health | buffer pressure, 429 count, rate-limit count, cursor/resume notes. |
| Realtime event health | SSE/WS status, events lagged, resync required, replay cursor. |
| Connector health | per-source events/errors/lag, disabled/cost-gated state. |

Rules:

- Missing server block renders `unknown`, not healthy.
- Zero dropped tokens is normal; non-zero gets an attention badge.
- High ingest pressure or recent 429s mark the panel degraded.
- Do not render connector credentials or raw private endpoints.

### UX-WP3: NDJSON Ingest and Tokens (#255)

Surfaces: Backup first; Agent tool later if accepted by #258.

User outcome: operators can import streamed records or grant a short-lived ingest token without manually crafting curl commands.

Implemented first slice:

1. Backup > Stream NDJSON Import panel.
2. Token mint/revoke API flow with the secret passed directly to the stream request and not rendered.
3. NDJSON upload/stream progress and terminal summary for ack/progress/warning/error/done frames.
4. Cursor summary renders as length-only metadata; agent ingest tool remains gated by #258.

State handling:

| Server state | UX response |
| --- | --- |
| 401 | Token missing/expired; route to mint token. |
| 410 | Cursor expired; explain restart requirement. |
| 429 | Backpressure/rate-limited; show retry-after. |
| Malformed line | Mark line failed without implying whole stream failed. |

### UX-WP4: Incoming Receivers and Inbound Sources (#256)

Surface: Admin > Webhooks, with two explicit tabs or segmented sections:

- Outbound Hooks.
- Incoming Receivers.
- Inbound Sources.

Incoming Receivers:

| Control | UX rule |
| --- | --- |
| Register receiver | Show slug/provider/schema fields; secret handled copy-once or generated server-side. |
| Validate payload | Display JSON-pointer validation errors in a compact table. |
| HMAC instructions | Show signing guidance, never raw stored secret. |
| Idempotency behavior | Explain repeat-key same-body vs conflict behavior. |

Inbound Sources:

| Control | UX rule |
| --- | --- |
| Connector list | Show connector type, enabled state, lag/error summary. |
| Create connector | Hide unavailable connector types when runtime gate disabled; otherwise show disabled card with reason. |
| Delete connector | Confirmation dialog; explain upstream stream is not deleted by HotM. |

### UX-WP5: Backup, Attachments, and Portable Shards (#257)

Surfaces: Backup and Attachments.

Backup UX:

- Group actions by scope: Knowledge shard, Database backup, Memory backup, Knowledge archive, Metadata.
- Keep restore/import actions visually distinct from download/export actions.
- State the portable byte-sidecar boundary: reference-only shards remain valid; server import does not currently restore attachment bytes.
- Show backup provenance and checksum metadata where available.

Attachments UX:

- Preserve existing TUS upload progress.
- Preserve explicit resume/failed/cancelled states for offset mismatch, expired sessions, size-limit failures, and no TUS checksum-extension support.
- Surface subtitle/thumbnail/sprite availability in media preview without forcing users into raw endpoints.

### UX-WP6: Agent Tool Refresh (#258)

Surface: Agent settings and runtime tool picker/status.

User outcome: the assistant only offers tools that are supported by the connected Fortemi server and current user/role.

Recommended UX:

- Tool availability summary in Agent settings.
- Disabled tool rows with reason: unsupported server, insufficient role, missing token, preview-only, local-disabled.
- Tool descriptions generated from the capability-gated registry, not stale prompt text.

Initial tool candidates:

| Candidate | UX disposition |
| --- | --- |
| Ingest stream | Agent-assisted only after Backup ingest primitives exist. |
| Inference provider status/test | Agent diagnostic tool; no secret exposure. |
| Backup/archive diagnostics | Agent can explain status; destructive actions require explicit confirmation. |
| Incoming/inbound diagnostics | Agent can summarize health; create/delete likely Admin-only first. |
| Vision/audio | Attachment preview actions implemented by #259; agent tools remain gated by #258. |
| Calls/Twilio | REST call diagnostics implemented by #259; Twilio realtime remains a documented exclusion. |

### UX-WP7: Vision, Audio, and Realtime Calls (#259)

Proposed disposition: `.aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md`.

Accepted dispositions:

| Server capability | Preferred UX disposition | Alternative |
| --- | --- | --- |
| `POST /api/v1/vision/describe` | Attachment preview action: "Describe image" | Agent tool for selected attachment. |
| `POST /api/v1/audio/transcribe` | Attachment preview action for audio/video | Capture workflow action. |
| `GET /api/v1/calls/{id}` | Realtime Debug / Admin diagnostics | Media/call session detail if call UX becomes productized. |
| `GET /api/v1/realtime/twilio/{provider_call_id}` | Documented exclusion until real call UX exists | Admin diagnostic if operators need live media stream validation. |

Decision criteria:

- Implement in primary UX only if it improves an existing workflow.
- Use Agent tool when the task is conversational or exploratory.
- Keep Admin/Realtime Debug for diagnostics.
- Exclude if it would expose provider-specific operational details without a clear user job.

## Route-Family UX Matrix

| Route family | Inventory status | UX disposition | Tracker |
| --- | --- | --- | --- |
| Native chat stream | covered | Primary Agent workflow for Fortemi provider | #242 |
| Streaming health | covered | Admin > API Surface streaming health card; Realtime Debug remains optional. | #254 |
| Ingest stream/tokens | covered | Backup operator workflow; possible Agent tool later. | #255 |
| Incoming webhooks | covered | Admin > Webhooks > Incoming Receivers | #256 |
| Inbound sources | covered | Admin > Webhooks > Inbound Sources | #256 |
| Attachments/TUS | covered | Attachments upload and media preview | #257 |
| Backup/archive | covered | Backup workflow groups | #257 |
| Agent tools | covered | Agent settings/tool registry | #258 |
| Vision/audio | covered | Attachment preview actions call typed media tools; Agent tools still gated | #259/#258 |
| Calls/Twilio | covered / documented_exclusion | Typed call-detail client is covered; Twilio realtime remains a documented exclusion | #259 |
| PKE | documented_exclusion | No current HotM UX claim | #253 |
| Rate limit status | documented_exclusion | Admin diagnostic only when manifest/rate-limit work requires it | #251 |

## Acceptance Criteria

- Any newly discovered partial or decision-needed route family has a named HotM surface or exclusion path, not just an API endpoint.
- No production-affecting control is enabled from unknown, preview, unavailable, or unsupported compatibility state.
- UX implementation follows the phase dependencies in `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md`, especially stream primitives before chat/ingest and stable API primitives before agent tool claims.
- Each route family satisfies the proof requirement in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.
- Token/secret values are copy-once or redacted after creation.
- New Admin panels use existing tab/section patterns and avoid adding top-level sidebar entries unless a workflow becomes primary.
- Agent tool availability is visible and capability-gated.
- Excluded capabilities are absent from UI claims and agent prompts.

## Implementation Notes

- Prefer adding tabs/sections inside Admin over new sidebar entries for incoming receivers, inbound sources, and streaming health.
- Prefer adding a "Stream Ingest" mode to Backup over a standalone ingest screen.
- Prefer adding vision/audio actions to attachment preview only if issue #259 accepts them as user-facing.
- Reuse existing status badge patterns from API Surface and Realtime Debug.
- Reuse existing upload/progress affordances from attachment upload and job queue views.
