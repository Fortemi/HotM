# HotM Enterprise Demo Runbook - 2026-07

## Purpose

Provide a reproducible manual and fixture-backed runbook for the HotM enterprise demo path. This runbook covers HUX-DEMO-001 through HUX-DEMO-005 and keeps backend blockers explicit instead of letting missing enterprise services appear as ambiguous demo failures.

## Status

- Status: draft
- Primary tracker: `Fortemi/HotM#250`
- Parent plan: `Fortemi/HotM#243`
- Persona default: tenant admin until the operator decides otherwise.
- Deployment target default: local sidecar plus hosted preview metadata until the operator decides otherwise.
- Demo priority default: compatibility center, hosted auth, realtime activity, premium catalog, backoffice preview.

## Preconditions

| Area | Required before dry run | Blocking issue if absent |
|---|---|---|
| HotM fixture mode | A fixture-backed API layer or test harness can provide the fixture payloads named below. | `Fortemi/HotM#250` |
| Compatibility metadata | HotM can parse version/deployment/capability metadata or render unknown capability state. | `Fortemi/HotM#244`, `Fortemi/fortemi#1018` |
| Hosted auth state | HotM can model local, unauthenticated, tenant admin, insufficient role, and auth failure states. | `Fortemi/HotM#247`, `Fortemi/fortemi-auth#25` |
| Realtime events | HotM can render sanitized SSE/job/MCP activity states from fixtures. | `Fortemi/HotM#246` |
| Premium/backoffice state | HotM can render preview and disabled states without production backend support. | `Fortemi/HotM#248`, `Fortemi/HotM#249`, `Fortemi/fortemi#1020` |
| Sidecar provenance | Demo build records a pinned sidecar/API version and checksum or explicitly runs fixture-only. | `Fortemi/HotM#245` |
| Manifest launch boundary | Hosted/mobile manifest discovery stays outside production-readiness claims until the unauthenticated `GET /v1/manifest` launch baseline and rate-limit proof are accepted. | `Fortemi/HotM#251` |
| Binary attachment projection boundary | Attachment realtime fixtures may demonstrate sanitized upload/extraction progress UI only. Binary extraction/search/index/export/embedding and React/browser parity remain outside the HotM demo claim. | `Fortemi/fortemi#1013`; `Fortemi/fortemi-react#227`; `roctinam/aiwg#1719` |

Checkpoint note, 2026-07-06: the first compatibility guard is now wired into `ApiCapabilitiesPanel`. It consumes `api.systemCompatibility.get()`, renders contract/deployment/auth metadata when present, treats `unknown`, `preview`, and `unavailable` capability states as non-production states, and falls back to legacy health metadata when the endpoint is unreachable.

Enterprise Preview note, 2026-07-06: `ApiCapabilitiesPanel` now renders a first premium/backoffice preview section for hosted auth, realtime activity, premium components, backoffice console, audit posture, quota status, KMS status, and MCP scope gate. Every surface shows capability state and reason code, and production status remains disabled unless the Fortemi compatibility state is `available`.

Hosted Auth Preview note, 2026-07-06: `ApiCapabilitiesPanel` now renders a dedicated hosted-auth state matrix for HUX-DEMO-002. It distinguishes local/private mode, hosted sign-in availability, tenant context, admin authorization, and auth-failure handling from compatibility metadata. Because the production role/session contract still belongs to `fortemi-auth`, admin authorization remains preview-only with `scope_contract_pending` until role evidence is available.

Premium Components Catalog note, 2026-07-06: `ApiCapabilitiesPanel` now renders a dedicated HUX-DEMO-004 catalog. It covers available, unavailable, license-required, admin-required, preview-only, and unknown states, keeps actions gated unless compatibility and tenant-context requirements are satisfied, and displays only coarse product, role, dependency, and reason text.

Backoffice Console Preview note, 2026-07-06: `ApiCapabilitiesPanel` now renders a dedicated HUX-DEMO-005 backoffice preview. It includes tenant health, audit posture, quota status, KMS status, and support diagnostics panels; every production-affecting action remains disabled until backend contract, role/scope, audit, and fixture gates pass. The preview keeps hosted production readiness blocked while the RLS gate remains open.

Sidecar provenance note, 2026-07-06: demo/release builds now use `release/sidecar-provenance.json` and `scripts/download-pinned-sidecar.sh` to pin Fortemi sidecar assets by upstream commit and SHA-256. The current pin is Fortemi commit `5b389cb86e4e8d8a610955d2e68f7f3e0a5de371`.

