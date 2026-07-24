---
title: HotM Manifest Endpoint v1 Specification
type: api-specification
created: 2026-05-17
status: Proposed
version: 1.0.0
related_artifacts:
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/research/findings/mobile-manifest-remote-config.md
  - .aiwg/planning/mobile-expansion-phase-plan.md
  - .aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md
---

# HotM Manifest Endpoint v1 Specification

## Purpose

The manifest endpoint is the **first network call any HotM mobile client makes** and the integration contract between the mobile binary (released through Apple App Store and Google Play) and the hosted backend (`matric-api` in multi-tenant deployment). It delivers everything the client cannot hardcode: which auth provider to talk to, what models are available, which features are enabled for this tier, whether the binary needs to force an update, and whether the service is currently operational. The endpoint is unauthenticated (it must be reachable before login) and globally cacheable (CDN-friendly).

Consumers: HotM mobile (iOS + Android) and HotM desktop in cloud mode. Local-install desktop never calls it.

Companion ADR: `.aiwg/architecture/adr-mobile-cloud-architecture.md`.

## Endpoint

```
GET https://api.hotm.fortemi.io/v1/manifest
```

| Property | Value |
|---|---|
| **Method** | `GET` only. `POST/PUT/PATCH/DELETE` return 405. |
| **Authentication** | None. Must be reachable before user login. |
| **Rate limit** | Per-IP token bucket. Provisional checkpoint planning value: 60 requests/minute; `Fortemi/HotM#251` must replace or justify the launch value before public/hosted/mobile production claims. |
| **CDN cacheable** | Yes. ETag + Cache-Control headers (see §HTTP Semantics). |
| **TLS** | Required. HTTP redirects to HTTPS. HSTS preload eligibility once domain is stable. |

Launch-boundary update, 2026-07: the `60 requests/minute` value remains provisional. `Fortemi/HotM#251` and `.aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md` must replace or justify the launch baseline, burst capacity, enforcement layer, identity key, `429`/`Retry-After` behavior, cache/ETag interaction, non-bypass proof, and telemetry evidence before hosted/mobile manifest discovery can support public production-readiness or backoffice claims. This does not block the current fixture-backed HotM enterprise preview.

## Schema (JSON)

```json
{
  "manifest_version": 1,
  "schema_revision": "2026-05-17",

  "service": {
    "status": "operational",
    "message": null,
    "cache_ttl_seconds": 300
  },

  "client_version": {
    "minimum_supported": "1.0.0",
    "recommended": "1.0.0",
    "update_url_ios": "https://apps.apple.com/app/idXXXXXXXXX",
    "update_url_android": "https://play.google.com/store/apps/details?id=io.fortemi.hotm"
  },

  "api": {
    "base_url": "https://api.hotm.fortemi.io",
    "websocket_url": "wss://api.hotm.fortemi.io/v1/ws"
  },

  "auth": {
    "provider": "clerk",
    "issuer_url": "https://hotm.clerk.accounts.dev",
    "client_id": "<public_clerk_app_id>",
    "scopes": ["openid", "email", "profile"],
    "redirect_uri": "hotm://auth/callback"
  },

  "models": {
    "default_generation": "claude-sonnet-4-7",
    "default_embedding": "voyage-3-large",
    "available_providers": [
      { "id": "anthropic",   "name": "Anthropic Claude", "key_format": "sk-ant-..." },
      { "id": "openai",      "name": "OpenAI",           "key_format": "sk-..." },
      { "id": "openrouter",  "name": "OpenRouter",       "key_format": "sk-or-..." },
      { "id": "ollama",      "name": "Self-hosted Ollama (advanced)", "key_format": null }
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
    "voice_capture": false,
    "agent_actions": false,
    "experimental_panel": false
  },

  "tiers": {
    "current_tier": "free",
    "limits": {
      "max_notes": 5000,
      "max_storage_bytes": 1073741824,
      "max_inference_requests_per_day": 100
    }
  },

  "branding": {
    "primary_color": "#1a1a1a",
    "logo_url": null,
    "app_name_override": null
  },

  "telemetry": {
    "enabled_by_default": false,
    "endpoint": "https://telemetry.hotm.fortemi.io/v1/events"
  },

  "links": {
    "support_url": "https://docs.fortemi.com/hotm/support",
    "privacy_policy_url": "https://hotm.fortemi.io/privacy",
    "terms_url": "https://hotm.fortemi.io/terms"
  }
}
```

## Field reference

