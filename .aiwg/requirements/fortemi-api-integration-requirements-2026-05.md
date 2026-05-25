---
title: Fortemi API Integration Requirements
status: baselined
date: 2026-05-25
artifact_type: requirements
related_artifacts:
  - .aiwg/design/fortemi-feature-ui-integration-plan-2026-05.md
  - .aiwg/architecture/impact/fortemi-api-contract-drift-2026-05.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-05.md
---

# Fortemi API Integration Requirements

These requirements scope the HotM integration response to the Fortemi v2026.5.13 local sidecar updates reviewed on 2026-05-25.

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| FORTEMI-REQ-001 | The compatibility API snapshot documents UI-used Fortemi create-note fields, response aliases, reprocess, backup import, document type, webhook, and capability-health surfaces. | P0 | OpenAPI contract test and source-route audit. |
| FORTEMI-REQ-002 | Advanced note creation must have one canonical UI path for document type, revision mode, context filters, processing toggles, tags, collections, concepts, and attachments. | P1 | Sidebar Quick Note routes advanced capture to Quick Capture. |
| FORTEMI-REQ-003 | Operators can verify sidecar endpoint, version/status, database/Ollama state, realtime counters, advertised capabilities, degraded guidance, and wired UI features without developer tools. | P1 | Admin > API Surface and API health metadata preservation test. |
| FORTEMI-REQ-004 | Operators can manage custom Fortemi document types from Admin while system types remain protected. | P2 | Admin > Document Types UI and tests. |
| FORTEMI-REQ-005 | Operators can manage outbound Fortemi webhooks from Admin for core lifecycle operations. | P2 | Admin > Webhooks UI and tests. |
| FORTEMI-REQ-006 | Backup import can defer inference and queued reprocess workflows remain explicit, observable, and contract-tested. | P1 | BackupManager tests, OpenAPI contract test. |
| FORTEMI-REQ-007 | Mobile/cloud enablement must remain disabled until a versioned manifest schema is validated and local-vs-remote data paths are explicit. | P2 | Manifest schema and validator; UI onboarding is next slice. |
| FORTEMI-REQ-008 | The plan must cite research-papers corpus sources and hedge recommendations by source quality. | P1 | Research alignment table in UI integration plan. |

## Scope Boundary

This requirements artifact treats /home/roctinam/dev/fortemi/fortemi at v2026.5.13 as the local latest Fortemi source checkout. No generated upstream OpenAPI file was present in that checkout during this audit; route/source evidence is therefore used for latest-source confirmation, while canonical OpenAPI diffing remains a follow-up control.
