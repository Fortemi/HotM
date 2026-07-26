---
title: HotM Mobile Expansion Phase Plan
type: phase-plan
created: 2026-05-17
status: Accepted for planning
phase_count: 6
related_artifacts:
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/architecture/manifest-schema-v1.md
  - .aiwg/research/findings/mobile-tauri2-production-patterns.md
  - .aiwg/research/findings/mobile-multitenant-byo-llm.md
  - .aiwg/research/findings/mobile-manifest-remote-config.md
  - .aiwg/reports/tauri-v2-research-2026-02.md
  - .aiwg/elaboration/responsive-design-spec.md
  - .aiwg/deferred/pwa-capabilities-plan.md
related_issues:
  - "#2 OAuth2/API Key Authentication (blocks Phase 2 completion)"
  - "#222 postinst trim + first-run wizard (overlaps with Phase 1)"
  - "#31 First-Run Onboarding Flow (intersects Phase 3 UX work)"
  - "#30 One-Click Personal Install Experience"
---

# HotM Mobile Expansion Phase Plan

## Overview

This plan sequences the work to take HotM from a Tauri 2 desktop-only application to a multi-platform product shipping in Apple App Store and Google Play. The shape of the work is dictated by the ADR (`adr-mobile-cloud-architecture.md`):

- Mobile is **cloud-only**: the local `matric-api` sidecar does not ship to mobile; mobile clients talk to a hosted multi-tenant deployment.
- Desktop remains **hybrid**: local-install stays the default, with optional cloud mode added.
- Inference is **BYO-LLM**: users supply their own provider keys; the hosted backend proxies requests but does not pay for inference.
- The mobile binary ships with a **baked-in API base URL**; everything else (auth, models, feature flags, kill switches) flows through the `GET /v1/manifest` endpoint defined in `manifest-schema-v1.md`.

Every phase is expressed in **agent-oriented units** per `.claude/rules/no-time-estimates.md`: scope (atomic items), agent count and roles, parallelism potential, and pass estimates. **No calendar dates, no week numbers, no "this will take N hours."**

The plan also makes the operational reality of going SaaS explicit. Hosting a multi-tenant backend with auth, secret storage, rate limiting, monitoring, and backups carries a real recurring cost (the research findings cite $50-150/mo at launch scale) and ongoing ops attention. The mobile expansion is not just "wrap the UI" — it is a SaaS infrastructure track that runs in parallel to the mobile UI track.

## Phase 0 — Decisions locked

Phase 0 is essentially "this plan exists." The artifacts that land in Phase 0:

- ADR-MOBILE-001 (`.aiwg/architecture/adr-mobile-cloud-architecture.md`) — the architectural decisions
- Manifest schema v1 (`.aiwg/architecture/manifest-schema-v1.md`) — the API contract
- Phase plan (this document)
- Three research findings under `.aiwg/research/findings/`

**Gate**: All five artifacts exist, are reviewed, and the operator has explicitly accepted ADR-MOBILE-001 for planning. HMC-2026-07-001 through HMC-2026-07-010 were accepted with recommended defaults on 2026-07-09. Production proof remains gated: `Fortemi/HotM#251` must stay open until hosted/gateway/CI manifest launch-rate proof replaces the local fixture, and public hosted/mobile claims remain no-go until the relevant hosted, legal/product, and CI evidence exists.

## Phase 1 — Backend extraction (`matric-api` as a hosted multi-tenant service)

**Scope** — 9 atomic items:

