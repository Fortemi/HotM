---
title: HotM Enterprise Demo Requirements
status: draft
date: 2026-07-06
artifact_type: requirements
related_artifacts:
  - .aiwg/planning/enterprise-demo-scenarios-2026-07.md
  - .aiwg/architecture/adr/ADR-009-enterprise-capability-driven-ux.md
  - .aiwg/design/enterprise-demo-screen-state-blueprint-2026-07.md
  - .aiwg/architecture/fortemi-compatibility-consumption-2026-07.md
  - .aiwg/testing/enterprise-demo-runbook-2026-07.md
  - .aiwg/testing/enterprise-demo-test-plan-2026-07.md
---

# HotM Enterprise Demo Requirements

These requirements scope the tenant-admin enterprise demo slice for HotM. Until the operator chooses otherwise through `.aiwg/decisions/operator-decision-ballot-2026-07-06.md`, the demo target is local sidecar plus hosted preview metadata and the claim boundary is fixture-backed preview only. The requirements are intentionally capability-driven: HotM may implement preview and degraded states before backend enterprise contracts are production-ready, but it must not imply unavailable backend capabilities are shipped.

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| HUX-REQ-001 | HotM must expose a Connection and Compatibility Center before enabling enterprise flows. | P0 | Component test covers compatible, incompatible, unknown, and unreachable endpoint states. |
| HUX-REQ-002 | HotM must distinguish local sidecar, single-tenant server, hosted multi-tenant, and unavailable modes. | P0 | API metadata fixture tests map each deployment mode to visible UI state. |
| HUX-REQ-003 | Enterprise and backoffice controls must be enabled only from Fortemi capability/version metadata plus auth role/scope state. | P0 | Tests prove unknown capability, insufficient role, missing license, and incompatible API version all disable controls with reason text. |
| HUX-REQ-004 | HotM must preserve local/private workflows when enterprise APIs are absent. | P0 | Regression test confirms note/search/local workflows remain available while enterprise surfaces are disabled. |
| HUX-REQ-005 | Hosted Auth Onboarding must clearly separate local mode, hosted sign-in, tenant context, and sign-in failure states. | P1 | Auth-state tests cover unauthenticated, authenticating, authenticated tenant admin, authenticated insufficient role, and auth failure. |
| HUX-REQ-006 | Realtime Activity Drawer must show connection state, last event time, retry state, event category, and user-visible errors. | P1 | Component tests cover connected, reconnecting, stale, failed, empty, and redacted event states. |
| HUX-REQ-007 | Premium Components Catalog must show available, unavailable, license-required, admin-required, and preview-only states. | P1 | Fixture tests cover every capability state and verify no sensitive license/config values are displayed. |
| HUX-REQ-008 | Backoffice Console preview must show tenant health, audit posture, quota status, KMS status, and support diagnostics as capability-gated panels. | P1 | Panel tests cover enabled, disabled, degraded, and preview states for each panel. |
| HUX-REQ-009 | Production-affecting backoffice actions must remain disabled unless capability, role, backend contract, and audit requirements are satisfied. | P0 | Tests assert action buttons are disabled for preview fixtures and include blocking reasons. |
| HUX-REQ-010 | Demo builds must pin Fortemi sidecar/API provenance by upstream commit and checksum. | P0 | CI or release test verifies pinned commit/checksum metadata exists and workflow downloads are verified against `release/sidecar-provenance.json`; `sidecar-latest` may only be used as a transport URL, not as the authoritative version. Local checksum proof is partial until a live Gitea Actions receipt exists or OP-2026-07-005 changes the requirement. |
| HUX-REQ-011 | Enterprise demo telemetry and UI logs must not expose credentials, bearer tokens, tenant secrets, KMS key IDs beyond approved coarse status, or raw license material. | P0 | Redaction tests inspect rendered events/log payloads for sensitive fixture values. |
| HUX-REQ-012 | The tenant-admin demo path must be reproducible from a documented script with expected states and known blockers. | P1 | Demo runbook review, accepted operator signoff, completed dated dry-run receipt with minimum command transcript, redaction-scan results, blocker classification, and `Fortemi/HotM#250` receipt link, plus OP-2026-07-001 through OP-2026-07-006 answers recorded in the suite ballot. |
| HUX-REQ-013 | Hosted/mobile manifest discovery must stay out of production-readiness claims until unauthenticated `GET /v1/manifest` launch-rate proof exists. | P0 | `scripts/verify-manifest-launch-boundary.sh` confirms the manifest contract still identifies the provisional 60 requests/minute value and `Fortemi/HotM#251` tracks launch baseline, enforcement layer, `429`, `Retry-After`, cache/ETag, and non-bypass proof. |
| HUX-REQ-014 | Attachment realtime UI evidence must stay separate from Fortemi binary projection/export readiness claims. | P0 | `npm run test:realtime` may prove sanitized attachment progress UI regressions, but demo copy and receipts must keep Fortemi binary extraction/search/index/export/embedding and React/browser parity blocked until `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, and `roctinam/aiwg#1719` close with issue acceptance and CI evidence. |

## Screen-State Blueprint

`HotM/.aiwg/design/enterprise-demo-screen-state-blueprint-2026-07.md` is the implementation handoff for screen structure, navigation placement, state families, fixture matrix, and disabled-control rules. `HotM/.aiwg/testing/enterprise-demo-runbook-2026-07.md` is the manual/demo execution handoff for HUX-REQ-012.

`HotM/.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` is the evidence-capture template for HUX-REQ-012. Completed receipts must include the minimum command transcript, redaction-scan results, blocker classification, and `Fortemi/HotM#250` receipt link, must classify each finding as a HotM defect, backend blocker, fixture gap, operator-decision gap, or claim-boundary issue, and must not convert fixture-backed preview evidence into hosted production readiness.