Manifest launch boundary note, 2026-07-07: hosted/mobile manifest discovery is not part of the fixture-backed enterprise preview readiness claim. `GET /v1/manifest` remains an unauthenticated mobile/cloud architecture contract, but production readiness stays blocked until `Fortemi/HotM#251` replaces or justifies the provisional 60 requests/minute launch value, defines the enforcement layer, and attaches `429`, `Retry-After`, cache/ETag, and non-bypass proof. `scripts/verify-manifest-launch-boundary.sh` keeps HUX-REQ-013 anchored to that boundary.

Manifest launch proof plan: `HotM/.aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md` defines the required launch baseline and burst policy, enforcement layer, identity key, replacement or justification for the provisional 60 requests/minute value, cache/ETag behavior, `429 Too Many Requests`, `Retry-After`, `Cache-Control`, non-bypass proof, and telemetry evidence. Documentation alone does not close `Fortemi/HotM#251`; issue-attached test or CI evidence remains required before hosted/mobile manifest discovery can support production-readiness claims.

Manifest launch local preflight, 2026-07-07: `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs` now starts a local fixture server and proves the expected `200`, `304`, `405`, and `429` route semantics, `Retry-After`, cache-header non-bypass, and redacted telemetry. This local fixture proof is useful for demo-gate preflight but does not replace the issue-attached hosted, gateway, or CI evidence required to close `Fortemi/HotM#251`.

Realtime Activity note, 2026-07-06: `RealtimeEventInspector` now presents a sanitized `Realtime Activity` view backed by `ui/src/services/realtimeActivity.ts`. Realtime events are classified as connection, job, sync, admin, MCP, or content activity, and rendered summaries avoid raw identifiers, prompt text, file paths, provider secrets, KMS identifiers, license material, and stack traces. `HallOfMind` exposes this view through a persistent header Activity button and drawer.

Binary attachment projection boundary note, 2026-07-08: attachment realtime regressions in `npm run test:realtime` prove sanitized HotM UI progress only. They do not prove Fortemi binary extraction, search/index, export, embedding, or React/browser parity. Keep `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, and `roctinam/aiwg#1719` visible as the required closure path before any attachment projection/export readiness claim appears in the demo receipt or tracker update.

## Fixture Set

| Fixture | Purpose | Must prove |
|---|---|---|
| `local-sidecar-compatible` | Baseline local/private mode. | Local workflows remain available; hosted/backoffice controls are disabled with local-mode reasons. |
| `single-tenant-compatible` | Compatible non-hosted server. | Compatibility is visible; hosted multi-tenant production claims remain disabled. |
| `hosted-compatible-admin` | Happy-path tenant-admin preview. | Preview enterprise surfaces render while production actions stay disabled unless all gates pass. |
| `hosted-compatible-insufficient-role` | Valid auth but missing admin role/scope. | Enterprise controls are disabled with role/scope reason. |
| `hosted-incompatible-version` | API below HotM enterprise-demo minimum. | Enterprise controls are disabled before incompatible API calls. |
| `hosted-unknown-capabilities` | Version known, capability metadata absent. | Unknown capability disables enterprise controls by default. |
| `api-unreachable` | Endpoint/network failure. | Clear unreachable state; local workflows remain usable where possible. |
| `preview-only-backoffice` | Backoffice visible without production operations. | Panels render preview state; production actions are disabled with backend gate references. |

## Demo Script

### Default First-Demo Path

Use this path unless the operator changes the persona, target, or priority:

1. Run HotM in fixture-backed mode with local-sidecar compatibility as the baseline.
2. Open API Surface and show the Connection/Compatibility state, also called the Connection and Compatibility Center, before any enterprise surface.
3. Show Hosted Auth Onboarding states as preview metadata when the hosted auth fixture is selected.
4. Switch to hosted preview metadata fixtures to show tenant-admin preview state without claiming hosted production readiness.
5. Walk the surfaces in this order: compatibility center, hosted auth preview, realtime activity drawer, premium components catalog, backoffice console preview.
6. End on the blocker list: RLS, hosted auth contract, KMS, backoffice API contract, private package publish/consume evidence, hosted/mobile manifest launch-rate proof, and binary attachment projection/export parity proof.

The default target is not a hosted multi-tenant production demo. Any hosted-looking state must be labelled as preview metadata or fixture-backed unless the corresponding Fortemi gates have passed.

