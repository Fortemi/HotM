---
title: Fortemi API Contract Drift Impact Assessment
status: draft
date: 2026-05-25
artifact_type: impact-assessment
aiwg_capabilities:
  - architecture-evolution
  - traceability-check
  - regression-api-contract
  - flow-test-strategy-execution
  - artifact-metadata
related_artifacts:
  - .aiwg/research/findings/mobile-manifest-remote-config.md
  - .aiwg/architecture/manifest-schema-v1.md
  - .aiwg/research/findings/mobile-multitenant-byo-llm.md
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/architecture/adr/ADR-004-spa-migration.md
  - .aiwg/testing/master-test-plan.md
research_refs:
  - REF-944
  - REF-318
  - REF-003
  - REF-132
  - REF-474
---

# Fortemi API Contract Drift Impact Assessment

## Scope

This assessment covers the current HotM integration surface for the latest local Fortemi sidecar updates, with emphasis on documented API contracts, UI client behavior, and test coverage. The immediate concern is that `docs/openapi.json` is older than the TypeScript API client and tests, so generated clients, review workflows, or downstream integrations could miss newer request fields and endpoints.

## Evidence

| Area | Current evidence | Impact |
| --- | --- | --- |
| API base URL | `ui/src/api/index.ts` defaults to `http://localhost:3000/api/v1`; `docs/openapi.json` still advertises `http://127.0.0.1:53211/api/v1`. | Contract consumers may target the retired service port. |
| Note creation | `ui/src/api/types.ts` defines `title`, `revision_mode`, `document_type`, `context_filter`, and `processing`; `docs/openapi.json` only documents `content`, `format`, and `source`. | New controls cannot be generated or validated from the spec. |
| Create response | `ui/src/api/notes.ts` normalizes Fortemi `id` and `note_id` responses; `docs/openapi.json` only documents legacy `noteId`. | Contract tests can pass against a shape the app no longer depends on. |
| Bulk reprocess | `ui/src/api/notes.ts` posts `/notes/reprocess`; `ui/src/api/__tests__/notes.test.ts` covers default and option payloads. | The reprocessing workflow is implemented but invisible in the API contract. |
| Deferred import inference | `ui/src/api/backup.ts` posts `/backup/import` with optional `defer_inference`; `ui/src/api/__tests__/backup.test.ts` covers true/false/omitted behavior. | Operators lack a documented way to import first and reprocess later. |

## Risk Classification

| Risk | Severity | Notes |
| --- | --- | --- |
| API compatibility drift | High | The OpenAPI spec is no longer a dependable source of truth for implemented UI behavior. |
| UI/generated-client drift | High | Additional controls for title generation, revision mode, document type, and processing cannot safely bind to a stale schema. |
| Migration and performance | Medium | Deferred inference and bulk reprocess change when expensive AI work runs; this needs explicit test and UX coverage. |
| Security and privacy | Medium | Manifest/cloud/mobile work should preserve local-first defaults and avoid silently expanding remote data paths. |

## Integration Plan

1. Correct the documented API contract for the latest note creation, bulk reprocess, and backup import behavior already implemented by the UI client.
2. Add a contract test gate that parses `docs/openapi.json` and checks presence of fields used by `ui/src/api/types.ts`, `ui/src/api/notes.ts`, and `ui/src/api/backup.ts`.
3. Add UI controls for implemented but under-exposed options: explicit note title, revision mode, document type, processing toggles, contextual filters, import with deferred inference, and post-import reprocess.
4. Add or update screens only where the workflow needs durable state: reprocess jobs/status, API capability/health, document type management, webhook/API events, and mobile/cloud manifest onboarding.
5. Keep mobile and cloud enablement behind explicit configuration generated from the manifest schema work, following the local-first privacy posture in the SPA/mobile architecture artifacts.

## Research Alignment

- `REF-944` supports visible system status, recognition over recall, and clear degraded-state/error recovery in the Admin > API Surface workflow.
- `REF-318` supports staged embedding/reprocess migrations with observable status instead of blocking local workflows on full recomputation.
- `REF-003` is VERY LOW-quality internal evidence, used only as a process caution against duplicated partial UI paths and abandoned implementation variants.
- `REF-132` is VERY LOW-quality vendor guidance, used only for rollout/process framing around context gathering, targeted tests, and capability verification.
- `REF-474` supports explicit, versioned, reversible, validated manifest/config changes before enabling remote/mobile data movement.

## Decisions

- Treat `docs/openapi.json` as a compatibility snapshot for the HotM UI and Fortemi sidecar integration, not as a complete upstream Fortemi canonical spec.
- Prefer additive schema changes first. Do not remove legacy response aliases until a backend compatibility matrix proves they are unused.
- Keep contract verification close to the API client tests so future API additions fail visibly when the spec is not updated.

## Verification Added

`ui/src/api/__tests__/openapi-contract.test.ts` now verifies that `docs/openapi.json` documents the Fortemi sidecar base URL, create-note controls, response aliases, `/notes/reprocess`, and `/backup/import` deferred inference behavior. This closes the immediate regression guard identified in this assessment while leaving broader upstream Fortemi baseline diffing as future work.
