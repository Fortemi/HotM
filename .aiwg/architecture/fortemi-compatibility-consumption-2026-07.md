# Fortemi Compatibility Consumption - 2026-07

## Purpose

Define how HotM consumes Fortemi compatibility metadata for the enterprise UX demo. This artifact supports `Fortemi/HotM#244` and pairs with `fortemi/.aiwg/architecture/api-compatibility-discovery-contract-2026-07.md`.

## Client Flow

1. On connection change, HotM requests `GET /api/v1/system/compatibility`.
2. HotM validates the compatibility contract revision, server API revision, and declared minimum supported HotM client before interpreting capabilities.
3. If the request fails, times out, has an unknown contract revision, requires a newer client, or returns an incompatible shape, HotM keeps local workflows available and marks affected server surfaces as unavailable.
4. HotM normalizes every capability into one of: `available`, `degraded`, `preview`, `unavailable`, or `unknown`.
5. HotM enables production controls only when contract revision, server API version, minimum-client constraint, deployment mode, capability state, auth state, role/scope, and local feature flag all allow the surface.
6. HotM treats `preview`, `unavailable`, and `unknown` as disabled for production-affecting actions.

## Contract Ownership

Fortemi owns the compatibility response schema and its revision semantics. HotM may normalize the response for presentation, but must not invent support for unknown revisions or infer compatibility from route presence.

The compatibility endpoint coordinates, but does not replace, the canonical contracts:

- OpenAPI for HTTP request/response shapes and security requirements.
- AsyncAPI for realtime event envelope and payload semantics.
- Knowledge Shard schema/profile metadata for portable import/export.
- `fortemi-auth` versioned claim fixtures for Rust/Node authentication behavior.

## Surface Mapping

| Compatibility field | HotM surface | Enablement rule |
|---|---|---|
| `contract_revision`, `server_api_revision`, `min_client_version` | Connection and Compatibility Center | Unknown revision or unmet minimum client disables affected server mutations. |
| `deployment.mode` | Connection and Compatibility Center | Display mode always; hosted production labels require `hosted_multi_tenant_ready: true`. |
| `auth.mode`, `auth.tenant_context_available` | Hosted Auth Onboarding | Hosted controls require `hosted_oauth` and tenant context. |
| `capabilities.realtime_activity` | Realtime Activity Drawer | `available` enables live connection; `preview` enables fixture/demo state only. |
| `capabilities.premium_components` | Premium Components Catalog | `available` may enable catalog details; `preview` shows coarse demo cards only. |
| `capabilities.backoffice_api` | Backoffice Console | Production actions require `available`; panels may render disabled in `preview`. |
| `capabilities.audit_posture` | Audit panel | `available` shows health; otherwise show blocker/reason. |
| `capabilities.quota_status` | Quota panel | `available` shows quota; otherwise show unavailable/preview state. |
| `capabilities.kms_status` | KMS panel | `available` shows coarse KMS posture; never show raw key IDs. |
| `capabilities.mcp_scope_gate` | MCP/admin status | `available` can show gate status; `preview` shows contract-only state. |

## Fixture Additions

Add these fields to the enterprise demo fixture family:

| Fixture | Required compatibility state |
|---|---|
| `local-sidecar-compatible` | `deployment.mode=local_sidecar`; core capabilities available; hosted/backoffice unavailable or preview. |
| `single-tenant-compatible` | `deployment.mode=single_tenant_server`; core/realtime available; hosted multi-tenant not ready. |
| `hosted-compatible-admin` | `deployment.mode=hosted_multi_tenant`; auth tenant context present; preview enterprise capabilities visible. |
| `hosted-compatible-insufficient-role` | Same as hosted admin, but production/admin controls disabled with `insufficient_role`. |
| `hosted-incompatible-version` | `reason_code=incompatible_api_version`; all enterprise controls disabled. |
| `hosted-unknown-capabilities` | Required capability keys missing or `unknown`; disable by default. |
| `api-unreachable` | No response; local workflows remain available. |
| `preview-only-backoffice` | `backoffice_api=preview`; panels visible; production actions disabled. |

## UI Rules

- Never enable a production-affecting backoffice action from `preview`, `unavailable`, or `unknown`.
- Unknown capability state is not a soft success; it is disabled-by-default.
- Reason text should map from stable `reason_code` values, not raw backend messages.
- Local/private flows must remain visible when enterprise metadata is absent.
- Rendered UI, logs, telemetry, and fixture snapshots must not include bearer tokens, API keys, raw tenant identifiers, KMS key IDs, raw license material, or private registry details.

## Test Hooks

- Compatibility revision tests cover supported, unknown, malformed, and minimum-client-not-met states.
- Compatibility normalization unit tests cover every capability state.
- Component tests cover the eight fixture families in `HotM/.aiwg/testing/enterprise-demo-test-plan-2026-07.md`.
- E2E smoke tests start from the Connection and Compatibility Center before navigating to hosted auth, realtime, premium catalog, or backoffice preview.
- Redaction tests include sensitive fixture values and assert they do not appear in rendered output or UI logs.

## 2026-07-06 Implementation Checkpoint

Initial route consumption is implemented in `ui/src/api/systemCompatibility.ts` and exposed through `api.systemCompatibility.get()`. The checkpoint proves request and presentation behavior for the observed response; it does not yet prove revision/minimum-client negotiation against a canonical versioned schema.

- `ApiCapabilitiesPanel` now requests `GET /api/v1/system/compatibility` alongside legacy health metadata.
- Compatibility capability states drive the advertised capability list when the endpoint is present.
- Unknown, preview, and unavailable states are treated as attention/disabled states, not successful availability.
- If compatibility discovery is unreachable, HotM falls back to legacy health metadata so current local sidecar workflows remain visible.
- Focused verification passed with `npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run` and `npm run typecheck`.

## 2026-07-06 Enterprise Preview Checkpoint

`ApiCapabilitiesPanel` now includes an Enterprise Preview section for the first premium/backoffice UX demonstration.

- Surfaces covered: hosted auth, realtime activity, premium components, backoffice console, audit posture, quota status, KMS status, and MCP scope gate.
- Each surface is gated from the Fortemi compatibility contract and displays state plus stable reason code.
- Production-affecting actions remain represented as disabled unless the capability state is `available`.
- Missing compatibility metadata and missing capability keys resolve to `unknown` and `production disabled`.
- Focused verification passed with `npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx --run` and `npm run typecheck`.

## Target-State Release Gate

Production compatibility is established only when a pinned Fortemi compatibility fixture matrix passes, the corresponding OpenAPI and AsyncAPI revisions are accepted, any Knowledge Shard profile used by Backup Manager passes cross-repository golden tests, and the auth claim-contract version is supported. Until then, the existing implementation is capability-display evidence, not full suite interoperability evidence.

## 2026-07-24 Contract Boundary Receipt

The client now enforces compatibility schema `1`, contract revision
`2026-07-06`, and `minimum_hotm_enterprise_client` before it normalizes any
capability. The comparison uses the exact version from `ui/package.json`.
Unsupported schema/revision, malformed minimum policy, and unmet minimum
produce typed contract errors and therefore use the existing
unavailable/degraded UI behavior; local workflows remain visible.

`ui/src/api/__tests__/systemCompatibility.test.ts` covers supported, equal
minimum, checkpoint prerelease, future revision, too-old client, malformed
minimum, and unsupported schema. Existing API/panel tests retain the
unreachable state. This is the HotM #244 consumer receipt; it does not collapse
the independent OpenAPI, AsyncAPI, Knowledge Shard, or auth gates.
