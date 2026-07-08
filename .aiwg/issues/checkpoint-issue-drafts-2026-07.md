# HotM Issue Drafts - SDLC Checkpoint 2026-07

## 1. Plan and implement HotM enterprise UX update for hosted/backoffice demo

**Filed:** `Fortemi/HotM#243`

**Labels:** `hotm-ux`, `sdlc/checkpoint`, `phase/enterprise`, `planning`

### Problem

The current UX design set predates the latest streaming/security work and does not describe how HotM will demonstrate hosted auth, realtime state, premium components, or backoffice tooling.

### Acceptance Criteria

- Adopt `.aiwg/planning/hotm-ux-enterprise-update-plan-2026-07.md` or a repo-local equivalent.
- Define the demo persona, target, priority, claim boundary, HUX-REQ-010 live CI caveat handling, and private registry posture through OP-2026-07-001 through OP-2026-07-006 before treating the fixture-backed demo script as final.
- Choose target API version once `Fortemi/fortemi#1018` defines the compatibility contract.
- Identify which surfaces are production-backed versus flagged preview.
- Add test/QA checklist for the demo path.

## 2. Add Fortemi API compatibility guard

**Filed:** `Fortemi/HotM#244`

**Labels:** `api`, `delivery`, `hotm-ux`, `security`

### Problem

HotM can break silently when Fortemi API contracts shift. Enterprise demos need a visible compatibility and degraded-mode story.

### Acceptance Criteria

- HotM queries Fortemi version/capability metadata before enabling advanced flows.
- UI distinguishes local sidecar, single-tenant, hosted multi-tenant, and unavailable modes.
- Unsupported features are disabled with a clear reason.
- Contract tests cover at least compatible, too-old, and unreachable API states.

### Checkpoint Artifact

- `.aiwg/architecture/fortemi-compatibility-consumption-2026-07.md` defines HotM normalization, enablement, fixture, and test rules for the Fortemi compatibility response.

## 3. Pin sidecar artifact provenance for demo builds

**Filed:** `Fortemi/HotM#245`

**Labels:** `delivery`, `supply-chain`, `sdlc/checkpoint`

### Problem

Using a floating sidecar artifact can make a previously working HotM demo fail when upstream changes.

### Acceptance Criteria

- Demo/release builds pin the Fortemi sidecar by upstream commit and checksum.
- Build docs explain how to update the pinned sidecar.
- CI fails if checksum verification is absent or mismatched.

### Checkpoint Artifact

- `release/sidecar-provenance.json` pins the current Fortemi sidecar assets to upstream commit `5b389cb86e4e8d8a610955d2e68f7f3e0a5de371` and SHA-256 values.
- `scripts/download-pinned-sidecar.sh` downloads, verifies, and writes sidecar provenance receipts.
- `.aiwg/supply-chain/sidecar-provenance-gate-2026-07.md` documents the gate, update procedure, and remaining signature-verification caveat.

## 4. Design realtime activity drawer

**Filed:** `Fortemi/HotM#246`

**Labels:** `ux`, `realtime`, `streaming`

### Problem

Recent streaming/realtime support needs a user-visible status model in HotM for jobs, sync, MCP activity, and retries.

### Acceptance Criteria

- Design describes event types, empty states, error states, retry states, and accessibility behavior.
- Implementation is feature-flagged until backend contracts are stable.
- No secret, token, or tenant-sensitive values appear in UI logs or telemetry.

## 5. Design hosted auth onboarding states for enterprise demo

**Filed:** `Fortemi/HotM#247`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

HotM needs a hosted-auth onboarding surface that separates local mode, hosted sign-in, tenant context, insufficient role, and auth failure states.

### Acceptance Criteria

