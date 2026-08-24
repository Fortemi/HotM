---
adr_id: ADR-AUTH-001
title: Public Fortemi authentication contract with native consumer implementations
status: accepted
date: 2026-07-26
canonical_source: "Fortemi/fortemi-auth (public MIT repository)"
related_artifacts:
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/reports/fortemi-auth-node-conformance-receipt-2026-07-26.md
related_issues:
  - "#2 OAuth2/API Key Authentication"
  - "#224 Mobile expansion epic"
  - "#231 Native auth corpus conformance"
  - "Fortemi/fortemi#707"
---

# ADR-AUTH-001 - Public authentication contract

## Decision

`Fortemi/fortemi-auth` is the public MIT-licensed authority for provider-neutral
authentication behavior, stable error codes, tenant extraction, exact scope
matching, and the versioned cross-language fixture corpus.

Rust services consume the public `fortemi-auth-core`, `fortemi-auth-clerk`, and
`fortemi-auth-axum` crates. HotM's Node boundary remains independently
implemented with `jose`; it must pass the exact authority corpus rather than
claiming compatibility from matching type names or route presence. Future
enterprise-only identity providers may remain private, but may not redefine the
public core contract.

## Current disposition

The Node verifier supports the named `rust-node-jwt-v1` profile from contract
`1.0.0`, with RS256 only, from signed CalVer release `v2026.7.0`. Its corpus
and release-policy fixtures are byte-identical to the authority. Tests cover
accepted, rejected, and key-rotation cases plus fail-closed handling for older
and newer release trains, contract/profile drift, and manifest drift.

The verifier is installed as fail-closed `agent-proxy` route middleware and
derives the request auth context consumed by downstream forwarding. Production
middleware snapshots immutable verifier configuration and constructs one
reusable `jose` remote JWKS resolver, preserving its cache and concurrent-fetch
coalescing across requests. The shared `AuthError` status mapping includes
redacted 503 responses for JWKS reachability and cache failures.

Every cryptographically valid hosted request then performs an active-tenant
lookup. Missing, suspended, and soft-deleted tenants reject as `unknown_tenant`;
lookup failure rejects as a redacted 503. The public CE package owns the
`TenantStore` interface and a fail-closed unavailable default. Internal
enterprise packaging may inject a backing implementation at app composition,
but it does not redefine the public verifier or admission contract and no
proprietary implementation belongs in this repository.

Focused verification covers the authority corpus, route protection,
configuration reuse, tenant admission, JWKS rotation, outage, cache failure,
and concurrent fetch behavior. This proves the named Node contract profile and
the HotM consumer boundary only. Hosted promotion remains blocked until Fortemi
advertises admitted auth contract metadata, provides an approved tenant-status
integration contract, and a live hosted receipt proves tenant isolation at the
persistence boundary.

## Consequences

- Consumers fail closed on unknown release, contract, and profile versions and unsupported JOSE algorithms.
- Error responses use stable redacted codes rather than provider diagnostics.
- Tenant existence remains a consumer-owned lookup after cryptographic verification.
- Hosted mode cannot admit traffic unless a tenant-store implementation is explicitly composed.
- A corpus receipt is compatibility evidence only for its named profile and pinned digest.
- Provider configuration and live keys remain runtime secrets and never enter fixtures.
- The upstream tenant-extraction guide names `tenant_store_failure` with status 503, but the current `fortemi-auth-core::AuthError` enum omits that variant. HotM keeps the fail-closed extension local until the authority resolves the mismatch.

## Authority

- Repository: `https://git.integrolabs.net/Fortemi/fortemi-auth`
- Public ADR: `docs/adr/adr-002-public-core-distribution.md`
- Corpus: `conformance/v1/manifest.json`
- Manifest SHA-256: `dbd7fff6370d8a0c55d2c7e4ad311d3ddd1796815e2caff6dc05501cdf417a38`
- Release: signed `v2026.7.0`, commit `130919cc01a29a1360c5f110ad8e2f8277e66c0a`
- Release policy: `conformance/v1/release-policy.json`
- Release-policy SHA-256: `c8c6e2fd9237ddf238f74376aad841c53fce86885f95c982befdcbcd24880e5b`