### HUX-DEMO-001: Connection And Compatibility Center

Run with fixtures:

1. `local-sidecar-compatible`
2. `hosted-compatible-admin`
3. `hosted-incompatible-version`
4. `hosted-unknown-capabilities`
5. `api-unreachable`

Expected evidence:

- Deployment mode is visible: local sidecar, single-tenant, hosted preview, incompatible, unknown, or unavailable.
- Version contract state is visible without developer tools.
- Enterprise controls are disabled for incompatible, unknown, and unreachable states.
- Disabled controls include a user-visible reason and issue/backend blocker reference.
- Local note/search/archive workflows remain available for local-sidecar and unknown-enterprise cases.

Failure classification:

| Failure | Classification |
|---|---|
| API metadata absent but UI shows enabled enterprise controls | HotM gating defect |
| Endpoint unreachable and all local workflows are blocked | HotM local-mode regression |
| Version mismatch reaches an incompatible enterprise API call | Compatibility guard defect |

### HUX-DEMO-002: Hosted Auth And Role-Gated Enterprise Surfaces

Run with fixtures:

1. `local-sidecar-compatible`
2. `hosted-compatible-admin`
3. `hosted-compatible-insufficient-role`
4. auth failure fixture when implemented

Expected evidence:

- Local mode does not show a broken sign-in path.
- Unauthenticated hosted mode shows sign-in as available only when hosted auth capability exists.
- Tenant-admin state enables preview surfaces according to capability metadata.
- Insufficient-role state disables enterprise controls with a role/scope reason.
- No credentials, bearer tokens, refresh tokens, authorization codes, tenant secrets, or raw provider diagnostics are rendered.

Failure classification:

| Failure | Classification |
|---|---|
| Token or raw provider error appears in UI/log fixture | Security/redaction defect |
| Insufficient-role fixture enables admin controls | Authorization-gating defect |
| Local mode loses existing private workflows | Local-mode regression |

### HUX-DEMO-003: Realtime Activity Drawer

Run with fixtures:

1. `hosted-compatible-admin`
2. `api-unreachable`
3. replay-expired/resync event fixture when implemented

Expected evidence:

- Drawer opens from a persistent shell affordance.
- Drawer shows connected, reconnecting, stale, failed, empty, and resync-required states.
- Events are grouped or labeled by category: connection, job, sync, MCP/tool, admin.
- Last event time and retry state are visible.
- Event rows are sanitized and do not expose note bodies, prompt text, tokens, private file paths, tenant secrets, raw stack traces, KMS identifiers, or raw license material.

Failure classification:

| Failure | Classification |
|---|---|
| Raw SSE payload is rendered | Security/redaction defect |
| Reconnect/resync state is indistinguishable from success | Realtime UX defect |
| Drawer hides backend blocker state | Demo diagnosability defect |

### HUX-DEMO-004: Premium Components Catalog

Run with fixtures:

1. `hosted-compatible-admin`
2. `hosted-compatible-insufficient-role`
3. `hosted-unknown-capabilities`
4. `preview-only-backoffice`

Expected evidence:

- Catalog states include available, unavailable, license required, admin required, preview only, and unknown.
- Unknown status disables related controls by default.
- License-required state shows coarse product status only.
- Admin-required state disables action for insufficient-role fixture.
- Backend contract absence references `Fortemi/fortemi#1020` or an equivalent blocker.

Failure classification:

| Failure | Classification |
|---|---|
| Unknown capability enables a component action | Capability-gating defect |
| Catalog exposes raw license/config/provider details | Security/product-boundary defect |
| Missing backend contract appears as a generic failure | Demo diagnosability defect |

### HUX-DEMO-005: Backoffice Console Preview

Run with fixtures:

1. `hosted-compatible-admin`
2. `hosted-compatible-insufficient-role`
3. `preview-only-backoffice`
4. `hosted-unknown-capabilities`

Expected evidence:

- Panels exist for tenant health, audit posture, quota status, KMS status, and support diagnostics.
- Each panel supports enabled, disabled, degraded, preview-only, and unavailable states as applicable.
- Production-affecting actions remain disabled unless capability, role/scope, backend contract, audit, and test fixture requirements are all satisfied.
- KMS unavailable/preview state references `Fortemi/fortemi#1019` or `Fortemi-Enterprise/kms#2`.
- Hosted multi-tenant production readiness is not claimed while `Fortemi/fortemi#1016` remains open.