| Field path | Type | Required | Description |
|---|---|---|---|
| `manifest_version` | integer | yes | Schema major version. Clients refuse to parse when `> known`. Start at `1`. |
| `schema_revision` | string (date) | yes | Human-readable revision tag for diff/audit. ISO date. |
| `service.status` | enum | yes | `operational` \| `degraded` \| `maintenance` \| `shutdown`. See §Service-status semantics. |
| `service.message` | string \| null | yes (null OK) | Optional in-app banner copy. Plain text. |
| `service.cache_ttl_seconds` | integer | yes | How long clients may cache this manifest before re-fetching. Default 300. Min 60. Max 3600. |
| `client_version.minimum_supported` | semver | yes | Hard floor. Clients below this version see force-update screen, cannot proceed. |
| `client_version.recommended` | semver | yes | Soft floor. Clients below this version see a non-blocking "update available" hint. |
| `client_version.update_url_ios` | URL | yes | App Store URL. Defaults shown until real `id` is provisioned. |
| `client_version.update_url_android` | URL | yes | Play Store URL. |
| `api.base_url` | URL | yes | Authority for all `/v1/*` endpoints. Allows backend relocation without re-release. |
| `api.websocket_url` | URL | yes | WebSocket endpoint for real-time features. |
| `auth.provider` | enum | yes | `clerk` \| `auth0` \| `keycloak` \| `self` \| `none`. Drives client's OAuth flow selection. |
| `auth.issuer_url` | URL | yes | OAuth/OIDC issuer. |
| `auth.client_id` | string | yes | **Public** OAuth client ID. Never a secret. |
| `auth.scopes` | array<string> | yes | OAuth scopes the client requests. |
| `auth.redirect_uri` | URI | yes | OAuth redirect, typically a custom URL scheme (`hotm://auth/callback`). |
| `models.default_generation` | string | yes | Model ID the client preselects in UI for new users. |
| `models.default_embedding` | string | yes | Embedding model preselected. |
| `models.available_providers` | array<object> | yes | Provider menu shown to users. `key_format` is a hint for input validation. |
| `models.available_generation_models` | array<object> | yes | Models user can choose. Empty array = no models available (degraded mode). |
| `models.available_embedding_models` | array<object> | yes | Same shape, embedding-side. |
| `features.*` | boolean | yes | All feature flags. Boolean only. Default in client binary, override here. See §Feature flag conventions. |
| `tiers.current_tier` | string | yes | `free` \| `pro` \| `team` (extensible). Determines limit row to enforce. |
| `tiers.limits.max_notes` | integer | yes | Hard limit on user's note count. |
| `tiers.limits.max_storage_bytes` | integer | yes | Hard limit on attachment storage. |
| `tiers.limits.max_inference_requests_per_day` | integer | yes | Daily LLM request quota. |
| `branding.primary_color` | hex string | yes | Theme accent. Hex `#RRGGBB`. |
| `branding.logo_url` | URL \| null | yes (null OK) | White-label logo override. Defaults shown in client when null. |
| `branding.app_name_override` | string \| null | yes (null OK) | White-label app name. |
| `telemetry.enabled_by_default` | boolean | yes | Whether to opt in by default. **Default false** for privacy. |
| `telemetry.endpoint` | URL | yes | Where event payloads go (when enabled). |
| `links.support_url` | URL | yes | Help center / contact. |
| `links.privacy_policy_url` | URL | yes | Privacy policy. |
| `links.terms_url` | URL | yes | Terms of service. |

Every field is required in the response body. "Not applicable" values use `null` rather than being omitted, so client parsers never branch on field presence.

## Machine-Readable Schema

The normative JSON Schema companion for this prose specification is `.aiwg/architecture/manifest-schema-v1.json`. Validate schema changes with:

```bash
node .aiwg/testing/scripts/validate-manifest-schema.mjs
```

## HTTP semantics

### Response codes

| Code | Meaning | Body |
|---|---|---|
| `200 OK` | Manifest body returned. | Full JSON manifest. |
| `304 Not Modified` | Client's `If-None-Match` matched current ETag. | Empty. |
| `405 Method Not Allowed` | Non-GET request. | `{ "error": "method_not_allowed", "allowed": ["GET"] }`. |
| `429 Too Many Requests` | Rate limit exceeded. | `{ "error": "rate_limited", "retry_after_seconds": N }`. `Retry-After` header set. |
| `503 Service Unavailable` | Backend cannot serve manifest. **Avoid** — return a `200` with `service.status: "shutdown"` instead whenever possible. `503` is for backend failure scenarios where the manifest cannot be computed at all. | `{ "error": "service_unavailable", "retry_after_seconds": N }`. |

