---
adr_id: ADR-MOBILE-001
title: Mobile expansion uses Tauri 2 mobile with cloud-only backend
status: Proposed
date: 2026-05-17
decision_drivers:
  - Existing Tauri 2.10.2 + React 19 + Vite + Tailwind investment
  - Mobile cannot run Postgres, Ollama, or sidecars locally
  - Single-codebase maintenance discipline
  - BYO-LLM economics — operator does not bear inference cost
  - HotM is configurable inference (not Ollama-only); mobile parity demands this stays true
deciders:
  - HotM operator
related_artifacts:
  - .aiwg/research/findings/mobile-tauri2-production-patterns.md
  - .aiwg/research/findings/mobile-multitenant-byo-llm.md
  - .aiwg/research/findings/mobile-manifest-remote-config.md
  - .aiwg/architecture/manifest-schema-v1.md
  - .aiwg/planning/mobile-expansion-phase-plan.md
  - .aiwg/architecture/ADR-001-client-server-architecture.md
  - .aiwg/architecture/ADR-002-database-schema-rebuild.md
  - .aiwg/architecture/ADR-007-spa-privacy-model.md
  - .aiwg/reports/tauri-v2-research-2026-02.md
related_issues:
  - "#2 OAuth2/API Key Authentication (blocks this)"
  - "#222 postinst trim + first-run wizard (overlaps on backend extraction)"
  - "#31 First-Run Onboarding Flow"
  - "#30 One-Click Personal Install Experience"
---

# ADR-MOBILE-001 — Mobile expansion uses Tauri 2 mobile with cloud-only backend

## Status

**Proposed (revision 1, post-Wave-3 review)**. Strategic intent confirmed by the operator on 2026-05-17. Reviewed in a Wave-3 multi-agent pass: Security Architect, Test Architect, Requirements Analyst, Technical Writer all returned APPROVED_WITH_CHANGES. The required changes were merged into this revision; see `.aiwg/working/mobile-planning/review-synthesis.md` for the consolidated finding list and which findings remain as follow-up artifacts.

This ADR documents the decision so downstream planning artifacts (the phase plan, the manifest schema doc, and `matric-api` migration tickets) can proceed against a stable reference.

### Revision log

| Rev | Date | Change | Source |
|---|---|---|---|
| 0 | 2026-05-17 | Initial draft by Architecture Designer agent. | Wave-2 multi-agent orchestration. |
| 1 | 2026-05-17 | Decision 4 hardened: KMS at launch (not "later"); explicit reference to `cryptographic-decisions.md`. Decision 5 sharpened: only API base URL is baked in; manifest is version-controlled. Decision 6 hardened: RLS invariants (NOBYPASSRLS role, FORCE RLS, CI gate, transaction discipline, schema-per-tenant escalation trigger). Decision 7 hardened: App Links / Universal Links over custom URL schemes; refresh token in platform-native secure storage. | Wave-3 reviews (Security 1.1/1.2/2.1/2.2/4.1, Technical Writer 4/5). |

## Context

HotM today is a desktop application built on Tauri 2.10.2, React 19, Vite, and Tailwind, with a sidecar Rust service (`matric-api`) that owns Postgres + pgvector and handles inference proxying. The current install path lands all of that on a user's local machine. ADR-001 established the client-server split inside a single desktop install; ADR-002 rebuilt the schema; ADR-007 set the SPA privacy posture. The desktop story is well-formed.

Mobile is a different problem. The platforms — iOS and Android — cannot host Postgres, cannot host Ollama, cannot host arbitrary native sidecars, and reject apps that try. The Tauri 2 sidecar mechanism (`tauri-plugin-shell`) is explicitly unsupported on mobile per the upstream architecture (see @.aiwg/research/findings/mobile-tauri2-production-patterns.md §4). This is not a gap on a roadmap — it is a categorical limit of the mobile platforms themselves.

The strategic question is therefore not "how do we port the desktop stack to mobile" but "what does the mobile architecture look like given that the local-install model cannot exist there." Three sub-questions follow:

1. Which mobile framework do we use, given existing Tauri 2 desktop investment?
2. Where does the backend live for mobile, given local-install is off the table?
3. What does this imply for desktop — does desktop keep its local-install model, or does mobile force desktop into a cloud-only mode too?