1. Extract `matric-api` from sidecar-only deployment in `fortemi/crates/matric-api`. Add a "service mode" entry point that runs as a long-lived HTTP server. (Cross-repo work, lives in `Fortemi/fortemi`, not in this repo.)
2. Add `tenant_id UUID NOT NULL` column to every user-data table in the `matric-api` schema. Backfill safely.
3. Add B-tree indexes on `tenant_id` for every RLS-protected table (research finding §2 — index every column referenced by RLS predicates).
4. Enable Postgres Row-Level Security on user-data tables. Policies read `current_setting('app.current_tenant')::uuid`.
5. Wire connection-level tenant-context setting: every request handler opens a transaction, calls `SET LOCAL app.current_tenant`, then proceeds. This is the canonical pattern per AWS/Crunchy/Supabase guidance.
6. Write a tenant-isolation test suite that proves a user cannot read another user's data. This test suite runs on every CI build forever.
7. BYO-LLM proxy implementation in `matric-api`: accept a model+request, look up the requesting user's encrypted LLM provider keys, decrypt, forward to the upstream provider, stream the response back. Metadata-only logging (no prompt/response bodies).
8. Per-user secret storage: envelope-encryption pattern (KEK + per-user DEK), per research finding §4. **KEK held in a managed KMS at launch (AWS KMS, GCP KMS, or HashiCorp Vault Transit)** — not on-host (Wave-3 Security Architect Finding 2.1). Detailed cryptographic decisions recorded in `.aiwg/architecture/cryptographic-decisions.md` (new artifact; reviewed by `applied-cryptographer`).
9. Deployable artifact: container image or static binary, with deployment config for one of (Fly.io, Render, Railway, Hetzner). Add basic ops: structured logs, Sentry-grade error reporting, health endpoint.

**Agents and parallelism**:

- Items 1, 2, 3, 4, 5 are serial (each builds on the previous). One Software Implementer working with consultation from Security Architect.
- Item 6 (tenant-isolation tests) is parallel to items 4-5 once schemas are in place. Test Engineer.
- Items 7, 8 are parallel to items 2-5 — they touch different parts of the codebase. Software Implementer + Security Auditor for item 8.
- Item 9 (deployable artifact) is sequential after items 1-8. DevOps Engineer.

**Pass estimate**: 4-6 passes to quality gate per item. The tenant-isolation testing in particular tends to surface subtle bugs that require multiple passes.

**Quality gate** (agent-executable):
- `cargo test --workspace --features service-mode` passes inside `fortemi/crates/matric-api`.
- **Tenant-isolation test suite** — minimum 10 named test cases, each individually CI-asserted (Wave-3 Test Architect Finding 4):
  1. `test_user_b_cannot_list_user_a_notes` — basic SELECT isolation.
  2. `test_user_b_cannot_fetch_user_a_note_by_uuid` — direct-access isolation, 404 not 403 (no existence leak).
  3. `test_user_b_cannot_update_user_a_note` — UPDATE policy isolation.
  4. `test_user_b_cannot_delete_user_a_note` — DELETE policy isolation.
  5. `test_user_b_cannot_insert_into_user_a_collection` — INSERT-with-foreign-key isolation.
  6. `test_same_connection_reused_between_users_isolates` — `SET LOCAL` works across pooled connection reuse.
  7. `test_sql_injection_in_search_string_cannot_bypass_rls` — SQL-injection regression even when input flows to LIKE / full-text / pgvector queries.
  8. `test_vector_similarity_search_filters_by_tenant_before_scoring` — pgvector-specific; user B's `<->` query must not return user A's vectors at any rank.
  9. `test_new_table_without_rls_fails_ci` — meta-test against `pg_class` / `pg_policy` (Wave-3 Security Architect Finding 1.2).
  10. `test_role_lacks_bypassrls_and_superuser` — startup assertion test (Wave-3 Security Architect Finding 1.1).
- `matric-api` serves `GET /healthz` returning `200` within 100ms.
- Deployment to a staging host succeeds and the staging instance passes a smoke test (signup → write note → read note → list notes → delete note → verify deletion).
- `.aiwg/architecture/cryptographic-decisions.md` exists, has been reviewed by `applied-cryptographer`, and implementation matches it (Wave-3 Security Architect Finding 2.2).

**Cross-repo work**:
- Lives primarily in `Fortemi/fortemi` (sibling repo at `/home/roctinam/dev/fortemi/fortemi`), specifically `crates/matric-api`.
- This HotM repo gets only the operational glue (CI workflow that triggers a `matric-api` deployment, deployment-status integration into release notes).
- See `roctinam/sysops`/`roctinam/itops` ops repos for the actual hosting infrastructure declaration if applicable; otherwise track in `Fortemi/fortemi` as `ops/` subdirectory.

**Dependencies**:
- Blocked by: Phase 0 ADR acceptance.
- Blocks: Phase 2 (auth + manifest endpoint depend on the service running).

