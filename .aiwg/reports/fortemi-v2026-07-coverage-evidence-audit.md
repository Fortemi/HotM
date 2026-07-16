---
title: Fortemi v2026.7.1 Coverage Evidence Audit
status: proposed
date: 2026-07-14
artifact_type: traceability-evidence-audit
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/reports/fortemi-v2026-07-api-integration-traceability.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
---

# Fortemi v2026.7.1 Coverage Evidence Audit

## Purpose

This audit applies the SDLC traceability-check model to the Fortemi v2026.7.1 route inventory. The generated route inventory is useful planning evidence, but it is not the same as implementation proof. This report separates route-family status from evidence strength so #253 can turn the current baseline into a reliable CI/local verifier.

The machine-readable evidence map for #253 verifier work is `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json`.

Source baseline:

- Fortemi commit: `f6733252`
- HotM commit at audit start: `ce42f9d`
- Generated route count: 200
- Route families: 36
- Status counts: 186 covered, 0 partial, 0 gap, 0 decision-needed, 14 documented-exclusion

## Traceability Evidence Levels

| Level | Meaning | Gate implication |
| --- | --- | --- |
| Strong | Route family has current HotM API/client or service code and focused tests for the family. | Can remain `covered` if tests still pass and route contracts stay current. |
| Medium | Route family has code and adjacent UI/tests, but route-level parity is broad or incomplete. | Keep issue-backed verification work open. |
| Weak | Route family has planning evidence or broad component evidence, but no clear route-level proof. | #253 should require exact code/test mapping before implementation pass. |
| None | No HotM implementation evidence found. | Keep `gap`, `decision_needed`, or `documented_exclusion`. |

## Evidence Inventory

