---
title: Fortemi Feature UI Integration Plan
status: draft
date: 2026-05-25
artifact_type: ux-integration-plan
aiwg_capabilities:
  - product-designer
  - regression-api-contract
related_artifacts:
  - .aiwg/architecture/impact/fortemi-api-contract-drift-2026-05.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-05.md
  - docs/openapi.json
research_refs:
  - REF-944
  - REF-318
  - REF-003
  - REF-132
  - REF-474
---

# Fortemi Feature UI Integration Plan

## Purpose

Integrate the latest Fortemi API additions into HotM without duplicating controls, hiding expensive inference behavior, or weakening the local-first privacy posture. This plan separates implemented UI surfaces from remaining gaps and defines the next implementation slices.

## Current UI Inventory

| Feature area | Current surface | Evidence | Status |
| --- | --- | --- | --- |
| Create-note title handling | Leading Markdown H1 is extracted as explicit title in sidebar Quick Note. | `ui/src/components/HallOfMind.tsx` | Implemented, implicit control. |
| Document type on capture | Quick Capture loads document types from `api.documents.list()`; sidebar Quick Note routes advanced capture to Quick Capture instead of duplicating selectors. | `ui/src/components/capture/QuickCapturePage.tsx`, `ui/src/components/HallOfMind.tsx` | Implemented. |
| Revision mode | Quick Capture uses sticky settings and ProcessingOptionsPanel; sidebar Quick Note routes advanced revision controls to Quick Capture. | `ui/src/components/capture/ProcessingOptionsPanel.tsx`, `ui/src/components/HallOfMind.tsx` | Implemented. |
| Context-filtered revision | Quick Capture exposes tag, collection, and query filters when `contextual_filtered` is selected. | `ui/src/components/capture/ContextFilterInputs.tsx` | Implemented in Quick Capture only. |
| Processing toggles | Quick Capture exposes `autoTagConcepts`, `generateEmbeddings`, `autoLinkRelated`, `extractMedia`, and `generateTitle`. | `ui/src/components/capture/ProcessingOptionsPanel.tsx` | Implemented in Quick Capture only. |
| Deferred import inference | Backup import dialog has a "Defer AI processing" toggle and stores preference. | `ui/src/components/backup/BackupManager.tsx` | Implemented. |
| Bulk reprocess | Backup view exposes reprocess flows and calls `api.notes.reprocessAll`. | `ui/src/components/backup/BackupManager.tsx` | Implemented. |
| Runtime/realtime status | Dashboard and job/realtime components expose API, service, transport, and queue state. Admin > API Surface shows sidecar endpoint, version/status, database/Ollama state, realtime counters, advertised capabilities, degraded guidance, and wired UI features. | `ui/src/components/HallOfMind.tsx`, `ui/src/components/jobs/JobQueueView.tsx`, `ui/src/components/admin/ApiCapabilitiesPanel.tsx` | Implemented. |
| Webhook administration | Admin > Webhooks lists configured hooks, registers hooks, sends test deliveries, and deletes hooks. | `ui/src/components/admin/WebhooksPanel.tsx`, `ui/src/api/webhooks.ts` | Implemented for core lifecycle. |

## Gaps And Recommendations

| Priority | Gap | Recommendation | Rationale |
| --- | --- | --- | --- |
| P0 | Contract guard for UI-used API fields | Keep `ui/src/api/__tests__/openapi-contract.test.ts` in the API test suite and expand it with each new UI-used Fortemi field. | Prevents the drift that triggered this assessment. |
| P1 | Sidebar Quick Note advanced controls were duplicated and partial | Implemented routing from sidebar Quick Note to Quick Capture for advanced capture; retain Quick Capture as the canonical create-note controls surface. | Avoids two divergent create-note workflows. |
| P1 | Dedicated API capability screen | Implemented Admin > API Surface with endpoint, version/status, database/Ollama state, realtime metrics, advertised capabilities, degraded guidance, and wired UI features. | Gives operators a single place to verify latest Fortemi surface availability. |
| P2 | Document type management is discoverable only through capture usage | Implemented Admin > Document Types for list/create/delete custom types. Update support remains a follow-up if operators need editing in place. | Avoids new screens without backend authority. |
| P2 | Webhooks/events are now visible as a configured integration surface | Implemented Admin > Webhooks for list/create/test/delete against the local webhooks API. Delivery-history review and richer event presets remain follow-ups. | Keeps realtime debug separate from productized integrations while exposing configured outbound hooks. |
| P2 | Mobile/cloud manifest onboarding is not productized | Add an onboarding screen that imports/validates the manifest schema and clearly shows local vs remote data paths. | Aligns with manifest research and local-first privacy requirements. |

## Preferred Interaction Model

1. **Fast path:** Keep sidebar Quick Note minimal: content, create, and a visible link/button to open Quick Capture for advanced API controls.
2. **Advanced path:** Treat Quick Capture as the canonical create-note workflow for document type, revision mode, context filters, processing toggles, tags, collections, concepts, and attachments.
3. **Operations path:** Treat Backup as the canonical import/reprocess workflow and Dashboard/Admin as the canonical capability/status workflow.
4. **Future mobile/cloud path:** Require explicit manifest validation before any remote endpoint, model provider, or sync behavior is activated.

