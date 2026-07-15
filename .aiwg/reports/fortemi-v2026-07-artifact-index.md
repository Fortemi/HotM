---
title: Fortemi v2026.7.1 HotM Integration Artifact Index
status: local-evidence-pass-ci-open
date: 2026-07-15
artifact_type: artifact-index
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/planning/fortemi-v2026-07-hotm-integration-plan.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/planning/fortemi-v2026-07-issue-dependency-map.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/testing/fortemi-v2026-07-fixture-catalog.md
  - .aiwg/testing/fortemi-route-verifier-spec-2026-07.md
  - .aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md
  - .aiwg/security/fortemi-v2026-07-security-redaction-controls.md
  - .aiwg/risks/fortemi-v2026-07-integration-risk-register.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
  - .aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md
  - .aiwg/handoffs/fortemi-v2026-07-tracker-publication-backlog.md
  - .aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md
  - .aiwg/scripts/publish-fortemi-tracker-comments.py
  - .aiwg/testing/scripts/verify-fortemi-closeout-package.py
  - .aiwg/reports/fortemi-v2026-07-tracker-publication-receipts.md
  - .aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md
  - .aiwg/reports/fortemi-v2026-07-completion-audit.md
  - .aiwg/reports/fortemi-v2026-07-remote-baseline-revalidation.md
---

# Fortemi v2026.7.1 HotM Integration Artifact Index

## Purpose

Provide a single navigation surface for the Fortemi v2026.7.1 HotM integration evidence package. Use this index when reviewing local implementation evidence, publishing tracker closeout comments, or revalidating the baseline after Fortemi changes.

## Baseline

| Item | Value |
| --- | --- |
| Fortemi commit | `f6733252` |
| Fortemi release tag | `v2026.7.1` |
| HotM evidence state | Current worktree |
| Route count | 200 |
| Route families | 36 |
| Route status | 186 covered, 14 documented exclusions |
| Current gate | Local implementation evidence pass / tracker published / CI publication open |

## Read First

| Order | Artifact | Use |
| ---: | --- | --- |
| 1 | `.aiwg/gates/fortemi-api-integration-gate-2026-07-14.md` | Current gate decision, local evidence, and final closure blockers. |
| 2 | `.aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md` | Local implementation evidence handoff and publication work order. |
| 3 | `.aiwg/handoffs/fortemi-v2026-07-tracker-publication-backlog.md` | Published tracker closeout source text and replay instructions. |
| 4 | `.aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md` | Ready PR title/body fallback for issue closeout publication. |
| 5 | `.aiwg/reports/fortemi-v2026-07-tracker-publication-receipts.md` | Published Gitea comment IDs for #242, #243, #247, #253-#259. |
| 6 | `.aiwg/reports/fortemi-v2026-07-remote-baseline-revalidation.md` | Proof that the audited Fortemi commit/tag still match configured remotes. |
| 7 | `.aiwg/reports/fortemi-v2026-07-completion-audit.md` | Strict completion boundary: local implementation complete, tracker published, CI pending. |
| 8 | `.aiwg/planning/fortemi-v2026-07-issue-dependency-map.md` | Issue-level critical path, parallelization windows, and gate blockers. |
| 9 | `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md` | Route-family status, HotM surface, tracker, and proof requirement. |
| 10 | `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md` | Scenario-to-test evidence checklist. |

## Artifact Map

