---
title: Fortemi Auth Node Conformance Receipt
status: passed
date: 2026-07-26
profile: rust-node-jwt-v1
contract_version: 1.0.0
authority_repository: https://git.integrolabs.net/Fortemi/fortemi-auth
authority_release: v2026.7.0
authority_tag_object: e4eb45370d49c65fd04ce8e5bebb8cb904c0c168
authority_commit: 130919cc01a29a1360c5f110ad8e2f8277e66c0a
manifest_sha256: dbd7fff6370d8a0c55d2c7e4ad311d3ddd1796815e2caff6dc05501cdf417a38
release_policy_sha256: c8c6e2fd9237ddf238f74376aad841c53fce86885f95c982befdcbcd24880e5b
related_issues:
  - HotM/HotM#231
  - Fortemi/fortemi#1081
---

# Fortemi Auth Node Conformance Receipt

## Scope

This receipt covers only the public `fortemi-auth` contract `1.0.0` profile
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
- Executed all eight CalVer release-policy cases. Only the exact current
  release/contract/profile/manifest tuple passed; bootstrap, previous/future
  trains, next year, contract/profile drift, and manifest drift failed closed.
- Ran TypeScript type checking and the complete `agent-proxy` Vitest suite.

## Result

`PASS` for `rust-node-jwt-v1` at the pinned authority commit and manifest
digest above. Route middleware remains intentionally uninstalled pending the
hosted deployment configuration and integration gate.

## Current-state addendum - 2026-08-24

The result above is retained as the revision-bound July 26 receipt. Subsequent
authorized work for HotM #231 installs authentication before request parsing on
`/api/agent/chat`, reuses one immutable-config remote JWKS resolver per app
middleware instance, applies the shared redacted status mapping, and performs
an active-tenant lookup for every hosted admission.

Focused current-state tests cover app-level route protection, missing and
suspended tenants, tenant-store failure, JWKS rotation and outage, malformed
cache material, and concurrent-fetch coalescing. These tests do not alter the
pinned corpus result or establish hosted readiness. The public CE package ships
the tenant-store interface and a fail-closed default, while an internal
distribution must inject a concrete adapter. Producer-admitted auth metadata,
an approved tenant-status integration contract, and a live Fortemi tenant
isolation receipt remain required.