- UI state model covers unauthenticated, authenticating, authenticated tenant admin, authenticated insufficient role, tenant-context missing, auth failure, and local mode.
- Enterprise controls remain disabled unless role/scope and capability state allow them.
- Local/private workflows remain available when hosted auth is unavailable.
- Tests use fixtures from `.aiwg/testing/enterprise-demo-test-plan-2026-07.md`.
- No credentials, bearer tokens, tenant secrets, or sensitive auth diagnostics appear in rendered UI or telemetry fixtures.

## 6. Design premium components catalog states for enterprise demo

**Filed:** `Fortemi/HotM#248`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

HotM needs a premium components catalog that makes premium capability availability visible without leaking private implementation, license, or configuration details.

### Acceptance Criteria

- Catalog supports available, unavailable, license-required, admin-required, preview-only, and unknown states.
- Unknown capability state disables related controls by default.
- Catalog displays coarse capability status only.
- Tests cover every catalog state from `.aiwg/testing/enterprise-demo-test-plan-2026-07.md`.
- Backend contract absence links to or references `Fortemi/fortemi#1020`.

## 7. Design backoffice console preview states for tenant-admin demo

**Filed:** `Fortemi/HotM#249`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

HotM needs a tenant-admin backoffice console preview for tenant health, audit posture, quota status, KMS status, and support diagnostics while production actions remain disabled until backend gates close.

### Acceptance Criteria

- Console contains capability-gated panels for tenant health, audit posture, quota status, KMS status, and support diagnostics.
- Each panel supports enabled, disabled, degraded, preview-only, and unavailable states.
- Production-affecting actions remain disabled unless capability, role, backend contract, and audit requirements are satisfied.
- Disabled actions include reason text and backend blocker references.
- UI does not expose sensitive tenant, KMS, license, or support diagnostic values.

## 8. Add enterprise demo fixture suite, redaction checks, and runbook

**Filed:** `Fortemi/HotM#250`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

The enterprise demo needs fixture-backed tests and a reproducible manual runbook so backend blockers produce explicit UI states instead of ambiguous failures.

### Acceptance Criteria

- Add fixtures for local sidecar, single-tenant, hosted admin, insufficient-role, incompatible-version, unknown-capabilities, unreachable API, and preview-only backoffice states.
- Add redaction checks for tokens, tenant secrets, raw license material, and sensitive KMS identifiers.
- Add a demo runbook covering HUX-DEMO-001 through HUX-DEMO-005.
- Test output identifies backend blockers explicitly.
- Local sidecar workflows remain usable in fixtures where enterprise metadata is unavailable.

## 9. Track manifest endpoint rate-limit launch proof

**Filed:** `Fortemi/HotM#251`

**Labels:** `security`, `phase: mobile-expansion`, `scope: cross-cutting`, `type: chore`

### Problem

The manifest endpoint is unauthenticated and is the first network call for mobile/cloud clients. `HotM/.aiwg/architecture/manifest-schema-v1.md` still treats the 60 requests/minute per-IP token bucket as a provisional value and explicitly says the number must be tightened before public launch based on observed traffic.

This is not a blocker for the current fixture-backed enterprise demo, but it is a hosted/mobile launch-readiness loose end before the manifest endpoint can support production readiness claims.

### Acceptance Criteria

- Replace or justify the provisional 60 requests/minute launch value with an explicit baseline and burst policy.
- Define the enforcement layer for `GET /v1/manifest`, including whether limits are per-IP only or combined with tenant/session controls after authentication.
- Add or link test evidence for HTTP `429 Too Many Requests`, `Retry-After`, cache/ETag behavior under rate limiting, and non-bypass by cache headers.
- Keep `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs` passing as local preflight evidence for the expected limiter/cache semantics; this fixture proof is not enough to close the issue without staging, gateway, hosted `matric-api`, or CI evidence from the selected enforcement layer.
- Document the telemetry window or production-observation input used to tighten the value before public launch.
- Keep the current enterprise demo claim boundary fixture-backed until hosted production, live CI, and operator signoff gates close.
