---
title: Fortemi v2026.7.1 Operation Coverage Inventory
status: generated
date: 2026-08-15
artifact_type: api-operation-coverage-inventory
related_issue: Fortemi/HotM#290
---

# Fortemi v2026.7.1 Operation Coverage Inventory

This report is generated from the same data as the machine-readable operation coverage JSON. It keeps route inventory, OpenAPI, AsyncAPI, Knowledge Shard, compatibility, and auth boundaries independent.

- OpenAPI receipt: `ui/src/api/contracts/fortemi-openapi-receipt.json`
- OpenAPI producer commit: `5ea08229c9f1565122df5f8e6906e89d98dc7e75`
- Contract revision: `1`
- Contract version: `2026.2.9`
- Operations: `251`
- Focused #290 operations: `33`

## Disposition Counts

| Disposition | Count |
| --- | ---: |
| gap | 12 |
| integrated | 1 |
| partial | 238 |

## Dimension Counts

| Dimension | Status counts |
| --- | --- |
| route | `{"conformant": 251}` |
| request | `{"conformant": 18, "gap": 225, "not_applicable": 8}` |
| response | `{"conformant": 19, "gap": 230, "partial": 2}` |
| auth_context | `{"conformant": 1, "gap": 230, "partial": 20}` |
| ui | `{"conformant": 13, "gap": 235, "partial": 3}` |
| agent | `{"gap": 251}` |
| live | `{"gap": 251}` |

## Verifier Diagnostics

| Diagnostic | Count |
| --- | ---: |
| Pin issues | 0 |
| Boundary issues | 0 |
| Evidence issues | 0 |
| Unclassified operations | 0 |
| Extra evidence operations | 0 |
| Missing OpenAPI operations | 0 |

## Focused #290 Operations

