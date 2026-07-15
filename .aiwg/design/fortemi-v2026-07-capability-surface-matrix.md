---
title: Fortemi v2026.7.1 Capability Surface Matrix
status: proposed
date: 2026-07-14
artifact_type: ux-capability-matrix
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/reports/fortemi-v2026-07-api-integration-traceability.md
  - .aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md
---

# Fortemi v2026.7.1 Capability Surface Matrix

## Purpose

This matrix is the implementation-facing checklist for seamless HotM integration with the current Fortemi server surface. It condenses the generated route inventory into route-family capabilities, assigns each family to a HotM surface or exclusion, and states the evidence needed before the family can be claimed as integrated.

Evidence strength for the current baseline is audited in `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md`.

Machine-readable source/test/UI evidence metadata is tracked in `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json`.

Agent-tool coverage and candidate tool dispositions are tracked in `.aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md`.

Source baseline:

- Fortemi commit: `f6733252`
- Latest release tag: `v2026.7.1`
- Route inventory: `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md`
- Route count: 200

## Completion Semantics

| Status | Closeout requirement |
| --- | --- |
| covered | Existing API/UI/tool coverage remains valid and has regression evidence. |
| partial | Route-level parity, copy, or tests must be added, or the missing slice must become a documented exclusion. |
| gap | Typed API/client support plus UX/tool coverage must be added, or the family must become a documented exclusion. |
| decision_needed | Product/UX disposition must move the route to covered or documented exclusion; none remain in the current verifier baseline. |
| documented_exclusion | HotM must not claim user-facing support until a new issue changes the boundary. |

## Capability Matrix

