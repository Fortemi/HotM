---
title: Fortemi Sensitive Operation Decisions
artifact_type: security-decision-ledger
status: approved
date: 2026-08-16
issue: "#297"
---

# Fortemi Sensitive Operation Decisions

This table classifies exactly 41 credential, PKE, binary-transfer, media, and TUS operations from the pinned Fortemi OpenAPI receipt. Route disposition is not request, response, auth, protocol, portable-data, compatibility, or live conformance evidence.

| Operation | Method and path | Decision | Enabled | Owner | Rationale / blocker |
|---|---|---|---:|---|---|
| `list_api_keys` | `GET /api/v1/api-keys` | `continued_exclusion` | no | Fortemi auth and HotM security | Pinned API-key success responses are not schema-bearing; secret receipt and lifecycle conformance is unverified. |
| `create_api_key` | `POST /api/v1/api-keys` | `continued_exclusion` | no | Fortemi auth and HotM security | Pinned API-key success responses are not schema-bearing; secret receipt and lifecycle conformance is unverified. |
| `revoke_api_key` | `DELETE /api/v1/api-keys/{id}` | `continued_exclusion` | no | Fortemi auth and HotM security | Pinned API-key success responses are not schema-bearing; secret receipt and lifecycle conformance is unverified. |
| `download_attachment` | `GET /api/v1/attachments/{attachment_id}/download` | `external_browser_protocol_handoff` | yes | HotM media UI | Authenticated media bytes are handled by browser/Tauri fetch and media primitives; payloads and local paths never enter generic agent input. |
| `get_sprite_sheet` | `GET /api/v1/attachments/{attachment_id}/sprites/{sprite_index}` | `external_browser_protocol_handoff` | yes | HotM media UI | Authenticated media bytes are handled by browser/Tauri fetch and media primitives; payloads and local paths never enter generic agent input. |
| `get_attachment_subtitles` | `GET /api/v1/attachments/{attachment_id}/subtitles` | `external_browser_protocol_handoff` | yes | HotM media UI | Authenticated media bytes are handled by browser/Tauri fetch and media primitives; payloads and local paths never enter generic agent input. |
| `get_attachment_thumbnail` | `GET /api/v1/attachments/{attachment_id}/thumbnail` | `external_browser_protocol_handoff` | yes | HotM media UI | Authenticated media bytes are handled by browser/Tauri fetch and media primitives; payloads and local paths never enter generic agent input. |
| `get_sprite_vtt` | `GET /api/v1/attachments/{attachment_id}/thumbnails.vtt` | `external_browser_protocol_handoff` | yes | HotM media UI | Authenticated media bytes are handled by browser/Tauri fetch and media primitives; payloads and local paths never enter generic agent input. |
| `database_backup_download` | `GET /api/v1/backup/database` | `continued_exclusion` | no | Fortemi backup and HotM recovery UI | Pinned binary media types, response headers, or upload request schemas are incomplete for this route. |
| `database_backup_upload` | `POST /api/v1/backup/database/upload` | `continued_exclusion` | no | Fortemi backup and HotM recovery UI | Pinned binary media types, response headers, or upload request schemas are incomplete for this route. |
| `backup_download` | `GET /api/v1/backup/download` | `continued_exclusion` | no | Fortemi backup and HotM recovery UI | Pinned binary media types, response headers, or upload request schemas are incomplete for this route. |
| `knowledge_archive_upload` | `POST /api/v1/backup/knowledge-archive` | `continued_exclusion` | no | Fortemi backup and HotM recovery UI | Pinned binary media types, response headers, or upload request schemas are incomplete for this route. |
| `knowledge_archive_download` | `GET /api/v1/backup/knowledge-archive/{filename}` | `continued_exclusion` | no | Fortemi backup and HotM recovery UI | Pinned binary media types, response headers, or upload request schemas are incomplete for this route. |
| `knowledge_shard_import_upload` | `POST /api/v1/backup/knowledge-shard/upload` | `continued_exclusion` | no | Fortemi backup and HotM recovery UI | Pinned binary media types, response headers, or upload request schemas are incomplete for this route. |
| `memory_backup_download` | `GET /api/v1/backup/memory/{name}` | `continued_exclusion` | no | Fortemi backup and HotM recovery UI | Pinned binary media types, response headers, or upload request schemas are incomplete for this route. |
| `upload_attachment` | `POST /api/v1/notes/{id}/attachments` | `continued_exclusion` | no | Fortemi attachments and HotM transfer UI | Legacy JSON attachment upload is not used by HotM; binary content is not base64-routed through the agent or UI client. |
| `tus_create_upload` | `POST /api/v1/notes/{id}/attachments/tus` | `typed_ui_workflow` | yes | HotM transfer UI | Typed tus-js-client workflow uses browser/Tauri byte transport with resumable offsets, bounded chunks, cancellation, and redacted failures. |
| `tus_options` | `OPTIONS /api/v1/notes/{id}/attachments/tus` | `typed_ui_workflow` | yes | HotM transfer UI | Typed tus-js-client workflow uses browser/Tauri byte transport with resumable offsets, bounded chunks, cancellation, and redacted failures. |
| `tus_delete_upload` | `DELETE /api/v1/notes/{id}/attachments/tus/{upload_id}` | `typed_ui_workflow` | yes | HotM transfer UI | Typed tus-js-client workflow uses browser/Tauri byte transport with resumable offsets, bounded chunks, cancellation, and redacted failures. |
| `tus_head_upload` | `HEAD /api/v1/notes/{id}/attachments/tus/{upload_id}` | `typed_ui_workflow` | yes | HotM transfer UI | Typed tus-js-client workflow uses browser/Tauri byte transport with resumable offsets, bounded chunks, cancellation, and redacted failures. |
| `tus_patch_upload` | `PATCH /api/v1/notes/{id}/attachments/tus/{upload_id}` | `typed_ui_workflow` | yes | HotM transfer UI | Typed tus-js-client workflow uses browser/Tauri byte transport with resumable offsets, bounded chunks, cancellation, and redacted failures. |
| `upload_attachment_multipart` | `POST /api/v1/notes/{id}/attachments/upload` | `continued_exclusion` | no | Fortemi attachments and HotM transfer UI | Pinned multipart request and success response schemas are absent; remote uploads use the typed TUS workflow instead. |
| `pke_address` | `POST /api/v1/pke/address` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `pke_decrypt` | `POST /api/v1/pke/decrypt` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `pke_encrypt` | `POST /api/v1/pke/encrypt` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `pke_keygen` | `POST /api/v1/pke/keygen` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `list_keysets` | `GET /api/v1/pke/keysets` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `create_keyset` | `POST /api/v1/pke/keysets` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `get_active_keyset` | `GET /api/v1/pke/keysets/active` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `import_keyset` | `POST /api/v1/pke/keysets/import` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `delete_keyset` | `DELETE /api/v1/pke/keysets/{name_or_id}` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `set_active_keyset` | `PUT /api/v1/pke/keysets/{name_or_id}/active` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `export_keyset` | `GET /api/v1/pke/keysets/{name_or_id}/export` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `pke_recipients` | `POST /api/v1/pke/recipients` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `pke_verify` | `GET /api/v1/pke/verify/{address}` | `continued_exclusion` | no | Fortemi PKE and HotM security | Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified. |
| `oauth_authorize_get` | `GET /oauth/authorize` | `continued_exclusion` | no | fortemi-auth and HotM security | fortemi-auth is specification-only and has no qualifying release or shared Rust/Node fixture receipt. |
| `oauth_authorize_post` | `POST /oauth/authorize` | `continued_exclusion` | no | fortemi-auth and HotM security | fortemi-auth is specification-only and has no qualifying release or shared Rust/Node fixture receipt. |
| `oauth_introspect` | `POST /oauth/introspect` | `continued_exclusion` | no | fortemi-auth and HotM security | fortemi-auth is specification-only and has no qualifying release or shared Rust/Node fixture receipt. |
| `oauth_register` | `POST /oauth/register` | `continued_exclusion` | no | fortemi-auth and HotM security | fortemi-auth is specification-only and has no qualifying release or shared Rust/Node fixture receipt. |
| `oauth_revoke` | `POST /oauth/revoke` | `continued_exclusion` | no | fortemi-auth and HotM security | fortemi-auth is specification-only and has no qualifying release or shared Rust/Node fixture receipt. |
| `oauth_token` | `POST /oauth/token` | `continued_exclusion` | no | fortemi-auth and HotM security | fortemi-auth is specification-only and has no qualifying release or shared Rust/Node fixture receipt. |

## Promotion Rules

- Promotion requires producer-owned request, response, and auth artifacts at the pinned revision plus focused consumer verification.
- `fortemi-auth` remains specification-only until its Rust workspace, CI, release, and shared Rust/Node fixture receipts all exist.
- Generic agent tools never receive credential material, private keys, upload URLs, tenant identifiers, local paths, or binary payloads.
- Browser/Tauri primitives carry bytes directly. Large payloads are not base64-encoded through the agent or React client.
- Unknown compatibility or auth claim-contract revisions fail closed while local-only workflows remain available.
