---
title: Fortemi v2026.7.1 Route Coverage Inventory
status: generated
date: 2026-08-15
artifact_type: api-coverage-inventory
---

# Fortemi v2026.7.1 Route Coverage Inventory

- Fortemi source: `../fortemi`
- Fortemi commit: `48bc0a0b`
- Latest release tag: `v2026.7.19`
- Extracted route declarations: `202`

## Status Counts

| Status | Count |
| --- | ---: |
| covered | 188 |
| documented_exclusion | 14 |

## Family Counts

| Family | Count |
| --- | ---: |
| archives | 13 |
| attachments | 9 |
| attachments_tus | 2 |
| audio_tools | 1 |
| auth_api_keys | 2 |
| backup_archive | 20 |
| chat_sync | 2 |
| collections | 4 |
| concepts | 22 |
| contract_docs | 2 |
| document_types | 3 |
| embeddings | 8 |
| graph | 11 |
| health | 4 |
| inbound_sources | 2 |
| incoming_webhook_receivers | 3 |
| inference | 6 |
| jobs | 10 |
| knowledge_health | 6 |
| models | 1 |
| native_chat_stream | 1 |
| notes | 25 |
| oauth | 7 |
| outbound_webhooks | 4 |
| pke | 12 |
| provenance | 5 |
| rate_limit | 1 |
| realtime_calls | 2 |
| realtime_events | 2 |
| search | 2 |
| streaming_health | 1 |
| streaming_ingest | 3 |
| system_compatibility | 1 |
| tags | 1 |
| templates | 3 |
| vision_tools | 1 |

## Verifier Diagnostics

| Diagnostic | Value |
| --- | --- |
| Metadata issues | `0` |
| Unclassified routes | `0` |
| Status drift fields | `0` |
| Evidence issues | `0` |

No verifier diagnostics are currently open.

## Route-Level Overrides

These entries are advisory planning metadata for mixed dispositions. They do not change current route status without implementation or documented-exclusion evidence.

