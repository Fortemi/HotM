---
title: HotM Enterprise Demo Test Plan
status: draft
date: 2026-07-06
artifact_type: test-plan-addendum
related_artifacts:
  - .aiwg/requirements/enterprise-demo-requirements-2026-07.md
  - .aiwg/planning/enterprise-demo-scenarios-2026-07.md
  - .aiwg/architecture/adr/ADR-009-enterprise-capability-driven-ux.md
  - .aiwg/architecture/fortemi-compatibility-consumption-2026-07.md
  - .aiwg/design/enterprise-demo-screen-state-blueprint-2026-07.md
  - .aiwg/testing/enterprise-demo-runbook-2026-07.md
  - .aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md
---

# HotM Enterprise Demo Test Plan

## Objective

Verify that the HotM tenant-admin enterprise demo can be designed and implemented without overstating backend readiness. The test strategy focuses on capability metadata, disabled/degraded states, redaction, and reproducible demo behavior.

## Test Fixtures

The fixture matrix in `.aiwg/design/enterprise-demo-screen-state-blueprint-2026-07.md` is authoritative for cross-surface expectations. This test plan adds the coverage expectations for those fixtures.

| Fixture | Purpose |
|---|---|
| `local-sidecar-compatible` | Local/private workflows available; enterprise controls disabled with local-mode reason. |
| `single-tenant-compatible` | Authenticated server mode with limited enterprise capabilities. |
| `hosted-compatible-admin` | Tenant admin with all preview capabilities advertised. |
| `hosted-compatible-insufficient-role` | Authenticated user without admin scopes. |
| `hosted-incompatible-version` | Fortemi version below HotM enterprise-demo minimum. |
| `hosted-unknown-capabilities` | Version known, enterprise capability metadata absent. |
| `api-unreachable` | Endpoint/network failure. |
| `preview-only-backoffice` | Backoffice panels visible but production actions disabled. |

## Required Test Coverage

| Area | Required checks |
|---|---|
| Compatibility center | Endpoint, version, deployment mode, capability set, unavailable reason, refresh behavior, and unknown metadata handling. |
| Auth onboarding | Unauthenticated, authenticating, authenticated tenant admin, insufficient role, tenant-context missing, and auth failure states. |
| Realtime drawer | Connected, reconnecting, stale, failed, empty, event categories, retry copy, last-event timestamp, and redaction. |
| Premium catalog | Available, unavailable, license-required, admin-required, preview-only, and unknown states. |
| Backoffice console | Tenant health, audit posture, quota status, KMS status, support diagnostics, disabled actions, and missing backend contract links. |
| Provenance | Demo build uses pinned sidecar/API commit and checksum; workflow downloads verify against `release/sidecar-provenance.json`, and `sidecar-latest` is only a transport URL. |
| Privacy/security | Rendered UI and logged event fixtures do not expose tokens, tenant secrets, raw license material, or sensitive KMS identifiers. |
| Manifest launch boundary | Hosted/mobile manifest discovery production claims stay blocked until the unauthenticated `GET /v1/manifest` endpoint has launch baseline, enforcement-layer, `429`, `Retry-After`, cache/ETag, and non-bypass proof attached to `Fortemi/HotM#251`. |
| Manifest launch proof plan | `HotM/.aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md` defines the required launch baseline, burst policy, enforcement layer, identity key, replacement or justification for the provisional `60 requests/minute` value, cache/ETag behavior, `429 Too Many Requests`, `Retry-After`, `Cache-Control`, non-bypass proof, and observability evidence before `Fortemi/HotM#251` can close. |
| Binary attachment projection boundary | Attachment realtime fixtures may prove sanitized upload/extraction progress UI, but must not be used as Fortemi binary extraction/search/index/export/embedding or React/browser parity proof before `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, and `roctinam/aiwg#1719` close. |
| Dry-run receipt | Each manual or reviewer dry run uses `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` and records fixture results, surface observations, the minimum command transcript, redaction scan results, blocker classifications, a `Fortemi/HotM#250` tracker receipt link, and a verdict that cannot overstate hosted production readiness. |

## Requirement ID Coverage Map

