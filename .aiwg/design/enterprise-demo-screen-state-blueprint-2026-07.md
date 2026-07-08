# HotM Enterprise Demo Screen-State Blueprint - 2026-07

## Purpose

Translate the July 2026 enterprise demo scenarios into implementable HotM screen states. This artifact bridges the SDLC requirements and the React SPA structure so `Fortemi/HotM#243` through `#250` can be implemented without overstating backend readiness.

## Existing UI Anchors

| Existing anchor | Current role | Enterprise-demo extension |
|---|---|---|
| `ui/src/components/HallOfMind.tsx` | Primary application shell and navigation host. | Add entry points for compatibility, activity, premium, and backoffice surfaces without disrupting local note workflows. |
| `ui/src/components/admin/AdminPanel.tsx` | Existing admin tabs for inference, audit, API capabilities, document types, and webhooks. | Host the first Connection and Compatibility Center and preview Backoffice Console panels. |
| `ui/src/components/admin/ApiCapabilitiesPanel.tsx` | Displays capability metadata from health payloads. | Normalize capability states into demo gates and disabled-control reasons. |
| `ui/src/services/websocket.ts`, `ui/src/services/realtimeEventBus.ts`, and `ui/src/services/realtimeActivity.ts` | Realtime transport, event fan-out, and sanitized activity classification. | Feed the Realtime Activity Drawer from the event bus and redacted activity classifier rather than raw backend payloads. |
| `ui/src/components/jobs/JobQueueView.tsx` and job queue indicators | Existing job visibility. | Contribute job events/status rows to the Realtime Activity Drawer. |
| `ui/src/components/admin/InferenceAuditLog.tsx` | Existing audit-log display pattern. | Reuse table and redaction expectations for audit posture preview. |

## Screen Map

| Screen | Primary issue | Scenario | Required state families |
|---|---|---|---|
| Connection and Compatibility Center | `Fortemi/HotM#244` | HUX-DEMO-001 | Compatible, incompatible, unknown, unreachable, local sidecar, single-tenant, hosted preview. |
| Hosted Auth Onboarding | `Fortemi/HotM#247` | HUX-DEMO-002 | Local mode, unauthenticated, authenticating, tenant admin, insufficient role, tenant missing, auth failure. |
| Realtime Activity Drawer | `Fortemi/HotM#246` | HUX-DEMO-003 | Connected, reconnecting, stale, failed, empty, redacted event, replay-expired resync. |
| Premium Components Catalog | `Fortemi/HotM#248` | HUX-DEMO-004 | Available, unavailable, license required, admin required, preview only, unknown. |
| Backoffice Console Preview | `Fortemi/HotM#249` | HUX-DEMO-005 | Enabled panel, disabled panel, degraded panel, preview panel, missing backend contract, insufficient role. |
| Demo Fixture and Runbook Surface | `Fortemi/HotM#250` | All | Fixture selector in tests/dev mode, deterministic blocker list, redaction assertions. |
| Demo Dry-Run Receipt | `Fortemi/HotM#250` | All | Completed receipt with fixture rows, surface checks, redaction results, blocker classification, and fixture-backed verdict. |

## Navigation Model

Use the existing admin/navigation model for the first implementation:

1. Add a top-level `Enterprise` or `Capabilities` admin tab only when the feature flag is enabled.
2. Put Connection and Compatibility Center first in that tab.
3. Expose Realtime Activity Drawer from the shell as a persistent status affordance because realtime state is useful outside admin.
4. Keep Premium Components Catalog and Backoffice Console under admin until product direction decides whether these become standalone product areas.
5. Keep all production-affecting controls disabled in preview fixtures.

## Screen Blueprints

### Connection and Compatibility Center

Purpose: prevent HotM from invoking unsupported enterprise flows and make backend blockers visible.

Layout:

```text
Connection and Compatibility
├── Endpoint summary
│   ├── API base URL class: local, same-origin, remote, hosted, unreachable
│   ├── Deployment mode badge
│   └── Last checked timestamp
├── Version contract
│   ├── Fortemi version
│   ├── HotM minimum enterprise-demo version
│   └── Contract status: compatible, incompatible, unknown
├── Capability matrix
│   ├── Hosted auth
│   ├── Realtime events
│   ├── Premium components
│   ├── Backoffice admin
│   ├── MCP scope gate
│   └── Sidecar provenance
└── Blocker list
    ├── Blocking issue reference
    ├── User-visible reason
    └── Safe next action
```

State rules:

| Input condition | UI behavior |
|---|---|
| Endpoint unreachable | Mark enterprise surfaces unavailable; preserve local workflows when possible. |
| Version below minimum | Disable enterprise controls and show required minimum. |
| Version present, capabilities absent | Show unknown capability state and disable enterprise controls by default. |
| Local sidecar compatible | Show local/private mode; keep hosted/backoffice controls disabled. |
| Hosted-compatible admin fixture | Enable preview enterprise surfaces only; production actions remain disabled unless backend gates are explicitly satisfied. |