## Compatibility Contract

`HotM/.aiwg/architecture/fortemi-compatibility-consumption-2026-07.md` defines the client-side normalization and enablement rules for the Fortemi compatibility response. The paired Fortemi-side contract is `fortemi/.aiwg/architecture/api-compatibility-discovery-contract-2026-07.md`.

## Scope Boundary

In scope:

- Tenant-admin demo UX and non-production preview states.
- Capability/version contract consumption once `Fortemi/fortemi#1018` exists.
- Compatibility, auth, realtime, premium catalog, and backoffice panel state modeling.

Out of scope for this artifact:

- Production hosted multi-tenant enablement.
- Implementing Fortemi backend RLS, KMS, audit sinks, RBAC, or package registry flow.
- Claims that premium components are available before capability metadata and licensing gates exist.
- Public or internal demo claims beyond the OP-2026-07-004 fixture-backed preview boundary.
- Hosted mobile/cloud or public backoffice production-readiness claims for unauthenticated manifest discovery before `Fortemi/HotM#251` closes.
- Fortemi binary attachment extraction, search/index, export, embedding, or React/browser parity claims before `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, and `roctinam/aiwg#1719` close.

## Operator Decision Dependencies

| Decision | Requirement impact |
|---|---|
| OP-2026-07-001 | Selects the first demo persona. |
| OP-2026-07-002 | Selects the first demo deployment target. |
| OP-2026-07-003 | Selects the first demo capability priority order. |
| OP-2026-07-004 | Controls the fixture-backed preview claim boundary. |
| OP-2026-07-005 | Controls whether HUX-REQ-010 can keep the live CI receipt as an open caveat. |
| OP-2026-07-006 | Controls the private package registry posture and any fallback assumption. |

## Backend Blocker References

| Blocker | Requirement impact |
|---|---|
| `Fortemi/fortemi#1016` | Hosted multi-tenant production must remain unavailable while RLS is incomplete. |
| `Fortemi/fortemi#1018` | Compatibility metadata contract for HUX-REQ-001 through HUX-REQ-003. |
| `Fortemi/fortemi#1019` | KMS status and KMS-dependent backoffice panels for HUX-REQ-008 and HUX-REQ-009. |
| `Fortemi/fortemi#1020` | Backoffice API contract for premium/backoffice preview panels. |
| `Fortemi/fortemi-auth#25` | Hosted auth/session contract for HUX-REQ-005. |
| `Fortemi/HotM#244` | HotM compatibility guard implementation. |
| `Fortemi/HotM#245` | Sidecar provenance gate for HUX-REQ-010. |
| `Fortemi/HotM#246` | Realtime activity UX for HUX-REQ-006. |
| `Fortemi/HotM#247` | Hosted auth preview and redaction coverage for HUX-REQ-005 and HUX-REQ-011. |
| `Fortemi/HotM#248` | Premium Components Catalog for HUX-REQ-007 and HUX-REQ-011. |
| `Fortemi/HotM#249` | Backoffice Console Preview for HUX-REQ-008, HUX-REQ-009, and HUX-REQ-011. |
| `Fortemi/HotM#250` | Demo fixture/runbook/signoff work for HUX-REQ-012. |
| `Fortemi/HotM#251` | Hosted/mobile manifest endpoint launch-rate-limit proof for HUX-REQ-013; this is a production-claim blocker, not a fixture-backed preview blocker. |
| `Fortemi-Enterprise/kms#2` | Enterprise KMS implementation evidence before KMS can move beyond preview/unavailable. |
| `Fortemi/fortemi#1013` | Fortemi binary attachment projection contract before attachment data can be claimed ready for search/index/export/embedding surfaces. |
| `Fortemi/fortemi-react#227` | React/browser binary parity companion that remains blocked until the Fortemi projection contract closes. |
| `roctinam/aiwg#1719` | AIWG binary inline/export crash companion that remains blocked until the projection boundary is accepted or explicitly scoped out. |

## Traceability

| Requirement | Scenario | Issue |
|---|---|---|
| HUX-REQ-001, HUX-REQ-002, HUX-REQ-003 | HUX-DEMO-001 | `Fortemi/HotM#244`, `Fortemi/fortemi#1018`; compatibility contract artifacts above |
| HUX-REQ-005 | HUX-DEMO-002 | `Fortemi/HotM#247`, `Fortemi/fortemi-auth#25` |
| HUX-REQ-006 | HUX-DEMO-003 | `Fortemi/HotM#246` |
| HUX-REQ-007 | HUX-DEMO-004 | `Fortemi/HotM#248`, `Fortemi/fortemi#1020` |
| HUX-REQ-008, HUX-REQ-009 | HUX-DEMO-005 | `Fortemi/HotM#249`, `Fortemi/fortemi#1020` |
| HUX-REQ-010 | All scenarios | `Fortemi/HotM#245` |
| HUX-REQ-011 | All scenarios | `Fortemi/HotM#247`, `Fortemi/HotM#248`, `Fortemi/HotM#249`, `Fortemi/HotM#250` |
| HUX-REQ-012 | All scenarios | `Fortemi/HotM#250` |
| HUX-REQ-013 | Production claim boundary | `Fortemi/HotM#251`; `HotM/.aiwg/architecture/manifest-schema-v1.md`; `HotM/.aiwg/issues/checkpoint-issue-drafts-2026-07.md` |
| HUX-REQ-014 | Attachment projection claim boundary | `Fortemi/fortemi#1013`; `Fortemi/fortemi-react#227`; `roctinam/aiwg#1719`; `HotM/ui/src/components/attachments/__tests__/AttachmentsPanel.test.tsx` |