A fourth question — economic, not architectural — sits behind all three: HotM does not bear inference cost. The product position has always been that users bring their own LLM provider (Anthropic, OpenAI, OpenRouter, Ollama, etc.) and pay providers directly. A mobile expansion that breaks this position (e.g., by proxying inference on operator-funded keys) is a product change, not just an architecture change. The user's stated configurability requirement (see persistent memory: "Fortemi inference configurability is a stated design goal") makes this non-negotiable.

## Decision

**Decision 1 — Framework: Tauri 2 mobile.** The mobile builds for Android and iOS use Tauri 2 mobile. This keeps the frontend codebase (React 19 + Vite + Tailwind) unchanged and avoids a parallel rewrite in Capacitor, React Native, or Flutter. Tauri 2 mobile reached stable on 2024-10-02 and has shipped through the 2.10.x line we already depend on (@.aiwg/research/findings/mobile-tauri2-production-patterns.md §1).

**Decision 2 — Backend model: cloud-only for mobile.** The mobile build does not ship the `matric-api` sidecar. There is no local Postgres, no local Ollama, no local sidecar on mobile. The mobile build talks to a hosted multi-tenant deployment of `matric-api` over HTTPS. This is the only path consistent with the Tauri 2 mobile sidecar gap (@.aiwg/research/findings/mobile-tauri2-production-patterns.md §4) and is the path the research finding directly recommends.

**Decision 3 — Desktop retains hybrid mode.** Desktop continues to support the current local-install path (sidecar, local Postgres, local Ollama). Desktop additionally gains an optional cloud mode in which it talks to the same hosted backend that mobile uses. Mode selection is a build-time and/or runtime flag — same frontend code, different transport. Users who value local-only privacy keep that path; users who want sync across desktop and mobile choose cloud mode.

**Decision 4 — BYO-LLM (bring your own LLM key), with KMS-managed envelope encryption at launch.** Inference cost is not borne by HotM. The hosted backend proxies user requests, but every provider call uses the requesting user's own provider key. The user pays the provider directly. The proxy pattern is well-established (OpenRouter, LiteLLM, Helicone, VoidLLM all ship variants of it — @.aiwg/research/findings/mobile-multitenant-byo-llm.md §3). Prompts and responses are metadata-only logged by default; content logging is opt-in.

Provider keys are stored using envelope encryption. The Key Encryption Key (KEK) is held in a **managed KMS at launch** — AWS KMS, GCP KMS, or HashiCorp Vault Transit (all have free/cheap tiers consistent with the operator economics in research §4). A "KEK file on disk" launch posture is rejected because it fails against host-root compromise, memory disclosure, and backup-tape exfil; the migration path to KMS later is too easy a path to defer. Detailed cryptographic decisions — AEAD primitive, KDF, wrap mode, and domain-separation labels — are recorded in `.aiwg/architecture/cryptographic-decisions.md` (to be authored before Phase 1 begins; reviewed by the `applied-cryptographer` agent). This ADR commits to envelope encryption with explicit AEAD + HKDF; the specific primitives are detailed in that sub-doc to satisfy the project's crypto rules (`no-key-reuse-across-purposes`, `no-adhoc-kdf`, `no-unauthenticated-encryption`).

**Decision 5 — Manifest endpoint for runtime configuration.** Only the API base URL is baked into the mobile binary; all other runtime configuration — auth provider details, available LLM providers and models, feature flags, branding, tier limits, and a minimum-supported-version field — is delivered via `GET /v1/manifest`. Schema and refresh semantics are documented in `.aiwg/architecture/manifest-schema-v1.md`. The endpoint is unauthenticated (it serves the configuration needed to render the login screen), cache-TTL'd, and ETag-conditional (@.aiwg/research/findings/mobile-manifest-remote-config.md §5, §8). The manifest is version-controlled in this repo; every change is auditable through `git log` rather than being a production knob without history.

**Decision 6 — Multi-tenant isolation: shared schema + Postgres RLS, with enforcement invariants.** The hosted `matric-api` uses shared-schema with `tenant_id UUID NOT NULL` on every user-data table and Postgres Row-Level Security policies enforcing isolation against `current_setting('app.current_tenant')` set per request inside a transaction. This is the convergent recommendation from AWS, Crunchy, and Supabase (@.aiwg/research/findings/mobile-multitenant-byo-llm.md §1, §2). pgvector queries combine the B-tree tenant filter with HNSW/IVFFLAT distance indexing.

