---
title: Fortemi API Integration Traceability Matrix
status: baselined
date: 2026-05-25
artifact_type: traceability-report
aiwg_capabilities:
  - traceability-check
related_artifacts:
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-05.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-05.md
  - .aiwg/design/fortemi-feature-ui-integration-plan-2026-05.md
---

# Fortemi API Integration Traceability Matrix

## Coverage Summary

| Category | Total | Implemented | Tested | Status |
| --- | ---: | ---: | ---: | --- |
| Fortemi requirements | 8 | 8 | 8 | PASS |
| UI surfaces | 4 | 4 | 4 | PASS |
| Contract/documentation controls | 4 | 4 | 4 | PASS with canonical upstream OpenAPI follow-up |

## Matrix

| Requirement | Implementation evidence | Test / verification evidence | Status |
| --- | --- | --- | --- |
| FORTEMI-REQ-001 | docs/openapi.json; ui/src/api/index.ts; ui/src/api/webhooks.ts; ui/src/api/documents.ts | ui/src/api/__tests__/openapi-contract.test.ts; ui/src/api/__tests__/index.test.ts; source-route audit of /home/roctinam/dev/fortemi/fortemi/crates/matric-api/src/main.rs | Covered |
| FORTEMI-REQ-002 | ui/src/components/HallOfMind.tsx; ui/src/components/capture/QuickCapturePage.tsx; ui/src/components/capture/ProcessingOptionsPanel.tsx | ui/src/components/capture/__tests__/useNoteCommit.test.ts; broad affected Vitest run | Covered |
| FORTEMI-REQ-003 | ui/src/components/admin/ApiCapabilitiesPanel.tsx; ui/src/components/admin/AdminPanel.tsx; ui/src/api/index.ts preserves raw health metadata | ui/src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx; ui/src/components/admin/__tests__/AdminPanel.test.tsx; ui/src/api/__tests__/index.test.ts | Covered |
| FORTEMI-REQ-004 | ui/src/components/admin/DocumentTypesPanel.tsx; ui/src/components/admin/AdminPanel.tsx | ui/src/components/admin/__tests__/DocumentTypesPanel.test.tsx; ui/src/components/admin/__tests__/AdminPanel.test.tsx | Covered |
| FORTEMI-REQ-005 | ui/src/components/admin/WebhooksPanel.tsx; ui/src/components/admin/AdminPanel.tsx; ui/src/api/webhooks.ts | ui/src/components/admin/__tests__/WebhooksPanel.test.tsx; ui/src/api/__tests__/openapi-contract.test.ts | Covered |
| FORTEMI-REQ-006 | ui/src/components/backup/BackupManager.tsx; ui/src/api/backup.ts; ui/src/api/notes.ts; docs/openapi.json | ui/src/components/backup/__tests__/BackupManager.test.tsx; ui/src/api/__tests__/openapi-contract.test.ts | Covered |
| FORTEMI-REQ-007 | .aiwg/architecture/manifest-schema-v1.json; .aiwg/architecture/manifest-schema-v1.md; .aiwg/testing/scripts/validate-manifest-schema.mjs; UI plan next slice | node .aiwg/testing/scripts/validate-manifest-schema.mjs | Covered for schema; UI onboarding deferred by plan |
| FORTEMI-REQ-008 | .aiwg/design/fortemi-feature-ui-integration-plan-2026-05.md; .aiwg/architecture/impact/fortemi-api-contract-drift-2026-05.md | Local corpus file existence checks for REF-944, REF-318, REF-003, REF-132, REF-474 under /home/roctinam/dev/research-papers/documentation/references/ | Covered |

## Upstream Latest Evidence

Local upstream source checkout: /home/roctinam/dev/fortemi/fortemi, git log -1: 7f74632 chore: release v2026.5.13 on main with tag v2026.5.13.

Route/source evidence from that checkout confirms the latest source contains the surfaces integrated here:

| Surface | Upstream source evidence |
| --- | --- |
| Create note revision_mode, document_type, processing controls | /home/roctinam/dev/fortemi/fortemi/crates/matric-api/src/main.rs around CreateNoteBody and create_note handling. |
| Bulk reprocess | /home/roctinam/dev/fortemi/fortemi/crates/matric-api/src/main.rs route /api/v1/notes/reprocess and bulk_reprocess_notes. |
| Backup import with defer_inference | /home/roctinam/dev/fortemi/fortemi/crates/matric-api/src/main.rs BackupImportBody and /api/v1/backup/import. |
| Document types | /home/roctinam/dev/fortemi/fortemi/crates/matric-api/src/handlers/document_types.rs; routes in main.rs. |
| Webhooks lifecycle, deliveries, test | /home/roctinam/dev/fortemi/fortemi/crates/matric-api/src/main.rs routes /api/v1/webhooks, /api/v1/webhooks/{id}, /api/v1/webhooks/{id}/deliveries, /api/v1/webhooks/{id}/test. |
| Capability health | /home/roctinam/dev/fortemi/fortemi/crates/matric-api/src/main.rs health response includes capabilities, sse, and job_processing. |

No canonical generated upstream OpenAPI file was found under /home/roctinam/dev/fortemi/fortemi during this audit. The local docs/openapi.json should therefore remain a compatibility snapshot until Fortemi publishes or exports a canonical OpenAPI artifact for automated diffing.

## Gap Register

| Gap | Severity | Disposition |
| --- | --- | --- |
| Canonical upstream OpenAPI diff unavailable locally | Medium | Documented as follow-up control in compatibility report and gate report. Source-route audit provides current evidence. |
| Mobile/cloud manifest onboarding UI not implemented | Low for current Fortemi API integration; Medium for future mobile work | Explicit next implementation slice. |
| Webhook delivery-history review UI not implemented | Low | Core lifecycle implemented; delivery history is future operator/audit enhancement. |
