# HotM Enterprise Demo Scenarios - 2026-07

## Purpose

Define the first demonstrable HotM UX slice for recent Fortemi streaming/security work and the upcoming enterprise/backoffice phase.

## Accepted First Product Persona

**Tenant admin** is the accepted first persona for the HotM desktop-plus-enterprise product sequence.

Reasoning:

- It exercises the enterprise/backoffice surfaces the objective asks for: tenant health, audit posture, quota, KMS/licensing state, premium components, and support diagnostics.
- It requires the same compatibility/auth/capability model that end users and operators also need.
- It makes missing backend contracts visible without pretending the enterprise implementation is complete.

## Product Validation Thread

Accepted OP baseline as of 2026-07-09:

| Decision | Accepted answer |
|---|---|
| Persona | Tenant admin |
| Deployment target | Local sidecar plus hosted preview metadata |
| Priority order | Compatibility center, hosted auth, realtime activity, premium catalog, backoffice preview |
| Claim boundary | Fixture-backed preview only; no hosted production, EE implementation, private package, or production backoffice readiness claim |
| HUX-REQ-010 live CI caveat | Keep open until live sidecar provenance CI receipt exists |
| Private registry posture | Keep as hard blocker until publish/consume proof exists |

This keeps the product validation tied to current implementation evidence while still showing the enterprise/backoffice direction through capability discovery and disabled-state explanations. Do not switch the script to a hosted multi-tenant production path or broader public claim until the RLS, auth, KMS, backoffice, package, and claim-control gates are proven or explicitly accepted by the operator.

### Scenario HUX-DEMO-001: Admin connects HotM to an enterprise-capable Fortemi endpoint

1. Open HotM.
2. Show the Connection and Compatibility Center.
3. Enter or select a Fortemi endpoint.
4. HotM reads version/capability metadata.
5. HotM displays deployment mode: local sidecar, single-tenant, hosted multi-tenant, or unavailable.
6. Unsupported enterprise controls are disabled with reason text.

**Proves:** API compatibility guard, degraded-state UX, sidecar/hosted mode clarity.

**Depends on:** `Fortemi/fortemi#1018`, `Fortemi/HotM#244`.

### Scenario HUX-DEMO-002: Admin signs in and sees role-gated enterprise surfaces

1. Admin starts hosted auth flow.
2. HotM displays tenant/context after successful sign-in.
3. HotM enables only controls allowed by role/scope/capability state.
4. HotM clearly distinguishes local/private mode from hosted mode.

**Proves:** Hosted auth UX model, role/scope gating, local-mode preservation.

**Depends on:** `Fortemi/fortemi-auth#25`, `Fortemi/fortemi#1017`, `Fortemi/HotM#243`.

### Scenario HUX-DEMO-003: Admin watches realtime activity

1. Trigger or observe a streaming/job/MCP event.
2. Open the Realtime Activity Drawer.
3. Show connection state, last event time, retry state, and user-visible error handling.
4. Confirm sensitive values are not shown in UI logs.

**Proves:** Streaming support is visible and operationally understandable.

**Depends on:** `Fortemi/HotM#246`.

### Scenario HUX-DEMO-004: Admin opens Premium Components Catalog

1. Open premium components.
2. Show available, unavailable, license-required, and admin-required states.
3. Select a component and view coarse status only.
4. If the backend contract is absent, show a clear preview/degraded state.

**Proves:** Premium capabilities are discoverable without leaking private implementation detail.

**Depends on:** `Fortemi/fortemi#1020`, `Fortemi/HotM#243`.

### Scenario HUX-DEMO-005: Admin opens Backoffice Console preview

1. Open tenant health.
2. Show audit posture, quota status, KMS status, and support diagnostics panels.
3. Disable production actions unless capability, role, and backend contract requirements are satisfied.
4. Show a link or reference to missing backend gates.

**Proves:** Backoffice UX direction, enterprise gate visibility.

**Depends on:** `Fortemi/fortemi#1016`, `Fortemi/fortemi#1019`, `Fortemi/fortemi#1020`.

## Alternate Personas

| Persona | Use when | Trade-off |
|---|---|---|
| Support/operator | Best when incident/support workflows are the main sales narrative. | Requires support diagnostics and audit event contracts earlier. |
| Developer | Best when selling integration extensibility and premium components. | Less direct proof of backoffice/admin value. |
| End user | Best when showcasing day-to-day memory workflows. | Does not exercise enough enterprise/backoffice capability for the checkpoint objective. |

## Demo Readiness Gates

| Gate | Required evidence |
|---|---|
| Compatibility | HotM receives version/capability metadata and handles incompatible/unknown responses. |
| Auth | Hosted auth flow exists or the demo explicitly runs in local mode without claiming hosted readiness. |
| Realtime | Drawer can show connection, event, retry, and error states. |
| Premium | Catalog is backed by capability metadata or clearly marked as preview. |
| Backoffice | Admin panels are role-gated and all production actions are disabled until backend contracts exist. |
| Provenance | Sidecar/API version is pinned for the demo. |

## Requirements And Verification

- Requirements: `.aiwg/requirements/enterprise-demo-requirements-2026-07.md`
- Test plan: `.aiwg/testing/enterprise-demo-test-plan-2026-07.md`
- Runbook: `.aiwg/testing/enterprise-demo-runbook-2026-07.md`
- Screen/state blueprint: `.aiwg/design/enterprise-demo-screen-state-blueprint-2026-07.md`
- Operator signoff packet: `.aiwg/testing/enterprise-demo-operator-signoff-2026-07-06.md`

## Accepted OP Decisions

Use the root operator ballot artifact as the source of truth for accepted answers: `../.aiwg/decisions/operator-decision-ballot-2026-07-06.md` from the HotM repo root's parent suite directory. The older request artifact remains context only.

- OP-2026-07-001: Tenant admin.
- OP-2026-07-002: Local sidecar plus hosted preview metadata.
- OP-2026-07-003: Compatibility center, hosted auth, realtime activity, premium catalog, backoffice preview.
- OP-2026-07-004: Fixture-backed preview only; no hosted production, EE implementation, private package, or production backoffice readiness claim.
- OP-2026-07-005: Keep HUX-REQ-010 open until an authenticated Gitea Actions sidecar provenance receipt exists.
- OP-2026-07-006: Keep ADR-096 private registry readiness hard-blocked until publish/consume proof exists.
- Choose target API version once `Fortemi/fortemi#1018` defines the compatibility contract.
