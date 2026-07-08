---
title: HotM Enterprise Demo Dry-Run Receipt Template
status: draft
date: 2026-07-07
artifact_type: test-receipt-template
related_artifacts:
  - .aiwg/testing/enterprise-demo-runbook-2026-07.md
  - .aiwg/testing/enterprise-demo-test-plan-2026-07.md
  - .aiwg/design/enterprise-demo-screen-state-blueprint-2026-07.md
  - .aiwg/requirements/enterprise-demo-requirements-2026-07.md
---

# HotM Enterprise Demo Dry-Run Receipt Template - 2026-07

## Purpose

Capture one repeatable fixture-backed HotM enterprise demo dry run without converting preview evidence into hosted production readiness. This template is the receipt shape for HUX-REQ-012 and should be copied into a dated receipt under `.aiwg/evidence/` after each operator or reviewer dry run.

## Acceptance Preconditions

A completed receipt can support HUX-REQ-012 acceptance only when all of the following are true:

- OP-2026-07-001 through OP-2026-07-006 have accepted rows in the suite operator ballot and are mirrored into the HotM signoff packet.
- The dated receipt is stored as `HotM/.aiwg/evidence/hotm-enterprise-demo-dry-run-YYYY-MM-DD.md`.
- The receipt is linked from `Fortemi/HotM#250` with the tracker comment ID recorded in the header below.
- The Minimum command set transcript is captured or linked, including `npm run test:hux-traceability`, `npm run test:realtime`, `scripts/verify-manifest-launch-boundary.sh`, and `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs`.
- Redaction checks pass for screenshots, logs, console output, and fixture payloads before the receipt is used for signoff.

The template itself, screenshots without this completed receipt, or a receipt whose final verdict is `blocked by external gate` or `fail` must not close HUX-REQ-012.

## Receipt Header

| Field | Value |
|---|---|
| Dry-run date/time | `YYYY-MM-DD HH:MM TZ` |
| Runner | `name or role` |
| HotM commit/build | `commit SHA or build ID` |
| Fortemi sidecar/API mode | `fixture-only`, `local sidecar`, `single-tenant server`, or `hosted preview metadata` |
| Fortemi sidecar/API version | `version or fixture label` |
| Sidecar provenance checksum | `sha256 or fixture-only` |
| Claim boundary | `fixture-backed preview only` unless OP-2026-07-004 says otherwise |
| Operator decision source | OP-2026-07-001 through OP-2026-07-006 ballot row IDs or accepted receipt |
| Tracker receipt | `Fortemi/HotM#250` comment ID or `not posted` |
| Minimum command transcript | `path to redacted transcript or CI artifact` |

## Minimum Command Evidence

| Command | Result | Transcript / artifact | Notes |
|---|---|---|---|
| `npm run test:hux-traceability` | `pass / fail / blocked / not run` | `path` | HUX anchor and traceability check. |
| `npm run test:realtime` | `pass / fail / blocked / not run` | `path` | Realtime activity, event bus, API stream, shell drawer, and attachment regressions. |
| `scripts/verify-manifest-launch-boundary.sh` | `pass / fail / blocked / not run` | `path` | Keeps HUX-REQ-013 production-claim boundary explicit. |
| `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs` | `pass / fail / blocked / not run` | `path` | Local fixture preflight only; not hosted/mobile production proof. |

## Fixture Results

| Fixture | HUX scenario(s) | Result | Evidence artifact | Blocker / issue if not pass |
|---|---|---|---|---|
| `local-sidecar-compatible` | HUX-DEMO-001 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |
| `single-tenant-compatible` | HUX-DEMO-001 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |
| `hosted-compatible-admin` | HUX-DEMO-001 through HUX-DEMO-005 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |
| `hosted-compatible-insufficient-role` | HUX-DEMO-002, HUX-DEMO-004, HUX-DEMO-005 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |
| `hosted-incompatible-version` | HUX-DEMO-001 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |
| `hosted-unknown-capabilities` | HUX-DEMO-001, HUX-DEMO-004, HUX-DEMO-005 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |
| `api-unreachable` | HUX-DEMO-001, HUX-DEMO-003 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |
| `preview-only-backoffice` | HUX-DEMO-004, HUX-DEMO-005 | `pass / fail / blocked / not run` | `screenshot/log path` | `issue or none` |

## Surface Checks

| Surface | Required observation | Result | Notes |
|---|---|---|---|
| Connection and Compatibility Center | Deployment mode, version contract, capability state, disabled reasons, and safe next action are visible without developer tools. | `pass / fail / blocked / not run` | |
| Hosted Auth Onboarding | Local, unauthenticated, tenant-admin, insufficient-role, tenant-missing, and auth-failure states do not render tokens or raw provider diagnostics. | `pass / fail / blocked / not run` | |
| Realtime Activity Drawer | Connected, reconnecting, stale, failed, empty, and resync-required states are distinguishable and sanitized. | `pass / fail / blocked / not run` | |
| Premium Components Catalog | Available, unavailable, license-required, admin-required, preview-only, and unknown states show coarse product status only. | `pass / fail / blocked / not run` | |
| Backoffice Console Preview | Tenant health, audit posture, quota status, KMS status, and support diagnostics panels keep production actions disabled unless all gates pass. | `pass / fail / blocked / not run` | |
| Manifest launch boundary | Hosted/mobile manifest discovery remains outside production-readiness claims until `Fortemi/HotM#251` has hosted/gateway/CI proof. | `pass / fail / blocked / not run` | |

## Redaction Result

The dry run fails if screenshots, logs, console output, exported artifacts, or fixture payloads contain any of:

- Bearer tokens, refresh tokens, OAuth authorization codes, API keys, or client secrets.
- Tenant secrets or raw tenant identifiers beyond approved display name/class.
- Raw license material, entitlement tokens, or private package registry credentials.
- KMS key IDs, key fingerprints, envelope metadata beyond coarse status, or provider resource names.
- Note bodies, prompt text, file paths, support bundle contents, raw stack traces, or provider diagnostics.

| Redaction check | Result | Evidence |
|---|---|---|
| UI screenshots scanned for sensitive strings | `pass / fail / not run` | `path or command` |
| Test logs scanned for sensitive strings | `pass / fail / not run` | `path or command` |
| Console output scanned for sensitive strings | `pass / fail / not run` | `path or command` |
| Fixture payloads reviewed for approved coarse values only | `pass / fail / not run` | `path or command` |

## Blocker Classification

| Finding | Classification | Tracker / next action |
|---|---|---|
| `example` | `HotM defect / backend blocker / fixture gap / operator-decision gap / claim-boundary issue` | `issue or artifact path` |

Allowed open blockers for the current checkpoint remain:

- OP-2026-07-001 through OP-2026-07-006 pending operator answers.
- HUX-REQ-010 live Gitea sidecar provenance receipt.
- HUX-REQ-013 hosted/mobile manifest launch-rate hosted/gateway/CI proof.
- Hosted production RLS/KMS/authz/audit/backoffice implementation evidence.
- Private package registry publish/consume proof or accepted OP-2026-07-006 fallback.

## Verdict

| Verdict | Meaning |
|---|---|
| `pass for fixture-backed preview` | HUX-DEMO-001 through HUX-DEMO-005 behaved as expected, redaction passed, and only known checkpoint blockers remain. |
| `blocked by external gate` | Demo path is valid, but required operator, CI, hosted, registry, or legal evidence is absent. |
| `fail` | A HotM UX, redaction, local-mode regression, or claim-boundary defect was found and needs a tracked fix. |

Final verdict: `pass for fixture-backed preview / blocked by external gate / fail`
