---
title: "Mobile remote-config and manifest delivery patterns (May 2026)"
type: research-finding
created: 2026-05-17
topic: mobile-config
quality_baseline: MODERATE
related_artifacts:
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/architecture/manifest-schema-v1.md
  - .aiwg/planning/mobile-expansion-phase-plan.md
---

# Mobile remote-config and manifest delivery patterns (May 2026)

## Scope

The cloud-only mobile HotM architecture needs a runtime configuration endpoint. The app ships from the store with a baked-in API base URL; everything else (auth provider details, available models, feature flags, branding, kill switches, minimum-supported-version) flows from a server-side manifest. This research documents the well-known patterns, recommends a schema for HotM, and surfaces anti-patterns to avoid.

## 1. Why a manifest at all

Mobile apps go through app-store review (days to weeks). If a flag, model name, auth-provider URL, or feature toggle is hardcoded in the binary, it cannot be changed without a new release. **Remote config** decouples binary-shipping cadence from operational config changes.

Standard use cases (per Firebase Remote Config, LaunchDarkly, Statsig docs):
- Roll out a feature gradually (1% → 5% → 25% → 100%)
- Kill a buggy feature without an app update
- A/B test variants
- Change copy, branding, theme
- Update model defaults, regional defaults, supported provider list
- Push a minimum-supported-version that triggers an in-app "please update"

GRADE: HIGH — well-attested by all major remote-config vendors and standardization efforts (OpenFeature, etc.).

## 2. Canonical implementations

| System | Transport | Refresh model | Notes |
|---|---|---|---|
| **Firebase Remote Config** | HTTPS poll | Configurable interval; real-time push via FCM optional | Tightly coupled to Firebase SDK; free tier generous |
| **LaunchDarkly** | Streaming (SSE) + poll fallback | Real-time | Mature, costly above free tier |
| **Statsig** | HTTPS poll | Configurable | Strong mobile + experimentation focus |
| **PostHog** | HTTPS poll | Configurable; mobile remote-config available | Open-source option; free self-host |
| **Unleash** | HTTPS poll | Configurable | Open-source feature flags |
| **Flagsmith** | HTTPS poll | Configurable | Open-source; self-hostable |
| **OpenFeature** | Spec only | N/A | Vendor-neutral SDK abstraction over the above |

