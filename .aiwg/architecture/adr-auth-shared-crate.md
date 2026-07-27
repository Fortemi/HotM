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
`1.0.0`, with RS256 only. Its fixture is byte-identical to the authority
manifest and tests accepted, rejected, and key-rotation cases.

The verifier is not yet installed as `agent-proxy` route middleware. The proxy
remains localhost-only; hosted and enterprise authentication are planned
deployment work and are not shipped by this ADR.

## Consequences

- Consumers fail closed on unknown contract versions and unsupported JOSE algorithms.
- Error responses use stable redacted codes rather than provider diagnostics.
- Tenant existence remains a consumer-owned lookup after cryptographic verification.
- A corpus receipt is compatibility evidence only for its named profile and pinned digest.
- Provider configuration and live keys remain runtime secrets and never enter fixtures.

## Authority

- Repository: `https://git.integrolabs.net/Fortemi/fortemi-auth`
- Public ADR: `docs/adr/ADR-AUTH-002-public-core-private-enterprise-providers.md`
- Corpus: `conformance/v1/manifest.json`
- Manifest SHA-256: `dbd7fff6370d8a0c55d2c7e4ad311d3ddd1796815e2caff6dc05501cdf417a38`