## Acceptance Criteria

- A user can create a note with explicit title behavior, document type, revision mode, context filters, and processing toggles from one canonical advanced capture surface.
- A user can import a backup with inference deferred, then intentionally queue reprocessing and see where to monitor job progress.
- A user can verify sidecar/API health, runtime version, realtime transport, and processing queue state without opening developer tools.
- New UI controls are backed by contract tests or API client tests before they are presented as supported features.
- Mobile/cloud settings never imply remote data movement without explicit validated configuration and visible state.

## Research Alignment

Research references were verified against the local `/home/roctinam/dev/research-papers` corpus. Best-practice implications for this integration are:

| Ref | Corpus source | Quality posture | Integration implication |
| --- | --- | --- | --- |
| `REF-944` | Nielsen, "10 Usability Heuristics for User Interface Design" | Foundational HCI heuristic framework. | Keep system status visible, make API capabilities recognizable instead of recall-based, and surface degraded states with recovery context. This supports Admin > API Surface. |
| `REF-318` | Vejendla, "Drift-Adapter" | HIGH in corpus; production embedding migration paper. | Treat embedding/reprocess changes as staged migrations with observable status and recovery paths; avoid forcing full recomputation before users can continue local workflows. |
| `REF-003` | "Agentic Development Anti-Patterns" | VERY LOW; internal qualitative audit, used only as process caution. | Avoid duplicate partial UI paths and abandoned experiments; remove stale sidebar advanced controls instead of preserving competing create-note workflows. |
| `REF-132` | Augment Code, "AI Coding Assistants for Large Codebases" | VERY LOW; vendor guide, used only for rollout/process framing. | Use explicit context gathering, targeted tests, and capability verification before expanding UI surfaces. |
| `REF-474` | "Dataset Versioning Tools -- DVC, LakeFS, and HuggingFace Hub Revisions" | Tooling documentation synthesis. | Keep manifest/config changes versioned, explicit, reversible, and validated before enabling remote/mobile data movement. |

These citations support the current implementation priorities: a single advanced capture path, explicit capability/status visibility, staged import/reprocess flows, and manifest validation before mobile/cloud enablement.

## Next Implementation Slice

The remaining highest-value slice is mobile/cloud manifest onboarding: add a validation/import screen for `.aiwg/architecture/manifest-schema-v1.json`, show local versus remote data paths explicitly, and keep remote behavior disabled until a validated manifest is present. Delivery-history review for Webhooks is a smaller follow-up once operators need audit visibility beyond test delivery results.

## Implementation Progress

- 2026-05-25: Added `.aiwg/architecture/manifest-schema-v1.json` and `.aiwg/testing/scripts/validate-manifest-schema.mjs`, closing the mobile-planning synthesis gap that made manifest compatibility claims unfalsifiable. Verification: `node .aiwg/testing/scripts/validate-manifest-schema.mjs` passed.

- 2026-05-25: Added Admin > Document Types as a supported management surface for the Fortemi document type API. The panel lists system/custom types, creates custom types, and deletes custom types while keeping system types protected. Verification: `npm test -- --run src/components/admin/__tests__/DocumentTypesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx src/api/__tests__/openapi-contract.test.ts` and `npm run typecheck` passed.


- 2026-05-25: Removed the stale hard-coded sidebar Quick Note advanced selectors for document type and revision mode. Sidebar Quick Note now keeps the fast path to content plus H1 title extraction, while advanced Fortemi controls route to Quick Capture as the canonical API-driven surface. Verification: `npm run typecheck` and `npm test -- --run src/api/__tests__/openapi-contract.test.ts src/components/capture/__tests__/useNoteCommit.test.ts src/components/backup/__tests__/BackupManager.test.tsx` passed.

- 2026-05-25: Added a sidebar Quick Note action that routes to the canonical Quick Capture screen for advanced Fortemi create-note controls. This keeps the fast path compact while making document type, revision mode, context filters, processing toggles, tags, collections, concepts, and attachments reachable from the sidebar workflow.
- 2026-05-25: Added Admin > Webhooks as the configured integration surface for Fortemi outbound hooks. The panel lists hooks, registers new endpoints with event selections and retry limits, sends test deliveries, and deletes hooks. The compatibility OpenAPI snapshot now documents /webhooks lifecycle, delivery history, and test endpoints. Verification: `npm test -- --run src/components/admin/__tests__/WebhooksPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx src/api/__tests__/openapi-contract.test.ts` and `npm run typecheck` passed.
- 2026-05-25: Added Admin > API Surface as the dedicated capability/status screen. The API client now preserves Fortemi health metadata instead of dropping capabilities during normalization, and the panel shows endpoint, status/version, database/Ollama state, realtime metrics, advertised capabilities, degraded guidance, and wired UI feature coverage. Verification: `npm test -- --run src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx` and `npm run typecheck` passed.