| Method | Path | Current family | Current status | Proposed status | Proposed surface | Tracker | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/v1/calls/{id}` | realtime_calls | covered | covered | Admin API Surface call diagnostics | #259 | ADR-011 |
| `GET` | `/api/v1/realtime/twilio/{provider_call_id}` | realtime_calls | documented_exclusion | documented_exclusion | Admin API Surface no-claim message for provider-specific live validation | #259 | ADR-011 |
| `POST` | `/api/v1/vision/describe` | vision_tools | covered | covered | Attachment preview action for supported image attachments | #259 | ADR-011 |
| `POST` | `/api/v1/audio/transcribe` | audio_tools | covered | covered | Attachment preview action for audio/video attachments | #259 | ADR-011 |

## Route Matrix

| Methods | Path | Family | Status | HotM evidence / disposition | Tracker |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/health` | health | covered | health checks in compat/core client | #253 |
| `GET` | `/health/live` | health | covered | health checks in compat/core client | #253 |
| `GET` | `/livez` | health | covered | health checks in compat/core client | #253 |
| `GET` | `/readyz` | health | covered | health checks in compat/core client | #253 |
| `GET` | `/api/v1/health/streaming` | streaming_health | covered | ui/src/api/health.ts and ApiCapabilitiesPanel streaming health card | #254 |
| `GET` | `/api/v1/system/compatibility` | system_compatibility | covered | ui/src/api/systemCompatibility.ts and ApiCapabilitiesPanel | #244 |
| `GET` | `/api/v1/operator/openapi.yaml` | contract_docs | covered | ui/src/api/systemCompatibility.ts fetches advertised OpenAPI and Admin API Surface links it | #253 |
| `GET` | `/api/v1/operator/asyncapi.yaml` | contract_docs | covered | ui/src/api/systemCompatibility.ts fetches advertised AsyncAPI and Admin API Surface links it | #253 |
| `GET, POST` | `/api/v1/notes` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `POST` | `/api/v1/notes/bulk` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET, PATCH, DELETE` | `/api/v1/notes/{id}` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `POST` | `/api/v1/notes/{id}/restore` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `POST` | `/api/v1/notes/{id}/purge` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `POST` | `/api/v1/notes/{id}/reprocess` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `POST` | `/api/v1/notes/reprocess` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET, PUT` | `/api/v1/notes/{id}/tags` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/links` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/backlinks` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/related` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/export` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/full` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/provenance` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/versions` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET, DELETE` | `/api/v1/notes/{id}/versions/{version}` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `POST` | `/api/v1/notes/{id}/versions/{version}/restore` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/{id}/versions/diff` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/search` | search | covered | ui/src/api/search.ts and SearchPage/agent tool | #253 |
| `POST` | `/api/v1/search/federated` | search | covered | ui/src/api/search.ts and SearchPage/agent tool | #253 |
| `GET` | `/api/v1/memories/search` | archives | covered | archive/memory routing APIs and ArchiveManager | #253 |
| `GET` | `/api/v1/notes/{id}/memory-provenance` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `POST` | `/api/v1/provenance/locations` | provenance | covered | ui/src/api/provenance.ts and memory provenance APIs | #253 |
| `POST` | `/api/v1/provenance/named-locations` | provenance | covered | ui/src/api/provenance.ts and memory provenance APIs | #253 |
| `POST` | `/api/v1/provenance/devices` | provenance | covered | ui/src/api/provenance.ts and memory provenance APIs | #253 |
| `POST` | `/api/v1/provenance/files` | provenance | covered | ui/src/api/provenance.ts and memory provenance APIs | #253 |
| `POST` | `/api/v1/provenance/notes` | provenance | covered | ui/src/api/provenance.ts and memory provenance APIs | #253 |
| `GET` | `/api/v1/notes/timeline` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/notes/activity` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/health/knowledge` | knowledge_health | covered | ui/src/api/health.ts and KnowledgeHealthDashboard | #253 |
| `GET` | `/api/v1/health/orphan-tags` | knowledge_health | covered | ui/src/api/health.ts and KnowledgeHealthDashboard | #253 |
| `GET` | `/api/v1/health/stale-notes` | knowledge_health | covered | ui/src/api/health.ts and KnowledgeHealthDashboard | #253 |
| `GET` | `/api/v1/health/unlinked-notes` | knowledge_health | covered | ui/src/api/health.ts and KnowledgeHealthDashboard | #253 |
| `GET` | `/api/v1/health/tag-cooccurrence` | knowledge_health | covered | ui/src/api/health.ts and KnowledgeHealthDashboard | #253 |
| `GET` | `/api/v1/health/access-frequency` | knowledge_health | covered | ui/src/api/health.ts and KnowledgeHealthDashboard | #253 |
| `PATCH` | `/api/v1/notes/{id}/status` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET` | `/api/v1/calls/{id}` | realtime_calls | covered | ui/src/api/calls.ts and ApiCapabilitiesPanel redacted call diagnostics | #259 |
| `GET` | `/api/v1/realtime/twilio/{provider_call_id}` | realtime_calls | documented_exclusion | HotM documents no Twilio realtime WebSocket diagnostic surface and exposes no helper | #259 |
| `GET, POST` | `/api/v1/jobs` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `GET` | `/api/v1/jobs/{id}` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `GET` | `/api/v1/jobs/pending` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `GET` | `/api/v1/jobs/stats` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `GET` | `/api/v1/jobs/status` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `POST` | `/api/v1/jobs/pause` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `POST` | `/api/v1/jobs/resume` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `POST` | `/api/v1/jobs/pause/{archive}` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `POST` | `/api/v1/jobs/resume/{archive}` | jobs | covered | ui/src/api/jobs.ts and job panels/store | #253 |
| `GET` | `/api/v1/extraction/stats` | jobs | covered | attachment/job status surfaces | #253 |
| `GET` | `/api/v1/models` | models | covered | ui/src/api/chat.ts/inference settings model discovery | #159 |
| `GET, POST, DELETE` | `/api/v1/inference/config` | inference | covered | ui/src/api/inference.ts and Admin inference settings/audit | #253 |
| `GET` | `/api/v1/inference/config/audit` | inference | covered | ui/src/api/inference.ts and Admin inference settings/audit | #253 |
| `POST` | `/api/v1/inference/test-connection` | inference | covered | ui/src/api/inference.ts and Admin inference settings/audit | #253 |
| `POST` | `/api/v1/inference/complete` | inference | covered | ui/src/api/inference.ts and Admin inference settings/audit | #253 |
| `POST` | `/api/v1/inference/stream` | inference | covered | ui/src/api/inference.ts and Admin inference settings/audit | #253 |
| `GET` | `/api/v1/inference/providers` | inference | covered | ui/src/api/inference.ts and Admin inference settings/audit | #253 |
| `POST` | `/api/v1/vision/describe` | vision_tools | covered | ui/src/api/mediaTools.ts and AttachmentsPanel image analysis action | #259 |
| `POST` | `/api/v1/audio/transcribe` | audio_tools | covered | ui/src/api/mediaTools.ts and AttachmentsPanel audio/video transcription action | #259 |
| `POST` | `/api/v1/chat` | chat_sync | covered | ui/src/api/chat.ts and agent components | #242 |
| `POST` | `/api/v1/chat/stream` | native_chat_stream | covered | ui/src/api/chat.ts native stream client and Agent Fortemi stream path | #242 |
| `POST` | `/api/v1/ingest/stream` | streaming_ingest | covered | ui/src/api/ingest.ts and BackupManager NDJSON stream import | #255 |
| `POST` | `/api/v1/ingest/tokens` | streaming_ingest | covered | ui/src/api/ingest.ts and BackupManager NDJSON stream import | #255 |
| `DELETE` | `/api/v1/ingest/tokens/{token_id}` | streaming_ingest | covered | ui/src/api/ingest.ts and BackupManager NDJSON stream import | #255 |
| `GET` | `/api/v1/chat/models` | chat_sync | covered | ui/src/api/chat.ts and agent components | #242 |
| `GET, POST` | `/api/v1/document-types` | document_types | covered | ui/src/api/documents.ts and DocumentTypesPanel | #253 |
| `GET, PATCH, DELETE` | `/api/v1/document-types/{name}` | document_types | covered | ui/src/api/documents.ts and DocumentTypesPanel | #253 |
| `POST` | `/api/v1/document-types/detect` | document_types | covered | ui/src/api/documents.ts and DocumentTypesPanel | #253 |
| `GET, POST` | `/api/v1/archives` | archives | covered | ui/src/api/archives.ts and ArchiveManager | #253 |
| `GET, PATCH, DELETE` | `/api/v1/archives/{name}` | archives | covered | ui/src/api/archives.ts and ArchiveManager | #253 |
| `POST` | `/api/v1/archives/{name}/set-default` | archives | covered | ui/src/api/archives.ts and ArchiveManager | #253 |
| `GET` | `/api/v1/archives/{name}/stats` | archives | covered | ui/src/api/archives.ts and ArchiveManager | #253 |
| `POST` | `/api/v1/archives/{name}/clone` | archives | covered | ui/src/api/archives.ts and ArchiveManager | #253 |
| `GET, POST` | `/api/v1/memories` | archives | covered | archive/memory routing APIs and ArchiveManager | #253 |
| `GET` | `/api/v1/memories/overview` | archives | covered | archive/memory routing APIs and ArchiveManager | #253 |
| `GET, PATCH, DELETE` | `/api/v1/memories/{name}` | archives | covered | archive/memory routing APIs and ArchiveManager | #253 |
| `POST` | `/api/v1/memories/{name}/set-default` | archives | covered | archive/memory routing APIs and ArchiveManager | #253 |
| `GET` | `/api/v1/memories/{name}/stats` | archives | covered | archive/memory routing APIs and ArchiveManager | #253 |
| `POST` | `/api/v1/memories/{name}/clone` | archives | covered | archive/memory routing APIs and ArchiveManager | #253 |
| `POST` | `/api/v1/pke/keygen` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `POST` | `/api/v1/pke/address` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `POST` | `/api/v1/pke/encrypt` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `POST` | `/api/v1/pke/decrypt` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `POST` | `/api/v1/pke/recipients` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `GET` | `/api/v1/pke/verify/{address}` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `GET, POST` | `/api/v1/pke/keysets` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `GET` | `/api/v1/pke/keysets/active` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `POST` | `/api/v1/pke/keysets/import` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `DELETE` | `/api/v1/pke/keysets/{name_or_id}` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `PUT` | `/api/v1/pke/keysets/{name_or_id}/active` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `GET` | `/api/v1/pke/keysets/{name_or_id}/export` | pke | documented_exclusion | No current HotM PKE UX claim; keep excluded until product slice | #253 |
| `GET` | `/api/v1/tags` | tags | covered | ui/src/api/tags.ts and TagManager | #253 |
| `GET, POST` | `/api/v1/concepts/schemes` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, PATCH, DELETE` | `/api/v1/concepts/schemes/{id}` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET` | `/api/v1/concepts/schemes/{id}/top-concepts` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, POST` | `/api/v1/concepts` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET` | `/api/v1/concepts/autocomplete` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, PATCH, DELETE` | `/api/v1/concepts/{id}` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET` | `/api/v1/concepts/{id}/full` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET` | `/api/v1/concepts/{id}/ancestors` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET` | `/api/v1/concepts/{id}/descendants` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, POST` | `/api/v1/concepts/{id}/broader` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `DELETE` | `/api/v1/concepts/{id}/broader/{target_id}` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, POST` | `/api/v1/concepts/{id}/narrower` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `DELETE` | `/api/v1/concepts/{id}/narrower/{target_id}` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, POST` | `/api/v1/concepts/{id}/related` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `DELETE` | `/api/v1/concepts/{id}/related/{target_id}` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, POST` | `/api/v1/notes/{id}/concepts` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `DELETE` | `/api/v1/notes/{id}/concepts/{concept_id}` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET, POST` | `/api/v1/notes/{id}/attachments` | attachments | covered | ui/src/api/attachments.ts and upload store | #257 |
| `POST` | `/api/v1/notes/{id}/attachments/upload` | attachments | covered | ui/src/api/attachments.ts and upload store | #257 |
| `POST, OPTIONS` | `/api/v1/notes/{id}/attachments/tus` | attachments_tus | covered | tusUploader/uploadStore/JobQueueMonitor cover TUS verbs, resume, termination, degraded states, and no checksum-extension claim | #257 |
| `GET, PATCH, DELETE, HEAD` | `/api/v1/notes/{id}/attachments/tus/{upload_id}` | attachments_tus | covered | tusUploader/uploadStore/JobQueueMonitor cover TUS verbs, resume, termination, degraded states, and no checksum-extension claim | #257 |
| `GET` | `/api/v1/attachments` | attachments | covered | ui/src/api/attachments.ts and attachment browser/panels | #257 |
| `GET, DELETE` | `/api/v1/attachments/{attachment_id}` | attachments | covered | ui/src/api/attachments.ts and attachment browser/panels | #257 |
| `GET` | `/api/v1/attachments/{attachment_id}/download` | attachments | covered | ui/src/api/attachments.ts and attachment browser/panels | #257 |
| `GET` | `/api/v1/attachments/{attachment_id}/subtitles` | attachments | covered | ui/src/api/attachments.ts and attachment browser/panels | #257 |
| `GET` | `/api/v1/attachments/{attachment_id}/thumbnail` | attachments | covered | ui/src/api/attachments.ts and attachment browser/panels | #257 |
| `GET` | `/api/v1/attachments/{attachment_id}/thumbnails.vtt` | attachments | covered | ui/src/api/attachments.ts and attachment browser/panels | #257 |
| `GET` | `/api/v1/attachments/{attachment_id}/sprites/{sprite_index}` | attachments | covered | ui/src/api/attachments.ts and attachment browser/panels | #257 |
| `GET` | `/api/v1/concepts/governance` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET` | `/api/v1/concepts/schemes/{id}/export/turtle` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET` | `/api/v1/concepts/schemes/export/turtle` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, POST` | `/api/v1/concepts/collections` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, PATCH, DELETE` | `/api/v1/concepts/collections/{id}` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `PUT` | `/api/v1/concepts/collections/{id}/members` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `POST, DELETE` | `/api/v1/concepts/collections/{id}/members/{concept_id}` | concepts | covered | ui/src/api/concepts.ts and ConceptBrowser | #253 |
| `GET, POST` | `/api/v1/collections` | collections | covered | ui/src/api/collections.ts and CollectionsManager | #253 |
| `GET, PATCH, DELETE` | `/api/v1/collections/{id}` | collections | covered | ui/src/api/collections.ts and CollectionsManager | #253 |
| `GET` | `/api/v1/collections/{id}/notes` | collections | covered | ui/src/api/collections.ts and CollectionsManager | #253 |
| `GET` | `/api/v1/collections/{id}/export` | collections | covered | ui/src/api/collections.ts and CollectionsManager | #253 |
| `POST` | `/api/v1/notes/{id}/move` | notes | covered | ui/src/api/notes.ts, extended.ts, versions.ts, links.ts | #253 |
| `GET, POST` | `/api/v1/embedding-sets` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `GET, PATCH, DELETE` | `/api/v1/embedding-sets/{slug}` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `GET, POST` | `/api/v1/embedding-sets/{slug}/members` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `DELETE` | `/api/v1/embedding-sets/{slug}/members/{note_id}` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `POST` | `/api/v1/embedding-sets/{slug}/refresh` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `GET, POST` | `/api/v1/embedding-configs` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `GET` | `/api/v1/embedding-configs/default` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `GET, PATCH, DELETE` | `/api/v1/embedding-configs/{id}` | embeddings | covered | ui/src/api/embeddings.ts and embedding components | #253 |
| `GET` | `/api/v1/graph/topology/stats` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `GET` | `/api/v1/graph/diagnostics` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `POST` | `/api/v1/graph/diagnostics/snapshot` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `GET` | `/api/v1/graph/diagnostics/history` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `GET` | `/api/v1/graph/diagnostics/compare` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `POST` | `/api/v1/graph/snn/recompute` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `POST` | `/api/v1/graph/pfnet/sparsify` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `POST` | `/api/v1/graph/community/coarse` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `POST` | `/api/v1/graph/maintenance` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `GET` | `/api/v1/graph/cold-spots` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `GET` | `/api/v1/graph/{id}` | graph | covered | ui/src/components/graph and link/search APIs | #253 |
| `GET, POST` | `/api/v1/templates` | templates | covered | ui/src/api/templates.ts and TemplateManager | #253 |
| `GET, PATCH, DELETE` | `/api/v1/templates/{id}` | templates | covered | ui/src/api/templates.ts and TemplateManager | #253 |
| `POST` | `/api/v1/templates/{id}/instantiate` | templates | covered | ui/src/api/templates.ts and TemplateManager | #253 |
| `GET` | `/.well-known/oauth-authorization-server` | oauth | covered | ui/src/api/auth.ts and Admin auth diagnostics cover OAuth discovery metadata and redaction | #247 |
| `GET` | `/.well-known/oauth-protected-resource` | oauth | covered | ui/src/api/auth.ts and Admin auth diagnostics cover OAuth discovery metadata and redaction | #247 |
| `GET, POST` | `/oauth/authorize` | oauth | covered | ui/src/api/auth.ts and Admin auth diagnostics cover discovery, authorize, register, token, introspect, revoke, and redaction | #247 |
| `POST` | `/oauth/register` | oauth | covered | ui/src/api/auth.ts and Admin auth diagnostics cover discovery, authorize, register, token, introspect, revoke, and redaction | #247 |
| `POST` | `/oauth/token` | oauth | covered | ui/src/api/auth.ts and Admin auth diagnostics cover discovery, authorize, register, token, introspect, revoke, and redaction | #247 |
| `POST` | `/oauth/introspect` | oauth | covered | ui/src/api/auth.ts and Admin auth diagnostics cover discovery, authorize, register, token, introspect, revoke, and redaction | #247 |
| `POST` | `/oauth/revoke` | oauth | covered | ui/src/api/auth.ts and Admin auth diagnostics cover discovery, authorize, register, token, introspect, revoke, and redaction | #247 |
| `GET, POST` | `/api/v1/api-keys` | auth_api_keys | covered | ui/src/api/auth.ts | #231 |
| `DELETE` | `/api/v1/api-keys/{id}` | auth_api_keys | covered | ui/src/api/auth.ts | #231 |
| `GET` | `/api/v1/backup/export` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `GET` | `/api/v1/backup/download` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `POST` | `/api/v1/backup/import` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `POST` | `/api/v1/backup/trigger` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `GET` | `/api/v1/backup/status` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `GET` | `/api/v1/backup/knowledge-shard` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `POST` | `/api/v1/backup/knowledge-shard/import` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `POST` | `/api/v1/backup/knowledge-shard/upload` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `GET` | `/api/v1/backup/database` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover database backup operations | #257 |
| `POST` | `/api/v1/backup/database/snapshot` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover database backup operations | #257 |
| `POST` | `/api/v1/backup/database/upload` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover database backup operations | #257 |
| `POST` | `/api/v1/backup/database/restore` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover database backup operations | #257 |
| `GET` | `/api/v1/backup/memory/{name}` | backup_archive | covered | ui/src/api/backup.ts and BackupManager memory backup route-group controls | #257 |
| `GET` | `/api/v1/backup/knowledge-archive/{filename}` | backup_archive | covered | ui/src/api/backup.ts and BackupManager knowledge archive route-group controls | #257 |
| `POST` | `/api/v1/backup/knowledge-archive` | backup_archive | covered | ui/src/api/backup.ts and BackupManager knowledge archive route-group controls | #257 |
| `GET` | `/api/v1/backup/list` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `GET` | `/api/v1/backup/list/{filename}` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `POST` | `/api/v1/backup/swap` | backup_archive | covered | ui/src/api/backup.ts and BackupManager cover backup/archive route shapes, UX groups, and portable sidecar limitation copy | #257 |
| `GET` | `/api/v1/backup/metadata/{filename}` | backup_archive | covered | ui/src/api/backup.ts and BackupManager metadata sidecar controls | #257 |
| `PUT` | `/api/v1/backup/metadata/{filename}` | backup_archive | covered | ui/src/api/backup.ts and BackupManager metadata sidecar controls | #257 |
| `GET` | `/api/v1/memory/info` | archives | covered | memory/archive status surfaces | #253 |
| `GET` | `/api/v1/ws` | realtime_events | covered | ui/src/services/websocket.ts fallback | #246 |
| `GET` | `/api/v1/events` | realtime_events | covered | ui/src/api/events.ts and realtimeEventBus/websocket service | #246 |
| `GET, POST` | `/api/v1/webhooks` | outbound_webhooks | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel | #256 |
| `GET, PATCH, DELETE` | `/api/v1/webhooks/{id}` | outbound_webhooks | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel | #256 |
| `GET` | `/api/v1/webhooks/{id}/deliveries` | outbound_webhooks | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel | #256 |
| `POST` | `/api/v1/webhooks/{id}/test` | outbound_webhooks | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel | #256 |
| `GET, POST` | `/api/v1/webhooks/incoming` | incoming_webhook_receivers | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel incoming receiver metadata surface | #256 |
| `POST` | `/api/v1/webhooks/incoming/validate` | incoming_webhook_receivers | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel incoming receiver metadata surface | #256 |
| `GET, POST, PATCH, DELETE` | `/api/v1/webhooks/incoming/{slug}` | incoming_webhook_receivers | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel incoming receiver metadata surface | #256 |
| `GET, POST` | `/api/v1/inbound-sources` | inbound_sources | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel inbound source metadata surface | #256 |
| `DELETE` | `/api/v1/inbound-sources/{name}` | inbound_sources | covered | ui/src/api/webhooks.ts and Admin WebhooksPanel inbound source metadata surface | #256 |
| `GET` | `/api/v1/rate-limit/status` | rate_limit | documented_exclusion | No HotM rate-limit UI claim yet; tracked by manifest/rate-limit planning | #251 |
