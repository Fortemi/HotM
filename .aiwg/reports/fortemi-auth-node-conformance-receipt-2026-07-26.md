---
title: Fortemi Auth Node Conformance Receipt
status: passed
date: 2026-07-26
profile: rust-node-jwt-v1
contract_version: 1.0.0
authority_repository: https://git.integrolabs.net/Fortemi/fortemi-auth
authority_commit: 656d44fe3f16ef9b0c8c71cf394d06455f86e2b5
manifest_sha256: dbd7fff6370d8a0c55d2c7e4ad311d3ddd1796815e2caff6dc05501cdf417a38
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
- Runtime: Node.js with `jose`
- Allowed JOSE algorithm: `RS256`

## Executed controls

- Verified the vendored manifest's exact SHA-256 before executing cases.
- Executed all 13 authority cases, including expiry, future `iat`, `nbf`,
  signature tampering, issuer/audience mismatch, algorithm rejection, tenant
  extraction, exact scope matching, malformed input, and JWKS rotation.
- Compared accepted identity, tenant, scopes, and `kid` values.
- Compared every rejection to the authority's stable redacted error code.
- Ran TypeScript type checking and the complete `agent-proxy` Vitest suite.

## Result

`PASS` for `rust-node-jwt-v1` at the pinned authority commit and manifest
digest above. Route middleware remains intentionally uninstalled pending the
hosted deployment configuration and integration gate.