| Method | Path | operationId | Family | Disposition | Route | Request | Response | Auth/context | UI | Agent | Live | Tracker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/v1/collections/{id}/export` | `export_collection` | collections | gap | conformant | gap | gap | gap | gap | gap | gap | #290 |
| `POST` | `/api/v1/document-types/detect` | `detect_document_type` | document_types | partial | conformant | conformant | conformant | partial | partial | gap | gap | #290 |
| `PATCH` | `/api/v1/document-types/{name}` | `update_document_type` | document_types | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `GET` | `/api/v1/extraction/stats` | `extraction_stats` | jobs | gap | conformant | not_applicable | gap | gap | gap | gap | gap | #290 |
| `GET` | `/api/v1/graph/diagnostics` | `graph_diagnostics` | graph | gap | conformant | not_applicable | gap | gap | gap | gap | gap | #290 |
| `GET` | `/api/v1/graph/diagnostics/compare` | `compare_diagnostics_snapshots` | graph | gap | conformant | gap | gap | gap | gap | gap | gap | #290 |
| `GET` | `/api/v1/graph/diagnostics/history` | `list_diagnostics_snapshots` | graph | gap | conformant | not_applicable | gap | gap | gap | gap | gap | #290 |
| `POST` | `/api/v1/graph/diagnostics/snapshot` | `capture_diagnostics_snapshot` | graph | gap | conformant | gap | gap | gap | gap | gap | gap | #290 |
| `GET` | `/api/v1/health/access-frequency` | `get_access_frequency` | knowledge_health | gap | conformant | not_applicable | gap | gap | gap | gap | gap | #290 |
| `POST` | `/api/v1/inference/complete` | `complete` | inference | gap | conformant | gap | gap | gap | gap | gap | gap | #290 |
| `GET` | `/api/v1/inference/config` | `get_inference_config` | inference | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `POST` | `/api/v1/inference/config` | `update_inference_config` | inference | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `DELETE` | `/api/v1/inference/config` | `delete_inference_config` | inference | partial | conformant | not_applicable | partial | partial | conformant | gap | gap | #290 |
| `GET` | `/api/v1/inference/config/audit` | `get_inference_config_audit` | inference | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `GET` | `/api/v1/inference/providers` | `list_providers` | inference | gap | conformant | not_applicable | gap | gap | gap | gap | gap | #290 |
| `POST` | `/api/v1/inference/stream` | `stream` | inference | gap | conformant | gap | gap | gap | gap | gap | gap | #290 |
| `POST` | `/api/v1/inference/test-connection` | `test_connection` | inference | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `GET` | `/api/v1/jobs` | `list_jobs` | jobs | integrated | conformant | conformant | conformant | conformant | conformant | gap | gap | #290 |
| `POST` | `/api/v1/jobs` | `create_job` | jobs | gap | conformant | gap | gap | gap | gap | gap | gap | #290 |
| `GET` | `/api/v1/jobs/{id}` | `get_job` | jobs | gap | conformant | gap | gap | gap | gap | gap | gap | #290 |
| `POST` | `/api/v1/provenance/devices` | `create_prov_device` | provenance | partial | conformant | conformant | conformant | partial | gap | gap | gap | #290 |
| `POST` | `/api/v1/provenance/files` | `create_file_provenance` | provenance | partial | conformant | conformant | conformant | partial | gap | gap | gap | #290 |
| `POST` | `/api/v1/provenance/locations` | `create_prov_location` | provenance | partial | conformant | conformant | conformant | partial | gap | gap | gap | #290 |
| `POST` | `/api/v1/provenance/named-locations` | `create_named_location` | provenance | partial | conformant | conformant | conformant | partial | gap | gap | gap | #290 |
| `POST` | `/api/v1/provenance/notes` | `create_note_provenance` | provenance | partial | conformant | conformant | conformant | partial | gap | gap | gap | #290 |
| `GET` | `/api/v1/templates` | `list_templates` | templates | partial | conformant | not_applicable | conformant | partial | conformant | gap | gap | #290 |
| `POST` | `/api/v1/templates` | `create_template` | templates | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `GET` | `/api/v1/templates/{id}` | `get_template` | templates | partial | conformant | conformant | conformant | partial | partial | gap | gap | #290 |
| `DELETE` | `/api/v1/templates/{id}` | `delete_template` | templates | partial | conformant | not_applicable | partial | partial | conformant | gap | gap | #290 |
| `PATCH` | `/api/v1/templates/{id}` | `update_template` | templates | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `POST` | `/api/v1/templates/{id}/instantiate` | `instantiate_template` | templates | partial | conformant | conformant | conformant | partial | partial | gap | gap | #290 |
| `PATCH` | `/api/v1/webhooks/{id}` | `update_webhook` | outbound_webhooks | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |
| `GET` | `/api/v1/webhooks/{id}/deliveries` | `list_webhook_deliveries` | outbound_webhooks | partial | conformant | conformant | conformant | partial | conformant | gap | gap | #290 |

## Operation Matrix

| Method | Path | operationId | Family | Disposition | Route disposition | #290 target |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/.well-known/oauth-authorization-server` | `oauth_discovery` | oauth | partial | covered | false |
| `GET` | `/.well-known/oauth-protected-resource` | `oauth_protected_resource` | oauth | partial | covered | false |
| `GET` | `/api/v1/api-keys` | `list_api_keys` | auth_api_keys | partial | covered | false |
| `POST` | `/api/v1/api-keys` | `create_api_key` | auth_api_keys | partial | covered | false |
| `DELETE` | `/api/v1/api-keys/{id}` | `revoke_api_key` | auth_api_keys | partial | covered | false |
| `GET` | `/api/v1/archives` | `list_archives` | archives | partial | covered | false |
| `POST` | `/api/v1/archives` | `create_archive` | archives | partial | covered | false |
| `GET` | `/api/v1/archives/{name}` | `get_archive` | archives | partial | covered | false |
| `DELETE` | `/api/v1/archives/{name}` | `delete_archive` | archives | partial | covered | false |
| `PATCH` | `/api/v1/archives/{name}` | `update_archive` | archives | partial | covered | false |
| `POST` | `/api/v1/archives/{name}/clone` | `clone_archive` | archives | partial | covered | false |
| `POST` | `/api/v1/archives/{name}/set-default` | `set_default_archive` | archives | partial | covered | false |
| `GET` | `/api/v1/archives/{name}/stats` | `get_archive_stats` | archives | partial | covered | false |
| `GET` | `/api/v1/attachments` | `list_all_attachments` | attachments | partial | covered | false |
| `GET` | `/api/v1/attachments/{attachment_id}` | `get_attachment` | attachments | partial | covered | false |
| `DELETE` | `/api/v1/attachments/{attachment_id}` | `delete_attachment` | attachments | partial | covered | false |
| `GET` | `/api/v1/attachments/{attachment_id}/download` | `download_attachment` | attachments | partial | covered | false |
| `GET` | `/api/v1/attachments/{attachment_id}/sprites/{sprite_index}` | `get_sprite_sheet` | attachments | partial | covered | false |
| `GET` | `/api/v1/attachments/{attachment_id}/subtitles` | `get_attachment_subtitles` | attachments | partial | covered | false |
| `GET` | `/api/v1/attachments/{attachment_id}/thumbnail` | `get_attachment_thumbnail` | attachments | partial | covered | false |
| `GET` | `/api/v1/attachments/{attachment_id}/thumbnails.vtt` | `get_sprite_vtt` | attachments | partial | covered | false |
| `POST` | `/api/v1/audio/transcribe` | `transcribe_audio` | audio_tools | partial | covered | false |
| `GET` | `/api/v1/backup/database` | `database_backup_download` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/database/restore` | `database_backup_restore` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/database/snapshot` | `database_backup_snapshot` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/database/upload` | `database_backup_upload` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/download` | `backup_download` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/export` | `backup_export` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/import` | `backup_import` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/knowledge-archive` | `knowledge_archive_upload` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/knowledge-archive/{filename}` | `knowledge_archive_download` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/knowledge-shard` | `knowledge_shard` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/knowledge-shard/import` | `knowledge_shard_import` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/knowledge-shard/upload` | `knowledge_shard_import_upload` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/list` | `list_backups` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/list/{filename}` | `get_backup_info` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/memory/{name}` | `memory_backup_download` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/metadata/{filename}` | `get_backup_metadata` | backup_archive | partial | covered | false |
| `PUT` | `/api/v1/backup/metadata/{filename}` | `update_backup_metadata` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/backup/status` | `backup_status` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/swap` | `swap_backup` | backup_archive | partial | covered | false |
| `POST` | `/api/v1/backup/trigger` | `backup_trigger` | backup_archive | partial | covered | false |
| `GET` | `/api/v1/calls/{id}` | `get_call` | realtime_calls | partial | covered | false |
| `POST` | `/api/v1/chat` | `chat_handler` | chat_sync | partial | covered | false |
| `GET` | `/api/v1/chat/models` | `list_chat_models` | chat_sync | partial | covered | false |
| `POST` | `/api/v1/chat/stream` | `chat_stream_handler` | native_chat_stream | partial | covered | false |
| `GET` | `/api/v1/collections` | `list_collections` | collections | partial | covered | false |
| `POST` | `/api/v1/collections` | `create_collection` | collections | partial | covered | false |
| `GET` | `/api/v1/collections/{id}` | `get_collection` | collections | partial | covered | false |
| `DELETE` | `/api/v1/collections/{id}` | `delete_collection` | collections | partial | covered | false |
| `PATCH` | `/api/v1/collections/{id}` | `update_collection` | collections | partial | covered | false |
| `GET` | `/api/v1/collections/{id}/export` | `export_collection` | collections | gap | covered | true |
| `GET` | `/api/v1/collections/{id}/notes` | `get_collection_notes` | collections | partial | covered | false |
| `GET` | `/api/v1/concepts` | `search_concepts` | concepts | partial | covered | false |
| `POST` | `/api/v1/concepts` | `create_concept` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/autocomplete` | `autocomplete_concepts` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/collections` | `list_skos_collections` | concepts | partial | covered | false |
| `POST` | `/api/v1/concepts/collections` | `create_skos_collection` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/collections/{id}` | `get_skos_collection` | concepts | partial | covered | false |
| `DELETE` | `/api/v1/concepts/collections/{id}` | `delete_skos_collection` | concepts | partial | covered | false |
| `PATCH` | `/api/v1/concepts/collections/{id}` | `update_skos_collection` | concepts | partial | covered | false |
| `PUT` | `/api/v1/concepts/collections/{id}/members` | `replace_skos_collection_members` | concepts | partial | covered | false |
| `POST` | `/api/v1/concepts/collections/{id}/members/{concept_id}` | `add_skos_collection_member` | concepts | partial | covered | false |
| `DELETE` | `/api/v1/concepts/collections/{id}/members/{concept_id}` | `remove_skos_collection_member` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/governance` | `get_governance_stats` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/schemes` | `list_concept_schemes` | concepts | partial | covered | false |
| `POST` | `/api/v1/concepts/schemes` | `create_concept_scheme` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/schemes/export/turtle` | `export_all_schemes_turtle` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/schemes/{id}` | `get_concept_scheme` | concepts | partial | covered | false |
| `DELETE` | `/api/v1/concepts/schemes/{id}` | `delete_concept_scheme` | concepts | partial | covered | false |
| `PATCH` | `/api/v1/concepts/schemes/{id}` | `update_concept_scheme` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/schemes/{id}/export/turtle` | `export_scheme_turtle` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/schemes/{id}/top-concepts` | `get_top_concepts` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/{id}` | `get_concept` | concepts | partial | covered | false |
| `DELETE` | `/api/v1/concepts/{id}` | `delete_concept` | concepts | partial | covered | false |
| `PATCH` | `/api/v1/concepts/{id}` | `update_concept` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/{id}/ancestors` | `get_ancestors` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/{id}/broader` | `get_broader` | concepts | partial | covered | false |
| `POST` | `/api/v1/concepts/{id}/broader` | `add_broader` | concepts | partial | covered | false |
| `DELETE` | `/api/v1/concepts/{id}/broader/{target_id}` | `remove_broader` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/{id}/descendants` | `get_descendants` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/{id}/full` | `get_concept_full` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/{id}/narrower` | `get_narrower` | concepts | partial | covered | false |
| `POST` | `/api/v1/concepts/{id}/narrower` | `add_narrower` | concepts | partial | covered | false |
| `DELETE` | `/api/v1/concepts/{id}/narrower/{target_id}` | `remove_narrower` | concepts | partial | covered | false |
| `GET` | `/api/v1/concepts/{id}/related` | `get_related` | concepts | partial | covered | false |
| `POST` | `/api/v1/concepts/{id}/related` | `add_related` | concepts | partial | covered | false |
| `DELETE` | `/api/v1/concepts/{id}/related/{target_id}` | `remove_related` | concepts | partial | covered | false |
| `GET` | `/api/v1/document-types` | `list_document_types` | document_types | partial | covered | false |
| `POST` | `/api/v1/document-types` | `create_document_type` | document_types | partial | covered | false |
| `POST` | `/api/v1/document-types/detect` | `detect_document_type` | document_types | partial | covered | true |
| `GET` | `/api/v1/document-types/{name}` | `get_document_type` | document_types | partial | covered | false |
| `DELETE` | `/api/v1/document-types/{name}` | `delete_document_type` | document_types | partial | covered | false |
| `PATCH` | `/api/v1/document-types/{name}` | `update_document_type` | document_types | partial | covered | true |
| `GET` | `/api/v1/embedding-configs` | `list_embedding_configs` | embeddings | partial | covered | false |
| `POST` | `/api/v1/embedding-configs` | `create_embedding_config` | embeddings | partial | covered | false |
| `GET` | `/api/v1/embedding-configs/default` | `get_default_embedding_config` | embeddings | partial | covered | false |
| `GET` | `/api/v1/embedding-configs/{id}` | `get_embedding_config` | embeddings | partial | covered | false |
| `DELETE` | `/api/v1/embedding-configs/{id}` | `delete_embedding_config` | embeddings | partial | covered | false |
| `PATCH` | `/api/v1/embedding-configs/{id}` | `update_embedding_config` | embeddings | partial | covered | false |
| `GET` | `/api/v1/embedding-sets` | `list_embedding_sets` | embeddings | partial | covered | false |
| `POST` | `/api/v1/embedding-sets` | `create_embedding_set` | embeddings | partial | covered | false |
| `GET` | `/api/v1/embedding-sets/{slug}` | `get_embedding_set` | embeddings | partial | covered | false |
| `DELETE` | `/api/v1/embedding-sets/{slug}` | `delete_embedding_set` | embeddings | partial | covered | false |
| `PATCH` | `/api/v1/embedding-sets/{slug}` | `update_embedding_set` | embeddings | partial | covered | false |
| `GET` | `/api/v1/embedding-sets/{slug}/members` | `list_embedding_set_members` | embeddings | partial | covered | false |
| `POST` | `/api/v1/embedding-sets/{slug}/members` | `add_embedding_set_members` | embeddings | partial | covered | false |
| `DELETE` | `/api/v1/embedding-sets/{slug}/members/{note_id}` | `remove_embedding_set_member` | embeddings | partial | covered | false |
| `POST` | `/api/v1/embedding-sets/{slug}/refresh` | `refresh_embedding_set` | embeddings | partial | covered | false |
| `GET` | `/api/v1/extraction/stats` | `extraction_stats` | jobs | gap | covered | true |
| `GET` | `/api/v1/graph/cold-spots` | `get_cold_spots` | graph | partial | covered | false |
| `POST` | `/api/v1/graph/community/coarse` | `coarse_community_detection` | graph | partial | covered | false |
| `GET` | `/api/v1/graph/diagnostics` | `graph_diagnostics` | graph | gap | covered | true |
| `GET` | `/api/v1/graph/diagnostics/compare` | `compare_diagnostics_snapshots` | graph | gap | covered | true |
| `GET` | `/api/v1/graph/diagnostics/history` | `list_diagnostics_snapshots` | graph | gap | covered | true |
| `POST` | `/api/v1/graph/diagnostics/snapshot` | `capture_diagnostics_snapshot` | graph | gap | covered | true |
| `POST` | `/api/v1/graph/maintenance` | `trigger_graph_maintenance` | graph | partial | covered | false |
| `POST` | `/api/v1/graph/pfnet/sparsify` | `pfnet_sparsify` | graph | partial | covered | false |
| `POST` | `/api/v1/graph/snn/recompute` | `recompute_snn_scores` | graph | partial | covered | false |
| `GET` | `/api/v1/graph/topology/stats` | `graph_topology_stats` | graph | partial | covered | false |
| `GET` | `/api/v1/graph/{id}` | `explore_graph` | graph | partial | covered | false |
| `GET` | `/api/v1/health/access-frequency` | `get_access_frequency` | knowledge_health | gap | covered | true |
| `GET` | `/api/v1/health/knowledge` | `get_knowledge_health` | knowledge_health | partial | covered | false |
| `GET` | `/api/v1/health/orphan-tags` | `get_orphan_tags` | knowledge_health | partial | covered | false |
| `GET` | `/api/v1/health/stale-notes` | `get_stale_notes` | knowledge_health | partial | covered | false |
| `GET` | `/api/v1/health/streaming` | `streaming_health_check` | streaming_health | partial | covered | false |
| `GET` | `/api/v1/health/tag-cooccurrence` | `get_tag_cooccurrence` | knowledge_health | partial | covered | false |
| `GET` | `/api/v1/health/unlinked-notes` | `get_unlinked_notes` | knowledge_health | partial | covered | false |
| `GET` | `/api/v1/inbound-sources` | `list_inbound_sources` | inbound_sources | partial | covered | false |
| `POST` | `/api/v1/inbound-sources` | `create_inbound_source` | inbound_sources | partial | covered | false |
| `DELETE` | `/api/v1/inbound-sources/{name}` | `delete_inbound_source` | inbound_sources | partial | covered | false |
| `POST` | `/api/v1/inference/complete` | `complete` | inference | gap | covered | true |
| `GET` | `/api/v1/inference/config` | `get_inference_config` | inference | partial | covered | true |
| `POST` | `/api/v1/inference/config` | `update_inference_config` | inference | partial | covered | true |
| `DELETE` | `/api/v1/inference/config` | `delete_inference_config` | inference | partial | covered | true |
| `GET` | `/api/v1/inference/config/audit` | `get_inference_config_audit` | inference | partial | covered | true |
| `GET` | `/api/v1/inference/providers` | `list_providers` | inference | gap | covered | true |
| `POST` | `/api/v1/inference/stream` | `stream` | inference | gap | covered | true |
| `POST` | `/api/v1/inference/test-connection` | `test_connection` | inference | partial | covered | true |
| `POST` | `/api/v1/ingest/tokens` | `mint_ingest_token` | streaming_ingest | partial | covered | false |
| `DELETE` | `/api/v1/ingest/tokens/{token_id}` | `revoke_ingest_token` | streaming_ingest | partial | covered | false |
| `GET` | `/api/v1/jobs` | `list_jobs` | jobs | integrated | covered | true |
| `POST` | `/api/v1/jobs` | `create_job` | jobs | gap | covered | true |
| `POST` | `/api/v1/jobs/pause` | `pause_jobs_global` | jobs | partial | covered | false |
| `POST` | `/api/v1/jobs/pause/{archive}` | `pause_jobs_archive` | jobs | partial | covered | false |
| `GET` | `/api/v1/jobs/pending` | `pending_jobs_count` | jobs | partial | covered | false |
| `POST` | `/api/v1/jobs/resume` | `resume_jobs_global` | jobs | partial | covered | false |
| `POST` | `/api/v1/jobs/resume/{archive}` | `resume_jobs_archive` | jobs | partial | covered | false |
| `GET` | `/api/v1/jobs/stats` | `queue_stats` | jobs | partial | covered | false |
| `GET` | `/api/v1/jobs/status` | `get_job_pause_status` | jobs | partial | covered | false |
| `GET` | `/api/v1/jobs/{id}` | `get_job` | jobs | gap | covered | true |
| `GET` | `/api/v1/memories` | `list_archives_memory_alias` | archives | partial | covered | false |
| `POST` | `/api/v1/memories` | `create_archive_memory_alias` | archives | partial | covered | false |
| `GET` | `/api/v1/memories/overview` | `memories_overview` | archives | partial | covered | false |
| `GET` | `/api/v1/memories/search` | `search_memories` | archives | partial | covered | false |
| `GET` | `/api/v1/memories/{name}` | `get_archive_memory_alias` | archives | partial | covered | false |
| `DELETE` | `/api/v1/memories/{name}` | `delete_archive_memory_alias` | archives | partial | covered | false |
| `PATCH` | `/api/v1/memories/{name}` | `update_archive_memory_alias` | archives | partial | covered | false |
| `POST` | `/api/v1/memories/{name}/clone` | `clone_archive_memory_alias` | archives | partial | covered | false |
| `POST` | `/api/v1/memories/{name}/set-default` | `set_default_archive_memory_alias` | archives | partial | covered | false |
| `GET` | `/api/v1/memories/{name}/stats` | `get_archive_stats_memory_alias` | archives | partial | covered | false |
| `GET` | `/api/v1/memory/info` | `memory_info` | archives | partial | covered | false |
| `GET` | `/api/v1/models` | `list_models` | models | partial | covered | false |
| `GET` | `/api/v1/notes` | `list_notes` | notes | partial | covered | false |
| `POST` | `/api/v1/notes` | `create_note` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/activity` | `get_notes_activity` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/bulk` | `bulk_create_notes` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/reprocess` | `bulk_reprocess_notes` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/timeline` | `get_notes_timeline` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}` | `get_note` | notes | partial | covered | false |
| `DELETE` | `/api/v1/notes/{id}` | `delete_note` | notes | partial | covered | false |
| `PATCH` | `/api/v1/notes/{id}` | `update_note` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/attachments` | `list_attachments` | attachments | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/attachments` | `upload_attachment` | attachments | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/attachments/tus` | `tus_create_upload` | attachments_tus | partial | covered | false |
| `OPTIONS` | `/api/v1/notes/{id}/attachments/tus` | `tus_options` | attachments_tus | partial | covered | false |
| `DELETE` | `/api/v1/notes/{id}/attachments/tus/{upload_id}` | `tus_delete_upload` | attachments_tus | partial | covered | false |
| `HEAD` | `/api/v1/notes/{id}/attachments/tus/{upload_id}` | `tus_head_upload` | attachments_tus | partial | covered | false |
| `PATCH` | `/api/v1/notes/{id}/attachments/tus/{upload_id}` | `tus_patch_upload` | attachments_tus | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/attachments/upload` | `upload_attachment_multipart` | attachments | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/backlinks` | `get_note_backlinks` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/concepts` | `get_note_concepts` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/concepts` | `tag_note_with_concept` | notes | partial | covered | false |
| `DELETE` | `/api/v1/notes/{id}/concepts/{concept_id}` | `untag_note_concept` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/export` | `export_note` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/full` | `get_full_document` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/links` | `get_note_links` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/memory-provenance` | `get_memory_provenance_handler` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/move` | `move_note_to_collection` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/provenance` | `get_note_provenance` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/purge` | `purge_note` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/related` | `get_related_notes` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/reprocess` | `reprocess_note` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/restore` | `restore_note` | notes | partial | covered | false |
| `PATCH` | `/api/v1/notes/{id}/status` | `update_note_status` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/tags` | `get_note_tags` | notes | partial | covered | false |
| `PUT` | `/api/v1/notes/{id}/tags` | `set_note_tags` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/versions` | `list_note_versions` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/versions/diff` | `diff_note_versions` | notes | partial | covered | false |
| `GET` | `/api/v1/notes/{id}/versions/{version}` | `get_note_version` | notes | partial | covered | false |
| `DELETE` | `/api/v1/notes/{id}/versions/{version}` | `delete_note_version` | notes | partial | covered | false |
| `POST` | `/api/v1/notes/{id}/versions/{version}/restore` | `restore_note_version` | notes | partial | covered | false |
| `POST` | `/api/v1/pke/address` | `pke_address` | pke | partial | documented_exclusion | false |
| `POST` | `/api/v1/pke/decrypt` | `pke_decrypt` | pke | partial | documented_exclusion | false |
| `POST` | `/api/v1/pke/encrypt` | `pke_encrypt` | pke | partial | documented_exclusion | false |
| `POST` | `/api/v1/pke/keygen` | `pke_keygen` | pke | partial | documented_exclusion | false |
| `GET` | `/api/v1/pke/keysets` | `list_keysets` | pke | partial | documented_exclusion | false |
| `POST` | `/api/v1/pke/keysets` | `create_keyset` | pke | partial | documented_exclusion | false |
| `GET` | `/api/v1/pke/keysets/active` | `get_active_keyset` | pke | partial | documented_exclusion | false |
| `POST` | `/api/v1/pke/keysets/import` | `import_keyset` | pke | partial | documented_exclusion | false |
| `DELETE` | `/api/v1/pke/keysets/{name_or_id}` | `delete_keyset` | pke | partial | documented_exclusion | false |
| `PUT` | `/api/v1/pke/keysets/{name_or_id}/active` | `set_active_keyset` | pke | partial | documented_exclusion | false |
| `GET` | `/api/v1/pke/keysets/{name_or_id}/export` | `export_keyset` | pke | partial | documented_exclusion | false |
| `POST` | `/api/v1/pke/recipients` | `pke_recipients` | pke | partial | documented_exclusion | false |
| `GET` | `/api/v1/pke/verify/{address}` | `pke_verify` | pke | partial | documented_exclusion | false |
| `POST` | `/api/v1/provenance/devices` | `create_prov_device` | provenance | partial | covered | true |
| `POST` | `/api/v1/provenance/files` | `create_file_provenance` | provenance | partial | covered | true |
| `POST` | `/api/v1/provenance/locations` | `create_prov_location` | provenance | partial | covered | true |
| `POST` | `/api/v1/provenance/named-locations` | `create_named_location` | provenance | partial | covered | true |
| `POST` | `/api/v1/provenance/notes` | `create_note_provenance` | provenance | partial | covered | true |
| `GET` | `/api/v1/rate-limit/status` | `rate_limit_status` | rate_limit | partial | documented_exclusion | false |
| `GET` | `/api/v1/search` | `search_notes` | search | partial | covered | false |
| `POST` | `/api/v1/search/federated` | `federated_search` | search | partial | covered | false |
| `GET` | `/api/v1/system/compatibility` | `system_compatibility` | system_compatibility | partial | covered | false |
| `GET` | `/api/v1/tags` | `list_tags` | tags | partial | covered | false |
| `GET` | `/api/v1/templates` | `list_templates` | templates | partial | covered | true |
| `POST` | `/api/v1/templates` | `create_template` | templates | partial | covered | true |
| `GET` | `/api/v1/templates/{id}` | `get_template` | templates | partial | covered | true |
| `DELETE` | `/api/v1/templates/{id}` | `delete_template` | templates | partial | covered | true |
| `PATCH` | `/api/v1/templates/{id}` | `update_template` | templates | partial | covered | true |
| `POST` | `/api/v1/templates/{id}/instantiate` | `instantiate_template` | templates | partial | covered | true |
| `POST` | `/api/v1/vision/describe` | `describe_image` | vision_tools | partial | covered | false |
| `GET` | `/api/v1/webhooks` | `list_webhooks` | outbound_webhooks | partial | covered | false |
| `POST` | `/api/v1/webhooks` | `create_webhook` | outbound_webhooks | partial | covered | false |
| `GET` | `/api/v1/webhooks/incoming` | `list_incoming_webhook_receivers` | incoming_webhook_receivers | partial | covered | false |
| `POST` | `/api/v1/webhooks/incoming` | `create_incoming_webhook_receiver` | incoming_webhook_receivers | partial | covered | false |
| `GET` | `/api/v1/webhooks/{id}` | `get_webhook` | outbound_webhooks | partial | covered | false |
| `DELETE` | `/api/v1/webhooks/{id}` | `delete_webhook_handler` | outbound_webhooks | partial | covered | false |
| `PATCH` | `/api/v1/webhooks/{id}` | `update_webhook` | outbound_webhooks | partial | covered | true |
| `GET` | `/api/v1/webhooks/{id}/deliveries` | `list_webhook_deliveries` | outbound_webhooks | partial | covered | true |
| `POST` | `/api/v1/webhooks/{id}/test` | `test_webhook` | outbound_webhooks | partial | covered | false |
| `GET` | `/health` | `health_check` | health | partial | covered | false |
| `GET` | `/health/live` | `health_check_live` | health | partial | covered | false |
| `GET` | `/livez` | `liveness_probe` | health | partial | covered | false |
| `GET` | `/oauth/authorize` | `oauth_authorize_get` | oauth | partial | covered | false |
| `POST` | `/oauth/authorize` | `oauth_authorize_post` | oauth | partial | covered | false |
| `POST` | `/oauth/introspect` | `oauth_introspect` | oauth | partial | covered | false |
| `POST` | `/oauth/register` | `oauth_register` | oauth | partial | covered | false |
| `POST` | `/oauth/revoke` | `oauth_revoke` | oauth | partial | covered | false |
| `POST` | `/oauth/token` | `oauth_token` | oauth | partial | covered | false |
| `GET` | `/readyz` | `readiness_probe` | health | partial | covered | false |