### Hosted Auth Onboarding

Purpose: separate local mode, hosted identity, tenant context, and authorization state.

State model:

| State | Entry condition | User-visible result |
|---|---|---|
| Local mode | No hosted auth capability or local sidecar selected | Local workflows available; hosted controls disabled with local-mode reason. |
| Unauthenticated | Hosted auth available but no session | Sign-in action visible; enterprise panels remain disabled. |
| Authenticating | OAuth redirect or token exchange in progress | Nonblocking progress state; no token details rendered. |
| Tenant admin | Session has tenant context and admin scope | Preview surfaces enabled according to capability metadata. |
| Insufficient role | Session valid but lacks admin scope | Enterprise controls disabled with role/scope reason. |
| Tenant missing | Session valid but tenant context absent | Tenant selector or blocker message visible. |
| Auth failure | Sign-in or refresh fails | Fixed error category, retry action, no raw provider diagnostics. |

Do not render bearer tokens, refresh tokens, authorization codes, tenant secrets, or raw provider errors.

Implementation checkpoint, 2026-07-06:

- `ApiCapabilitiesPanel` now renders a `Hosted Auth Preview` matrix for local mode, sign-in path, tenant context, admin authorization, and auth-failure handling.
- The matrix is derived from compatibility metadata only. It does not claim production role enforcement until the hosted auth/session contract exposes role or scope evidence.
- Focused tests cover local sidecar, hosted tenant-admin preview, insufficient role, auth failure, and compatibility discovery unavailable states.

### Realtime Activity Drawer

Purpose: make streaming/job/MCP activity understandable without exposing sensitive payloads.

Recommended shell affordance:

- Persistent activity icon with connection state indicator.
- Drawer opens from the shell and overlays the current workflow.
- Drawer content is chronological, grouped by event category.

Event categories:

| Category | Examples | Redaction requirement |
|---|---|---|
| Connection | connected, reconnecting, stale, failed, resync required | No endpoint credentials or auth headers. |
| Job | queued, running, completed, failed, retrying | No note body, prompt text, provider secrets, or raw stack traces. |
| Sync | archive refresh, capability refresh, replay-expired full refresh | No tenant IDs beyond approved display name or coarse tenant class. |
| MCP/tool | tool started, tool completed, tool failed | No tool arguments containing content, tokens, file paths, or private payloads. |
| Admin | audit refresh, quota check, KMS status check | No KMS key IDs, license material, or support diagnostic values. |

Required states:

- Empty: no activity yet, with last connection check.
- Connected: live events active.
- Reconnecting: retry count and next retry time.
- Stale: last event exceeds threshold.
- Failed: fixed error category and retry.
- Resync required: explain that state refreshed because replay history expired.

Implementation checkpoint, 2026-07-06:

- `ui/src/services/realtimeActivity.ts` classifies realtime events into `connection`, `job`, `sync`, `admin`, `mcp`, and `content` categories.
- The classifier returns fixed user-visible summaries instead of raw backend messages, stack traces, IDs, provider settings, KMS identifiers, license material, prompt text, or file paths.
- `ui/src/components/debug/RealtimeEventInspector.tsx` now presents a sanitized `Realtime Activity` view using the classifier.
- `ui/src/components/HallOfMind.tsx` exposes a persistent header Activity button that opens the sanitized realtime activity drawer.
- Focused tests cover job progress redaction, replay-expiry/lag warnings, hidden admin/provider details, and opening the shell drawer.

### Premium Components Catalog

Purpose: expose premium capability availability without leaking implementation, license, or provider configuration.

Catalog item model:

| Field | Rule |
|---|---|
| Name | Product-facing capability name only. |
| Status | One of available, unavailable, license required, admin required, preview only, unknown. |
| Description | Coarse product description, no internal crate or provider details unless already public. |
| Required role | Display role class, not internal policy expression. |
| Backend dependency | Link to issue or capability key when absent. |
| Action | Disabled unless capability, license, role, and backend contract all permit it. |

Default behavior:

- Unknown status disables the component.
- Preview-only status may show read-only details but no production action.
- License-required status links to operator-approved licensing copy once `Fortemi/licensing#1` closes.

Implementation checkpoint, 2026-07-06:

- `ApiCapabilitiesPanel` now renders a `Premium Components Catalog` with product-facing rows for premium components, licensed server components, backoffice widgets, enterprise MCP tools, hosted auth components, and KMS integrations.
- The catalog shows available, unavailable, license-required, admin-required, preview-only, and unknown states from compatibility metadata plus conservative licensing and role gates.
- Catalog rows display role class, backend dependency, and reason code, while action buttons remain disabled unless the component is explicitly available and tenant context exists.
- Focused tests cover catalog state coverage, compatibility-metadata absence, gated actions, and absence of raw license, registry, or KMS-sensitive strings.

### Backoffice Console Preview

Purpose: give tenant admins a truthful preview of enterprise operations while backend gates are incomplete.

Panels:

