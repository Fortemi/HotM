# HotM Enterprise Demo Operator Signoff Packet - 2026-07-06

## Purpose

Make HUX-REQ-012 closeable by giving the operator one concrete signoff surface for the first HotM enterprise demo path. This packet does not approve the defaults by itself; it records the current recommended path, evidence already collected, the exact decisions needed, and the completed dated dry-run receipt requirement before the runbook can move from draft to accepted demo baseline.

The suite-level answer surface is `../.aiwg/decisions/operator-decision-ballot-2026-07-06.md` from the HotM checkout, or `.aiwg/decisions/operator-decision-ballot-2026-07-06.md` from the suite root. Use `../.aiwg/traceability/operator-decision-synchronization-2026-07-06.md` from HotM, or `.aiwg/traceability/operator-decision-synchronization-2026-07-06.md` from the suite root, as the checklist for mirroring accepted answers back into root and HotM artifacts.

The dry-run receipt evidence surface is HotM repo-local: `HotM/.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` from the suite root, or `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` from the HotM checkout. A dated completed copy must be stored under `HotM/.aiwg/evidence/` from the suite root, or `.aiwg/evidence/` from HotM, and linked to `Fortemi/HotM#250` before HUX-REQ-012 is treated as accepted demo evidence.

## Current Recommended Demo Baseline

| Decision | Recommended default | Acceptance impact |
|---|---|---|
| Persona | Tenant admin | Exercises compatibility, hosted auth, realtime activity, premium catalog, tenant health, audit, quota, KMS, and support diagnostics in one path. |
| Deployment target | Local sidecar plus hosted preview metadata | Keeps the demo tied to current implementation evidence while allowing hosted/enterprise states to appear as preview/capability metadata. |
| Priority order | Compatibility center, hosted auth, realtime activity, premium catalog, backoffice preview | Starts with guardrails before showing enterprise surfaces, reducing risk of unsupported demo paths. |
| Claim boundary | Fixture-backed preview, not hosted production | Prevents claims of hosted multi-tenant, EE implementation, private package distribution, or production backoffice readiness. |

## Evidence Already Available

| Area | Evidence | Status |
|---|---|---|
| Demo runbook | `.aiwg/testing/enterprise-demo-runbook-2026-07.md` | Draft, ready for operator acceptance or changes. |
| Requirements | `.aiwg/requirements/enterprise-demo-requirements-2026-07.md` | HUX-REQ-001 through HUX-REQ-014 defined. |
| Requirement traceability | Suite root `.aiwg/reports/hotm-enterprise-demo-traceability-2026-07-06.md` | 10 of 14 requirements covered for fixture/demo scope; HUX-REQ-010, HUX-REQ-012, HUX-REQ-013, and HUX-REQ-014 remain partial. |
| Browser evidence | `.aiwg/evidence/hotm-enterprise-preview-evidence-2026-07-06.md`; desktop/mobile screenshots | Fixture-backed desktop and mobile smoke passed. |
| Local workflow guard | `ui/src/components/admin/__tests__/AdminPanel.test.tsx`; `ui/src/components/search/__tests__/SearchPage.test.tsx` | HUX-REQ-004 covered for admin fallback and note-search fixture scope. |
| Sidecar provenance | `.aiwg/supply-chain/sidecar-provenance-gate-2026-07.md`; `.aiwg/supply-chain/sidecar-provenance-live-ci-evidence-2026-07-06.md` | Local checksum proof exists; live Gitea Actions receipt remains open. |
| Tracker updates | `Fortemi/HotM#250` comments `#80146`, `#80163`, `#80208`, `#80219`, `#80380`, `#80447`, `#80497`, `#80538`, `#80540`, `#80545`, and `#80560`; `Fortemi/HotM#243` comments `#80488`, `#80561`, `#80562`, `#80563`, `#80564`, `#80567`, `#80568`, `#80570`, `#80580`, `#80587`, `#80599`, `#80605`, `#80607`, `#80610`, `#80611`, `#80612`, `#80613`, `#80614`, `#80615`, `#80616`, `#80617`, `#80618`, `#80619`, `#80620`, `#80621`, `#80622`, `#80623`, `#80624`, `#80625`, `#80626`, `#80627`, `#80628`, `#80629`, `#80630`, `#80631`, `#80632`, and `#80633`; `Fortemi-Enterprise/distribution#1` comments `#80634` and `#80635`; `Fortemi/fortemi.com#27` comments `#80573` and `#80636`; `Fortemi/fortemi#1016` comment `#80637`; `Fortemi/fortemi#1021` comment `#80638`; `Fortemi/HotM#245` comment `#80234` | Current evidence, direct HUX anchors, traceability verifier, CI wiring, demo evidence alignment, operator decision-support, OP synchronization, executable OP sync verifier, dynamic receipt checking, executable Gitea live-evidence preflight, checkpoint evidence consistency, corrected `tea` login detection, executable public-claim verification, conditional checkpoint readiness verification, operator-decision application runbook, accepted operator-decision verifier, workspace manifest verifier, blocker-ledger verifier, handoff-suite verifier, manifest-verifier inventory, handoff-validation verifier, issue-traceability verifier, HotM UX enterprise-plan verifier, Enterprise repo readiness verifier, checkpoint review-batch verifier, loose-end correction verifier, enterprise objective-audit verifier, enterprise phase-impact verifier, generated Python cache hygiene, stale compile-evidence wording guard, tracker-comment index verifier, July 7 checkpoint revalidation, tracker revalidation-surface guard, enterprise next-action register, live tracker revalidation, operator response template, refreshed live tracker evidence, July 7 external proof-gate preflight evidence, completion/objective audit alignment, sidecar provenance traceability wording, checkpoint revalidation live-CI wording, refreshed HotM#243 live comment-count, private registry plan verifier, dynamic tracker-live latest-receipt, enterprise claim approval verifier, hosted production gate verifier, and Gitea Actions live-evidence verifier residual blockers are posted. |
| Posted proof follow-ups | `Fortemi/fortemi-react#252` comments `#80888` and `#80963`; `Fortemi/fortemi#1013` comment `#80889`; `Fortemi/HotM#251` comment `#80890`; `Fortemi/aiwg-fortemi-skills#2` comment `#80891` | React npm/Gitea publish proof, completed React local metadata/docs reconciliation tracker update, Fortemi binary projection local proof, HotM manifest launch-rate local fixture proof, and AIWG provider-context refresh proof are posted. These are proof/update handoffs only and do not replace live CI receipts, private registry proof, hosted/gateway/CI production evidence, reviewer acceptance, or `Fortemi/fortemi-react#252` acceptance/closure. |
| Accepted OP receipts | `Fortemi/HotM#243` comment `#81235`; `Fortemi/HotM#250` comment `#81236` | OP-2026-07-001 through OP-2026-07-006 are accepted for the HotM product sequence. HUX-REQ-012 still requires a completed dated dry-run receipt before final demo evidence acceptance. |

