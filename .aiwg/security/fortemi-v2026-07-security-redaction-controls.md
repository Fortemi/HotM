---
title: Fortemi v2026.7.1 HotM Security and Redaction Controls
status: proposed
date: 2026-07-14
artifact_type: security-control-addendum
related_artifacts:
  - .aiwg/security/secrets-management-policy.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/risks/fortemi-v2026-07-integration-risk-register.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
---

# Fortemi v2026.7.1 HotM Security and Redaction Controls

## Purpose

Define the Fortemi v2026.7.1-specific security and redaction controls that implementation issues must satisfy before HotM can claim seamless current-server integration. This addendum narrows the project-wide secrets policy to the new stream, ingest, webhook, inbound connector, backup, media, realtime call, and agent-tool surfaces.

## Security Defaults

| Default | Rule |
| --- | --- |
| Fail closed | Unknown, preview, unavailable, malformed, insufficient-role, or unsupported capability state disables production-affecting controls. |
| No raw secret echo | Tokens, credentials, keys, private endpoints, cursors, provider IDs, and raw diagnostics are not rendered, logged, stored in snapshots, or returned by agent tools unless a copy-once creation flow explicitly allows display. |
| Copy-once only | Newly-created ingest tokens, receiver secrets, or API keys may be displayed once in a deliberate copy flow, then redacted. |
| Diagnostic minimization | Health, audit, and call diagnostics show coarse state, counts, lag, and reason codes rather than raw payloads or provider internals. |
| Agent least capability | Agent tools are absent or disabled unless the server, role/scope, intent, and tool registry all permit the action. |
| Error-path safety | Error messages describe recovery action without embedding request bodies, headers, tokens, cursor values, file paths, stack traces, or private provider details. |

## Sensitive Data Inventory

| Sensitive value | Surfaces | Required handling | Tracker |
| --- | --- | --- | --- |
| Fortemi bearer/session tokens | Chat, Admin, agent-proxy | Never render or log; keep in runtime auth layer only. | #242, #258 |
| Ingest bearer token | Backup > Stream Ingest, possible agent ingest | Copy-once at mint; no transcript/log/snapshot persistence; revoke path must not echo token. | #255 |
| Ingest cursor | Stream ingest resume guidance | Summarize or hash where possible; do not expose full cursor outside targeted resume UI. | #255 |
| Webhook receiver secret/HMAC material | Incoming receiver create/edit/validate | Copy-once newly-created secret; stored secret always redacted; validation errors must not echo secret. | #256 |
| Connector credentials/private endpoints | Inbound sources, streaming health | Render connector type/state/lag/errors only; redact credentials and private endpoint URLs. | #254, #256 |
| API keys | Auth/API key management, agent tools | Copy-once creation; list/delete use key label/fingerprint only; agent tools must not create raw keys unless explicitly accepted. | #231, #258 |
| Provider keys/config | Inference settings, inference diagnostics | Never render plaintext; provider status/test output redacts request details and provider secrets. | #253, #258 |
| File paths/object keys/archive paths | Attachments, backup/archive, portable shards | Prefer filenames or coarse labels; redact private filesystem paths, object-store keys, and archive internals in UI/agent output. | #257 |
| Media transcript and extracted content | Audio/vision/attachments | Treat as user content; display only in the owning attachment/note context; avoid agent diagnostic leakage. | #259 |
| Provider call identifiers/raw media URLs | Realtime calls/Twilio diagnostics | Redact by default; Admin call diagnostics render presence/length metadata only, and Twilio realtime remains excluded unless a future operator slice adds tests. | #259 |
| Tenant/auth diagnostics | Compatibility, hosted auth, Admin | Coarse reason codes only; no raw tenant secrets, bearer tokens, authorization codes, or private tenant IDs. | #244, #247 |

## Degraded-Mode Matrix

| Trigger | UI behavior | Agent behavior | Data handling | Recovery |
| --- | --- | --- | --- | --- |
| Capability key missing or `unknown` | Disable production action with unknown-capability reason. | Tool absent or disabled with reason. | No speculative request with secret-bearing args. | Refresh compatibility or use documented fallback. |
| Capability `preview` | Render preview/diagnostic-only state unless issue explicitly accepts action. | Tool disabled unless preview tool is explicitly accepted. | No secret-bearing mutation. | Enable only after acceptance tests and role gate. |
| Insufficient role/scope | Disable action with role/scope reason. | Mutating tool disabled; read-only diagnostic may summarize coarse state. | Do not expose denied request details. | Sign in with required role/scope. |
| Stream parser error | Preserve session/panel state and mark degraded. | Stop tool/stream and report safe failure. | Do not log raw frame body if it may contain user content or cursor. | Retry after parser-safe state reset. |
| Token expired/invalid (`401`) | Route user to mint/sign-in flow. | Tool reports unavailable auth state. | Do not echo supplied token. | Mint new token or re-authenticate. |
| Cursor expired (`410`) | Explain restart/resume limit. | Tool does not invent cursor. | Redact cursor value. | Restart stream from source input. |
| Rate-limited/backpressured (`429`) | Show retry-after/backpressure state. | Tool pauses or reports retryable state. | Do not repeat secret-bearing payload in message. | Retry after server guidance. |
| Receiver validation failure | Show JSON-pointer/schema errors. | Diagnostics only; no create/delete unless accepted. | Do not echo HMAC secret or full private payload. | Correct payload/schema and retry. |
| Backup/archive unsupported | Disable route or document exclusion. | Diagnostic-only summary if accepted. | Redact paths/object keys. | Use supported export/import path. |
| Media/call route excluded | No UI/agent support claim. | Tool absent. | No provider IDs/raw URLs displayed. | Revisit #259 if product need changes. |

## Implementation Acceptance Rules

- Every issue that touches a sensitive value must add a redaction assertion in `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md` or cite an existing one.
- New error messages must be reviewed for secret-bearing request/response content.
- Agent tool descriptions must be generated or reviewed from enabled capabilities; prompt-only claims are not accepted evidence.
- Copy-once flows must include tests proving the secret disappears after the initial display path.
- Degraded and unsupported states must be tested alongside happy paths.
- Route-family status cannot move to `covered` while a required redaction/degraded-mode assertion is missing.

## Issue-Specific Controls

| Issue | Required security evidence |
| --- | --- |
| #242 | Streaming chat errors and fallback states do not log bearer tokens, prompt internals beyond normal chat transcript, or unsupported tool claims. |
| #254 | Streaming health renders counters/reason codes without connector credentials or private endpoints. |
| #255 | Ingest tokens are copy-once; cursors are redacted; 401/410/429 paths avoid echoing secret-bearing payloads. |
| #256 | Receiver secrets and connector credentials are redacted; create/delete actions are role/capability gated. |
| #257 | Backup/archive UI and agent diagnostics redact private paths, object keys, filenames where sensitive, and sidecar internals. |
| #258 | Tool registry metadata and tests keep unavailable or unsafe tools out of the executable set; new diagnostic tools still require output redaction fixtures for tokens, keys, credentials, private paths, and diagnostics before enablement. |
| #259 | Vision/audio/call surfaces redact media-sensitive content and provider identifiers; excluded routes have no UI/agent claims. |
| #253 | Verifier reports missing redaction/degraded-mode evidence as an open gate for affected route families. |

## Gate Impact

This artifact is a gate companion, not implementation proof. The Fortemi integration gate remains implementation-open until every included sensitive route family has passing redaction and degraded-mode tests or an explicit documented exclusion.
