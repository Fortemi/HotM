---
adr_id: ADR-AUTH-001
title: Public Fortemi authentication contract with native consumer implementations
status: accepted
date: 2026-07-26
canonical_source: "Fortemi/fortemi-auth (public MIT repository)"
related_artifacts:
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/reports/fortemi-auth-node-conformance-receipt-2026-07-26.md
  - .aiwg/reports/fortemi-auth-tenant-store-composition-receipt-2026-08-24.md
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
`1.1.0`, with RS256 only, from signed CalVer release `v2026.8.0`. Its corpus
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
`TenantStore` interface and a fail-closed unavailable default. HotM's executable
composition root now injects a narrow PostgreSQL implementation when a dedicated
tenant-registry connection is configured. It mirrors Fortemi's system-scoped
`SELECT id, status FROM tenant_registry WHERE id = $1` lookup, validates the row,
uses bounded pool timeouts, and closes the pool during process shutdown. No
identity-provider implementation or customer configuration enters this repo.

Focused verification covers the authority corpus, route protection,
configuration reuse, tenant admission, PostgreSQL composition, row-shape
validation, non-enumerating tenant states, JWKS rotation, outage, cache failure,
and concurrent fetch behavior. Fortemi's hosted implementation at commit
`0bcd537ba758177e89ddb9daf0810568197d38ea` is the tenant-registry contract
source consumed here. This proves the named Node profile and fixture-backed HotM
consumer boundary only. Its pinned compatibility response still advertises the
previous authority tuple and therefore fails HotM admission. Hosted promotion
remains blocked until Fortemi advertises the current tuple and a live receipt
proves the JWT-to-transaction-to-forced-RLS chain and cross-tenant denial.

## Consequences

- Consumers fail closed on unknown release, contract, and profile versions and unsupported JOSE algorithms.
- Error responses use stable redacted codes rather than provider diagnostics.
- Tenant existence remains a consumer-owned lookup after cryptographic verification.
- Hosted mode cannot admit traffic unless a tenant-store implementation is explicitly composed.
- The composed database identity is a dedicated system-scope reader, not the Fortemi tenant-table runtime or migration owner.
- A corpus receipt is compatibility evidence only for its named profile and pinned digest.
- Provider configuration and live keys remain runtime secrets and never enter fixtures.
- Contract `1.1.0` standardizes dependency outage, timeout, and malformed-response failures as `tenant_store_unavailable` with HTTP 503.
- Missing, suspended, and soft-deleted tenants remain indistinguishable as `unknown_tenant` with HTTP 403.

## Authority

- Repository: `https://git.integrolabs.net/Fortemi/fortemi-auth`
- Public ADR: `docs/adr/adr-002-public-core-distribution.md`
- Corpus: `conformance/v1/manifest.json`
- Manifest SHA-256: `ab846ba11f479b11638fb3f5bc7029f98ad498b028f6cf060171316b90552e94`
- Release: signed `v2026.8.0`, commit `36ba38efdd5ed57da2f2c2638529ee166255e198`
- Release policy: `conformance/v1/release-policy.json`
- Release-policy SHA-256: `828c6ff24f63b10f114b78e6f83a8db6bd53d53f903e4c4f246eaccb6eeac949`
- Tenant-store producer: `Fortemi/fortemi` commit `0bcd537ba758177e89ddb9daf0810568197d38ea`, `crates/matric-api/src/hosted_auth.rs`
- Tenant-store producer-file SHA-256: `cd8b2f10c3e8c352fb1507b3739a51bdc88716d79459000a62b3c2f44532eaf5`