**Risks specific to Phase 1**:
- **Tenant isolation correctness is the highest-stakes correctness property of the entire product.** A single missed RLS policy on a single table is a customer-data-leak incident. Mitigation: dedicated isolation test suite that's mandatory CI; periodic manual review (quarterly) by Security Auditor agent.
- **Schema migration on existing single-tenant `matric-api` is non-trivial.** The current schema does not have `tenant_id`. Adding it on an empty schema is easy; adding it to a schema that real users have data in is hard. Mitigation: this migration must be tested against a representative production database snapshot before being approved.
- **Key handling errors are silent until they're not.** A bug in the envelope encryption code can either fail loudly (decryption errors visible) or fail quietly (decrypting with wrong key produces garbage that flows to upstream providers as "invalid API key"). Mitigation: per-request decrypt verification with a known-good plaintext suffix; alerting on any decrypt error.

## Phase 2 — Auth + manifest endpoint

**Scope** — 7 atomic items:

1. Implement `GET /v1/manifest` per `manifest-schema-v1.md`. Stable ETag computation, Cache-Control headers, conditional 304 support.
2. Select auth provider. Recommended candidates per research finding §5: Clerk (fastest path) or self-hosted Keycloak (full control). Document the choice in an ADR-MOBILE-002.
3. Integrate selected auth provider into `matric-api`. JWT verification middleware. PKCE-compatible OAuth flow.
4. Wire user-record creation: first-time-sign-in creates a tenant row, returns the issued session token. Existing-user sign-in resolves user record by IdP-subject claim and returns a session token.
5. User-side secret management UI for BYO-LLM keys. The mobile (and cloud-mode desktop) client needs a settings panel where users paste their LLM provider API keys. Frontend work in this HotM repo.
6. Server-side endpoints for user-secret CRUD: `POST /v1/user/secrets`, `GET /v1/user/secrets`, `DELETE /v1/user/secrets/{provider}`. Secrets are returned masked.
7. Issue #2 (OAuth2/API Key Authentication) is the umbrella for items 2-4 and 6. Closing #2 is the milestone that signals Phase 2 done.

**Agents and parallelism**:

- Items 1 and 2 can run in parallel (manifest endpoint vs. auth provider research). Two Software Implementers.
- Items 3-4 are serial (auth integration depends on provider choice).
- Items 5-6 are parallel to 3-4 once the auth provider's session-token format is defined. Software Implementer + Frontend Specialist.
- Security Architect reviews items 1-6 in one pass after first-pass implementation lands.

**Pass estimate**: 3-5 passes. Auth integration tends to have a long tail of edge cases (refresh token rotation, expiry, sign-out).

**Quality gate** (agent-executable):
- `GET /v1/manifest` returns valid JSON conforming to the JSON Schema in `.aiwg/architecture/manifest-schema-v1.json` (a new artifact required by Phase 2 per Wave-3 Test Architect Finding 7); CI runs `ajv-cli` or `jsonschema-rs` validation.
- `GET /v1/manifest` with valid `If-None-Match` returns 304 empty.
- ETag determinism: identical manifest state produces identical ETag across process restarts.
- Kill-switch propagation: instrumented client polls during a `service.status=shutdown` manifest → client reaches maintenance-screen state within `cache_ttl_seconds` + jitter (Wave-3 Test Architect Finding 9).
- Rollback safety: push v1 manifest → v2 with broken flag → revert to v1 → instrumented clients converge on v1 within TTL (Wave-3 Test Architect Finding 8).
- Min-supported-version boundary: client reporting a version below `client_version.minimum_supported` receives a force-update response.
- Cache-Control headers: `Cache-Control: max-age=N` present and matches configured TTL.
- OAuth flow integration test: programmatic sign-in via test IdP → session token returned → authenticated `GET /v1/user/profile` returns expected user.
- BYO-LLM secret CRUD: POST a fake key → GET returns masked → encrypted-at-rest verification by direct DB inspection.
- Tenant isolation still holds after auth is wired — re-run the 10-case Phase 1 suite as regression (`cargo test --workspace --features tenant-isolation`) (Wave-3 Test Architect Finding 1).
- **Desktop hybrid regression** (Wave-3 Test Architect Finding 10): `cargo test --workspace --features desktop-hybrid` passes with both `VITE_HOTM_MODE=local` and `VITE_HOTM_MODE=cloud` configurations. Mode-switch data fidelity test: write a note in local mode, switch to cloud, confirm the note is visible and unmodified.
- **ADR-MOBILE-002 exists** (Wave-3 Test Architect Finding 4, Wave-3 Requirements Finding 3): `.aiwg/architecture/adr-mobile-002-hybrid-data-semantics.md` documents whether cloud is independent / cloud-authoritative / local-authoritative.
- Issue #2 is in `closed` state with referenced commits.
- Manifest commits go through version control with an audit-traceable history (Wave-3 Security Architect Finding 3.2; manifest-as-config-as-code).