| Requirement | Primary test-plan area | Tracker/blocker references |
|---|---|---|
| HUX-REQ-001 | Compatibility center | `Fortemi/HotM#244`, `Fortemi/fortemi#1018` |
| HUX-REQ-002 | Compatibility center | `Fortemi/HotM#244`, `Fortemi/fortemi#1018` |
| HUX-REQ-003 | Compatibility center; Premium catalog; Backoffice console | `Fortemi/HotM#244`, `Fortemi/fortemi#1018`, `Fortemi/fortemi#1020` |
| HUX-REQ-004 | Compatibility center; local workflow regression | `Fortemi/HotM#244` |
| HUX-REQ-005 | Auth onboarding | `Fortemi/HotM#247`, `Fortemi/fortemi-auth#25` |
| HUX-REQ-006 | Realtime drawer | `Fortemi/HotM#246` |
| HUX-REQ-007 | Premium catalog | `Fortemi/HotM#248`, `Fortemi/fortemi#1020` |
| HUX-REQ-008 | Backoffice console | `Fortemi/HotM#249`, `Fortemi/fortemi#1019`, `Fortemi/fortemi#1020`, `Fortemi-Enterprise/kms#2` |
| HUX-REQ-009 | Backoffice console disabled-action gate | `Fortemi/HotM#249`, `Fortemi/fortemi#1016`, `Fortemi/fortemi#1019`, `Fortemi/fortemi#1020` |
| HUX-REQ-010 | Provenance | `Fortemi/HotM#245` |
| HUX-REQ-011 | Privacy/security redaction | `Fortemi/HotM#247`, `Fortemi/HotM#248`, `Fortemi/HotM#249`, `Fortemi/HotM#250` |
| HUX-REQ-012 | Manual/demo runbook and fixture smoke | `Fortemi/HotM#250` |
| HUX-REQ-013 | Manifest launch boundary | `Fortemi/HotM#251` |
| HUX-REQ-014 | Binary attachment projection boundary | `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, `roctinam/aiwg#1719` |

## Suggested Test Types

- Unit tests for compatibility metadata normalization.
- React Testing Library component tests for each UI surface state.
- API-client tests for version/capability endpoint parsing once `Fortemi/fortemi#1018` defines the contract.
- Contract-shape tests against `fortemi/.aiwg/architecture/api-compatibility-discovery-contract-2026-07.md` once the endpoint implementation lands.
- E2E smoke test for HUX-DEMO-001 through HUX-DEMO-005 with fixture-backed API responses.
- Static check for demo sidecar provenance metadata.

## Current Automated Coverage

| Date | Coverage | Evidence |
|---|---|---|
| 2026-07-06 | Compatibility endpoint parsing normalizes future/malformed capability states to `unknown`. | `npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx --run` |
| 2026-07-06 | API Surface tab renders compatibility contract metadata and falls back to legacy health when compatibility discovery is unreachable. | Same focused test command. |
| 2026-07-06 | Compatibility discovery can be absent while enterprise actions remain gated and local admin workflows remain reachable through Document Types and Webhooks. | `npm run test -- src/components/admin/__tests__/AdminPanel.test.tsx --run` |
| 2026-07-06 | Local note search remains usable when enterprise compatibility discovery is absent: SearchPage renders a local note result and selection returns the note ID without calling compatibility discovery. | `npm run test -- src/components/search/__tests__/SearchPage.test.tsx --run` |
| 2026-07-06 | Enterprise Preview renders premium/backoffice surfaces with production disabled for `unknown`, missing, `preview`, and `unavailable` states. | Same focused test command plus `npm run typecheck`. |
| 2026-07-06 | Hosted Auth Preview renders local mode, hosted tenant-admin, insufficient-role, auth-failure, and compatibility-unavailable states without exposing tokens or raw provider diagnostics. | `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Premium Components Catalog renders available, unavailable, license-required, admin-required, preview-only, and unknown states with gated actions and no raw license/registry/KMS strings. | `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Backoffice Console Preview renders tenant health, audit posture, quota status, KMS status, and support diagnostics with disabled production actions, RLS/KMS blockers, and redaction checks. | `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Desktop and mobile browser smoke renders the current API Surface enterprise demo path: Enterprise Preview, Hosted Auth Preview, Premium Components Catalog, and Backoffice Console Preview. | `npx playwright test e2e/tests/enterprise-preview.spec.ts --project=e2e-mocked`; screenshots recorded under `.aiwg/evidence/`. |
| 2026-07-06 | Sidecar provenance manifest parses and Linux sidecar checksum verification succeeds. | `node -e "...release/sidecar-provenance.json..."`; `scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-provenance-check`. |
| 2026-07-06 | HUX-REQ-010 live CI receipt remains blocked by missing token-based Gitea Actions access and local workflow changes not proven by remote Actions; required receipt fields are documented. | `.aiwg/supply-chain/sidecar-provenance-live-ci-evidence-2026-07-06.md`; suite-root `.aiwg/scripts/check-gitea-actions-live-evidence-preflight.sh` returned blocked while confirming local HotM provenance, workflow YAML parse, and HUX checks pass. |
| 2026-07-06 | HUX-REQ-012 operator signoff packet, dry-run receipt template, and suite ballot added for demo persona, target, priority, claim boundary, sidecar CI caveat, and registry posture acceptance. | `.aiwg/testing/enterprise-demo-operator-signoff-2026-07-06.md`; `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md`; `../.aiwg/decisions/operator-decision-ballot-2026-07-06.md` |
| 2026-07-06 | Realtime activity classification and redaction cover job, replay-expired, event-lagged, and admin/provider-change events. | `npm run test:realtime`; `npm run typecheck`. |
| 2026-07-06 | Persistent shell Activity button opens the sanitized realtime drawer from `HallOfMind`. | `npm run test:realtime`; `npm run typecheck`. |
| 2026-07-06 | Initial direct HUX requirement anchors existed for HUX-REQ-001 through HUX-REQ-012 and were wired into the UI quality gate; current scope is extended by the 2026-07-07 HUX-REQ-013 row below. | `npm run test:hux-traceability`; `.gitea/workflows/ui-ci.yml`; `scripts/verify-hux-traceability.sh`. |
| 2026-07-07 | Hosted/mobile manifest discovery launch boundary is anchored to HUX-REQ-013 and the filed `Fortemi/HotM#251` production-claim blocker. | `scripts/verify-manifest-launch-boundary.sh`; `scripts/verify-hux-traceability.sh`; `HotM/.aiwg/issues/checkpoint-issue-drafts-2026-07.md`. |
| 2026-07-07 | Local manifest launch-rate fixture proves expected `200`, `304`, `405`, and `429` semantics, `Retry-After`, cache-header non-bypass, and redacted telemetry for the contract. This is local preflight evidence only and does not close `Fortemi/HotM#251` without hosted/gateway/CI proof. | `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs`; `scripts/verify-manifest-launch-boundary.sh`; suite-root `.aiwg/scripts/verify-hotm-manifest-launch-rate-proof-plan.sh`. |
| 2026-07-08 | Attachment realtime regressions prove sanitized UI progress only; they do not close Fortemi binary extraction, search/index, export, embedding, or React/browser parity. | `npm run test:realtime`; `ui/src/components/attachments/__tests__/AttachmentsPanel.test.tsx`; `Fortemi/fortemi#1013`; `Fortemi/fortemi-react#227`; `roctinam/aiwg#1719`. |