| Route family | Route status | Evidence strength | Current evidence | Traceability action |
| --- | --- | --- | --- | --- |
| notes | covered | Strong | `ui/src/api/notes.ts`, `ui/src/api/__tests__/notes.test.ts`, note UI tests. | Preserve covered status; add route-level verifier mapping for every notes route. |
| search | covered | Strong | `ui/src/api/search.ts`, `ui/src/api/__tests__/search.test.ts`, `ui/src/components/search/__tests__/SearchPage.test.tsx`, agent search tests. | Preserve covered status; ensure federated search remains in contract tests. |
| archives | covered | Strong | `ui/src/api/archives.ts`, `ui/src/api/__tests__/archives.test.ts`, `ArchiveManager`. | Preserve covered status; add memory-route parity checks if missing from tests. |
| concepts | covered | Strong | `ui/src/api/concepts.ts`, `ui/src/api/__tests__/concepts.test.ts`, `ConceptBrowser` tests. | Preserve covered status; ensure governance/export/collection routes are explicitly asserted. |
| tags | covered | Strong | `ui/src/api/tags.ts`, `ui/src/api/__tests__/tags.test.ts`, tag UI surfaces. | Preserve covered status. |
| attachments | covered | Strong | `ui/src/api/attachments.ts`, `ui/src/api/__tests__/attachments.test.ts`, attachment browser/panel/media tests. | Preserve covered status; keep media preview route checks current. |
| realtime_events | covered | Strong | `ui/src/api/events.ts`, `ui/src/services/realtimeEventBus.ts`, `websocket.ts`, realtime service tests. | Preserve covered status; ensure SSE and WS fallback are both covered. |
| system_compatibility | covered | Strong | `ui/src/api/systemCompatibility.ts`, `ApiCapabilitiesPanel` tests, compatibility fixtures. | Preserve covered status; continue fail-closed capability tests. |
| health | covered | Strong | `ui/src/api/auth.ts` health checks and service health tests. | Preserve covered status for basic health only; do not count `/health/streaming` here. |
| knowledge_health | covered | Strong | `ui/src/api/health.ts`, `KnowledgeHealthDashboard` tests. | Preserve covered status; keep each knowledge-health endpoint represented in fixtures. |
| jobs | covered | Strong | `ui/src/api/jobs.ts`, job panel/store tests, realtime job tests. | Preserve covered status; add extraction stats assertion if absent. |
| backup_archive | covered | Strong | `ui/src/api/backup.ts`, `BackupManager.tsx`, API tests, and BackupManager tests cover legacy backup, knowledge shard import/upload, database download/snapshot/upload/restore, memory download, knowledge archive download/upload, list/detail/swap, metadata get/update, route-group UX controls, and portable sidecar limitation copy. | Preserve #257 coverage; backup/archive diagnostics can now use this evidence boundary. |
| attachments_tus | covered | Strong | `ui/src/services/tusUploader.ts`, `uploadStore.ts`, `JobQueueMonitor.tsx`, and focused TUS/upload-store/monitor tests cover POST creation metadata, server `media_optimize` query handling, OPTIONS discovery, HEAD resume headers, PATCH required headers/offset, DELETE termination, GET finalization, termination aborts, offset mismatch, chunk-too-large, expired/not-found recovery, and no checksum-extension claim. | Preserve #257 TUS coverage while the issue remains open for BackupManager UX exposure and portable sidecar limitation copy. |
| oauth | covered | Strong | `ui/src/api/auth.ts` implements discovery, authorize URL/consent/form submission, register, token, introspect, revoke, and API key helpers; Admin auth diagnostics render metadata and route coverage without secrets or tokens. | Preserve #247 API/Admin tests; hosted session/role UX remains gated until Fortemi advertises that contract. |
| outbound_webhooks | covered | Medium | `ui/src/api/webhooks.ts`, `WebhooksPanel` tests. | Preserve outbound coverage but keep #256 open so incoming receivers are not conflated with outbound hooks. |
| inference | covered | Medium | `ui/src/api/inference.ts`, Admin inference settings/audit surfaces. | Preserve covered status; #253 should verify provider/status/test-connection route-level assertions. |
| chat_sync | covered | Medium | `ui/src/api/chat.ts`, agent chat tests. | Preserve sync fallback; #242 must add native stream coverage. |
| auth_api_keys | covered | Medium | `ui/src/api/auth.ts` list/create/delete API key support. | Preserve covered status if copy-once/redaction tests exist; otherwise add under #231/#253. |
| collections | covered | Medium | `ui/src/api/collections.ts`, collection UX/e2e coverage. | #253 should add exact route-level assertions for collection export and notes listing. |
| embeddings | covered | Medium | `ui/src/api/embeddings.ts`, embedding component tests. | #253 should assert current `/embedding-sets` and `/embedding-configs` routes explicitly. |
| document_types | covered | Medium | `ui/src/api/documents.ts`, `DocumentTypesPanel` tests. | #253 should add API-level route assertions if only panel coverage exists. |
| templates | covered | Medium | `ui/src/api/templates.ts`, `TemplateManager` tests. | #253 should assert route-level CRUD and instantiate coverage. |
| provenance | covered | Strong | `ui/src/api/provenance.ts` and `ui/src/api/__tests__/provenance.test.ts` cover note provenance plus location, named-location, device, file, and note provenance creation endpoints; `ui/src/api/memory.ts` preserves memory provenance access. | Preserve #253 provenance route-level tests and validation guards. |
| graph | covered | Strong | `ui/src/api/links.ts` and `ui/src/api/__tests__/links.test.ts` cover graph fetch, topology stats, diagnostics, snapshots, history, compare, SNN recompute, PFNET sparsify, coarse community detection, maintenance, and cold-spots route shapes; graph components preserve visualization transforms. | Preserve #253 graph route-level assertions and component transform coverage. |
| models | covered | Strong | `ui/src/api/chat.ts` exposes `getModelCatalog()` for `/models` and `getModels()` for `/chat/models`; `ui/src/api/__tests__/chat.test.ts` asserts both exact routes and response metadata. | Preserve #159/#253 model catalog and agent-selection route assertions. |
| contract_docs | covered | Strong | `ui/src/api/systemCompatibility.ts` fetches advertised OpenAPI/AsyncAPI contracts from the Fortemi server root; `ApiCapabilitiesPanel` renders advertised contract links; API/Admin tests cover both paths. | Preserve contract fetch and link assertions alongside source-route extraction verifier coverage. |
| streaming_health | covered | Strong | `ui/src/api/health.ts` and `ApiCapabilitiesPanel` implement `/health/streaming`; focused API/UI tests cover populated, missing, malformed, and unavailable states. | Preserve #254 focused tests and route inventory status. |
| native_chat_stream | covered | Strong | `ui/src/api/chat.ts`, `ui/src/api/__tests__/chat.test.ts`, and `ui/src/components/agent/__tests__/useAgentChat.test.ts` cover native POST stream request shape, delta/done/error parsing, Last-Event-ID resume, active Fortemi Agent streaming, and sync fallback. | Preserve #242 evidence; #258 still owns agent tool registry gating. |
| streaming_ingest | covered | Strong | `ui/src/api/ingest.ts`, `ui/src/api/__tests__/ingest.test.ts`, and `ui/src/components/backup/__tests__/BackupManager.test.tsx` cover token mint/revoke, NDJSON stream parsing/upload, progress summary, token revocation, and no-secret rendering. | Preserve #255 evidence; agent tool boundary remains #258. |
| incoming_webhook_receivers | covered | Strong | `ui/src/api/webhooks.ts` and `WebhooksPanel` cover incoming receiver metadata APIs and Admin rendering with no raw secret display. | Preserve #256 focused tests and redaction assertions. |
| inbound_sources | covered | Strong | `ui/src/api/webhooks.ts` and `WebhooksPanel` cover inbound source metadata APIs and Admin rendering with no raw config display. | Preserve #256 focused tests and redaction assertions. |
| vision_tools | covered | Strong | `ui/src/api/mediaTools.ts`, `ui/src/api/__tests__/mediaTools.test.ts`, `AttachmentsPanel`, and `AttachmentsPanel` tests cover multipart `/vision/describe`, attachment action UX, unsupported media, endpoint errors, result rendering, and no raw model-name rendering. | Preserve #259 focused tests; agent tool exposure remains gated by #258. |
| audio_tools | covered | Strong | `ui/src/api/mediaTools.ts`, `ui/src/api/__tests__/mediaTools.test.ts`, `AttachmentsPanel`, and `AttachmentsPanel` tests cover multipart `/audio/transcribe`, attachment action UX, unsupported media, endpoint errors, transcript rendering, and no raw model-name rendering. | Preserve #259 focused tests; agent tool exposure remains gated by #258. |
| realtime_calls | covered | Strong | `ui/src/api/calls.ts`, `ui/src/api/__tests__/calls.test.ts`, `ApiCapabilitiesPanel`, and `ApiCapabilitiesPanel` tests cover `/calls/{id}` detail pagination, redacted Admin call diagnostics, no raw transcript/provider ID rendering, and no Twilio realtime helper/product claim. | Preserve #259 evidence and keep Twilio realtime as a documented exclusion unless a future operator diagnostics slice changes the boundary. |
| pke | documented_exclusion | None by design | No current HotM PKE UX claim. | Keep excluded until a product slice opens. |
| rate_limit | documented_exclusion | None by design | No current HotM general rate-limit status UX claim; launch proof tracked by #251. | Keep excluded unless manifest/rate-limit diagnostics become a product surface. |