### Response headers

| Header | Value | Notes |
|---|---|---|
| `Content-Type` | `application/json; charset=utf-8` | Always. |
| `ETag` | `"<sha256-hex>"` (quoted) | Stable hash of the manifest body. Backend recomputes only on manifest change. |
| `Cache-Control` | `public, max-age=300, stale-while-revalidate=600` | CDN may serve cached responses; clients may serve stale during revalidation. |
| `Vary` | `Accept-Encoding` | Required for gzip/brotli CDN caching. |
| `X-Manifest-Revision` | matches `schema_revision` in body | Out-of-band revision marker, useful for log correlation. |

### Request headers (optional from client)

| Header | Value | Notes |
|---|---|---|
| `If-None-Match` | previously received ETag (quoted) | Triggers `304` when matching. Cuts manifest-refresh bandwidth significantly. |
| `Accept-Encoding` | `gzip, br` recommended | Body compresses to ~1-2 KB. |
| `User-Agent` | `HotM/<version> (<platform>)` | Used in server-side analytics + version-skew telemetry. Example: `HotM/1.2.0 (ios)`. |

## Client behavior contract

Clients MUST implement the following protocol. Failure to do so risks stale config or broken degraded-mode behavior.

```
On app launch:
  1. Read cached manifest from local secure storage (if any)
  2. If cache exists AND (now - cached_at) < cache_ttl_seconds:
       use cache, proceed to next launch step
  3. Else:
       fetch GET /v1/manifest with If-None-Match: <cached_etag> if available
  4. On 200:
       parse body
       if manifest_version > client_supported_version → show "please update"
       write to cache with new etag and cached_at = now
  5. On 304:
       extend cached_at = now (keep existing body)
  6. On network failure:
       fall back to cache regardless of age
       emit non-fatal warning
       if no cache exists → show offline-mode screen with retry button
  7. Apply manifest fields:
       if service.status == "shutdown" → show maintenance screen, do not proceed
       if client_version.minimum_supported > current_version → show force-update screen
       else if client_version.recommended > current_version → show soft "update available" prompt
       else → proceed with normal launch using manifest as config source

Background refresh:
  - Refresh every cache_ttl_seconds while app is foregrounded
  - Refresh on resume-from-background when last fetch was > cache_ttl_seconds ago
  - Refresh on explicit user action (logout, settings reload)
  - Use exponential backoff on repeated failures (1s, 2s, 4s, ... cap 60s)
```

All defaults referenced in client logic (default model, default tier limits, default feature flag values) **MUST also exist in the client binary** so the app degrades gracefully when the manifest is unreachable on first launch.

## Service-status semantics

| Value | Client behavior |
|---|---|
| `operational` | Normal launch. UI fully accessible. |
| `degraded` | Normal launch, but show non-dismissible status banner with `service.message`. Useful for "search is slow today" notices. |
| `maintenance` | Show full-screen maintenance message (`service.message`). Block navigation to data-bearing screens. User can retry. Existing read-only cached content may remain visible. |
| `shutdown` | Show "service unavailable" full-screen message. Hard kill switch. Client may not proceed. Different from `503` in that the manifest itself loads cleanly — the service is deliberately shut down. |

The `shutdown` value exists for incident response: if a critical security issue is detected and the backend must be taken offline, setting `service.status` to `shutdown` and pushing a manifest update propagates through clients within `cache_ttl_seconds`.

## Version-gating semantics

```
current = parse_semver(client_version_baked_in_binary)
min     = parse_semver(manifest.client_version.minimum_supported)
rec     = parse_semver(manifest.client_version.recommended)

if current < min:
  // Hard block. Cannot proceed.
  show ForceUpdateScreen(update_url_for_platform)
elif current < rec:
  // Soft hint. Dismissible once per session.
  show SoftUpdateBanner(update_url_for_platform)
else:
  // Up to date. No banner.
  proceed
```

Semver comparison: standard major.minor.patch, with build metadata ignored. Pre-release identifiers (e.g., `1.0.0-rc.1`) are treated as less than the release (`1.0.0`).

## Feature flag conventions

