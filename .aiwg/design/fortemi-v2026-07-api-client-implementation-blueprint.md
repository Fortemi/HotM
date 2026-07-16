---
title: Fortemi v2026.7.1 API Client Implementation Blueprint
status: proposed
date: 2026-07-14
artifact_type: api-client-implementation-blueprint
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/testing/fortemi-v2026-07-fixture-catalog.md
  - .aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md
---

# Fortemi v2026.7.1 API Client Implementation Blueprint

## Purpose

Map the Fortemi v2026.7.1 route-family implementation slices to concrete HotM API modules, UI/component surfaces, agent-proxy boundaries, and test files. This blueprint is the historical implementation aid for #242, #254, #255, #256, #257, #258, and #259; the current verifier baseline now has zero gap and zero partial route rows.

Fixture naming and minimum payload sketches for those tests are maintained in `.aiwg/testing/fortemi-v2026-07-fixture-catalog.md`.

## Existing HotM Anchors

| Area | Existing anchor files |
| --- | --- |
| API client foundation | `ui/src/api/client.ts`, `ui/src/api/errors.ts`, `ui/src/api/index.ts`, `ui/src/api/types.ts` |
| Agent chat | `ui/src/api/chat.ts`, `ui/src/components/agent/useAgentChat.ts`, `agent-proxy/src/routes/chat.ts` |
| Admin/API surface | `ui/src/api/systemCompatibility.ts`, `ui/src/api/health.ts`, `ui/src/components/admin/ApiCapabilitiesPanel.tsx`, `ui/src/components/debug/RealtimeEventInspector.tsx` |
| Backup/import | `ui/src/api/backup.ts`, `ui/src/components/backup/BackupManager.tsx` |
| Webhooks/Admin | `ui/src/api/webhooks.ts`, `ui/src/components/admin/WebhooksPanel.tsx` |
| Attachments/media | `ui/src/api/attachments.ts`, `ui/src/components/attachments/*`, `ui/src/services/tusUploader.ts` |
| Agent tools | `agent-proxy/src/tools.ts`, `agent-proxy/src/agent/tool-sets.ts`, `ui/src/components/agent/tools.ts` |

## Implementation Slices

| Issue | Route family | API/client module | UI/component surface | Agent boundary | Primary tests |
| --- | --- | --- | --- | --- | --- |
| #242 | `native_chat_stream` | Extend `ui/src/api/chat.ts` with a reusable POST stream helper or create `ui/src/api/streams.ts` if shared by #255. | `ui/src/components/agent/useAgentChat.ts`, `AgentPanel.tsx`, message cancel/retry controls. | `agent-proxy/src/routes/chat.ts` only if proxy path owns stream fanout; otherwise keep native UI client direct and capability-gated. | `ui/src/api/__tests__/chat.test.ts`, `ui/src/components/agent/__tests__/useAgentChat.test.ts`, `agent-proxy/src/__tests__/chat-route.test.ts`. |
| #254 | `streaming_health` | Extend `ui/src/api/health.ts` with `getStreamingHealth()` and normalized unknown/degraded blocks. | `ApiCapabilitiesPanel.tsx`, `RealtimeEventInspector.tsx`, optionally `JobQueueMonitor.tsx`. | Candidate read-only diagnostic tool waits for #258. | `ui/src/api/__tests__/health.test.ts`, `ui/src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx`, realtime/debug component tests. |
| #255 | `streaming_ingest` | Add `ui/src/api/ingest.ts` for token mint/revoke and NDJSON stream ingest; reuse stream helper from #242. | `BackupManager.tsx` stream ingest panel and token modal. | Agent ingest tools disabled until #258 accepts role/capability/redaction gates. | `ui/src/api/__tests__/ingest.test.ts`, stream parser tests, `ui/src/components/backup/__tests__/BackupManager.test.tsx`. |
| #256 | `incoming_webhook_receivers`, `inbound_sources` | Extend or split `ui/src/api/webhooks.ts`; prefer `ui/src/api/inboundSources.ts` if source payloads diverge from webhooks. | `WebhooksPanel.tsx` segmented sections: outbound hooks, incoming receivers, inbound sources. | Read-only diagnostics only after Admin surfaces exist; create/delete remains Admin-first. | `ui/src/api/__tests__/webhooks.test.ts`, `ui/src/api/__tests__/inboundSources.test.ts`, `ui/src/components/admin/__tests__/WebhooksPanel.test.tsx`. |
| #257 | `attachments_tus`, `backup_archive` | Extend `ui/src/api/backup.ts`, `ui/src/api/attachments.ts`, `ui/src/services/tusUploader.ts`. | `BackupManager.tsx`, `AttachmentsPanel.tsx`, `AttachmentsBrowser.tsx`. | Backup/archive diagnostics only after parity and copy assertions pass. | `ui/src/api/__tests__/backup.test.ts`, `ui/src/api/__tests__/attachments.test.ts`, `ui/src/services/__tests__/tusUploader.test.ts`, `BackupManager.test.tsx`. |
| #258 | agent tool refresh | No new API module by default; consume implemented clients and capability state. | Agent settings/tool picker/status views. | `agent-proxy/src/tools.ts`, `agent-proxy/src/agent/tool-sets.ts`, `ui/src/components/agent/tools.ts`. | `agent-proxy/src/__tests__/tools.test.ts`, `agent-proxy/src/agent/__tests__/tool-sets.test.ts`, `ui/src/components/agent/__tests__/tools.test.ts`. |
| #259 | `vision_tools`, `audio_tools`, `realtime_calls` | Add `ui/src/api/mediaTools.ts` for vision/audio if implemented; add `ui/src/api/calls.ts` only if call diagnostics accepted. | Attachment preview actions for vision/audio; Realtime Debug/Admin detail for call diagnostics. | Agent tools remain blocked until #258; Twilio remains no-claim if excluded. | `ui/src/api/__tests__/mediaTools.test.ts`, optional `calls.test.ts`, attachment preview component tests, exclusion/no-claim tests. |

## Shared Client Rules

- Reuse `ui/src/api/client.ts` request/error handling and existing typed API style.
- Normalize unsupported or missing capability responses as `unknown` or `unsupported`, never `healthy`.
- Keep stream parsing reusable across #242 and #255 so terminal event, abort, retry-after, 401/410/429/503, and malformed-frame behavior stays consistent.
- Put copy-once secrets behind explicit UI states; do not persist ingest tokens, webhook secrets, or API keys in snapshots/logs.
- Keep provider call identifiers, connector private endpoints, archive paths, transcripts, and cursors redacted unless a specific operator-only exception is approved.

## Suggested File Additions

| File | Owner issue | Purpose |
| --- | --- | --- |
| `ui/src/api/streams.ts` | #242/#255 | Shared POST stream and NDJSON/SSE frame parsing helpers. |
| `ui/src/api/ingest.ts` | #255 | Ingest token and stream client. |
| `ui/src/api/inboundSources.ts` | #256 | Inbound source list/create/delete client if webhooks module becomes overloaded. |
| `ui/src/api/mediaTools.ts` | #259 | Vision describe and audio transcribe clients if ADR-011 accepted. |
| `ui/src/api/calls.ts` | #259 | Call detail diagnostic client if accepted. |

## Non-Goals

- Do not add agent tools before capability and role/scope gates exist.
- Do not expose raw endpoint-browser UI.
- Do not reclassify route inventory status from this blueprint alone.
- Do not close #243 or any implementation issue without the delivery evidence ledger proof.
