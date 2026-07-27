# agent-proxy — Security Posture

## Intended Deployment

agent-proxy is designed as a **localhost-only sidecar** to the HotM UI (web SPA in
development, Tauri webview in desktop builds). It is not a multi-tenant service.
It holds raw API keys for cloud LLM providers (Anthropic, OpenAI) and proxies
requests on behalf of the local user.

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

## Network Exposure

`agent-proxy` does **not** currently enforce client authentication on its routes.
The default binding to `127.0.0.1` is the primary control preventing remote use
of the embedded API keys. The reusable Node verifier in `src/auth/` passes the
public `fortemi-auth` `rust-node-jwt-v1` fixture profile, but it is not installed
as route middleware. Setting `BIND_ADDR=0.0.0.0` (or any non-loopback address)
without additionally introducing an authentication layer is **not supported**
and effectively publishes your LLM provider credentials to anyone who can reach
the listening port.

If a network-exposed deployment is needed:

1. Front the proxy with a reverse proxy that performs authentication
   (e.g., nginx + mTLS, or an SSO gateway).
2. Keep `BIND_ADDR` set to a private interface only that reverse proxy can reach.
3. Audit the CORS allowlist to match the public origin.
4. File a follow-up issue to add native auth to agent-proxy itself.

## Operator Checklist

Before starting agent-proxy in any environment:

- [ ] Confirm `BIND_ADDR` matches the intended exposure (`127.0.0.1` for dev / Tauri).
- [ ] Confirm API keys are loaded from a process-scope mechanism (env file,
      systemd `EnvironmentFile=`, vault provider), not from a tracked file.
- [ ] Confirm `CORS_ORIGIN` lists only the UI origin you intend to serve.
- [ ] If running outside Tauri, confirm `AGENT_PROXY_RATE_LIMIT_RPM` is set
      to a value appropriate for the workload (60 is comfortable for a single
      human user).

## Related Issues

- #212 (this document) — bind defaults + threat-model documentation
- #218 — rate limiting on `/api/agent/chat`
- #214 — path-to-regexp ReDoS (patched)
- #121 — original design issue for the agent-proxy route
- Hardening plan: `.aiwg/security/npm-audit-plan-2026-05-14.md`