| Route family | Routes | Current status | HotM surface / disposition | Tracker | Proof needed before seamless claim |
| --- | ---: | --- | --- | --- | --- |
| health | 2 | covered | Compatibility/core health checks. | #253 | Preserve health parser tests and degraded/unreachable API states. |
| streaming_health | 1 | covered | Admin > API Surface > Streaming Health card. | #254 | Implemented typed `/health/streaming` parser plus API/UI tests for populated, missing, malformed, and unavailable blocks; preserve degraded/backpressure rendering. |
| system_compatibility | 1 | covered | Admin > API Surface compatibility guard. | #244 | Compatibility fixtures prove unsupported/preview/unknown states disable production controls. |
| contract_docs | 2 | covered | Contract verifier input and Admin API Surface contract links. | #253 | Preserve source-route extraction, advertised OpenAPI/AsyncAPI root fetch tests, and Admin contract-link assertions. |
| notes | 25 | covered | Notes, detail views, status, versions, links, provenance, export. | #253 | Regression tests preserve current note CRUD, reprocess, status, export, link, and version paths. |
| search | 2 | covered | Search UI and agent search tool. | #253 | Search and federated search tests remain tied to current request/response contracts. |
| archives | 13 | covered | Archives/memories management and routing. | #253 | Archive/memory CRUD, defaulting, clone, stats, and routing behavior remain covered. |
| provenance | 5 | covered | Provenance API and note memory-provenance surfaces. | #253 | Location, device, file, named-location, and note provenance paths have typed-client coverage. |
| knowledge_health | 6 | covered | Knowledge Health dashboard. | #253 | Existing orphan/stale/unlinked/cooccurrence/access-frequency panels have current payload fixtures. |
| realtime_calls | 2 | covered | Admin API Surface exposes redacted `/calls/{id}` diagnostics; Twilio realtime WebSocket diagnostics are a documented exclusion with no helper/product claim. | #259 | Preserve typed client tests, Admin diagnostics redaction tests, and Twilio no-claim evidence. |
| jobs | 10 | covered | Jobs panels, queue controls, extraction status. | #253 | Job list/detail/stats/status/pause/resume and archive-scoped controls remain covered. |
| models | 1 | covered | Agent/model settings. | #159 | Model discovery contract remains covered by chat/model settings tests. |
| inference | 6 | covered | Admin > Inference settings, providers, audit, test connection. | #253 | Config/audit/providers/complete/stream/test-connection tests preserve secret redaction. |
| vision_tools | 1 | covered | Attachment preview image-analysis action backed by typed `/vision/describe` client. | #259 | Preserve multipart client tests and attachment action success, unsupported-media, endpoint-error, and no raw model-name assertions. |
| audio_tools | 1 | covered | Attachment preview audio/video transcription action backed by typed `/audio/transcribe` client. | #259 | Preserve multipart client tests and attachment action transcript, unsupported-media, endpoint-error, and no raw model-name assertions. |
| chat_sync | 2 | covered | Agent chat and model list fallback. | #242 | Synchronous chat remains fallback when stream is unsupported or degraded. |
| native_chat_stream | 1 | covered | Agent token-by-token response stream for the Fortemi provider. | #242 | Native POST stream parser, Last-Event-ID, delta/done/error handling, active Agent hook streaming, and sync fallback tests pass. |
| streaming_ingest | 3 | covered | Backup > Stream NDJSON Import. | #255 | Token mint/revoke client tests, NDJSON POST stream parser tests, Backup UI progress tests, token revocation, and no-secret-render assertions pass. |
| document_types | 3 | covered | Admin > Document Types. | #253 | CRUD/detect typed API and panel tests remain current. |
| pke | 12 | documented_exclusion | No current HotM UX claim. | #253 | Exclusion rationale remains in traceability; no UI or agent text claims PKE support. |
| tags | 1 | covered | Tag manager and note tag controls. | #253 | Tag list fixtures remain current. |
| concepts | 22 | covered | Concept browser, schemes, relations, collections, governance/export. | #253 | SKOS concept CRUD, relationships, collections, governance, and Turtle export tests remain current. |
| attachments | 9 | covered | Attachments browser, note attachments, media previews. | #257 | Attachment list/detail/download/subtitles/thumbnail/sprite paths keep typed API and UI coverage. |
| attachments_tus | 2 | covered | Attachments upload/resume flow and transfer recovery guidance. | #257 | Preserve TUS POST/OPTIONS/GET/HEAD/PATCH/DELETE, creation query, resume headers, required PATCH headers, termination, finalization, offset mismatch, chunk-too-large, expired/not-found recovery, and no checksum-extension claim tests. |
| collections | 4 | covered | Collections manager. | #253 | Collection CRUD, notes, and export paths remain covered. |
| embeddings | 8 | covered | Embedding sets/configs. | #253 | Embedding set/config CRUD, members, refresh, and default config tests remain current. |
| graph | 11 | covered | Graph diagnostics, topology, maintenance, SNN/PFNET/community tools. | #253 | Graph diagnostic, snapshot/history/compare, maintenance, and graph fetch tests remain current. |
| templates | 3 | covered | Template manager and instantiate flow. | #253 | Template CRUD and instantiate tests remain current. |
| oauth | 7 | covered | Admin > Authentication read-only OAuth diagnostics plus root auth API helpers. | #247 | Preserve discovery, authorize URL/consent/form, register, token, introspect, revoke API tests and Admin diagnostics redaction assertions; hosted session/role UX remains gated until Fortemi advertises that contract. |
| auth_api_keys | 2 | covered | Auth/API key management. | #231 | API key list/create/delete paths remain covered and secrets are copy-once/redacted. |
| backup_archive | 20 | covered | Backup/export/import manager and route-group controls. | #257 | Preserve backup API and BackupManager tests for legacy backup, knowledge shard import/upload, database download/snapshot/upload/restore, memory download, knowledge archive download/upload, list/detail/swap, metadata get/update, and portable sidecar limitation copy. |
| realtime_events | 2 | covered | Realtime event bus, SSE, WebSocket fallback, activity drawer. | #246 | SSE/WS fallback and activity-state tests remain current. |
| outbound_webhooks | 4 | covered | Admin > Webhooks > Outbound Hooks. | #256 | Existing outbound webhook lifecycle tests remain separate from incoming receiver tests. |
| incoming_webhook_receivers | 3 | covered | Admin > Webhooks > Incoming Receivers metadata surface. | #256 | Receiver list/create/get/patch/delete and payload validation API tests pass; Admin list/create/delete/validate tests prove secret redaction. |
| inbound_sources | 2 | covered | Admin > Webhooks > Inbound Sources metadata surface. | #256 | Source list/create/delete API tests and Admin create/delete tests pass with disabled-by-default and config redaction assertions. |
| rate_limit | 1 | documented_exclusion | No general HotM UX claim; launch proof tracked separately. | #251 | Exclusion remains documented unless manifest/rate-limit launch work creates a diagnostic surface. |

## Cross-Family Acceptance Rules

- Every production-affecting action must be disabled from unknown, preview, unavailable, or insufficient-role capability state.
- Every token, API key, webhook secret, connector credential, tenant/auth diagnostic, private path, and ingest cursor must be redacted or copy-once as appropriate.
- Agent tools may summarize or diagnose only capabilities that are enabled for the connected server and current user context.
- The route inventory must be regenerated when Fortemi changes; status-count changes must be intentional and reviewed.
- The implementation gate cannot pass if a newly discovered route remains `decision_needed` without issue-backed disposition; the current verifier baseline has no `gap` or `decision_needed` routes.