To make RLS load-bearing (not advisory), the following invariants are mandatory:

- **Database role**: `matric-api` connects as a Postgres role with `NOSUPERUSER NOBYPASSRLS`. A startup assertion fails-closed if the connecting role has either attribute.
- **Force RLS**: `ALTER TABLE ... FORCE ROW LEVEL SECURITY` is set on every tenant-scoped table. This applies RLS even to the table owner.
- **CI gate**: A CI step queries `pg_class` / `pg_policy` and fails the build when any table in the tenant-scoped schema lacks `rowsecurity = true` or has no policy referencing `current_setting('app.current_tenant')`. New table without RLS = failed build.
- **Transaction discipline**: Every request handler wraps its query work in `BEGIN` / `COMMIT` and uses `SET LOCAL app.current_tenant = ...` inside the transaction. Session-mode connection pooling (PgBouncer session mode) is not used; only transaction-mode pooling is safe.
- **Schema-per-tenant escalation trigger**: We revisit schema-per-tenant or database-per-tenant only if (a) a specific compliance regime (HIPAA / SOC2) requires per-tenant data separation or (b) a single tenant grows beyond the operational limits of shared-schema (cited research §1 places this threshold around 10k tenants). Until then, shared-schema is the architecture.

**Decision 7 — Auth: OAuth 2.0 with PKCE via a hosted IdP, with verified deep links.** Mobile auth uses OAuth 2.0 + PKCE — the 2026 consensus floor for mobile clients (@.aiwg/research/findings/mobile-multitenant-byo-llm.md §5). For the initial launch the IdP is Clerk or Auth0 (free/cheap tier), not a self-hosted Keycloak. Issue #2 ("OAuth2/API Key Authentication") is the blocking implementation ticket; this ADR ratifies its scope. The auth provider's SDK or OIDC endpoints handle the OAuth 2.0 + PKCE flow on the HotM client's behalf.

The OAuth return path uses **Android App Links** and **iOS Universal Links** — both domain-verified mechanisms tied to `api.hotm.fortemi.io`. Custom URL schemes (`hotm://auth/callback`) are not used as the primary return path because they are hijackable by other apps on the device; if a custom scheme is used as a fallback, it is only after the App Link / Universal Link path is verified to fail. Refresh tokens are stored in platform-native secure storage (iOS Keychain / Android Keystore) and never in `localStorage` or `AsyncStorage`.

## Consequences

### Positive

- **Frontend reuse.** One React codebase serves desktop and mobile. Component-level work (responsive layouts, touch gestures) is incremental, not a rewrite. (Follows from Decision 1.)
- **Sidecar gap stops being a blocker.** The Tauri mobile sidecar limitation (research §4) is sidestepped entirely on mobile; desktop is unaffected because it keeps its existing local mode. (Decisions 1 + 3.)
- **Inference cost stays with users.** BYO-LLM preserves the operator economics that make HotM viable at solo-dev scale. (Decision 4.)
- **Sync becomes a feature.** Cloud-mode desktop and cloud-mode mobile share a backend, so the same notes appear on both. This is a product feature that the local-install model could never deliver. (Decision 3.)
- **Manifest-driven configurability.** Adding a new LLM provider, raising a tier limit, or rolling out a feature flag does not require an app-store release. (Decision 5.)
- **Tenant isolation is testable and auditable.** RLS at the database tier is a hard wall, not a developer-discipline wall. Cross-tenant data leaks become regression-testable. (Decision 6.)
- **Auth surface is industry-standard.** OAuth 2.0 + PKCE with a hosted IdP means we are not the people writing password hashing or session-token rotation. (Decision 7.)

### Negative / costs

