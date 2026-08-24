# agent-proxy — Security Posture

## Intended Deployment

agent-proxy defaults to a **localhost-only sidecar** for the HotM UI (web SPA in
development, Tauri webview in desktop builds). It holds raw API keys for cloud
LLM providers (Anthropic, OpenAI) and proxies requests on behalf of the local
user. A hosted profile is admitted only when Fortemi compatibility metadata
requires authentication and the deployment supplies released verifier settings
plus an active-tenant lookup implementation.

## Threat Model

| Threat                                      | Control                                  |
|--------------------------------------------|------------------------------------------|
| Remote attacker reaches the API directly    | Bind to `127.0.0.1` only (default).      |
| Same-machine browser cross-origin call      | CORS origin allowlist (`CORS_ORIGIN`).   |
| Runaway client / quota exhaustion           | Per-IP rate limit (`AGENT_PROXY_RATE_LIMIT_RPM`, default 60 rpm). |
| API key leakage to the renderer             | Keys stay in the server process; the UI never sees them. |
| ReDoS / event-loop wedge                    | Patched Express + path-to-regexp (#214). |

**Out of scope** — the following are *not* defended against by agent-proxy:

- A malicious process running as your local user. OS user isolation is the
  outer boundary. If something else on your box can read your environment,
  it can also reach `127.0.0.1:3001`.
- A compromised browser extension or another tab running on your local Vite
  dev server. CORS reduces but does not eliminate this risk.

## Configuration

| Env var                        | Default                         | Notes |
|--------------------------------|---------------------------------|-------|
| `PORT`                         | `3001`                          | |
| `BIND_ADDR`                    | `127.0.0.1`                     | Set to `0.0.0.0` to expose; see "Network exposure" below. |
| `CORS_ORIGIN`                  | `http://localhost:5173`         | Single origin only. |
| `AGENT_PROXY_RATE_LIMIT_RPM`   | `60`                            | Per-IP requests per minute on `/api/agent/chat`. Set to `0` to disable. |
| `ANTHROPIC_API_KEY`            | unset                           | Required only for the `anthropic` provider. |
| `OPENAI_API_KEY`               | unset                           | Required only for the `openai` provider. |
| `FORTEMI_AUTH_RELEASE`         | unset                           | Hosted mode requires the pinned released auth version. |
| `FORTEMI_AUTH_CONTRACT_VERSION` | pinned release value           | Must match the admitted public claim contract. |
| `FORTEMI_AUTH_PROFILE`         | pinned release value           | Must match the admitted Node profile. |
| `FORTEMI_AUTH_ISSUER`          | unset                           | Exact hosted token issuer. |
| `FORTEMI_AUTH_AUDIENCE`        | unset                           | Exact hosted token audience. |
| `FORTEMI_AUTH_JWKS_URL`        | unset                           | HTTPS required except loopback development. |
| `FORTEMI_AUTH_TENANT_CLAIM`    | `fortemi:tenant_id`             | Tenant UUID claim name. |
| `FORTEMI_AUTH_CLOCK_SKEW_SECONDS` | `60`                         | Integer from 0 through 300. |
| `FORTEMI_AUTH_JWKS_TIMEOUT_MS` | `5000`                          | Remote JWKS request timeout. |
| `FORTEMI_AUTH_JWKS_COOLDOWN_MS` | `30000`                        | Minimum refetch interval for an unknown key ID. |
| `FORTEMI_AUTH_JWKS_CACHE_MAX_AGE_MS` | `600000`                   | Maximum remote JWKS cache age. |

## Network Exposure

`createAgentProxyApp` installs authentication middleware on
`/api/agent/chat` before parsing request content. The compatibility-advertised
`anonymous_local` profile admits the local workflow without a bearer token.
Hosted mode requires RS256 issuer/audience/JWKS verification and an active
tenant lookup for every admitted request. Missing credentials, unknown or
suspended tenants, JWKS outages, tenant-store outages, and invalid auth
configuration fail closed with redacted error codes.

The public CE package defines the verifier and `TenantStore` composition seam,
but intentionally ships no hosted tenant-database adapter. An internal
enterprise distribution may inject that implementation into
`createAgentProxyApp`; without it, hosted requests return 503. This separation
does not establish hosted readiness. Promotion still requires producer-admitted
auth metadata and live Fortemi evidence for transaction-scoped tenant isolation.

For any network-exposed deployment, keep the service behind a private ingress,
retain an outer transport/authentication control such as mTLS or an SSO gateway,
and restrict CORS to the exact UI origin. Do not expose the process merely by
setting `BIND_ADDR=0.0.0.0`.

## Operator Checklist

Before starting agent-proxy in any environment:

- [ ] Confirm `BIND_ADDR` matches the intended exposure (`127.0.0.1` for dev / Tauri).
- [ ] Confirm API keys are loaded from a process-scope mechanism (env file,
      systemd `EnvironmentFile=`, vault provider), not from a tracked file.
- [ ] Confirm `CORS_ORIGIN` lists only the UI origin you intend to serve.
- [ ] If running outside Tauri, confirm `AGENT_PROXY_RATE_LIMIT_RPM` is set
      to a value appropriate for the workload (60 is comfortable for a single
      human user).
- [ ] For hosted mode, confirm the released auth identity, issuer, audience,
      HTTPS JWKS endpoint, and active-tenant adapter are configured.
- [ ] Confirm JWKS and tenant-store outages return redacted 503 responses and
      never fall back to anonymous admission.

## Related Issues

- #212 (this document) — bind defaults + threat-model documentation
- #218 — rate limiting on `/api/agent/chat`
- #214 — path-to-regexp ReDoS (patched)
- #121 — original design issue for the agent-proxy route
- #231 — native auth corpus conformance and production admission boundary
- Hardening plan: `.aiwg/security/npm-audit-plan-2026-05-14.md`