1. **Boolean values only**. No nested objects, no strings, no enums. Each flag is `true` or `false`.
2. **Neutral names**. Use descriptive names (`media_upload`, `voice_capture`, `agent_actions`) rather than confidential codenames (`project_falcon_q3`, `internal_dogfood_only`). The manifest is **public** — anyone hitting the endpoint sees every flag.
3. **Defaults in the binary**. The client must have a default value for every flag it consults. Manifest only overrides; never supplies-from-scratch.
4. **Internal flags do not appear here**. If a feature is dogfood-only or pre-release-pre-internal-disclosure, it does not go in the public manifest. Add an authenticated `/v1/features/internal` endpoint when this need arises.
5. **Lifecycle obligation**. Each flag has a lifecycle: introduced → ramped → 100% → flag retired (removed from manifest). Quarterly cleanup is bake-in ops work, not aspirational. Stale flags accrue silently and become forgotten config knobs.
6. **Naming convention**. `snake_case`. Prefix sparingly: `experimental_*` for things rampable to early users; otherwise no prefix.

## Versioning policy

**Forward-compatible changes (no version bump)**:
- Add a new field
- Add a new feature flag
- Add a new model or provider entry
- Add a new tier value (e.g., `enterprise`)
- Tighten a value (e.g., reduce `max_inference_requests_per_day`)

Clients ignore unknown fields and unknown enum values gracefully — they fall back to defaults. The schema is intentionally additive.

**Backward-incompatible changes (require `manifest_version` bump)**:
- Remove a field
- Rename a field
- Change a field's type
- Change semantics of an existing enum value
- Restructure nested objects

When `manifest_version` bumps:
1. Plan the change in `.aiwg/architecture/` with a successor schema doc (`manifest-schema-v2.md`).
2. Maintain a transitional period where both versions are served — clients on v1 receive a v1 body; v2-aware clients receive v2.
3. Use the `client_version.minimum_supported` field to force-update v1 clients before retiring v1 serving.
4. Retire the v1 endpoint only after telemetry confirms v1 client population is empty.

This pattern (additive forever, backward-incompatible-rare) matches the OpenAPI / GraphQL evolution conventions and avoids the "field deprecation graveyard" antipattern.

## Security considerations

The manifest endpoint is intentionally unauthenticated; this is a feature, not a bug, but the public exposure creates threats that must be handled:

1. **Information disclosure**. Every field in the manifest is visible to anyone. Therefore:
   - Never put internal codenames in feature flag names.
   - Never put unreleased product names in `models.available_*`.
   - Never include any per-user data (tenant IDs, user emails, internal-tier names that imply customer identity).
   - `auth.client_id` is public per OAuth conventions — explicitly OK to expose. `auth.client_secret` is NEVER in this response (server-side only).

2. **Tampering in transit**. Mitigated by TLS. HTTP redirects to HTTPS. Plan HSTS preload once the domain is stable.

3. **Rate-limit DoS**. The endpoint is small and cache-friendly, so absolute DoS is hard, but a malicious client could try to exhaust origin capacity. Mitigations: per-IP token bucket, edge-CDN absorption, conditional-fetch (ETag/304) reduces real backend hits.

4. **Manifest change audit**. Every change to the manifest must be tracked. Either:
   - Version-control the canonical manifest in this repo (preferred — change history is in `git log`), OR
   - Maintain a server-side audit log of who changed what when.

   Treating the manifest as config-as-code (in git) is the most rigorous option and dovetails with this repo's existing `.aiwg/` artifact discipline.

5. **Replay protection**. None needed — there is no state. The manifest is idempotent.

6. **Authentication for *write*-side**: this spec covers the read endpoint only. The mechanism for *updating* the served manifest (admin UI? config commit? `aiwg`-style CLI?) is an operational concern documented in the phase plan, not this contract.

## Anti-patterns / out-of-scope

The following MUST NOT be added to this endpoint:

- **Per-user data**. The manifest is global. User-specific config goes through authenticated `/v1/user/profile` or similar.
- **Secrets of any kind**. API keys, OAuth client_secret, signing keys — never. Public OAuth client_id is fine.
- **Internal-only flags**. Use a separate authenticated endpoint.
- **Large blob content**. The manifest stays under 4 KB compressed. CSS, fonts, large images do not go here — link them.
- **Server-side prompts or LLM content**. The manifest is configuration, not content delivery.
- **Operational metrics** (uptime numbers, queue depths). Use a separate status page.
- **A/B test variants**. Use a feature-flag service for A/B testing. The manifest is for global / tier-wide config.

## Test plan stub