Failure classification:

| Failure | Classification |
|---|---|
| Preview fixture enables production action | Backoffice safety defect |
| KMS/audit/quota raw internals are displayed | Security/redaction defect |
| Console implies hosted production readiness before RLS/KMS gates close | Gate-claim defect |

### HUX-DEMO-009: Attachment Projection Claim Boundary

Run with fixtures:

1. `hosted-compatible-admin`
2. attachment upload/extraction progress fixture when implemented
3. attachment extraction unavailable fixture when implemented

Expected evidence:

- Attachment progress or extraction state is shown only as sanitized UI progress.
- The demo receipt classifies binary extraction/search/index/export/embedding and React/browser parity as blocked by `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, and `roctinam/aiwg#1719`.
- No raw binary bytes, note bodies, file paths, tenant identifiers, KMS identifiers, license material, or provider diagnostics are rendered in attachment UI states.
- Attachment realtime regressions are recorded as `npm run test:realtime` evidence only, not as Fortemi projection/export closure.

Failure classification:

| Failure | Classification |
|---|---|
| Attachment UI implies binary search/export readiness before `Fortemi/fortemi#1013` closes | Gate-claim defect |
| Attachment progress renders raw path, binary bytes, note body, or provider diagnostics | Security/redaction defect |
| React/browser parity is claimed from HotM UI tests alone | Cross-repo parity defect |

## Redaction Checklist

No credentials, tenant identifiers, tokens, or secret fingerprints may be logged to frontend telemetry or rendered in captured demo artifacts.

The dry run fails if rendered UI, fixture logs, console output captured by tests, or exported demo artifacts contain any of:

- Bearer tokens, refresh tokens, OAuth authorization codes, API keys, or client secrets.
- Tenant secrets or raw tenant identifiers beyond approved display name/class.
- Raw license material, entitlement tokens, or private package registry credentials.
- KMS key IDs, key fingerprints, envelope metadata beyond coarse status, or provider resource names.
- Note bodies, prompt text, file paths, support bundle contents, raw stack traces, or provider diagnostics.

## Evidence To Capture

| Evidence | Purpose |
|---|---|
| Fixture name and HotM commit/build identifier | Reproducibility |
| Fortemi sidecar/API version and checksum when not fixture-only | Provenance |
| Screenshot or test artifact for each HUX-DEMO scenario | UX review |
| Disabled-control blocker list | Backend handoff |
| Redaction check result | Security gate |
| Local workflow smoke result | Local/private regression guard |

## Dry-Run Receipt

Use `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` for every manual or reviewer dry run. A completed receipt should be saved under `.aiwg/evidence/` with the run date and should include fixture result rows, surface observations, a minimum command transcript, redaction scan results, blocker classifications, a `Fortemi/HotM#250` tracker receipt link, and one of the allowed verdicts:

- `pass for fixture-backed preview`
- `blocked by external gate`
- `fail`

Do not use a dry-run receipt to close hosted production readiness, private package distribution readiness, HUX-REQ-010 live CI evidence, HUX-REQ-013 hosted/mobile manifest launch proof, or HUX-REQ-014 binary attachment projection/export readiness unless the corresponding tracker evidence is attached.

## Exit Criteria

- HUX-DEMO-001 through HUX-DEMO-005 have been run with the required fixtures or have a documented backend blocker.
- Every failed step is classified as a HotM defect, backend blocker, fixture gap, or operator-decision gap.
- The run produces a blocker list that maps to filed issues, not free-form notes.
- The run produces a completed dry-run receipt from `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` with the minimum command transcript, redaction-scan results, and `Fortemi/HotM#250` tracker receipt link.
- Local workflows remain usable in fixtures where enterprise metadata is absent.
- Redaction checklist passes.
- Attachment realtime evidence remains scoped to HotM sanitized UI progress and does not claim Fortemi binary extraction/search/index/export/embedding or React/browser parity readiness.

## Verification Log

