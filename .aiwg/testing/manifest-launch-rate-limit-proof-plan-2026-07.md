# Manifest Launch Rate-Limit Proof Plan - 2026-07

## Status

Open proof plan for `Fortemi/HotM#251`. This does not close hosted/mobile manifest discovery production readiness and does not change the current fixture-backed HotM enterprise preview boundary.

## Scope

This plan defines the evidence required before unauthenticated `GET /v1/manifest` can be used in hosted mobile/cloud or public backoffice production-readiness claims.

The endpoint is intentionally unauthenticated because mobile/cloud clients need manifest data before login. The launch proof therefore has to show that unauthenticated access is bounded at the enforcement layer, cache-aware, and non-bypassable by ordinary cache or conditional-request headers.

## Current Baseline

- Current provisional value: `60 requests/minute` per IP.
- Current posture: provisional and not justified for public launch.
- Current claim boundary: fixture-backed HotM preview is allowed; hosted/mobile manifest discovery production readiness remains no-go.
- Live tracker: `Fortemi/HotM#251`.

## Required Launch Decision

Before closing `Fortemi/HotM#251`, record:

| Decision | Required content |
|---|---|
| Launch baseline | Explicit request rate, burst capacity, token refill period, and rationale from expected app-launch, resume, background-refresh, and CDN-cache traffic. |
| Enforcement layer | Concrete layer such as CDN/WAF, API gateway, reverse proxy, or `matric-api`, with ownership and configuration path. |
| Identity key | The key used for unauthenticated limiting, such as client IP plus trusted proxy headers; include spoofing and shared-NAT limitations. |
| Cache interaction | How `ETag`, `If-None-Match`, `304`, `Cache-Control`, and CDN caching interact with the limiter. |
| Retry policy | `429 Too Many Requests` response shape, `Retry-After` header behavior, client backoff expectations, and minimum retry interval. |
| Telemetry | Counters or logs that show allowed, throttled, cache-hit, cache-revalidated, and origin-hit behavior without recording credentials or tenant identifiers. |

## Required Test Evidence

The closure evidence must include these cases:

| Case | Required proof |
|---|---|
| Baseline under limit | Requests within the launch baseline return `200 OK` or cache-valid `304 Not Modified`. |
| Burst above limit | Requests exceeding burst capacity return `429 Too Many Requests` with `Retry-After` and `retry_after_seconds`. |
| Cache headers do not bypass | Requests with `If-None-Match`, `Cache-Control: no-cache`, `Pragma: no-cache`, and varied `Accept-Encoding` cannot bypass the limiter. |
| ETag behavior under limiting | Valid conditional requests either return `304` while under limit or `429` when over limit; no stale or malformed manifest is emitted. |
| Method boundary | Non-GET requests remain `405 Method Not Allowed` and do not become a bypass route. |
| Shared-cache safety | CDN or gateway cache hits are counted according to the recorded enforcement-layer decision, and origin shielding is explained. |
| Observability | Evidence shows counts for allowed and throttled requests without tokens, tenant IDs, user emails, auth codes, API keys, or client secrets. |

## Suggested Test Harness

Use a staging deployment or local gateway fixture that can emulate the chosen enforcement layer:

```bash
# Pseudocode only; final command belongs in the implementation PR.
for i in $(seq 1 80); do
  curl -si \
    -H 'If-None-Match: "test-etag"' \
    -H 'Cache-Control: no-cache' \
    https://api.hotm.fortemi.io/v1/manifest
done
```

The accepted receipt should include a redacted command transcript or CI artifact, not screenshots alone.

## Local Fixture Evidence

The local fixture proof command is:

```bash
node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs
```

This fixture starts a local HTTP server for `GET /v1/manifest` and proves these launch-contract semantics:

- `200 OK` includes `ETag`, `Cache-Control`, `Vary`, and `X-Manifest-Revision`.
- Valid `If-None-Match` returns `304 Not Modified` while under the limiter.
- Non-GET requests return `405 Method Not Allowed` with `Allow: GET`.
- Requests over the fixture burst limit return `429 Too Many Requests`, `Retry-After`, and `retry_after_seconds`.
- `If-None-Match`, `Cache-Control: no-cache`, `Pragma: no-cache`, varied `Accept-Encoding`, and untrusted `X-Forwarded-For` values do not bypass the limiter.
- Telemetry evidence records allowed, throttled, cache-revalidated, and origin-hit events without tokens, tenant IDs, user emails, auth codes, API keys, or client secrets.

This local fixture proof does not close `Fortemi/HotM#251`. It is preflight evidence for the expected contract only. Closure still requires an issue-attached staging, gateway, hosted `matric-api`, or CI receipt from the actual enforcement layer selected for launch.

## Non-Goals

- Do not close `Fortemi/HotM#251` with documentation only.
- Documentation alone is not accepted proof for `Fortemi/HotM#251`; issue-attached staging, gateway, or CI evidence is required.
- Do not close `Fortemi/HotM#251` with local fixture proof alone.
- Do not treat the provisional `60 requests/minute` value as accepted without rationale.
- Do not make hosted/mobile manifest discovery part of public production-readiness claims until this proof is accepted.
- Do not block the current fixture-backed HotM preview on this proof.

## References

- `Fortemi/HotM#251`
- `HotM/.aiwg/architecture/manifest-schema-v1.md`
- `HotM/.aiwg/architecture/adr-mobile-cloud-architecture.md`
- `HotM/.aiwg/planning/mobile-expansion-phase-plan.md`
- `HotM/scripts/verify-manifest-launch-boundary.sh`