Acceptance tests that should exist before the manifest endpoint goes to public production. Enumerated for a future test-engineering pass to pick up — not implemented here.

1. **Schema validity**: response parses as JSON and matches the JSON Schema (to be written alongside implementation).
2. **All fields present**: every documented field exists in the response.
3. **`200` and `304` parity**: `If-None-Match` matching returns `304` empty body.
4. **`405` on non-GET**: POST/PUT/DELETE return 405.
5. **`429` on burst**: rapid requests exceed bucket; subsequent requests get `429` with `Retry-After`.
6. **TLS-only**: HTTP redirects to HTTPS (or 400, depending on infra config).
7. **Cache headers**: `Cache-Control`, `ETag`, `Vary` all present and correct.
8. **Service-status enum coverage**: all four values (`operational`, `degraded`, `maintenance`, `shutdown`) handled correctly on the client.
9. **Force-update gating**: client with version < `minimum_supported` blocks navigation to data screens.
10. **Forward-compat**: client at schema v1 receives an extra unknown field — does not crash, ignores it.
11. **Default fallback**: client with no network gets cached manifest; client with no cache and no network gets in-binary defaults plus offline screen.

## Example responses

### Success — operational

`GET /v1/manifest`
Status: `200 OK`
Headers:
```
Content-Type: application/json; charset=utf-8
ETag: "5f4dcc3b5aa765d61d8327deb882cf99"
Cache-Control: public, max-age=300, stale-while-revalidate=600
Vary: Accept-Encoding
X-Manifest-Revision: 2026-05-17
```

Body: see §Schema (JSON) above. All fields populated as in the canonical example.

### Conditional — not modified

`GET /v1/manifest`
Request header: `If-None-Match: "5f4dcc3b5aa765d61d8327deb882cf99"`
Status: `304 Not Modified`
Body: empty.

Client honors existing cache; bumps `cached_at`.

### Maintenance mode

Same shape as success, but `service.status` and `service.message` change:

```json
{
  "manifest_version": 1,
  "schema_revision": "2026-05-17",
  "service": {
    "status": "maintenance",
    "message": "We're upgrading the inference layer. Service returns in ~30 minutes.",
    "cache_ttl_seconds": 60
  },
  "...": "rest of manifest unchanged"
}
```

Note the reduced `cache_ttl_seconds` — during incidents, clients should re-check more often.

### Shutdown / kill switch

```json
{
  "manifest_version": 1,
  "schema_revision": "2026-05-17",
  "service": {
    "status": "shutdown",
    "message": "Service is offline. See https://hotm.fortemi.io/status for updates.",
    "cache_ttl_seconds": 60
  },
  "...": "rest of manifest unchanged"
}
```

Client shows full-screen "service unavailable" message and does not proceed. The presence of the field elsewhere lets the client *know* the manifest itself succeeded — distinguishing from a network failure.

### Rate-limited

`GET /v1/manifest` (request 61 in 60 seconds)
Status: `429 Too Many Requests`
Headers:
```
Retry-After: 30
Content-Type: application/json; charset=utf-8
```
Body:
```json
{
  "error": "rate_limited",
  "retry_after_seconds": 30
}
```

Client retries after `Retry-After` interval with exponential backoff.

## Open questions

These cannot be settled in this spec alone; they require operator/product input:

1. **Auth provider final choice**. The schema lists `clerk` first, but the choice between Clerk, Auth0, Keycloak (self-hosted), and a roll-your-own depends on cost tolerance and lock-in posture. Settled in the phase plan, locked in the ADR.
2. **Tier definitions**. Are there actually tiers at launch, or is there only a single `free` tier? Limit values are placeholders until the manifest launch proof records the accepted launch baseline and tier policy.
3. **Telemetry endpoint**. Does HotM operate its own telemetry endpoint or use a vendor (PostHog, Plausible)? Affects the `telemetry.endpoint` URL.
4. **Domain choice**. `api.hotm.fortemi.io` is suggestive but not confirmed. The exact domain affects DNS, CDN, and certificate setup.
5. **Manifest update mechanism**. How does the operator actually change the served manifest? Direct git commit + redeploy? An admin UI? A CLI? Affects the operational story but not the contract.
6. **Initial rate-limit numbers**. The 60/min figure is unjustified; `Fortemi/HotM#251` must replace or justify it with launch-rate proof before public launch.

These should be tracked as line-items in the phase plan and resolved before the manifest endpoint goes to public production. The launch-rate items are specifically tracked by `Fortemi/HotM#251` and `.aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md`.
