---
title: Fortemi Route Verifier Specification - v2026.7.1
status: proposed
date: 2026-07-14
artifact_type: verifier-specification
related_artifacts:
  - .aiwg/testing/scripts/fortemi-route-coverage.py
  - .aiwg/testing/scripts/verify-fortemi-route-inventory.sh
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md
  - .aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
---

# Fortemi Route Verifier Specification - v2026.7.1

## Purpose

Define the #253 verifier behavior needed to turn the current Fortemi v2026.7.1 planning inventory into a repeatable compatibility control. The current script extracts Fortemi routes and classifies families. The implementation verifier must also prove that route-family status, evidence metadata, and issue-backed dispositions stay coherent as Fortemi and HotM change.

## Inputs

| Input | Role |
| --- | --- |
| Fortemi route source: `../fortemi/crates/matric-api/src/main.rs` | Canonical route extraction source until `/openapi.yaml` and `/asyncapi.yaml` become canonical verifier inputs. |
| Fortemi Git metadata | `fortemi_commit` and `fortemi_latest_tag` must be derived from the sibling Fortemi checkout at generation time, not copied from stale planning text. |
| `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json` | Generated route inventory and route-family status counts. |
| `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` | Route-family evidence metadata: status, evidence strength, source files, test files, UI surfaces, tracker, verifier action. |
| `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md` | Human-readable route-family surface and proof checklist. |
| `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md` | Baseline assessment of strong, medium, weak, and no-evidence families. |
| `.aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md` | CI/local adoption runbook for making `--check` an enforceable #253 control. |

## Output

The verifier should continue writing the existing generated files:

- `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json`
- `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md`

It should also emit, either in the same JSON or a separate generated report:

| Field | Meaning |
| --- | --- |
| `generated_at` | Inventory generation date. |
| `fortemi_commit` | Short commit hash for the Fortemi checkout used for extraction. |
| `fortemi_latest_tag` | Nearest/latest reachable Fortemi release tag from the extraction checkout. |
| `route_count` | Number of extracted Fortemi route declarations. |
| `status_counts` | Counts for `covered`, `partial`, `gap`, `decision_needed`, and `documented_exclusion`. |
| `family_counts` | Count of routes per family. |
| `verifier_diagnostics.unclassified_routes` | Explicit list; must be empty for a passing gate. |
| `verifier_diagnostics.metadata_issues` | Missing Fortemi commit/tag metadata. |
| `verifier_diagnostics.evidence_issues` | Missing source/test/UI/tracker metadata, stale file paths, and evidence-map parity problems. |
| `verifier_diagnostics.status_drift` | Route count, family count, or status count changes versus the encoded baseline. |
| `route_level_overrides` | Proposed per-route status/surface metadata when a family has mixed disposition, such as `realtime_calls`; this does not change current route status without implementation or exclusion evidence. |

The current local preflight encodes the v2026.7.1 baseline as script constants:

| Baseline field | Expected value |
| --- | ---: |
| `route_count` | 200 |
| route-family count | 36 |
| `covered` | 186 |
| `partial` | 0 |
| `gap` | 0 |
| `decision_needed` | 0 |
| `documented_exclusion` | 14 |

## Pass/Fail Controls

### Hard Fail

| Control | Rule |
| --- | --- |
| Route extraction | Fortemi route source cannot be read or parsed. |
| Git metadata extraction | Fortemi commit or latest tag cannot be resolved from the sibling checkout, unless an explicit offline override is documented in the gate report. |
| Unclassified routes | Any route family is `unclassified`. |
| Evidence map parity | Evidence map family set differs from generated inventory family set. |
| Missing tracker | Any non-covered family lacks a tracker reference. |
| Missing source evidence | A `covered` family lacks `source_files`, unless `manual_evidence` is present and the family is `documented_exclusion`. |
| Missing source path | Any non-empty source/test/UI path in the evidence map does not exist. |
| Undocumented status drift | Route count, family count, or status count changes from the encoded baseline without an intentional baseline update. |

### Warning / Open Gate

| Control | Rule |
| --- | --- |
| Weak covered evidence | `covered` family has `evidence_strength=weak`. |
| Medium evidence | `covered` or `partial` family has source code but broad or adjacent tests only. |
| Partial family | Family remains `partial`; issue must remain open and linked; current baseline should stay at zero partial rows. |
| Decision needed | Route or family remains `decision_needed`; issue and ADR/disposition must be linked. |
| Documented exclusion | Exclusion exists but no compatibility behavior or no-support-claim assertion is present. |

## Baseline Assertions

For the current planning baseline, these commands must pass:

```bash
python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check
.aiwg/testing/scripts/verify-fortemi-route-inventory.sh
```

Expected current evidence strength counts:

| Evidence strength | Count |
| --- | ---: |
| strong | 26 |
| medium | 8 |
| weak | 0 |
| none | 2 |

## Mixed-Disposition Requirement

The verifier emits `route_level_overrides` for ADR-011 mixed dispositions. These overrides mirror the implemented #259 evidence and keep route-level intent visible inside the `realtime_calls` family:

| Route | Proposed disposition |
| --- | --- |
| `GET /api/v1/calls/{id}` | Admin API Surface redacted call diagnostic coverage. |
| `GET /api/v1/realtime/twilio/{provider_call_id}` | Documented exclusion unless operator diagnostics require it. |

`realtime_calls` is covered after typed `/calls/{id}` client evidence, Admin diagnostics redaction tests, and Twilio documented-exclusion evidence. `/realtime/twilio/{provider_call_id}` must not gain a UI, agent tool, or helper claim unless a future operator diagnostics slice changes the boundary with route-level tests.

## Adoption Plan

1. Keep `.aiwg/testing/scripts/fortemi-route-coverage.py` as the planning baseline generator.
2. Keep generator metadata derived from the sibling Fortemi Git checkout so route evidence names the actual audited commit and tag.
3. Keep `--check` as the local preflight for Git metadata, unclassified families, baseline drift, evidence-map parity, missing trackers, and stale source/test/UI paths.
4. Replace or complement script constants with a committed baseline file if #253 needs multi-version support.
5. Consume `verifier_diagnostics` in CI/log review instead of requiring maintainers to infer failures from ad hoc snippets.
6. Promote route-level overrides from advisory planning metadata to enforced route-level closeout checks when #259 changes statuses.
7. Follow `.aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md` to move the command into CI or a documented local preflight and update the gate report with actual output.

## Non-Goals

- This verifier does not replace Vitest, Playwright, or integration tests.
- This verifier does not replace full API response schema compatibility tests; `/openapi.yaml` and `/asyncapi.yaml` availability is covered by HotM contract-link and fetch tests.
- This verifier does not mark implementation complete; it only proves inventory and traceability consistency.
