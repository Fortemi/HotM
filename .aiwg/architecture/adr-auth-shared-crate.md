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

The verifier is not yet installed as `agent-proxy` route middleware. The proxy
remains localhost-only; hosted and enterprise authentication are planned
deployment work and are not shipped by this ADR.

## Consequences

- Consumers fail closed on unknown release, contract, and profile versions and unsupported JOSE algorithms.
- Error responses use stable redacted codes rather than provider diagnostics.
- Tenant existence remains a consumer-owned lookup after cryptographic verification.
- A corpus receipt is compatibility evidence only for its named profile and pinned digest.
- Provider configuration and live keys remain runtime secrets and never enter fixtures.

## Authority

- Repository: `https://git.integrolabs.net/Fortemi/fortemi-auth`
- Public ADR: `docs/adr/ADR-AUTH-002-public-core-private-enterprise-providers.md`
- Corpus: `conformance/v1/manifest.json`
- Manifest SHA-256: `dbd7fff6370d8a0c55d2c7e4ad311d3ddd1796815e2caff6dc05501cdf417a38`
- Release: signed `v2026.7.0`, commit `130919cc01a29a1360c5f110ad8e2f8277e66c0a`
- Release policy: `conformance/v1/release-policy.json`
- Release-policy SHA-256: `c8c6e2fd9237ddf238f74376aad841c53fce86885f95c982befdcbcd24880e5b`
