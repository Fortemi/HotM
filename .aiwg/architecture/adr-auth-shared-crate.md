---
adr_id: ADR-AUTH-001
title: OAuth via shared private Rust crate consumed by HotM + Fortemi
status: Proposed
date: 2026-05-17
decision_drivers:
  - HotM mobile expansion (#224) requires multi-tenant auth (ADR-MOBILE-001 Decision 7)
  - Fortemi Integration epic (#1) cannot ship without auth (#2 P0, open since Feb 2026)
  - Avoid duplicating OAuth/JWT logic between matric-api and any future Fortemi-side endpoints
  - Keep IdP integration details (Clerk customer ID, Auth0 tenant subdomain, etc.) out of public repos
  - Provider abstraction so IdP choice is reversible without touching call sites
deciders:
  - HotM operator
related_artifacts:
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/architecture/manifest-schema-v1.md
  - .aiwg/planning/mobile-expansion-phase-plan.md
  - .aiwg/research/findings/mobile-multitenant-byo-llm.md
related_issues:
  - "#2 OAuth2/API Key Authentication (this ADR scopes the implementation)"
  - "#224 Mobile expansion epic (blocked on this)"
  - "#1 Fortemi Integration epic (blocked on this)"
  - "#116 Embedded AI Assistant epic (blocked on this via #120, #121)"
supersedes_scope_of:
  - "#2 (the 'how' — this ADR replaces the implementation outline with the shared-crate architecture)"
---

# ADR-AUTH-001 — OAuth via shared private Rust crate

## Status

Proposed. Strategic intent established 2026-05-17. This ADR specifies the implementation shape for the OAuth + JWT auth layer used by both HotM (matric-api when run as a sidecar, plus future Fortemi-side endpoints in the hosted multi-tenant deployment per ADR-MOBILE-001) and Fortemi (`fortemi/crates/matric-api`).

## Context

HotM #2 has been open since Feb 4, 2026 as a P0 covering OAuth 2.0 + API key authentication for the Fortemi API. The original scope assumed a single-codebase implementation. Two developments since then make a single-codebase approach incorrect:

1. **ADR-MOBILE-001 mandates hosted multi-tenant `matric-api`.** Both the HotM local-mode sidecar and the Fortemi hosted service will run substantially the same Rust binary in different deployment modes. They need identical token-verification semantics; duplicated implementations will drift.
2. **Implementation details should not be public.** Customer-specific IdP configuration (Clerk customer IDs, tenant subdomains, audience URIs, signing key custody) belongs in a private repo. The HotM and Fortemi public repos should depend on the auth crate as an opaque dependency.

The decision is therefore not "build OAuth into matric-api" but "build OAuth into a separate private Rust crate, and integrate it into matric-api via Cargo's git-dependency mechanism."

## Decision

**Decision 1 — Auth lives in a new private repo, structured as a Cargo workspace.** Repo name (proposed): `Fortemi/fortemi-auth` (private; mirrored to GitHub if desired). The crate is consumed by `fortemi/crates/matric-api` via a `git = "..."` Cargo dependency, not via crates.io.

**Decision 2 — The workspace contains three crates with a clean provider boundary:**

```
Fortemi/fortemi-auth (private repo)
└── crates/
    ├── fortemi-auth-core/    # provider-agnostic types + traits + JWT verify
    ├── fortemi-auth-clerk/   # Clerk provider implementation (or auth0, keycloak)
    └── fortemi-auth-axum/    # axum tower::Layer + extractors
```

`fortemi-auth-axum` is the entry point matric-api depends on. It re-exports the needed types from `-core` so consumers don't pull in `-core` directly.

**Decision 3 — Underlying OIDC layer: `xjp-oidc`.** Production-ready multi-issuer OIDC SDK with JWKS caching, OIDC Discovery, ID Token + Access Token verification, and axum middleware. Already published on crates.io with active maintenance. We wrap it rather than rolling our own JWT verification. Alternatives considered in §Alternatives.

**Decision 4 — Provider abstraction via a trait, not a feature flag.** `fortemi-auth-core` defines `trait OAuthProvider` with the operations matric-api needs (verify token, extract claims, refresh, revoke). `fortemi-auth-clerk` and (later) `fortemi-auth-auth0` etc. implement the trait. Switching providers is a dependency swap + config change, not a code change in matric-api.

**Decision 5 — Tenant extraction is the crate's responsibility.** The crate maps verified token claims (`sub`, custom claims) to a `tenant_id` UUID that matric-api uses for the RLS `SET LOCAL app.current_tenant` (per ADR-MOBILE-001 Decision 6). This keeps the multi-tenant logic in one place — neither matric-api nor the IdP itself owns the mapping.

**Decision 6 — API key support is a parallel auth path, not a replacement for OAuth.** Some clients (CI pipelines, server-to-server integrations) cannot do OAuth. The crate provides `enum Credential { Bearer(JwtToken), ApiKey(ApiKeyToken) }` with both paths validated through the same middleware, producing the same `AuthContext` extractor in matric-api. API keys are issued by Fortemi/HotM, not the IdP — they live in the application database (hashed) per the existing #2 acceptance criteria.

**Decision 7 — Frontend integration uses the IdP's official SDK, not a custom layer.** HotM's React frontend uses (e.g.) `@clerk/clerk-react` for the OAuth flow — sign-in UI, PKCE, token storage, refresh. The Rust crate is server-side only; the frontend integration is provider-specific JavaScript. This is a one-time per-provider integration cost on the frontend.

**Decision 8 — agent-proxy (Node.js sidecar) gets a separate verification step, not a Rust crate.** The agent-proxy is Express + Node and cannot consume Rust crates. It verifies tokens against the same JWKS endpoint using `jose` (the standard Node JWT library) and reads tenant_id from the same claim structure. This is a small duplication (~30 lines) but unavoidable given the language split. Document the claim contract in `fortemi-auth-core` so the Node implementation references the same spec.

## Consequences

### Positive

- **Single source of truth for token verification semantics.** matric-api in local-mode (HotM desktop sidecar) and hosted-mode (Fortemi multi-tenant) use the same crate; they cannot drift.
- **IdP swap is reversible.** Decision to use Clerk at launch (per ADR-MOBILE-001) can be revisited without rewriting matric-api. Implement `fortemi-auth-auth0` or `fortemi-auth-keycloak` against the trait and switch.
- **Public repos stay public.** Customer-specific configuration, signing keys, audience URIs, and IdP integration details remain in the private repo.
- **Tenant extraction is enforced uniformly.** Every endpoint that uses `AuthContext` gets the right `tenant_id` automatically; no risk of a developer using `sub` directly and getting it wrong.
- **API key path is unified with OAuth.** No second middleware, no second extractor — same `AuthContext` regardless of credential type.
- **xjp-oidc handles the hard parts.** JWKS caching, key rotation, multi-issuer routing, OIDC discovery — all production-tested.

### Negative / costs

- **A new private repo to operate.** Repository governance, CI for the crate itself, dependabot, security patch cadence — all new ops surface.
- **Cargo private git dependency complexity.** Local developer workflow (SSH keys), CI workflow (`CARGO_NET_GIT_FETCH_WITH_CLI=true` + token), Renovate config — each is well-trodden but adds steps to onboarding.
- **Three crates is more than strictly necessary at launch.** Could ship as one crate; the split is investment for the provider-swap option. Justified because the swap option is real and the split is cheap if done upfront.
- **Frontend SDK lock-in per provider.** Switching from Clerk's React SDK to Auth0's React SDK is a frontend rewrite of the auth screens. The Rust crate's provider-swap freedom does not extend to the frontend.
- **agent-proxy duplication.** ~30 lines of Node JWT verification logic mirrors what the Rust crate does. Maintenance overhead is small but real.
- **Bootstrap problem.** matric-api cannot start without the auth crate compiled; auth crate cannot be developed without matric-api as a test harness. Solve via `path = "../fortemi-auth/crates/fortemi-auth-axum"` for local development, `git = "..."` for production.

### Risks

| Risk | Mitigation |
|---|---|
| Private repo access lost on CI runner (expired deploy key) | Use a dedicated CI deploy key with no-expiry on the runner; document rotation in `docs/operations/ci-keys.md`. |
| Token verification bypass via crate downgrade attack | Cargo.lock pinned in matric-api; CI verifies lockfile commit. Updates to the auth crate require explicit version bump in matric-api. |
| Tenant extraction logic has a bug that mixes tenants | Tested in the Phase 1 isolation suite (per ADR-MOBILE-001 phase plan); CI gate fails the build if any test case regresses. |
| `xjp-oidc` becomes unmaintained | Trait abstraction means we can swap to `axum-jwks` or roll our own JWT verification on `jsonwebtoken`. The provider trait isolates this. |
| IdP migration mid-implementation (Clerk → Auth0) | The provider trait was designed for this. Concrete migration involves: implement the new `fortemi-auth-<provider>` crate against the trait, swap the Cargo dep, run the test suite. Frontend is more work (see Negative § above). |
| API keys and JWTs treated as interchangeable when they shouldn't be | The `Credential` enum forces explicit destructuring at boundary; per-endpoint policy can require Bearer-only by matching on variant. |
| Bootstrap cycle (auth crate ↔ matric-api) blocks parallel dev | Use `path =` deps during early dev; switch to `git =` once the crate has a stable v0.1.0 tag. |

## Alternatives considered

### Alternative 1 — Inline auth in matric-api (no separate crate)

The original #2 scope: implement JWT verification + API key handling directly in matric-api.

**Rejected because:** any future Fortemi-side service (not HotM-sidecar, but a separate API for billing, admin, etc.) would need to duplicate the verification. With multi-tenancy and a hosted deployment now in scope (ADR-MOBILE-001), duplication is inevitable. Splitting upfront is cheaper than refactoring later.

### Alternative 2 — Public crate on crates.io

Same shape, but the crate is public.

**Rejected because:** IdP-specific configuration (Clerk's customer ID, our audience URI, our tenant claim schema) is operationally sensitive. Keeping the crate private gates this material behind repo access. The Rust ecosystem support for private git deps is mature enough that the inconvenience is low.

### Alternative 3 — Single crate (no workspace split)

`fortemi-auth` as one crate with everything inline.

**Rejected because:** the provider abstraction is the load-bearing reason to do this work upfront. A single-crate version conflates the provider implementation with the trait. Swapping providers would mean editing the crate's main module rather than swapping a dependency. The workspace split is cheap and makes the abstraction structural.

### Alternative 4 — Use `xjp-oidc` directly in matric-api (no wrapper crate)

`matric-api/Cargo.toml` adds `xjp-oidc` as a direct dependency; tenant extraction lives in matric-api code.

**Rejected because:** tenant extraction is the load-bearing security property. If it lives in matric-api, future services have to re-implement it correctly. If it lives in the shared crate, the trait + `AuthContext` extractor enforce correctness at the type level. This is the same argument that justifies splitting tenant_id into a database column rather than relying on application code to filter — single source of truth.

### Alternative 5 — Open-source the auth crate but keep config in private repos

A common pattern: the code is open, but the config (URLs, customer IDs) is environment-injected.

**Rejected because:** while config-via-env is good practice and we will use it, the crate also contains the implementation details of how we map IdP claims to tenant_ids — a piece of operational logic that benefits from being non-public. Re-evaluate after launch: if the crate's contents become "just glue", revisit and open-source.

### Alternative 6 — Auth0 / Clerk SDK directly in matric-api (no abstraction)

Most aggressive provider lock-in choice. Skip the trait, call Auth0's Rust SDK directly.

**Rejected because:** provider lock-in is the worst-case outcome. The cost of the trait abstraction is one Rust file (`provider.rs`, ~50 lines); the cost of un-locking from a provider after a year of usage is a significant refactor. The trait is cheap insurance.

## Implementation outline

The full implementation plan lives in the **HotM mobile expansion phase plan** (which already places auth in Phase 2). This ADR adds the following structural specifications that the phase plan inherits:

1. **Repo: `Fortemi/fortemi-auth`** (private, to be created by operator). Workspace with three crates.
2. **`fortemi-auth-core`** publishes (semver-stable): `trait OAuthProvider`, `struct AuthConfig`, `struct AuthContext { user_id, tenant_id, scopes, credential: Credential }`, `enum Credential { Bearer(JwtToken), ApiKey(ApiKeyToken) }`, `enum AuthError`.
3. **`fortemi-auth-clerk`** implements `OAuthProvider` for Clerk using `xjp-oidc` as the underlying JWT verifier. Configurable via `ClerkConfig { customer_id, audience, jwks_cache_ttl }`. Pulls Clerk's instance JWKS endpoint, verifies tokens, extracts the standard OIDC claims plus Clerk's custom claims.
4. **`fortemi-auth-axum`** publishes `auth_layer(config) -> impl tower::Layer` and `pub use AuthContext`. The layer:
   - Reads `Authorization: Bearer <token>` header
   - Falls back to `X-API-Key: <key>` header for API key auth
   - Validates via the configured `OAuthProvider`
   - Extracts `tenant_id` per `provider.extract_tenant(&claims)`
   - Inserts `AuthContext` into request extensions
   - Returns `401 Unauthorized` on validation failure with structured body `{ "error": "invalid_token", "reason": "<details>" }`
5. **matric-api integration**: adds `fortemi-auth-axum = { git = "ssh://git@git.integrolabs.net:Fortemi/fortemi-auth.git", branch = "main" }` to `Cargo.toml`. Wraps the API router in the auth layer. Per-handler RLS context-set reads `tenant_id` from `Extension<AuthContext>`.
6. **agent-proxy integration** (separate sub-issue): adds `jose` (Node JWT lib), fetches the same JWKS endpoint, verifies tokens, extracts the same claims structure. Reference the claim-contract doc in `fortemi-auth-core`.

## Traceability

**Existing ADRs this builds on:**

- @.aiwg/architecture/adr-mobile-cloud-architecture.md — Decision 7 (OAuth 2.0 + PKCE) is now implementation-specified here. Decision 6 (RLS) depends on `tenant_id` extraction implemented in this crate.

**Issues this ADR scopes:**

- **#2** OAuth2/API Key Auth — this ADR replaces the "Technical Notes" section of #2's original body with the shared-crate architecture. The acceptance criteria (OAuth flow, API key endpoints, refresh, rate limits, middleware, docs, migration guide, security audit) remain valid; the **how** changes.
- **#224** Mobile expansion epic — Phase 2 work depends on this crate.
- **#1** Fortemi Integration epic — every API feature in #3-#8 depends on this.
- **#116** Embedded AI Assistant epic — #120 (Fortemi ops as tool calls) and #121 (backend proxy for cloud keys) both depend on this.

**Cross-repo work:**

- New private repo: `Fortemi/fortemi-auth` (operator to create)
- New sub-issues in `Fortemi/HotM` for client-side integration
- New sub-issues in `Fortemi/fortemi` for matric-api integration
- New sub-issues in `Fortemi/fortemi-auth` for the crate work itself

**Supersedes:** none. Adds to the auth track without retiring any ADR.

## Open questions

1. **Final IdP choice — Clerk or Auth0?** ADR-MOBILE-001 said "Clerk or Auth0"; this ADR needs a single pick to specify the first provider crate's name. Recommend Clerk for: free tier generosity for the launch user count, React SDK quality, OIDC compliance is solid. Re-evaluate at scale.
2. **Repo location: under `Fortemi` org or `roctinam` personal namespace?** Per the existing repo pattern (HotM and fortemi both under `Fortemi`), recommend `Fortemi/fortemi-auth`.
3. **GitHub mirror?** The HotM and fortemi repos mirror to GitHub. The auth crate is private — do we still want a GitHub mirror for backup, or keep it Gitea-only? Recommend Gitea-only for the auth crate (simpler, fewer surfaces to secure).
4. **API key issuance UI surface.** ADR-MOBILE-001 punts on "how does the user get an API key". The frontend needs a settings panel (Phase 2 work). Where in the React component tree does this live? Tie to issue #122 (Provider settings UI).
5. **Token claim schema for tenant_id.** Does Clerk natively support custom claims with our `tenant_id` UUID, or do we map from `sub` (Clerk user ID) → our internal user table → `tenant_id`? The latter is more flexible but requires a database hop on every token verification. Cache aggressively.
6. **Scopes/permissions model.** ADR-MOBILE-001 doesn't specify scopes. This ADR's `AuthContext` has `scopes: Vec<String>`. What scopes do we need at launch? Recommend deferring to a sub-ADR or to the Phase 2 implementation sub-issue (likely just `read`, `write`, `admin` at launch).
7. **API key format and revocation.** Hashed in DB per #2. Format: opaque `sk_live_<entropy>` style? UUID-style? Hash algorithm — bcrypt vs argon2id. Recommend argon2id per existing crypto rules.

These are implementation-detail open questions that don't block ADR acceptance; they block the Phase 2 implementation sub-issues that this ADR will spawn.