## Acceptance Checklist

The operator can accept the default demo path if all of the following are true:

| Check | Required answer |
|---|---|
| OP-2026-07-001 persona accepted | Tenant admin is acceptable as the first demo persona, or a replacement persona is named. |
| OP-2026-07-002 target accepted | Local sidecar plus hosted preview metadata is acceptable, or a replacement deployment target is named. |
| OP-2026-07-003 priority accepted | Compatibility center first is acceptable, followed by hosted auth, realtime activity, premium catalog, and backoffice preview; otherwise a new order is named. |
| OP-2026-07-004 claim boundary accepted | Demo remains fixture-backed/preview and does not claim hosted production, EE implementation readiness, private package readiness, or production backoffice readiness. |
| OP-2026-07-005 sidecar live CI caveat accepted | HUX-REQ-010 remains partial until an authenticated Gitea Actions run receipt is captured after workflow changes are pushed. |
| OP-2026-07-006 registry caveat accepted | Private Cargo registry readiness remains blocked until publish/consume verification passes or the operator accepts a different distribution posture. |

## Signoff Form

Record answers here, then mirror accepted decisions into the root decision log.

| Field | Operator answer |
|---|---|
| OP-2026-07-001 accept tenant-admin persona? | Accepted: tenant admin |
| OP-2026-07-002 accept local sidecar plus hosted preview metadata target? | Accepted: local sidecar plus hosted preview metadata |
| OP-2026-07-003 accept compatibility-first demo order? | Accepted: compatibility center, hosted auth, realtime activity, premium catalog, backoffice preview |
| OP-2026-07-004 accept fixture-backed preview claim boundary? | Accepted: fixture-backed preview only; no hosted production, EE implementation, private package, or production backoffice readiness claim |
| OP-2026-07-005 accept HUX-REQ-010 live CI caveat as an open gate? | Accepted: keep open until authenticated Gitea Actions sidecar provenance receipt exists |
| OP-2026-07-006 accept private registry as a hard blocker until publish/consume proof? | Accepted: keep ADR-096 private registry readiness hard-blocked until publish/consume proof exists |
| Operator name / handle | Operator via Codex interactive OP ballot |
| Decision date | 2026-07-09 |
| Notes or required changes | Accepted recommended defaults. HUX-REQ-012 still requires a completed dated dry-run receipt and `Fortemi/HotM#250` receipt link before product sequence signoff is complete. |

## If Accepted

Update these artifacts:

- Suite root `.aiwg/decisions/operator-decision-log-2026-07.md`
- Suite root `.aiwg/decisions/enterprise-backoffice-decision-register-2026-07.md`
- Suite root `.aiwg/decisions/operator-decision-ballot-2026-07-06.md`
- Suite root `.aiwg/decisions/operator-decision-support-matrix-2026-07-06.md` if accepted answers change the recommended defaults or rationale
- Suite root `.aiwg/gates/enterprise-backoffice-checkpoint-gate-2026-07-06.md`
- Suite root `.aiwg/traceability/sdlc-checkpoint-issue-traceability-2026-07-06.md`
- Suite root `.aiwg/traceability/operator-decision-synchronization-2026-07-06.md`
- Suite root `.aiwg/planning/enterprise-backoffice-checkpoint-handoff-2026-07-06.md`
- Suite root `.aiwg/planning/hotm-ux-enterprise-update-plan-2026-07.md`
- `HotM/.aiwg/planning/enterprise-demo-scenarios-2026-07.md`
- `HotM/.aiwg/testing/enterprise-demo-runbook-2026-07.md`

Post the accepted decision summary to:

- `Fortemi/HotM#243`
- `Fortemi/HotM#250`
- `Fortemi-Enterprise/distribution#1` if the registry posture changes.
- `Fortemi/fortemi-auth#26` if OP-2026-07-006 accepts a dependency-distribution fallback.
- `Fortemi/fortemi.com#27` and `Fortemi/licensing#1` if OP-2026-07-004 changes public, customer-facing, or legal claim language.

## If Changed

If any default changes, keep HUX-REQ-012 partial until the demo scenarios, runbook, test plan, screenshots, and traceability report are updated to match the changed persona, target, priority order, claim boundary, live CI caveat, or registry posture. Keep HUX-REQ-013 partial until `Fortemi/HotM#251` closes the hosted/mobile manifest launch-rate proof.