**Dependencies**:
- Blocked by: Phase 1 (multi-tenant `matric-api` running).
- Blocks: Phase 3 (the mobile client's first-launch flow depends on having a manifest to fetch and a session-token format to receive).

**Risks specific to Phase 2**:
- **Issue #2 is the only P0 in the queue and has been open since 2026-02-04.** Treat as a flag that the auth work has hit some prior friction. Surface any blockers immediately.
- **Auth provider choice has cost and lock-in implications.** Picking Clerk and then migrating to self-hosted Keycloak later is a real migration. Make the decision deliberate.
- **The manifest endpoint becomes the kill switch for the entire product.** Operating it requires the operator to have a defined process for pushing manifest changes (git commit → CI → CDN purge, ideally). Without that process, an incident-response manifest change is itself a race.

## Phase 3 — Mobile build init + UI polish

**Scope** — 11 atomic items:

1. `cargo tauri android init` in `ui/src-tauri/`. Verify the generated `gen/android/` scaffolding builds.
2. `cargo tauri ios init`. Verify the generated `gen/apple/` scaffolding builds on a Mac host (required; iOS cannot be cross-compiled from Linux).
3. Plugin gating: wrap `tauri-plugin-shell`, `tauri-plugin-global-shortcut`, system-tray config in `#[cfg(desktop)]` per the pattern in research finding §7. Mobile-specific plugin additions (`tauri-plugin-biometric`, if/when used) gated by `#[cfg(mobile)]`.
4. Frontend client refactor: introduce `VITE_HOTM_MODE = local | cloud` build flag. In `cloud` mode, all API calls go through `VITE_HOTM_API_BASE` over HTTPS instead of through the desktop sidecar IPC. Same fetcher, different transport. Mobile builds always use `cloud` mode.
5. First-launch flow: client fetches `/v1/manifest`, caches it per the client-behavior contract in `manifest-schema-v1.md`, handles `service.status` and `client_version` gates correctly. **Graceful no-network path**: clean install with no network shows offline screen with retry button, does not crash, does not enter inconsistent state (Wave-3 Requirements Finding 1).
6. Auth flow on mobile: OAuth2 + PKCE via the system browser, with **Android App Links / iOS Universal Links** as the return path (ADR Decision 7, post-revision; Wave-3 Security Finding 4.1). Refresh tokens stored in platform-native secure storage (iOS Keychain / Android Keystore). Custom URL scheme `hotm://` only as a documented fallback.
7. Mobile UX polish: close the 30% gap. Per existing `.aiwg/elaboration/responsive-design-spec.md`, phone-width pass on `HallOfMind` panels, bottom-nav for primary navigation, media player swap to mobile notification bar pattern, touch-target ≥44px verification, IME/keyboard-aware layout testing.
8. **Mobile test infrastructure** (Wave-3 Test Architect Finding 5): configure iOS simulator and Android emulator in CI for headless E2E; commit a baseline E2E suite covering first-launch → manifest fetch → sign-in → CRUD; pick a snapshot-test strategy for visual regression (Playwright with mobile-viewport emulation is the recommended fast-CI option).
9. **Mobile accessibility pass** (Wave-3 Requirements Finding 5): VoiceOver + TalkBack screen-reader compatibility on one primary user journey, dynamic-type / text-size scaling without layout breakage, WCAG AA color contrast verification, reduced-motion support, focus indication on keyboard-attached tablets.
10. **Author launch use cases** (Wave-3 Requirements Finding 11): five use cases at AIWG-template depth — first-launch mobile sign-in, second-device-add, switch-LLM-provider, account-deletion, no-network-degradation. Saved to `.aiwg/requirements/use-cases/UC-MOBILE-*.md`.
11. Build a debug-only "API base override" hatch in mobile settings, so power users (and the developer) can point at staging without re-releasing.

**Agents and parallelism**:

- Items 1-3 are sequential (init must succeed before plugin gating makes sense). DevOps Engineer + Mobile Developer.
- Items 4-5 can be parallel to 1-3 (frontend HTTP-mode refactor doesn't need the mobile build to be working). Frontend Specialist.
- Items 6, 7 can run in parallel once items 4-5 land. Frontend Specialist + UX Lead.
- Item 8 is a small task at the end. Software Implementer.

**Pass estimate**: 3-4 passes per item. The UX polish (item 7) likely needs a real-device test cycle and may produce a longer tail.

**Quality gate** (agent-executable):
- Android: `cargo tauri android build -- --aab` produces a valid AAB.
- iOS: `cargo tauri ios build --export-method app-store-connect` produces a valid IPA (Mac host required).
- Headless E2E: `adb shell am instrument ...` (Android emulator) and `xcrun simctl launch ...` (iOS simulator) each exit 0 after running the baseline launch-flow suite (Wave-3 Test Architect Finding 1, replacing the previous "opens on real devices" verbal gate). Real-device sign-off is a separate documented artifact at `.aiwg/testing/mobile-device-cycle-N.md`, not a blocking CI signal.
- First-launch flow exercises: clean install → manifest fetched → forced to log in → token stored → notes-list endpoint returns 200 with expected payload. Also: clean install with no network → offline screen + retry, no crash (Wave-3 Requirements Finding 1).
- Visual regression: Playwright mobile-viewport baseline; no horizontal scrolling at 320px viewport.
- Touch-target audit script: every interactive element ≥44px.
- Accessibility audit: VoiceOver and TalkBack pass on the launch use case; WCAG AA contrast verified.
- Five mobile-launch use cases authored and saved to `.aiwg/requirements/use-cases/UC-MOBILE-*.md`.
- Cross-device consistency test (Wave-3 Test Architect Finding 4): sign in as user A on emulator-1, write a note; sign in as the same user on emulator-2, the note appears.

**Dependencies**:
- Blocked by: Phase 2 (need an auth provider and manifest endpoint serving).
- Items 4-7 can begin in parallel with parts of Phase 2 once the manifest schema and auth provider are locked.

**Risks specific to Phase 3**:
- **iOS simulator vs real device divergence.** Many bugs surface only on real iOS hardware. Mitigation: at least one real iOS device test cycle before Phase 4.
- **Deep-link reliability** on Android for the OAuth return path. Known flaky area per the Tauri 2 mobile research §6. Mitigation: test the auth flow on at least Android 12, 13, 14.
- **HallOfMind component density** at phone widths. The current desktop layout is information-dense; collapsing to phone widths without breaking the metaphor needs real UX iteration. The mobile read view already works as a model.

## Phase 4 — CI + signing + first internal release

**Scope** — 9 atomic items:

1. Apple Developer Program enrollment (operator action, not engineering).
2. Google Play Console developer account (operator action).
3. App Store Connect API key generation and storage as CI secret.
4. Android signing keystore generation, secure backup (this key is irreplaceable), storage as CI secret.
5. iOS provisioning profile + `Entitlements.plist` setup. Sandbox mandatory.
6. Mac runner provisioning. Self-hosted or GitHub Actions Mac runner. Research finding §5 flags ~10x cost vs. Linux runner.
7. CI workflow: `.gitea/workflows/mobile-android.yml` triggered on `v*` tags. Builds AAB, uploads to Play Console internal track (manual upload first time per research finding §5).
8. CI workflow: `.gitea/workflows/mobile-ios.yml` triggered on `v*` tags. Mac-only runner. Builds IPA, uploads via `xcrun altool` to TestFlight.
9. Privacy policy text + store-listing materials (app description, screenshots, icons). Operator + Technical Writer.

**Agents and parallelism**:

- Items 1, 2, 9 are operator actions (account procurement, content authoring). Cannot be parallelized further than the operator's bandwidth.
- Items 3, 4, 5 are config work, parallel to operator actions. DevOps Engineer.
- Items 6-8 are sequential: runner first, then both CI workflows. DevOps Engineer + Build Engineer.

**Pass estimate**: 2-3 passes for CI workflows. Mostly procedural; first failures are typically signing-related.

**Quality gate** (agent-executable):
- CI workflow on a tag push produces signed AAB and signed IPA artifacts.
- Manual upload to Play Console internal track succeeds (first time only).
- TestFlight upload succeeds; the build appears in App Store Connect ready for processing.
- Internal testers (operator + designated reviewers) can install the build on real devices via TestFlight and Play internal track.

**Dependencies**:
- Blocked by: Phase 3 (need working `cargo tauri build` for both platforms).
- Blocks: Phase 5 (public release).

**Risks specific to Phase 4**:
- **Mac runner is expensive.** Mitigation: iOS builds only on tag pushes, never on PRs. Self-hosted Mac mini if a spare exists.
- **First Play upload must be manual.** Documented; not a surprise. Just don't forget.
- **Signing key loss is catastrophic.** Lost Android keystore means a new package identifier; users on the old keystore cannot upgrade. Mitigation: encrypted offline backup of keystore + passphrase, with the recovery procedure documented in `docs/operations/`.

## Phase 5 — Public store release

**Scope** — 6 atomic items:

1. App Store review submission. Reviewer notes pre-prepared explaining this is a native Tauri app (not a wrapped web page) — pre-empts the Guideline 4.2 rejection risk flagged in research finding §6.
2. Google Play review submission. Less risk of confused-reviewer rejection but still needs proper store-listing material.
3. Public privacy policy hosted at a stable URL (linked from `manifest.links.privacy_policy_url`).
4. Public support channel — at minimum a status page and a contact email. Linked from `manifest.links.support_url`.
5. Gradual rollout configuration on Play (1% → 5% → 25% → 100% over staged days, with monitoring of crash-free rates per release).
6. Telemetry decision and implementation: if anonymous opt-in telemetry is enabled, hook up the endpoint (`telemetry.endpoint` in manifest) and document the opt-in flow.

**Agents and parallelism**:

- Item 1 and 2 are operator submissions; cannot parallelize beyond review-queue timing.
- Items 3, 4 are content + ops; Technical Writer + DevOps Engineer.
- Items 5, 6 are configuration; DevOps Engineer.

**Pass estimate**: undefined — review cycles dominate.

**Launch Readiness Checklist** (Wave-3 Requirements Finding 12): the criterion that says "we can submit to public stores." Distinct from the 100%-rollout quality gate below, which is a post-submission milestone. Items in this checklist must all be true before App Store / Play submission:

- [ ] Privacy policy live at a stable URL, linked in `manifest.links.privacy_policy_url`.
- [ ] Support channel live (status page + contact email), linked in `manifest.links.support_url`.
- [ ] Terms of service live, linked in `manifest.links.terms_url`.
- [ ] Store listings (description, screenshots, icons, age rating) reviewed and approved internally.
- [ ] Internal-track build green for 7 consecutive days with no critical bugs.
- [ ] Crash-free rate ≥99% on internal-track builds.
- [ ] Manifest endpoint operationally stable (uptime + alerting verified).
- [ ] All five mobile-launch use cases (`UC-MOBILE-*`) have passing acceptance tests.
- [ ] User data deletion FR (Wave-3 Requirements Finding 2) is end-to-end testable and tested. **Regulatory; cannot ship without.**
- [ ] User data export FR (Wave-3 Requirements Finding 8) is end-to-end testable and tested. **Regulatory.**
- [ ] App Store review reviewer notes drafted (pre-empts Guideline 4.2 confusion).
- [ ] Encryption-export declaration in `Info.plist` set correctly.
- [ ] Branding fully aligned (issue #15 — matric-memory → Fortemi rename — closed).
- [ ] Telemetry posture confirmed (defaults to off per current ADR open question #4).

**Quality gate** (agent-executable, where applicable — post-submission):
- Apps published to both stores at 100% rollout.
- Manifest's `client_version.update_url_*` fields point to live store URLs.
- Crash-free rate ≥99% over trailing 7-day window per Play Console / App Store Connect dashboard, evaluated before each rollout-percentage bump (Wave-3 Test Architect Finding 3).

**Dependencies**:
- Blocked by: Phase 4.

**Risks specific to Phase 5**:
- **App Store review rejection** for Guideline 4.2 (repackaged web content). Mitigation: explicit reviewer notes referencing native features and Tauri framework. If rejected, response cycle is typically 1-2 weeks.
- **Crash-free rate falling below threshold** during gradual rollout. Mitigation: halt rollout via Play Console (Apple equivalent: pause approval); investigate; fix; re-release.
- **First user feedback** typically surfaces design assumptions baked into the desktop UX that don't translate to mobile. Plan a quick-iteration window after first public release.

## Phase 6 — Post-launch (open-ended)

Beyond the initial release. The plan does not commit to ordering here; items are picked up as evidence (user feedback, crash patterns, business need) justifies them.

1. Silent-push kill switch for emergency manifest refresh (research finding §6 mentions this as a deferrable enhancement).
2. A/B experimentation infrastructure (LaunchDarkly, Statsig, or PostHog integration). Only when product genuinely needs experiments — not before.
3. Telemetry and analytics maturation: cohort tracking, funnel analytics, feature-usage measurement. Avoid the temptation to log too much (privacy posture is a differentiator).
4. PWA pickup. The deferred PWA plan at `.aiwg/deferred/pwa-capabilities-plan.md` becomes relevant if a meaningful set of users want offline-on-the-go or are on Android-only without app-store concern. Lower priority than native.
5. Team features. Sharing notes, multi-user workspaces, organization tenancy. These are an order-of-magnitude scope expansion and warrant their own phase plan.
6. Tier expansion. Paid `pro` and `team` tiers if monetization becomes a goal. Requires Stripe (or equivalent) integration, billing webhooks, dunning, etc. Substantial.

## Phase gates summary

| Phase | Primary gate | Blocking artifacts |
|---|---|---|
| 0 | ADR-MOBILE-001 status = Accepted | adr-mobile-cloud-architecture.md, manifest-schema-v1.md, this plan |
| 1 | Tenant-isolation test suite green in CI; matric-api deployable; staging smoke test passes | matric-api service-mode running |
| 2 | `GET /v1/manifest` matches schema; OAuth round-trip works; issue #2 closed | manifest endpoint live; auth provider operational |
| 3 | `cargo tauri android/ios build` produces signed artifacts; clean-install first-launch flow works end-to-end on real devices | Tauri mobile builds; mobile UX |
| 4 | TestFlight + Play internal builds installable; signing fully automated | CI workflows for both platforms |
| 5 | Both stores at 100% rollout; crash-free rate >99% | Public store presence |
| 6 | (open-ended) | various |

## Parallelism map

Concurrent tracks of work:

```
Phase 1 (backend extraction) ─┬─────────────────────────┐
                              │ (in fortemi repo)      │
                              ↓                         ↓
Phase 2 (auth + manifest) ────┬─────────────────────┬──┘
                              │ (auth provider)    │
                              │ Issue #2 closes    │
                              ↓                     ↓
Phase 3 (mobile build + UX) ──┬──────────────────┬──┘
                              │ (Frontend + Tauri init)
                              ↓                     ↓
Phase 4 (CI + signing) ───────┬──────────────┬─────┘
                              ↓               ↓
Phase 5 (public release) ─────┴───────────────┘
                                              ↓
Phase 6 (post-launch, open-ended)
```

Phases 1 and 3-frontend can begin in parallel once the manifest schema and the auth provider are locked. The deep dependencies are: Phase 2 needs Phase 1; Phase 3-mobile-build needs Phase 2 auth-and-manifest; Phase 4 needs Phase 3; Phase 5 needs Phase 4.

## Risk register (phase-spanning)

| Risk | Phase | Severity | Mitigation |
|---|---|---|---|
| Tenant data isolation failure | 1, ongoing | Critical | Dedicated isolation test suite; quarterly security review; never deploy schema migration without isolation regression check |
| Auth provider lock-in / cost spike | 2 | High | ADR documents the choice; migration plan to self-hosted Keycloak is feasible if needed |
| Mac runner cost | 4 | Medium | iOS builds only on tag pushes; consider self-hosted Mac mini if existing hardware available |
| App Store review rejection (Guideline 4.2) | 5 | Medium | Reviewer notes pre-prepared; native features (biometric, push) demonstrably in the build |
| User signing-key loss on Android | 4, ongoing | High | Encrypted offline backup of keystore + passphrase; documented recovery procedure |
| Operational cost overruns | 1, ongoing | Medium | Per-tenant rate limits + spend ceilings before launch (not after); telemetry on backend resource usage |
| Issue #2 (OAuth) friction recurrence | 2 | High | Already P0 and open since Feb 2026 — surface any specific blockers immediately rather than starting fresh |
| Schema migration on existing user data | 1 | High | Test against a representative production database snapshot before approving migration |

## Deferred / out-of-scope

These are explicitly NOT in this plan and should not creep in:

- Voice capture on mobile
- Agent actions (the `agent_actions` feature flag in the manifest exists for this future work but is `false` in v1)
- White-label deployments (the branding fields exist in the manifest but are not exercised at launch)
- Team / multi-user workspaces
- Paid tier billing infrastructure
- Self-hostable `matric-api` for privacy-focused users (interesting; would deserve its own future phase plan)
- PWA pickup (deferred per `.aiwg/deferred/pwa-capabilities-plan.md`)
- Push notifications beyond manifest kill-switch (broader notification feature set)
- Tablet-specific UX (responsive design covers basic tablet, but iPad-class apps need additional thought)

If any of these become priorities during the planned phases, file a new phase plan rather than expanding this one.

## Accepted HMC Defaults And Remaining Evidence Gates

These HMC questions were answered with the recommended defaults on 2026-07-09. They can guide planning, but the evidence gates below still control phase completion and public claims:

1. **Auth provider choice (Phase 2)**. Accepted planning default: Clerk for hosted preview; Keycloak/self-host remains a later enterprise option.
2. **Hosting provider for `matric-api` (Phase 1)**. Accepted planning default: managed preview host; exact provider remains evidence-gated before production. The research finding cites $50-150/mo at launch scale across most candidates.
3. **Free tier vs paid-only (Phase 2, recurring)**. Accepted planning default: fixture-backed preview plus no public paid/free-tier claim until pricing and abuse limits are accepted.
4. **Domain (Phases 1-2)**. Accepted planning default: `api.hotm.fortemi.io` remains provisional and must not be claimed until DNS, CDN, and certificate evidence exists.
5. **Telemetry stance (Phase 5)**. Accepted planning default: off/opt-in until product/legal approves a backend and copy.
6. **Self-hosted `matric-api` option for privacy-focused users**. Accepted planning default: post-launch follow-up, not a first demo or launch commitment.
7. **App Store description and screenshots (Phase 5)**. Visual style, target user description, key feature highlights.
8. **Compliance and pricing copy**. Accepted planning default: do not claim HIPAA or SOC2; keep GDPR data-subject rights in hosted planning; pricing remains undecided with no public plan, quota, or paid-tier claim from placeholder values.
9. **i18n launch posture**. Accepted planning default: deferred from the first enterprise demo and represented as a later planning item if launch scope changes.
10. **Local/cloud data semantics**. Accepted planning default: local-to-cloud mode switching requires ADR-MOBILE-002 before Phase 2 acceptance.

Each of these is non-blocking until its phase reaches the gate where it matters. Accepted planning defaults do not close hosted/mobile production readiness or the `Fortemi/HotM#251` manifest launch-rate proof gate.

## Maintenance note

This plan is a living document. It should be updated when:
- A phase completes (note the actual gate-passing commit/artifact).
- A risk is realized (update the severity, document the mitigation taken).
- An open question is resolved (move the answer to the relevant phase's scope, remove from the open list).
- New scope appears that should be captured (add to the relevant phase or to deferred).

The plan is updated **after**, not **before**, the phase work begins. The plan does not become aspirational backlog.
