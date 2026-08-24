---
title: Fortemi Auth Node Conformance Receipt
status: passed
date: 2026-07-26
profile: rust-node-jwt-v1
contract_version: 1.1.0
authority_repository: https://git.integrolabs.net/Fortemi/fortemi-auth
authority_release: v2026.8.0
authority_tag_object: fba96383107e26bed12e20b0d70d6ac01b7749a8
authority_commit: 36ba38efdd5ed57da2f2c2638529ee166255e198
manifest_sha256: ab846ba11f479b11638fb3f5bc7029f98ad498b028f6cf060171316b90552e94
release_policy_sha256: 828c6ff24f63b10f114b78e6f83a8db6bd53d53f903e4c4f246eaccb6eeac949
related_issues:
  - HotM/HotM#231
  - Fortemi/fortemi#1081
---

# Fortemi Auth Node Conformance Receipt

## Scope

This receipt covers only the public `fortemi-auth` contract `1.1.0` profile
`rust-node-jwt-v1`. It does not establish hosted deployment, enterprise
provider support, OAuth route integration, or suite-wide authentication parity.

## Consumer

- Implementation: `agent-proxy/src/auth/verify.ts`
- Fixture: `agent-proxy/src/auth/fixtures/fortemi-auth-v1.json`
- Release policy: `agent-proxy/src/auth/fixtures/fortemi-auth-release-policy-v1.json`
- Runtime: Node.js with `jose`
- Allowed JOSE algorithm: `RS256`

## Executed controls

- Verified the vendored manifest's exact SHA-256 before executing cases.
- Verified the vendored release policy's exact SHA-256.
- Executed all 13 authority cases, including expiry, future `iat`, `nbf`,
  signature tampering, issuer/audience mismatch, algorithm rejection, tenant
  extraction, exact scope matching, malformed input, and JWKS rotation.
- Compared accepted identity, tenant, scopes, and `kid` values.
- Compared every rejection to the authority's stable redacted error code.
- Executed all five tenant-store cases, including unavailable, timeout,
  malformed response, inactive, and not-found outcomes with exact HTTP status.
- Executed all eight CalVer release-policy cases. Only the exact current
  release/contract/profile/manifest tuple passed; bootstrap, previous/future
  trains, next year, contract/profile drift, and manifest drift failed closed.
- Ran TypeScript type checking and the complete `agent-proxy` Vitest suite.

## Result

`PASS` for `rust-node-jwt-v1` at the pinned authority commit and manifest digest
above. The updated full suite passed 28 files and 426 tests after a production
TypeScript build; focused auth tests and type checking also passed.

## Current-state addendum - 2026-08-24

The original July 26 result is superseded by the authority tuple above.
Authorized work for HotM #231 installs authentication before request parsing on
`/api/agent/chat`, reuses one immutable-config remote JWKS resolver per app
middleware instance, applies the shared redacted status mapping, and performs
an active-tenant lookup for every hosted admission.

Focused current-state tests cover app-level route protection, missing and
suspended tenants, tenant-store unavailability, JWKS rotation and outage, malformed
cache material, and concurrent-fetch coalescing. These tests do not alter the
pinned corpus result or establish hosted readiness. The executable process now
composes a PostgreSQL `TenantStore` over Fortemi's producer-owned
`tenant_registry` ID/status lookup when a dedicated connection is present.
Synthetic registry fixtures cover active, missing, suspended, soft-deleted,
unknown-status, mismatched-row, duplicate-row, and dependency-failure paths.

The pinned producer compatibility response still advertises the superseded
tuple and is rejected by this consumer. Fortemi must publish the current tuple
before hosted admission. The remaining live evidence must carry a real JWT
through Fortemi `AuthContext`, transaction-local tenant binding, and forced RLS
while proving same-tenant access and cross-tenant denial.