## Immediate #253 Verifier Backlog

1. Use `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` as the machine-readable route-family evidence map with `source_files`, `test_files`, `ui_surfaces`, and `tracker` for each family.
2. Fail the verifier when a family is marked `covered` but lacks at least one source file and one test file, unless it is explicitly configured as `manual_evidence`.
3. Keep `partial` families issue-backed until route-level tests cover all current server methods/paths in that family.
4. Require implementation PRs to update both the route inventory and capability surface matrix when a family changes status.
5. Report weak covered families separately from hard gaps so planning can distinguish missing implementation from missing traceability proof.

## Verification Commands Used

```bash
aiwg discover "traceability check" --limit 3
aiwg show skill aiwg:skill:0e9f051a27567c68
rg --files ui/src/api ui/src/services ui/src/components agent-proxy/src
rg --files -g '*test*' -g '*spec*' ui agent-proxy
rg -n "chat/stream|health/streaming|ingest/tokens|ingest/stream|webhooks/incoming|inbound-sources|vision/describe|audio/transcribe|calls/|realtime/twilio" ui/src agent-proxy/src --glob '!**/__tests__/**'
python3 .aiwg/testing/scripts/fortemi-route-coverage.py
jq -e '(.families | length) == 36' .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
```

The scan now has implementation evidence for `native_chat_stream`, `streaming_health`, `streaming_ingest`, `incoming_webhook_receivers`, `inbound_sources`, `vision_tools`, `audio_tools`, and the REST diagnostics portion of `realtime_calls`; Twilio realtime is a documented exclusion and selected `partial` families still lack full UX or route-parity evidence.