| Area | Artifact | Status | Owner / issue |
| --- | --- | --- | --- |
| Route inventory | `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md` | Generated | #253 |
| Route inventory JSON | `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json` | Generated verifier output | #253 |
| Route evidence map | `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` | Proposed verifier input | #253 |
| Requirements | `.aiwg/requirements/fortemi-api-integration-requirements-2026-07.md` | Proposed | #243 |
| Workflow scenarios | `.aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md` | Proposed | #242, #254-#259 |
| Coverage ADR | `.aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md` | Proposed | #253 |
| Media/call ADR | `.aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md` | Proposed | #259 |
| SAD addendum | `.aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md` | Proposed | #243 |
| API drift impact | `.aiwg/architecture/impact/fortemi-api-contract-drift-2026-07.md` | Proposed | #243 |
| UX addendum | `.aiwg/design/fortemi-v2026-07-ux-integration-addendum.md` | Proposed | #242, #254-#259 |
| Capability matrix | `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md` | Proposed | #253 |
| API/client blueprint | `.aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md` | Proposed | #242, #254-#259 |
| Agent tool matrix | `.aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md` | Proposed | #258 |
| MCP/tool surface audit | `.aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md` | Reconciled local evidence | #258, #243 |
| Work plan | `.aiwg/planning/fortemi-v2026-07-hotm-integration-plan.md` | Proposed | #243 |
| Roadmap | `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md` | Proposed | #243 |
| Issue dependency map | `.aiwg/planning/fortemi-v2026-07-issue-dependency-map.md` | Proposed | #243, #253, #242, #254-#259 |
| API test plan | `.aiwg/testing/api-contract-test-plan-addendum-2026-07.md` | Proposed | #253 |
| Scenario test matrix | `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md` | Proposed | #242, #254-#259 |
| Fixture catalog | `.aiwg/testing/fortemi-v2026-07-fixture-catalog.md` | Proposed | #242, #254-#259 |
| Verifier spec | `.aiwg/testing/fortemi-route-verifier-spec-2026-07.md` | Proposed | #253 |
| Verifier CI runbook | `.aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md` | Proposed | #253 |
| Security controls | `.aiwg/security/fortemi-v2026-07-security-redaction-controls.md` | Proposed | #255, #256, #257, #258, #259 |
| Risk register | `.aiwg/risks/fortemi-v2026-07-integration-risk-register.md` | Proposed | #243 |
| Traceability report | `.aiwg/reports/fortemi-v2026-07-api-integration-traceability.md` | Proposed | #243 |
| Evidence audit | `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md` | Proposed | #253 |
| Remote baseline revalidation | `.aiwg/reports/fortemi-v2026-07-remote-baseline-revalidation.md` | Current baseline confirmed | #253 |
| Delivery evidence ledger | `.aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md` | Local evidence pass / tracker published / CI open | #242, #243, #253-#259 |
| Completion audit | `.aiwg/reports/fortemi-v2026-07-completion-audit.md` | Local implementation complete / tracker published / CI pending | #242, #243, #247, #253-#259 |
| Gate report | `.aiwg/gates/fortemi-api-integration-gate-2026-07-14.md` | Local implementation evidence pass / CI open | #243 |
| Delivery handoff | `.aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md` | Local implementation evidence handoff | #243 |
| Tracker publication backlog | `.aiwg/handoffs/fortemi-v2026-07-tracker-publication-backlog.md` | Published; retained as replay source | #242, #243, #247, #253-#259 |
| Tracker publication receipts | `.aiwg/reports/fortemi-v2026-07-tracker-publication-receipts.md` | Published | #242, #243, #247, #253-#259 |
| PR closeout package | `.aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md` | Ready for publication fallback | #242, #243, #247, #253-#259 |
| Tracker publication helper | `.aiwg/scripts/publish-fortemi-tracker-comments.py` | Dry-run validated; post requires Gitea token | #242, #243, #247, #253-#259 |
| Closeout package verifier | `.aiwg/testing/scripts/verify-fortemi-closeout-package.py` | Local/CI closeout packet consistency check | #243, #253 |

## Issue Map

| Issue | Work package | Required artifact path before closeout |
| --- | --- | --- |
| #242 | Native Fortemi streaming chat | Workflow scenario, scenario test matrix, roadmap, security controls. |
| #253 | Route verifier and evidence parity | Route inventory, family evidence map, verifier spec, verifier CI runbook, coverage evidence audit. |
| #254 | Streaming health/backpressure | Workflow scenario, scenario test matrix, security controls. |
| #255 | Ingest stream/tokens | Workflow scenario, scenario test matrix, security controls, risk register. |
| #256 | Incoming receivers/inbound sources | Workflow scenario, scenario test matrix, security controls. |
| #257 | Backup/TUS/portable shard parity | Capability matrix, scenario test matrix, security controls, risk register. |
| #258 | Agent tool refresh | Agent tool matrix, MCP/tool surface audit, workflow scenario, scenario test matrix, security controls. |
| #259 | Vision/audio/realtime call disposition | ADR-011, workflow scenario, scenario test matrix, verifier mixed-disposition support. |

## Baseline Validation

Run from the HotM checkout:

```bash
python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check
.aiwg/testing/scripts/verify-fortemi-route-inventory.sh
python3 .aiwg/testing/scripts/verify-fortemi-closeout-package.py
npm run test -- --run
npm run typecheck
(cd agent-proxy && npm run test && npm run typecheck)
.aiwg/scripts/publish-fortemi-tracker-comments.py
```

## Completion Boundary

This index points to local implementation evidence and published tracker receipts for the current Fortemi v2026.7.1 baseline. Final closure remains unproven until the route verifier CI/local-preflight policy is accepted.