- **HotM now operates infrastructure.** The desktop-only era ended where users self-hosted their own data. The cloud track requires a hosted Postgres+pgvector, application hosting, object storage, an IdP subscription, and monitoring. Realistic monthly floor at <100 active users: ~$50-150/mo (@.aiwg/research/findings/mobile-multitenant-byo-llm.md §7). This is not free.
- **Ongoing operational attention.** Backups need restore testing. TLS certs need renewal monitoring. Sentry alerts need a human at the other end. Crate-level security updates need a cadence. None of this existed when HotM was a desktop-only project.
- **Two backend modes to maintain.** `matric-api` now needs to run as both a per-user sidecar (desktop local mode) and a multi-tenant hosted service (mobile + desktop cloud mode). This bifurcation is real and will surface in migration ordering, configuration handling, and test matrices.
- **iOS build chain is Mac-only.** GitHub Actions Mac runners are roughly 10× the per-minute cost of Linux runners (@.aiwg/research/findings/mobile-tauri2-production-patterns.md §5). iOS CI must be gated to release tags, not every PR. Self-hosted Mac runner is the future cost mitigation but adds hardware ownership.
- **App Store review friction is plausible.** Tauri apps occasionally get flagged under Guideline 4.2 ("wrapped web content"); mitigation is showing genuine native features (biometrics, push, share sheet) in the build and noting the native-compiled nature in review notes (@.aiwg/research/findings/mobile-tauri2-production-patterns.md §6). Plan for one or two rejection cycles on first submission.
- **Schema migration is non-trivial.** Existing `matric-api` schema has no `tenant_id`. Adding it, backfilling, indexing, and enabling RLS is an ordered migration with non-zero downtime risk (@.aiwg/research/findings/mobile-multitenant-byo-llm.md §2).
- **A new class of bugs: cross-tenant leaks.** RLS lowers the risk but does not eliminate it. The single most important regression suite for the lifetime of the hosted product is "tenant A cannot see tenant B's data, ever, under any code path."

### Risks