Sources:
- [Firebase Remote Config](https://firebase.google.com/products/remote-config) — HIGH
- [What can you do with Remote Config? (Firebase docs)](https://firebase.google.com/docs/remote-config/use-cases) — HIGH
- [Feature flags vs configuration (PostHog)](https://posthog.com/product-engineers/feature-flags-vs-configuration) — MODERATE
- [What is a feature flag? Feature Flags vs Remote Config vs A/B Testing (PostHog)](https://posthog.com/blog/what-is-a-feature-flag) — MODERATE
- [OpenFeature CLI docs](https://openfeature.dev/docs/reference/other-technologies/cli/) — HIGH
- [7 Best Mobile Feature Flagging Tools in 2025 (Statsig)](https://www.statsig.com/comparison/best-mobile-feature-flagging-tools) — LOW (vendor comparison)
- [Mobile feature flags: iOS and Android (Statsig)](https://www.statsig.com/perspectives/mobile-feature-flags-ios-android) — LOW
- [Android remote config tutorial (PostHog)](https://posthog.com/tutorials/android-remote-config) — MODERATE
- [Remote config docs (PostHog)](https://posthog.com/docs/feature-flags/remote-config) — MODERATE

## 3. Build vs buy for HotM

**Build (recommended).** HotM is already running its own Rust backend; adding a `GET /v1/manifest` endpoint is a small addition (~100 lines). Avoids a third-party dependency, simplifies the privacy story (no per-user data leaves the backend), and matches the project's existing single-developer-ops profile.

**When to buy later**: if A/B experimentation, complex targeting rules, or staged rollouts to specific segments become real product requirements. Then PostHog or Statsig becomes attractive. At launch: build.

GRADE: MODERATE — judgment call; both paths viable.

## 4. Recommended manifest schema (`GET /v1/manifest`)

Based on the canonical patterns above, here is the proposed minimum-viable manifest for HotM. **This schema is the primary integration contract between mobile clients and the backend** — getting it right early prevents rework.

```json
{
  "manifest_version": 1,
  "schema_revision": "2026-05-17",

  "service": {
    "status": "operational",          // operational | degraded | maintenance | shutdown
    "message": null,                  // optional banner shown to user
    "cache_ttl_seconds": 300          // how long client may cache this manifest
  },

  "client_version": {
    "minimum_supported": "1.0.0",     // below this, app forces update screen
    "recommended": "1.0.0",           // below this, app shows soft "update available"
    "update_url_ios": "https://apps.apple.com/app/idXXXXXXXXX",
    "update_url_android": "https://play.google.com/store/apps/details?id=io.fortemi.hotm"
  },

  "api": {
    "base_url": "https://api.hotm.fortemi.io",  // baseline; allows hot-relocate
    "websocket_url": "wss://api.hotm.fortemi.io/v1/ws"
  },

  "auth": {
    "provider": "clerk",              // clerk | auth0 | self | none
    "issuer_url": "https://hotm.clerk.accounts.dev",
    "client_id": "<public_clerk_app_id>",
    "scopes": ["openid", "email", "profile"],
    "redirect_uri": "hotm://auth/callback"
  },

  "models": {
    "default_generation": "claude-sonnet-4-7",
    "default_embedding": "voyage-3-large",
    "available_providers": [
      { "id": "anthropic", "name": "Anthropic Claude", "key_format": "sk-ant-..." },
      { "id": "openai",    "name": "OpenAI",          "key_format": "sk-..." },
      { "id": "openrouter","name": "OpenRouter",      "key_format": "sk-or-..." },
      { "id": "ollama",    "name": "Self-hosted Ollama (advanced)", "key_format": null }
    ],
    "available_generation_models": [
      { "provider": "anthropic", "model": "claude-sonnet-4-7", "label": "Claude Sonnet 4.7" },
      { "provider": "anthropic", "model": "claude-opus-4-7",   "label": "Claude Opus 4.7" },
      { "provider": "openai",    "model": "gpt-5",             "label": "GPT-5" }
    ],
    "available_embedding_models": [
      { "provider": "voyage", "model": "voyage-3-large" }
    ]
  },

  "features": {
    "media_upload": true,
    "spatial_search": true,
    "voice_capture": false,             // not yet available on mobile
    "agent_actions": false,             // gated; controlled rollout
    "experimental_panel": false
  },

  "tiers": {
    "current_tier": "free",             // free | pro | team
    "limits": {
      "max_notes": 5000,
      "max_storage_bytes": 1073741824,  // 1 GiB
      "max_inference_requests_per_day": 100
    }
  },

  "branding": {
    "primary_color": "#1a1a1a",
    "logo_url": null,
    "app_name_override": null           // for white-label deployments
  },

  "telemetry": {
    "enabled_by_default": false,
    "endpoint": "https://telemetry.hotm.fortemi.io/v1/events"
  },

  "links": {
    "support_url": "https://docs.fortemi.io/hotm/support",
    "privacy_policy_url": "https://hotm.fortemi.io/privacy",
    "terms_url": "https://hotm.fortemi.io/terms"
  }
}
```

**Schema design principles applied:**

1. **Versioning at the top**: `manifest_version` is the integer schema version. Clients refuse to parse manifests with a `manifest_version > known`. The `schema_revision` is a human-readable date for diff/audit.
2. **Cache TTL in the payload**: client honors `service.cache_ttl_seconds`, not a hardcoded interval.
3. **Service status field with kill-switch semantics**: `service.status = "shutdown"` is the global kill switch.
4. **Min/recommended version split**: hard floor and soft suggestion are distinct concepts.
5. **Public IDs only**: `auth.client_id` is fine to expose; private keys never appear here.
6. **Feature flags are booleans, not strings**: easier to evaluate, no parse logic.
7. **Tier shape supports both free and paid models** without restructure.

## 5. Cache and refresh strategy

**Recommended client behavior:**

```
On launch:
  1. Read cached manifest from local storage
  2. If cache exists and (now - cached_at) < cache_ttl_seconds → use cache, proceed
  3. Otherwise → fetch /v1/manifest with If-None-Match: <etag>
  4. On 200: replace cache; on 304: extend cached_at
  5. On network failure: fall back to cache regardless of age; emit warning
  6. If service.status == "shutdown" → show maintenance screen, do not proceed

Background refresh:
  - Every 5 minutes while app is foregrounded
  - On resume from background after >60s
  - After explicit user action (logout, settings change)
```

**ETag / If-None-Match conditional fetches** are well-supported by every HTTP library and dramatically reduce manifest bandwidth and parse cost. The backend should compute the ETag from a stable hash of the manifest body.

GRADE: HIGH — well-documented HTTP-caching pattern.

## 6. When to use push (and when not to)

Push channels (APNs / FCM silent push, SSE, WebSocket) make sense for:
- **Emergency kill switch propagation** — same hour, not 5 minutes from now.
- **Real-time A/B variant changes** — rare; usually polling is fine.
- **Server-to-user notifications** — but that's a different feature, not config.

Polling at 5-minute intervals with a 5-minute TTL is enough for almost everything else. Push adds operational complexity (handle delivery failure, ordering, mobile-OS quirks) that is not worth it for HotM's launch scope.

**Recommendation**: Poll-only at launch. Plan to add silent-push for the kill switch in a later milestone.

GRADE: MODERATE — judgment, not prescription.

## 7. Versioning and compatibility

**Forward compatibility**: Adding fields to the manifest is always safe. Clients ignore unknown fields. Add freely.

**Backward compatibility**: Removing fields is dangerous. Old clients in the field may still depend on them. Two strategies:
1. **Never remove fields; mark deprecated**: set the field to a deprecated-marker value (e.g., `null`, `"deprecated"`) and rely on clients having been updated.
2. **Bump `manifest_version`** when a breaking change is required. Old clients receiving a higher version refuse to parse, prompt user to update via `min_supported_version`.

Recommendation: use strategy 1 for nearly everything; reserve `manifest_version` bumps for genuinely structural changes.

GRADE: MODERATE — practitioner consensus.

## 8. Security considerations

**The manifest endpoint must be unauthenticated.** It serves the auth-provider configuration the user needs to *log in* — there's no logged-in user yet when it's first hit.

Threats:
- **Tampering in transit**: mitigated by TLS. Use HTTPS only; HSTS preload eventually.
- **Enumeration of feature flag names**: anyone hitting `/v1/manifest` can see all flag keys. Don't put confidential codenames in flag names. Use neutral names like `experimental_panel` rather than `project_falcon_q3_launch`.
- **Pre-release leak**: same as above. Internal-only flags should not appear in the public manifest. Maintain a separate `internal_features` block server-side that requires authentication to read.

Additional hardening:
- Rate-limit the manifest endpoint (per-IP, per-min) — abuse vector is low but worth a token-bucket.
- Cache-Control headers for CDN edge caching to absorb traffic spikes.
- The endpoint is a stable API surface: changes must go through the schema-versioning discipline above.

GRADE: MODERATE — security considerations are standard but situation-specific.

## 9. Anti-patterns

Documented failure modes from practitioner posts and our own design analysis:

1. **Manifest TTL too long, kill switch too slow.** Set the TTL to the maximum tolerable response time for a critical issue. 5 minutes is the practical floor without push.
2. **Putting per-user data in the global manifest.** Manifest is global-or-tiered-only, never per-user. Per-user config goes through authenticated user-profile endpoints.
3. **Mixing config with content.** Manifest is configuration; the user's actual notes are content. Don't conflate.
4. **Manifest endpoint requires login.** Then there's no way to render the login screen.
5. **No graceful degradation when manifest is unavailable.** Default values must exist in the client binary for every feature flag and every config value. Manifest *overrides* them; it doesn't supply them from scratch.
6. **Manifest changes are not auditable.** Manifest is operational config; every change should be in version control or have an audit log. Don't let it become a "production knob" with no history.
7. **Feature flags that never get cleaned up.** Each flag has a lifecycle: introduced → ramped → 100% → flag retired. Bake a quarterly review into ops.

GRADE: MODERATE — well-attested practitioner knowledge.

Sources for anti-patterns:
- [PostHog: Feature flags vs configuration](https://posthog.com/product-engineers/feature-flags-vs-configuration)
- [PostHog: What is a feature flag?](https://posthog.com/blog/what-is-a-feature-flag)

## 10. Bottom line for the ADR

1. **Build, don't buy.** A `GET /v1/manifest` endpoint added to `matric-api` is a small addition; vendor remote-config services are over-engineering for launch.
2. **Schema above is the proposed v1 contract.** Architecturally load-bearing — finalize before any mobile UI code is written.
3. **Poll-only at launch.** 5-minute TTL, ETag-conditional, cache-friendly. Plan for silent-push kill switch as a later milestone.
4. **Defaults in the binary, overrides in the manifest.** Never assume the manifest is reachable; degrade gracefully.
5. **Audit log for manifest changes.** Treat it as config-as-code: version control or audit log mandatory.
6. **No internal-only data in the public manifest.** Authenticated config is a different endpoint.

## Sources

- [Firebase Remote Config](https://firebase.google.com/products/remote-config) — HIGH
- [What can you do with Remote Config? Firebase docs](https://firebase.google.com/docs/remote-config/use-cases) — HIGH
- [Firebase Remote Config docs](https://firebase.google.com/docs/remote-config) — HIGH
- [PostHog — Feature flags vs configuration](https://posthog.com/product-engineers/feature-flags-vs-configuration) — MODERATE
- [PostHog — What is a feature flag?](https://posthog.com/blog/what-is-a-feature-flag) — MODERATE
- [PostHog — Android remote config tutorial](https://posthog.com/tutorials/android-remote-config) — MODERATE
- [PostHog — Remote config docs](https://posthog.com/docs/feature-flags/remote-config) — MODERATE
- [OpenFeature — CLI docs](https://openfeature.dev/docs/reference/other-technologies/cli/) — HIGH
- [Statsig — 7 Best Mobile Feature Flagging Tools (vendor comparison)](https://www.statsig.com/comparison/best-mobile-feature-flagging-tools) — LOW
- [Statsig — Mobile feature flags: iOS and Android](https://www.statsig.com/perspectives/mobile-feature-flags-ios-android) — LOW
