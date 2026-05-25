---
title: API Contract Test Plan Addendum
status: draft
date: 2026-05-25
artifact_type: test-plan-addendum
aiwg_capabilities:
  - traceability-check
  - regression-api-contract
  - flow-test-strategy-execution
related_artifacts:
  - .aiwg/testing/master-test-plan.md
  - .aiwg/architecture/impact/fortemi-api-contract-drift-2026-05.md
---

# API Contract Test Plan Addendum

## Objective

Prevent HotM UI behavior from drifting away from the documented Fortemi compatibility contract as Fortemi adds endpoints, optional request controls, and processing workflows.

## Existing Coverage To Preserve

| Test file | Current coverage |
| --- | --- |
| `ui/src/api/__tests__/notes.test.ts` | Create-note defaults, title forwarding/omission, Fortemi `id` normalization, and `/notes/reprocess` payload behavior. |
| `ui/src/api/__tests__/backup.test.ts` | Backup import payload wrapping and optional `defer_inference` behavior. |
| `ui/src/api/__tests__/client.test.ts` | Base URL normalization, retry behavior, request serialization, and `/api/v1` path handling. |

## New Contract Checks

1. Parse `docs/openapi.json` in CI and fail on invalid JSON or missing required component schemas.
2. Assert `CreateNoteRequest` documents `title`, `revision_mode`, `document_type`, `context_filter`, and `processing`.
3. Assert `CreateNoteResponse` documents the current normalized response shape, including `id` or `note_id`, while retaining legacy aliases during transition.
4. Assert `/notes/reprocess` exists with a POST request body covering `revision_mode`, `note_ids`, `steps`, `limit`, and `model`.
5. Assert `/backup/import` exists with optional `defer_inference` so import-first/reprocess-later flows remain documented.
6. Assert `/webhooks`, `/webhooks/{id}`, `/webhooks/{id}/deliveries`, and `/webhooks/{id}/test` exist with schemas for create/update, configured hooks, and delivery records.
7. Add an OpenAPI diff step once a canonical upstream Fortemi spec is available; until then, compare the compatibility snapshot to local client fixtures.

## Implemented Guard

`ui/src/api/__tests__/openapi-contract.test.ts` implements checks 1-6 against the local compatibility snapshot. It should run with the existing API Vitest suite and be expanded whenever the UI client begins using another Fortemi API field or endpoint.

## UI Regression Matrix

| Workflow | Required checks |
| --- | --- |
| Create note | Explicit title, generated-title default, revision mode selector, document type selector, contextual filters, and processing toggles serialize correctly. |
| Import backup | Import with immediate inference and deferred inference both surface clear state and recovery actions. |
| Reprocess | Bulk and selected-note reprocess flows send bounded payloads and report completion/failure status. |
| Capability health | Admin > API Surface exposes sidecar endpoint, version/status, available capabilities/features, realtime counters, and degraded-mode guidance without blocking local note workflows. |
| Webhook administration | List, register, test, and delete webhook flows call the documented endpoints and expose success/failure states. |

## Exit Criteria

- API client unit tests pass.
- OpenAPI parsing and schema-presence checks pass via `ui/src/api/__tests__/openapi-contract.test.ts`.
- Any new UI controls have test coverage for serialization and disabled/degraded states.
- Architecture impact assessment is linked from the relevant feature or release planning artifact.

## UI Evidence Added

- `ui/src/components/admin/__tests__/DocumentTypesPanel.test.tsx` covers listing document types, creating custom types, and blocking system type deletion.
- `ui/src/components/admin/__tests__/AdminPanel.test.tsx` covers the Admin tab entry for API Surface, Document Types, and Webhooks.
- `ui/src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx` covers endpoint/version display, degraded capability guidance, advertised capabilities, wired UI features, refresh, and error state.
- `ui/src/api/__tests__/index.test.ts` covers preserving Fortemi health capability metadata through API normalization.
- `ui/src/components/admin/__tests__/WebhooksPanel.test.tsx` covers listing, registering, testing, and deleting webhooks.
- `ui/src/api/__tests__/openapi-contract.test.ts` covers the Webhooks paths and schemas used by the UI client.

## Manifest Schema Evidence

- `.aiwg/architecture/manifest-schema-v1.json` provides the machine-readable manifest contract requested by mobile planning review synthesis.
- `.aiwg/testing/scripts/validate-manifest-schema.mjs` validates the manifest example against the schema.
- Verification command: `node .aiwg/testing/scripts/validate-manifest-schema.mjs`.