| Date | Scope | Result |
|---|---|---|
| 2026-07-06 | Compatibility client and `ApiCapabilitiesPanel` fallback/unknown-state tests. | Passed: `npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Enterprise Preview section and AdminPanel tab integration. | Passed: `npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Hosted Auth Preview local, tenant-admin, insufficient-role, auth-failure, and compatibility-unavailable states. | Passed: `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Premium Components Catalog state coverage and product-boundary redaction checks. | Passed: `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Backoffice Console Preview panel coverage, disabled production actions, RLS/KMS blocker visibility, and redaction checks. | Passed: `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. |
| 2026-07-06 | Browser-backed desktop/mobile API Surface enterprise demo smoke covering Enterprise Preview, Hosted Auth Preview, Premium Components Catalog, and Backoffice Console Preview. | Passed: `npx playwright test e2e/tests/enterprise-preview.spec.ts --project=e2e-mocked`; screenshots in `.aiwg/evidence/hotm-enterprise-preview-desktop.png` and `.aiwg/evidence/hotm-enterprise-preview-mobile.png`. |
| 2026-07-06 | Sidecar provenance gate and checksum verifier. | Passed: `scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-provenance-check`; receipt written to `/tmp/hotm-sidecar-provenance-check.provenance.json`. |
| 2026-07-06 | Sanitized realtime activity classifier and event-bus regression tests. | Passed: `npm run test:realtime`; `npm run typecheck`. |
| 2026-07-06 | Shell Activity drawer opens from `HallOfMind` header and renders sanitized realtime activity view. | Passed: `npm run test:realtime`; `npm run typecheck`. |
| 2026-07-08 | Package-level realtime gate includes the sanitized activity classifier, event bus, API event stream, shell drawer, and attachment realtime regressions. | Passed: `npm run test:realtime` from `HotM/ui`; 5 test files and 84 tests passed. |
| 2026-07-08 | Attachment realtime proof is bounded to sanitized UI progress and does not close binary projection/export or React/browser parity. | `Fortemi/fortemi#1013`, `Fortemi/fortemi-react#227`, and `roctinam/aiwg#1719` remain the closure path. |
| 2026-07-06 | Initial HUX-REQ-001 through HUX-REQ-012 direct anchors were present and the UI quality gate included the traceability verifier; current scope is extended by the 2026-07-07 HUX-REQ-013 row below. | Passed: `npm run test:hux-traceability`. |
| 2026-07-07 | HUX-REQ-013 manifest launch boundary anchors are present and tied to `Fortemi/HotM#251`. | Passed: `scripts/verify-manifest-launch-boundary.sh`; `scripts/verify-hux-traceability.sh`. |

## Operator Decision Dependencies

Until answered, use these defaults:

| ID | Default | Runbook effect |
|---|---|---|
| OP-2026-07-001 | Persona: tenant admin. | Demo narration starts from a tenant-admin operator view. |
| OP-2026-07-002 | Deployment target: local sidecar plus hosted preview metadata. | Hosted-looking states remain fixture-backed preview metadata, not production evidence. |
| OP-2026-07-003 | First demo priority: compatibility center, hosted auth, realtime activity, premium catalog, backoffice preview. | Demo order starts with guardrails before feature surfaces. |
| OP-2026-07-004 | Claim boundary: fixture-backed preview only; no hosted production, EE implementation, private package, or production backoffice readiness claim. | Public/internal demo language must not overstate readiness. |
| OP-2026-07-005 | HUX-REQ-010 live CI caveat: keep sidecar provenance live CI receipt open until workflow changes are pushed and authenticated run evidence is captured. | Local checksum proof stays separate from live Gitea Actions evidence. |
| OP-2026-07-006 | Private package registry: no-go; do not claim private package distribution readiness. | Package distribution claims remain blocked until the registry plan passes, publish/consume proof is attached to `Fortemi-Enterprise/distribution#1`, or OP-2026-07-006 records an accepted fallback. |

Accepted operator answers must be recorded first in the root suite ballot artifact: `../.aiwg/decisions/operator-decision-ballot-2026-07-06.md` from the HotM repo root's parent suite directory. The older request artifact remains context only. Then update this runbook and `HotM/.aiwg/planning/enterprise-demo-scenarios-2026-07.md` to match.

## Operator Signoff Packet

Use `.aiwg/testing/enterprise-demo-operator-signoff-2026-07-06.md` as the HUX-REQ-012 signoff surface. It records OP-2026-07-001 through OP-2026-07-006 for the default persona, target, priority order, claim boundary, HUX-REQ-010 live CI caveat, private registry posture, available evidence, remaining operator answers, and receipt evidence needed before this runbook can move from draft to accepted demo baseline. This runbook also requires a completed dated dry-run receipt from `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` stored under `.aiwg/evidence/`, containing the minimum command transcript and redaction-scan results, and linked to `Fortemi/HotM#250` before HUX-REQ-012 is accepted.