| Panel | Preview content | Backend dependency | Default action state |
|---|---|---|---|
| Tenant health | Deployment mode, API compatibility, event status, known blockers | `Fortemi/fortemi#1018`, `#1020` | Read-only |
| Audit posture | Audit availability, recent event count class, redaction status | `Fortemi/fortemi#1020`, EE audit sinks | Read-only |
| Quota status | Coarse quota state: ok, warning, exceeded, unknown | Backoffice contract | Read-only |
| KMS status | Configured, unavailable, preview, unknown | `Fortemi/fortemi#1019`, `Fortemi-Enterprise/kms#2` | Read-only |
| Support diagnostics | Export readiness, safe diagnostic categories | Backoffice contract and audit gate | Disabled by default |

Production-affecting actions stay disabled until all are true:

1. Capability metadata says the action is supported.
2. The authenticated role/scope permits the action.
3. Backend contract exists and is not preview-only.
4. Audit event requirement is satisfied.
5. The action has a test fixture proving disabled and enabled states.

Implementation checkpoint, 2026-07-06:

- `ApiCapabilitiesPanel` now renders a `Backoffice Console Preview` with tenant health, audit posture, quota status, KMS status, and support diagnostics panels.
- Panels show enabled, disabled, degraded, preview-only, unavailable, and unknown states from compatibility metadata, auth posture, and conservative production-readiness gates.
- Production-affecting actions remain disabled, including support export, until backend contract, role/scope, audit, and fixture gates are all satisfied.
- The preview references `Fortemi/fortemi#1019`, `Fortemi/fortemi#1020`, and `Fortemi-Enterprise/kms#2` for KMS/backoffice blockers and does not claim hosted production readiness while the RLS gate remains open.
- Focused tests cover hosted tenant-admin preview, insufficient-role disabling, disabled production actions, KMS/RLS blocker visibility, and absence of raw tenant, KMS, support-bundle, or stack-trace strings.

## Fixture Matrix

| Fixture | Compatibility center | Auth | Realtime | Premium | Backoffice |
|---|---|---|---|---|---|
| `local-sidecar-compatible` | Local compatible | Local mode | Optional local events | Unavailable | Unavailable |
| `single-tenant-compatible` | Single-tenant compatible | Optional auth | Connected or empty | Preview/unknown | Disabled |
| `hosted-compatible-admin` | Hosted compatible | Tenant admin | Connected | Preview/available mix | Preview panels |
| `hosted-compatible-insufficient-role` | Hosted compatible | Insufficient role | Connected | Admin required | Disabled |
| `hosted-incompatible-version` | Incompatible | Disabled | Disabled | Disabled | Disabled |
| `hosted-unknown-capabilities` | Unknown capabilities | Depends on auth | Unknown | Unknown | Unknown |
| `api-unreachable` | Unreachable | Unavailable | Failed | Unavailable | Unavailable |
| `preview-only-backoffice` | Compatible preview | Tenant admin | Connected | Preview only | Preview panels, actions disabled |

## Acceptance Checklist

- Every enterprise control has a disabled reason for incompatible, unknown, insufficient-role, and missing-contract states.
- Local/private note, search, archive, and inference workflows remain usable when enterprise metadata is absent.
- Realtime drawer renders from sanitized event envelopes, not raw backend payloads.
- Premium catalog never renders raw license material, internal provider secrets, or private crate paths.
- Backoffice panels never render raw tenant identifiers, KMS key IDs, support bundle contents, or stack traces.
- Demo fixture tests and verifier scripts cover HUX-REQ-001 through HUX-REQ-014.
- The manual demo runbook at `.aiwg/testing/enterprise-demo-runbook-2026-07.md` names backend blockers instead of treating them as test failures.
- Manual or reviewer dry runs produce a completed receipt from `.aiwg/testing/enterprise-demo-dry-run-receipt-template-2026-07.md` before the run is used as demo evidence.

## Open Inputs

This blueprint uses the current planning defaults until the operator decides otherwise:

- First persona: tenant admin.
- First deployment target: local sidecar plus hosted preview metadata.
- First path: compatibility center, then hosted auth, realtime activity, premium catalog, backoffice preview.
- First claim boundary: fixture-backed preview only; no hosted production, EE implementation, private package, or production backoffice readiness claim.
- HUX-REQ-010 live CI caveat: sidecar provenance remains partial until live Gitea Actions receipt exists.
- HUX-REQ-013 manifest launch caveat: hosted/mobile manifest discovery remains no-go for production claims until `Fortemi/HotM#251` closes with launch baseline, enforcement-layer, `429`, `Retry-After`, cache/ETag, and non-bypass proof.
- Distribution gate: private package registry readiness remains no-go until the registry verification plan passes, publish/consume proof is attached to `Fortemi-Enterprise/distribution#1`, or OP-2026-07-006 records an accepted fallback.

Accepted changes to these defaults should be recorded first in the root suite ballot artifact: `../.aiwg/decisions/operator-decision-ballot-2026-07-06.md` from the HotM repo root's parent suite directory.
