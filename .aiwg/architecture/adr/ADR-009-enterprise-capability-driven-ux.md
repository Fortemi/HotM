# ADR-009: Enterprise Capability-Driven UX

**Status**: Proposed
**Date**: 2026-07-06
**Deciders**: Product, HotM engineering, Fortemi platform engineering
**Context**: HotM UX update for hosted, enterprise, backoffice, and premium component demonstration

---

## 1. Context

HotM needs to demonstrate recent Fortemi streaming and security work while preparing for the next phase: enterprise software, backoffice tooling, and premium components. The July 2026 SDLC checkpoint found that the open-BSL single-tenant product is mature, but hosted multi-tenant and enterprise controls remain gated by Fortemi backend work: RLS, KeyProvider/KMS, authorization coverage, MCP scope gates, API compatibility, and licensing.

The existing HotM UX integration design predates this checkpoint. It describes feature-level Fortemi API integrations, but it does not define how HotM should safely expose hosted auth, realtime activity, premium component availability, or backoffice controls while backend contracts are still stabilizing.

## 2. Decision

HotM will use a capability-driven enterprise UX model for the next demo and construction phase.

Enterprise and backoffice surfaces must be enabled from Fortemi-reported deployment metadata, version compatibility, capability flags, and authenticated role/scope state. HotM must not infer enterprise readiness from static build configuration alone, and it must not expose production-looking controls for backend capabilities that are absent, incompatible, or explicitly disabled.

The UX update will prioritize five surfaces:

1. Connection and Compatibility Center.
2. Hosted Auth Onboarding.
3. Realtime Activity Drawer.
4. Premium Components Catalog.
5. Backoffice Console.

Each surface must have disabled, unavailable, and degraded states before it is considered demo-ready.

## 3. Decision Drivers

- HotM must demonstrate the latest Fortemi features without overstating hosted/enterprise readiness.
- API drift between HotM and Fortemi is already a known delivery risk.
- Premium and backoffice features require role/scope gating and audit discipline.
- Local sidecar and privacy-first flows must remain understandable when hosted capabilities are unavailable.
- Demo builds need deterministic sidecar/API compatibility rather than floating artifacts.

## 4. Considered Options

### Option 1: Static enterprise UI behind build flags

HotM could show enterprise controls based on a compile-time or environment feature flag.

**Rejected** because it can present controls that the connected Fortemi instance cannot actually support. It also makes demos fragile across sidecar/API versions.

### Option 2: Separate backoffice app first

Fortemi could build a dedicated backoffice application before any HotM enterprise UX work.

**Deferred** because HotM is the requested demonstration vehicle. A separate app may still be appropriate later for production operations, but it does not solve the near-term demo and product-discovery need.

### Option 3: Capability-driven HotM enterprise UX

HotM queries Fortemi for version, deployment mode, auth mode, role/scope state, and capability availability, then renders the relevant local, hosted, premium, and backoffice states.

**Selected** because it aligns the UX with actual backend readiness, supports graceful degradation, and keeps local-first/sidecar workflows intact.

## 5. Consequences

### Positive

- HotM can demonstrate new features while clearly showing unsupported or gated states.
- API compatibility becomes a visible product concern instead of a hidden runtime failure.
- Premium components can be discoverable without leaking private implementation details.
- Backoffice surfaces can be designed incrementally as Fortemi API contracts become real.
- The same UX shell can support local, single-tenant, hosted multi-tenant, and unavailable modes.

### Negative

- HotM now depends on a Fortemi version/capability contract before enterprise UX can be production-backed.
- Some early UX work may be blocked on backend capability discovery.
- Preview states must be carefully labeled to avoid confusing demo users.

### Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Capability metadata is incomplete or unstable. | Treat unknown capability state as unavailable and file backend contract gaps. |
| Users confuse preview controls with shipped enterprise features. | Use explicit disabled/degraded states and keep preview surfaces behind feature flags. |
| Hosted auth blocks the UX demo. | Keep local sidecar demo mode distinct; do not simulate production auth as complete. |
| Premium catalog leaks sensitive licensing state. | Show coarse capability state only; require admin scopes for operational detail. |

## 6. Implementation Requirements

- HotM must query Fortemi compatibility metadata before enabling advanced enterprise flows.
- The compatibility model must distinguish local sidecar, single-tenant server, hosted multi-tenant, and unavailable modes.
- Unsupported controls must explain what is missing: API version, auth state, role/scope, license, or backend capability.
- Realtime UX must expose connection, retry, last-event, and error states.
- Backoffice controls must be role-gated and auditable once backed by real APIs.
- Demo builds must pin Fortemi sidecar/API provenance by version and checksum.

## 7. Traceability

| Requirement | Filed issue |
|---|---|
| Fortemi capability/version contract | `Fortemi/fortemi#1018` |
| HotM compatibility guard | `Fortemi/HotM#244` |
| HotM enterprise UX update | `Fortemi/HotM#243` |
| Sidecar provenance | `Fortemi/HotM#245` |
| Realtime activity drawer | `Fortemi/HotM#246` |
| Backoffice API contract | `Fortemi/fortemi#1020` |

## 8. References

- Suite checkpoint: `/home/roctinam/dev/fortemi-suite/.aiwg/reports/sdlc-checkpoint-2026-07-06.md`
- HotM UX plan: `/home/roctinam/dev/fortemi-suite/.aiwg/planning/hotm-ux-enterprise-update-plan-2026-07.md`
- Requirements: `HotM/.aiwg/requirements/enterprise-demo-requirements-2026-07.md`
- Test plan: `HotM/.aiwg/testing/enterprise-demo-test-plan-2026-07.md`
- Architecture impact analysis: `/home/roctinam/dev/fortemi-suite/.aiwg/architecture/impact/enterprise-backoffice-phase-impact-2026-07.md`
- Prior UX design: `HotM/docs/ux/fortemi-integration-ux-design.md`
