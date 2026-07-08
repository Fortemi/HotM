---
title: HotM Enterprise Demo Readiness Matrix
status: checkpoint
date: 2026-07-08
artifact_type: demo-readiness-matrix
related_artifacts:
  - .aiwg/testing/enterprise-demo-runbook-2026-07.md
  - .aiwg/testing/enterprise-demo-test-plan-2026-07.md
  - .aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md
  - .aiwg/design/enterprise-demo-screen-state-blueprint-2026-07.md
  - ../../.aiwg/planning/hotm-ux-enterprise-update-plan-2026-07.md
---

# HotM Enterprise Demo Readiness Matrix - 2026-07

## Purpose

Give the operator and next implementation pass a compact view of what can be demonstrated now, what remains fixture-backed only, and what must stay blocked until external proof or operator acceptance exists.

This matrix does not replace the runbook or test plan. It is a checkpoint entry point for deciding whether the current HotM UX is ready for a fixture-backed demo dry run.

## Readiness Legend

| State | Meaning |
|---|---|
| Demo-ready fixture | May be shown in a local or mocked preview with the named fixtures and no production-readiness claim. |
| Preview-only | May be shown as disabled or degraded UI that explains the backend gate. |
| External gate | Do not claim closure until issue-attached CI, hosted, registry, legal/product, or operator evidence exists. |
| Operator gate | Do not treat as accepted until OP or HMC answers are recorded and synchronized through the runbook. |

## Surface Readiness

| Demo surface | Current readiness | Required fixture or proof | Blocking issue(s) | Demo rule |
|---|---|---|---|---|
| HUX-DEMO-001 Connection and Compatibility Center | Demo-ready fixture | `local-sidecar-compatible`, `single-tenant-compatible`, `hosted-compatible-admin`, `hosted-incompatible-version`, `hosted-unknown-capabilities`, `api-unreachable` | `Fortemi/HotM#244`; `Fortemi/fortemi#1018` | Show compatibility before advanced surfaces; unsupported or unknown enterprise metadata must disable enterprise controls. |
| HUX-DEMO-002 Hosted Auth Onboarding | Preview-only | `local-sidecar-compatible`, `hosted-compatible-admin`, `hosted-compatible-insufficient-role`; auth-failure fixture when implemented | `Fortemi/HotM#247`; `Fortemi/fortemi-auth#25` | Show local mode and hosted preview states; do not claim production hosted auth or admin authorization. |
| HUX-DEMO-003 Realtime Activity Drawer | Demo-ready fixture | `hosted-compatible-admin`, `api-unreachable`, replay-expired/resync fixture when implemented | `Fortemi/HotM#246` | Show sanitized connection, retry, stale, failed, empty, and activity states without raw payloads. |
| HUX-DEMO-004 Premium Components Catalog | Preview-only | `hosted-compatible-admin`, `hosted-compatible-insufficient-role`, `hosted-unknown-capabilities`, `preview-only-backoffice` | `Fortemi/HotM#248`; `Fortemi/fortemi#1020` | Show available, unavailable, license-required, admin-required, preview-only, and unknown states with coarse status only. |
| HUX-DEMO-005 Backoffice Console Preview | Preview-only | `hosted-compatible-admin`, `hosted-compatible-insufficient-role`, `preview-only-backoffice`, `hosted-unknown-capabilities` | `Fortemi/HotM#249`; `Fortemi/fortemi#1016`; `Fortemi/fortemi#1019`; `Fortemi/fortemi#1020`; `Fortemi-Enterprise/kms#2` | Show tenant health, audit, quota, KMS, and support diagnostics as disabled/degraded preview panels; production actions stay disabled. |
| HUX-DEMO-006 Sidecar provenance evidence callout | External gate | `release/sidecar-provenance.json`; `scripts/download-pinned-sidecar.sh`; future authenticated sidecar provenance Actions receipt | `Fortemi/HotM#245` | Local checksum proof may be mentioned as local preflight only; HUX-REQ-010 remains open until a live CI receipt exists. |
| HUX-DEMO-007 Hosted/mobile manifest launch boundary | External gate | `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs`; future hosted/gateway/CI proof | `Fortemi/HotM#251` | Local fixture proof may be shown as preflight; do not claim hosted/mobile production readiness without enforcement-layer evidence. |
| HUX-DEMO-008 Demo script and reviewer dry run | Operator gate | `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md`; accepted OP answers; completed signoff packet | `Fortemi/HotM#250` | Do not claim final demo acceptance until fixture rows, minimum command transcript, redaction-scan results, blocker classification, posted tracker receipt, and operator signoff are complete. |
| HUX-DEMO-009 Attachment projection claim boundary | External gate | `npm run test:realtime`; `ui/src/components/attachments/__tests__/AttachmentsPanel.test.tsx`; future Fortemi projection/export and React/browser parity receipts | `Fortemi/fortemi#1013`; `Fortemi/fortemi-react#227`; `roctinam/aiwg#1719` | Attachment realtime proof may be shown as sanitized UI progress only; do not claim binary extraction/search/index/export/embedding or React/browser parity readiness. |

## Operator Gates

| Gate | Current posture | Required action |
|---|---|---|
| OP-2026-07-001 through OP-2026-07-006 | Operator gate | Accept recommended defaults or provide replacement rows, then apply through `../../.aiwg/decisions/operator-decision-application-runbook-2026-07-06.md`; covers OP-2026-07-001 persona, OP-2026-07-002 deployment target, OP-2026-07-003 capability order, OP-2026-07-004 claim boundary, OP-2026-07-005 live CI caveat, and OP-2026-07-006 private registry posture. |
| HUX-REQ-012 final demo acceptance | Operator gate | Complete a dated dry-run receipt from `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md`, include the minimum command transcript and redaction-scan results, link the receipt from `Fortemi/HotM#250`, and synchronize signoff before claiming final demo acceptance. |
| HMC-2026-07-001 through HMC-2026-07-010 | Operator gate | Keep mobile/cloud follow-on answers separate from the immediate OP ballot; do not infer acceptance for unanswered HMC rows. |

## Minimum Dry-Run Command Set

Run these before a fixture-backed reviewer walkthrough:

- `npm run test:hux-traceability` from `HotM/ui`
- `npm run test:realtime` from `HotM/ui`
- `scripts/verify-manifest-launch-boundary.sh` from `HotM`
- `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs` from `HotM`
- `.aiwg/scripts/verify-hotm-ux-enterprise-plan.sh` from the suite root

## No-Claim Boundary

- Do not claim hosted multi-tenant production readiness while `Fortemi/fortemi#1016` remains open.
- Do not claim KMS readiness while `Fortemi/fortemi#1019` and `Fortemi-Enterprise/kms#2` remain open.
- Do not claim backoffice API readiness while `Fortemi/fortemi#1020` remains open.
- Do not claim live sidecar provenance while `Fortemi/HotM#245` lacks an authenticated Gitea Actions receipt.
- Do not claim hosted/mobile manifest launch readiness while `Fortemi/HotM#251` lacks hosted, gateway, or CI enforcement-layer proof.
- Do not claim final demo acceptance until OP answers, HotM signoff, the dated dry-run receipt, minimum command transcript, redaction-scan results, and `Fortemi/HotM#250` receipt link are synchronized.
- Do not claim binary attachment extraction, search/index, export, embedding, or React/browser parity readiness while `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, and `roctinam/aiwg#1719` remain open.

## Verification

This matrix is verified by the suite-root `.aiwg/scripts/verify-hotm-ux-enterprise-plan.sh` and summarized by the checkpoint handoff suite.
