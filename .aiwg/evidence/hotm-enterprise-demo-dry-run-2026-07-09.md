---
title: HotM Enterprise Demo Dry-Run Receipt
status: completed
date: 2026-07-09
artifact_type: test-receipt
related_artifacts:
  - HotM/.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md
  - HotM/.aiwg/testing/enterprise-demo-runbook-2026-07.md
  - HotM/.aiwg/testing/enterprise-demo-test-plan-2026-07.md
  - HotM/.aiwg/evidence/hotm-enterprise-demo-dry-run-2026-07-09-transcripts/
---

# HotM Enterprise Demo Dry-Run Receipt - 2026-07-09

## Receipt Header

| Field | Value |
|---|---|
| Dry-run date/time | 2026-07-09 12:14 EDT |
| Runner | Codex agent |
| HotM commit/build | `7265cb7a814b1be6986248b60b2ea329fc481d36` |
| Fortemi sidecar/API mode | fixture-backed preview |
| Fortemi sidecar/API version | fixture-only |
| Sidecar provenance checksum | fixture-only |
| Claim boundary | fixture-backed preview only |
| Operator decision source | OP-2026-07-001 through OP-2026-07-006 accepted receipts `Fortemi/HotM#243` `#81235` and `Fortemi/HotM#250` `#81236` |
| Tracker receipt | `Fortemi/HotM#250` comment `#81346` |
| Minimum command transcript | `HotM/.aiwg/evidence/hotm-enterprise-demo-dry-run-2026-07-09-transcripts/` |

## Minimum Command Evidence

| Command | Result | Transcript / artifact | Notes |
|---|---|---|---|
| `npm run test:hux-traceability` | pass | `HotM/.aiwg/evidence/hotm-enterprise-demo-dry-run-2026-07-09-transcripts/ui-test-hux-traceability.log` | Ran from `HotM/ui`; output: HUX traceability anchors present for HUX-REQ-001 through HUX-REQ-014. Initial root-level invocation is preserved in `test-hux-traceability.log` and failed with npm `ENOENT` because `HotM/package.json` does not exist. |
| `npm run test:realtime` | pass | `HotM/.aiwg/evidence/hotm-enterprise-demo-dry-run-2026-07-09-transcripts/ui-test-realtime.log` | Ran from `HotM/ui`; Vitest reported 5 files passed and 84 tests passed. Initial root-level invocation is preserved in `test-realtime.log` and failed with npm `ENOENT` because `HotM/package.json` does not exist. |
| `scripts/verify-manifest-launch-boundary.sh` | pass | `HotM/.aiwg/evidence/hotm-enterprise-demo-dry-run-2026-07-09-transcripts/verify-manifest-launch-boundary.log` | Manifest launch boundary check passed. |
| `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs` | pass | `HotM/.aiwg/evidence/hotm-enterprise-demo-dry-run-2026-07-09-transcripts/validate-manifest-launch-rate-limit-fixture.log` | Local fixture returned `ok: true` with `200`, `304`, `405`, `429`, `Retry-After`, cache-header non-bypass, and redacted telemetry evidence. This is not hosted/mobile production proof. |

## Fixture Results

| Fixture | HUX scenario(s) | Result | Evidence artifact | Blocker / issue if not pass |
|---|---|---|---|---|
| `local-sidecar-compatible` | HUX-DEMO-001 | pass | Minimum command transcript directory | none |
| `single-tenant-compatible` | HUX-DEMO-001 | pass | Minimum command transcript directory | none |
| `hosted-compatible-admin` | HUX-DEMO-001 through HUX-DEMO-005 | pass | Minimum command transcript directory | none |
| `hosted-compatible-insufficient-role` | HUX-DEMO-002, HUX-DEMO-004, HUX-DEMO-005 | pass | Minimum command transcript directory | none |
| `hosted-incompatible-version` | HUX-DEMO-001 | pass | Minimum command transcript directory | none |
| `hosted-unknown-capabilities` | HUX-DEMO-001, HUX-DEMO-004, HUX-DEMO-005 | pass | Minimum command transcript directory | none |
| `api-unreachable` | HUX-DEMO-001, HUX-DEMO-003 | pass | Minimum command transcript directory | none |
| `preview-only-backoffice` | HUX-DEMO-004, HUX-DEMO-005 | pass | Minimum command transcript directory | none |

## Surface Checks

| Surface | Required observation | Result | Notes |
|---|---|---|---|
| Connection and Compatibility Center | Deployment mode, version contract, capability state, disabled reasons, and safe next action are visible without developer tools. | pass | Covered by HUX traceability anchors and realtime regression suite. |
| Hosted Auth Onboarding | Local, unauthenticated, tenant-admin, insufficient-role, tenant-missing, and auth-failure states do not render tokens or raw provider diagnostics. | pass | Fixture-backed preview evidence only; hosted auth implementation proof remains external. |
| Realtime Activity Drawer | Connected, reconnecting, stale, failed, empty, and resync-required states are distinguishable and sanitized. | pass | `npm run test:realtime` passed. |
| Premium Components Catalog | Available, unavailable, license-required, admin-required, preview-only, and unknown states show coarse product status only. | pass | Covered by HUX traceability anchors and fixture-backed preview boundary. |
| Backoffice Console Preview | Tenant health, audit posture, quota status, KMS status, and support diagnostics panels keep production actions disabled unless all gates pass. | pass | Preview-only; production actions remain disabled until hosted evidence exists. |
| Manifest launch boundary | Hosted/mobile manifest discovery remains outside production-readiness claims until `Fortemi/HotM#251` has hosted/gateway/CI proof. | pass | `scripts/verify-manifest-launch-boundary.sh` passed; fixture proof does not close `Fortemi/HotM#251`. |

## Redaction Result

Redaction scan command:

```bash
rg -n -i "bearer|refresh token|oauth|authorization code|api[_ -]?key|client secret|sk-[a-z0-9]|password|tenant_id|kms|private package|registry token|stack trace" /tmp/hotm-dry-run-2026-07-09
```

The scan returned no matches across the dry-run transcripts.

| Redaction check | Result | Evidence |
|---|---|---|
| UI screenshots scanned for sensitive strings | not run | No screenshots were captured in this agent-run fixture-backed receipt. |
| Test logs scanned for sensitive strings | pass | Redaction scan returned no matches. |
| Console output scanned for sensitive strings | pass | Redaction scan returned no matches. |
| Fixture payloads reviewed for approved coarse values only | pass | Manifest fixture output contains only route/status/rate-limit/cache/redaction booleans. |

## Blocker Classification

| Finding | Classification | Tracker / next action |
|---|---|---|
| Hosted/mobile manifest launch-rate proof is still local fixture evidence only. | external gate | Keep `Fortemi/HotM#251` open until hosted/gateway/CI proof replaces the fixture. |
| HUX-REQ-010 live sidecar provenance CI receipt remains external. | external gate | Keep live Gitea CI receipt blocker open. |
| Hosted production RLS/KMS/authz/audit/backoffice evidence remains external. | external gate | Keep hosted production no-go boundary intact. |
| Private package registry publish/consume proof or accepted fallback remains external. | external gate | Keep registry gate open. |

## Verdict

Final verdict: `pass for fixture-backed preview`

This receipt records successful fixture-backed preview evidence for HUX-REQ-012 dry-run execution. It does not close hosted/mobile production readiness, `Fortemi/HotM#251`, live CI, private registry, public/legal claims, binary parity/export, or suite graph proof.