| Risk | Mitigation |
|---|---|
| App Store rejection due to Tauri unfamiliarity | Ensure biometric/push/share features are present; document native-compiled nature in review notes; plan for 1-2 rejection cycles (research §6). Set a Capacitor bail-out trigger only if multiple rejections cite Tauri-specific internals (research §8). |
| iOS keystore / Play Console keystore loss | Treat both as production secrets. Store in operator's password manager AND in a sealed offsite backup. Document rotation procedure. |
| Cross-tenant data leak via missed RLS policy | Mandatory RLS-enabled migration; per-PR test that asserts tenant A queries return zero rows of tenant B data; quarterly review of every table to confirm RLS policy coverage. |
| BYO-LLM key theft (user's key compromised on their device) | Out of operator's threat model. Document in privacy policy that users are responsible for their own provider keys. Provide a "revoke and re-enter key" flow. |
| KEK compromise (operator's key encryption key leaked) | KEK held in KMS (AWS KMS, GCP KMS, or HashiCorp Vault). For solo-dev scale launch: KEK file at mode 600, root-owned, on the service host; upgrade path to KMS documented. Rotation procedure for KEK that re-wraps DEKs without touching encrypted user keys. |
| Manifest endpoint becomes a runtime knob with no audit trail | Treat manifest as config-as-code. Every change goes through version control. Audit log records who changed what when (research §10). |
| Hosted backend cost spike from free-tier abuse | Token-bucket rate limiter at the gateway tier. Per-tenant daily/monthly inference quotas. Verified email at signup. Cloudflare Turnstile on signup (research §6). |
| iOS Mac-only build constraint blocks contributor velocity | Split iOS into its own workflow file (mirrors existing desktop-release.yml / desktop-build-matrix.yml split). Build iOS on release tags only. Self-hosted Mac runner as a fallback. |
| Manifest kill switch too slow during incident | 5-minute TTL is the practical floor without push. Plan silent-push kill switch as a later milestone (research §6). |
| Desktop users perceive cloud mode as forced | Desktop local mode is the default and remains supported. Cloud mode is opt-in via setting or build flag. The desktop changelog must say this clearly. |
| `matric-api` migration to multi-tenant destabilizes desktop local mode | Maintain a feature flag that selects single-tenant (desktop local) vs multi-tenant (hosted) at startup. Both paths must continue to pass the existing desktop test suite during the migration. |

## Alternatives considered

### Alternative 1 — Capacitor for mobile, keep Tauri for desktop

Capacitor (Ionic) is the most common alternative for adding mobile to an existing web frontend. Capacitor's plugin ecosystem is larger and App Store review is more familiar to reviewers.

**Rejected because:** this would mean two frontend build pipelines (Capacitor for mobile, Tauri for desktop) and two sets of native integration points to maintain. The existing Tauri 2.10.2 investment — `Cargo.toml`, `tauri.conf.json`, the lib pattern in `src-tauri/src/lib.rs` — would need to be duplicated or abandoned. The Tauri 2 mobile maturity in 2026 is sufficient to avoid this duplication (@.aiwg/research/findings/mobile-tauri2-production-patterns.md §1, §9). Bail-out trigger documented in research §8: revisit only if Tauri-specific App Store rejection becomes unfixable.

### Alternative 2 — React Native rewrite

React Native is the dominant cross-platform mobile framework and has the deepest plugin ecosystem.

**Rejected because:** it requires rebuilding the frontend in a parallel codebase. Vite, Tailwind v4, and the existing component tree do not port cleanly to React Native; nontrivial conditional rendering would be needed throughout. The cost is a complete frontend re-engineering effort with no commensurate benefit — the mobile product surface does not need native-grade animation performance or the broader React Native plugin set. The Tauri 2 mobile plugin matrix (research §3) covers what HotM mobile actually needs: HTTPS, notifications, biometrics, deep links, clipboard.

### Alternative 3 — Progressive Web App only (no app-store presence)

A PWA served from the hosted backend would avoid app-store review entirely.

**Rejected because:** mobile-store distribution is part of the product position. Discovery, trust signals, and push notification reliability all favor a store-delivered native app over a PWA on iOS in particular (where PWA support remains second-class). PWA can remain as a future addition for users who don't want to install — but it is not a substitute for the store-delivered mobile path.

### Alternative 4 — Local-install on mobile (port Postgres, Ollama, sidecars)

This was the desktop-style architecture extended to mobile: a self-contained mobile install with its own Postgres, its own Ollama, no hosted backend.

**Rejected because:** it is categorically impossible. iOS and Android do not permit arbitrary native daemons. Postgres does not ship as a mobile-installable runtime. Ollama does not run on iOS/Android. The Tauri mobile sidecar mechanism is unsupported (@.aiwg/research/findings/mobile-tauri2-production-patterns.md §4). No combination of effort produces this architecture on either platform.

### Alternative 5 — Mobile-only cloud, desktop forced to cloud-only too

A cleaner architecture might collapse desktop and mobile into the same cloud-only path, retiring the desktop local-install.

**Rejected because:** the local-install model is the privacy posture for an entire segment of HotM's user base. ADR-007 codified the SPA privacy model. Removing local install would break that posture and would amount to a product change, not an architectural simplification. The hybrid model (Decision 3) is operationally costlier but preserves the user choice.

### Alternative 6 — Operator-funded inference (not BYO-LLM)

The simpler economic model: operator holds a single set of provider keys and bills users per-request.

**Rejected because:** the user's stated design goal is inference configurability (persistent memory: "Fortemi inference configurability is a stated design goal"). Operator-funded inference contradicts that. Even setting product position aside, the operator economics at solo-dev scale do not support absorbing inference cost for a public free tier. BYO-LLM is the established proxy pattern (research §3) and the only model consistent with HotM's stated configurability commitments.

## Implementation outline

This ADR ratifies the architecture. The phase-by-phase implementation sequence lives in `.aiwg/planning/mobile-expansion-phase-plan.md`. The structural shape is:

1. **Backend extraction (parallels issue #222):** `matric-api` runs as a multi-tenant hosted service. Adds `tenant_id` column to user-data tables, indexes, RLS policies. Existing desktop sidecar mode continues to work behind a feature flag.
2. **Auth (issue #2):** OAuth 2.0 + PKCE via Clerk or Auth0. Mobile and cloud-mode desktop both authenticate against the same IdP.
3. **BYO-LLM proxy:** request flow defined in @.aiwg/research/findings/mobile-multitenant-byo-llm.md §3. Per-user provider keys encrypted under envelope encryption (§4). Metadata-only logging by default.
4. **Manifest endpoint:** `GET /v1/manifest` implemented per `.aiwg/architecture/manifest-schema-v1.md`. ETag-conditional, cache-TTL'd, unauthenticated.
5. **Frontend gating:** `#[cfg(desktop)]` cleanup in `src-tauri/src/lib.rs` (currently uses `tauri-plugin-shell` and `tauri-plugin-global-shortcut` unconditionally). `VITE_HOTM_MODE` env var selects local-sidecar vs cloud transport in the React HTTP client.
6. **Mobile build pipelines:** Android workflow (`cargo tauri android build -- --aab`) and iOS workflow (Mac runners, `cargo tauri ios build --export-method app-store-connect`). iOS gated to release tags.
7. **App-store submission cycles:** Google Play and App Store Connect. Plan for review iteration, especially on iOS.

Scope, dependencies, and ordering are the phase plan's job — not this ADR's.

## Traceability

**Existing HotM ADRs this builds on or affects:**

- @.aiwg/architecture/ADR-001-client-server-architecture.md — established the client/sidecar split that is being extended into a client/hosted-service split.
- @.aiwg/architecture/ADR-002-database-schema-rebuild.md — the schema rebuilt under that ADR now needs `tenant_id` and RLS layered in.
- @.aiwg/architecture/ADR-007-spa-privacy-model.md — preserved on desktop local mode; explicitly altered on cloud mode (the privacy posture for cloud users is different and must be documented separately).

**Research findings backing each decision:**

- Decision 1 (Tauri 2 mobile): @.aiwg/research/findings/mobile-tauri2-production-patterns.md §1, §2, §9
- Decision 2 (cloud-only for mobile): @.aiwg/research/findings/mobile-tauri2-production-patterns.md §4
- Decision 3 (desktop hybrid): @.aiwg/research/findings/mobile-tauri2-production-patterns.md §7
- Decision 4 (BYO-LLM): @.aiwg/research/findings/mobile-multitenant-byo-llm.md §3, §4
- Decision 5 (manifest): @.aiwg/research/findings/mobile-manifest-remote-config.md §4, §5, §10
- Decision 6 (multi-tenant + RLS): @.aiwg/research/findings/mobile-multitenant-byo-llm.md §1, §2
- Decision 7 (OAuth 2.0 + PKCE): @.aiwg/research/findings/mobile-multitenant-byo-llm.md §5

**Issues this ADR scopes or affects:**

- #2 OAuth2/API Key Authentication — this ADR sets its scope: OAuth 2.0 + PKCE via hosted IdP, mobile + cloud-mode desktop both consume it.
- #222 postinst trim + first-run wizard — overlaps on the `matric-api` extraction; the cloud-only-on-mobile decision implies that the wizard flow on desktop and the onboarding flow on mobile both need to handle local-vs-cloud mode selection.
- #31 First-Run Onboarding Flow — onboarding must account for mobile's cloud-only path.
- #30 One-Click Personal Install Experience — applies to desktop local install only; cloud mode has a different onboarding flow (sign in vs install-and-launch).

**Supersedes:** none. This ADR adds the mobile track; it does not retire any existing ADR.

## Open questions

These are genuinely unsettled and need product input — they are not architectural gaps to fill in implementation.

1. **Free tier yes/no, and what does it include?** The decision affects abuse-prevention sizing, signup friction, and the business model. Without a free tier, signup gating is simpler but discovery suffers. Resolved in product planning, not this ADR.
2. **Self-hosted multi-tenant mode for advanced users?** A household or homelab user might want to run `matric-api`'s multi-tenant mode themselves and have their family connect to it. This is technically possible but adds documentation, distribution, and support cost. Not in launch scope; flag for revisit.
3. **Compliance posture at launch.** HIPAA, SOC2, GDPR — the explicit operator position at launch should be "we do not claim HIPAA or SOC2; we follow GDPR data-subject rights." Confirm with product/legal before launch copy.
4. **Telemetry default.** The manifest schema (`.aiwg/architecture/manifest-schema-v1.md`) has telemetry default off. Confirm this is the launch posture.
5. **Pricing model if any.** Free with BYO-LLM, or paid tiers with quotas? Decision affects tier limit shape in the manifest. Not architectural — but the manifest schema needs to absorb whatever the answer is without breaking changes.
6. **Cloud-mode desktop privacy disclosure.** Desktop users who flip to cloud mode are now in a different privacy posture than ADR-007 described. The transition needs a clear consent moment, not a silent migration.

These do not block ADR acceptance; they block specific implementation tickets downstream.