## Exit Criteria

- HUX-REQ-001 through HUX-REQ-014 have at least one mapped test, verifier, or explicitly documented backend blocker.
- Unknown backend capability state always disables enterprise controls.
- Local sidecar workflows remain usable when enterprise metadata is absent.
- Demo script can be run from a clean checkout with fixture-backed API responses.
- OP-2026-07-001 through OP-2026-07-006 are answered or explicitly accepted as open blockers.
- The test run produces a clear blocker list for backend-dependent states rather than failing ambiguously.
- Manual or reviewer demo evidence is captured in the dry-run receipt format, stored under `.aiwg/evidence/`, and linked from `Fortemi/HotM#250` with minimum command transcript and redaction-scan results.

## Traceability Maintenance

Current HotM tests, sidecar provenance scripts, manifest launch-boundary scripts, and attachment realtime tests embed `HUX-REQ-*` identifiers for HUX-REQ-001 through HUX-REQ-014. The authoritative requirement-to-test mapping remains the suite-root `.aiwg/reports/hotm-enterprise-demo-traceability-2026-07-06.md` report plus the coverage table above. Future HotM demo test changes should keep the relevant `HUX-REQ-*` ID in the test description/comment or update the traceability report in the same change. Run `scripts/verify-hux-traceability.sh` from the repo root or `npm run test:hux-traceability` from `ui/` before closing HotM demo traceability changes; the UI quality-gate workflow runs the npm script.

## Backend Blockers To Represent As Test Fixtures

| Backend blocker | Related issue | Required HotM behavior |
|---|---|---|
| Version/capability endpoint absent | `Fortemi/fortemi#1018`; `fortemi/.aiwg/architecture/api-compatibility-discovery-contract-2026-07.md` | Show unknown capability state and disable enterprise controls. |
| Hosted auth not implemented | `Fortemi/fortemi-auth#25` | Keep hosted auth as unavailable/preview; local mode remains usable. |
| RLS not implemented | `Fortemi/fortemi#1016` | Do not show hosted multi-tenant production-ready state. |
| KMS not implemented | `Fortemi/fortemi#1019` | Show KMS panel unavailable or preview-only. |
| Backoffice API contract absent | `Fortemi/fortemi#1020` | Show disabled panels with backend contract blocker links. |
| Sidecar provenance not pinned | `Fortemi/HotM#245` | Demo release gate fails. |
| Manifest launch-rate proof absent | `Fortemi/HotM#251` | Keep hosted/mobile manifest discovery out of production-readiness claims; fixture-backed enterprise preview remains allowed. |
| Binary attachment projection/export contract absent | `Fortemi/fortemi#1013`; `Fortemi/fortemi-react#227`; `roctinam/aiwg#1719` | Keep attachment realtime UI proof scoped to sanitized progress display; do not claim binary extraction/search/index/export/embedding or React/browser parity. |

## Manual Demo Dry-Run Checklist

Use `.aiwg/testing/enterprise-demo-runbook-2026-07.md` as the authoritative manual dry-run procedure. The checklist below is the minimum smoke pass.

- Open the Connection and Compatibility Center.
- Confirm deployment mode and capability state are visible without developer tools.
- Confirm enterprise controls are disabled with reason text for unsupported fixtures.
- Confirm tenant-admin fixture enables preview surfaces only.
- Open Realtime Activity Drawer and verify connection/retry/error states.
- Open Premium Components Catalog and verify coarse status only.
- Open Backoffice Console and verify production actions remain disabled until backend gates are satisfied.
