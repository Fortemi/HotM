---
title: Fortemi v2026.7.1 Agent Tool Coverage Matrix
status: proposed
date: 2026-07-14
artifact_type: agent-tool-coverage-matrix
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/risks/fortemi-v2026-07-integration-risk-register.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
---

# Fortemi v2026.7.1 Agent Tool Coverage Matrix

## Purpose

Define the #258 agent-tool refresh baseline for current Fortemi server capabilities. The assistant must only expose tools that are supported by the connected Fortemi server, current user context, and HotM API/client layer. Unsupported, unsafe, or product-ambiguous capabilities must be disabled with reason text or remain out of the tool registry.

Current implementation source:

- `agent-proxy/src/tools.ts`
- `agent-proxy/src/agent/tool-sets.ts`
- `agent-proxy/src/__tests__/tools.test.ts`
- `agent-proxy/src/agent/__tests__/tool-sets.test.ts`

Fortemi MCP comparison source:

- `.aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md`

## Tool Exposure Rules

- Tools are opt-in by capability, role/scope, and intent.
- Read-only diagnostic tools may ship before mutating tools when they do not expose secrets or private tenant diagnostics.
- Mutating tools require explicit capability, role/scope, confirmation UX where destructive, auditability, and redaction tests.
- Agent prompt/tool descriptions must not claim unavailable Fortemi operations.
- Tool results must redact tokens, webhook secrets, connector credentials, private paths, tenant/auth diagnostics, and ingest cursors unless a copy-once workflow explicitly permits display.

## Current Tool Registry

| Agent tool | Intent set | Fortemi route family | Current endpoints used | Coverage status | #258 action |
| --- | --- | --- | --- | --- | --- |
| `search_notes` | exploratory, knowledge-action | search | `GET /api/v1/search` | Covered | Preserve; verify federated search parameters and archive routing. |
| `create_note` | knowledge-action | notes, tags | `POST /api/v1/notes`, `PUT /api/v1/notes/{id}/tags` | Covered | Preserve; keep duplicate-search guidance and tag update tests. |
| `get_note` | exploratory, knowledge-action | notes, attachments | `GET /api/v1/notes/{id}`, `GET /api/v1/notes/{id}/attachments` | Covered | Preserve; ensure attachment summary remains non-secret. |
| `revise_note` | knowledge-action | jobs, notes | `POST /api/v1/jobs` | Covered | Preserve; verify job type and queued-state contract. |
| `update_tags` | knowledge-action | tags, notes | `GET /api/v1/notes/{id}/tags`, `PUT /api/v1/notes/{id}/tags` | Covered | Preserve; keep full-replacement behavior explicit. |
| `link_notes` | knowledge-action | notes | `POST /api/v1/notes/{id}/links` | Covered | Preserve; verify link kind enum against current server contract. |
| `list_collections` | exploratory, knowledge-action | collections | `GET /api/v1/collections` | Partial | Extend or document why create/update/delete/export/list-notes are UI-only. |
| `search_concepts` | exploratory, knowledge-action | concepts | `GET /api/v1/concepts` | Partial | Preserve search; decide whether concept detail/governance/export remain UI-only. |
| `get_related` | exploratory, knowledge-action | notes, search | `GET /api/v1/notes/{id}/similar` | Covered | Preserve; verify response normalization against route inventory. |
| `list_archives` | exploratory, knowledge-action | archives | `GET /api/v1/archives` | Partial | Decide whether archive stats/default/clone/routing controls remain UI-only. |
| `list_notes` | exploratory, knowledge-action | notes | `GET /api/v1/notes` | Covered | Preserve; verify pagination/filter behavior and archive routing if added. |
| `get_attachments` | exploratory, knowledge-action | attachments | `GET /api/v1/notes/{id}/attachments` | Partial | Preserve read-only listing; keep upload/delete/download outside tools unless #257 and capability gates approve. |

## Candidate Tool Decisions

| Candidate tool | Fortemi route families | Candidate endpoints | Proposed disposition | Dependencies | Required tests |
| --- | --- | --- | --- | --- | --- |
| `stream_chat` or native agent transport | native_chat_stream, chat_sync, models | `POST /api/v1/chat/stream`, `POST /api/v1/chat`, `GET /api/v1/chat/models` | Use native stream for assistant responses when supported; keep sync fallback. Not a user-callable tool unless architecture changes. | #242, FTI-002 | Delta/done/error, abort, 503 fallback, unsupported capability, model-list fallback. |
| `inspect_streaming_health` | streaming_health | `GET /api/v1/health/streaming` | Read-only diagnostic summary candidate. | #254, #258 | Missing/degraded/malformed blocks, no private counters beyond approved summaries. |
| `create_ingest_token` / `revoke_ingest_token` | streaming_ingest | `POST /api/v1/ingest/tokens`, `DELETE /api/v1/ingest/tokens/{token_id}` | Defer as agent tool until Backup UX and redaction are proven; possible admin-only tool later. | #255, FTI-004 | Copy-once token behavior, 401/410/429, no token persistence in transcript. |
| `stream_ingest` | streaming_ingest | `POST /api/v1/ingest/stream` | Defer until shared stream primitive and Backup first UX land. | #242, #255 | NDJSON ack/progress/done/error, abort, cursor redaction, capability gating. |
| `inspect_inference_providers` | inference | `GET /api/v1/inference/providers`, `GET /api/v1/inference/config`, `GET /api/v1/inference/audit` | Read-only diagnostic candidate after Admin inference evidence is strong. | #253, #258 | Provider status, secret redaction, audit summary does not leak credentials. |
| `test_inference_provider` | inference | `POST /api/v1/inference/test-connection` | Defer or require explicit confirmation and admin role because it can trigger external provider activity. | #253, #258 | Role gate, confirmation, timeout/error handling, secret redaction. |
| `inspect_backup_status` | backup_archive | Backup status/list/snapshot/restore routes | Read-only diagnostic candidate after #257 parity proof. | #257, #258 | Portable sidecar limitation copy, no private paths/secrets, archive status fixtures. |
| `create_backup_or_restore` | backup_archive | Backup import/export/snapshot/restore routes | Defer; destructive/high-impact operations require stronger UX than autonomous tool call. | #257 | Confirmation, role gate, audit, failure recovery, copy assertions. |
| `inspect_incoming_receivers` | incoming_webhook_receivers, inbound_sources | Receiver/source list/get routes | Read-only diagnostic candidate after #256 Admin surfaces exist. | #256, #258 | Secret redaction, disabled/cost-gated state, outbound/incoming separation. |
| `manage_incoming_receivers` | incoming_webhook_receivers, inbound_sources | Receiver/source create/patch/delete/validate routes | Defer until role/scope, confirmation, audit, and redaction controls are proven. | #256, FTI-003, FTI-004 | Confirmation, role gate, secret handling, payload validation errors. |
| `describe_attachment_image` | vision_tools, attachments | `POST /api/v1/vision/describe` | Attachment preview action first per ADR-011; agent tool only after #259 and #258 gating. | #259, #258 | Unsupported media, redaction, attachment linkage, capability disabled reason. |
| `transcribe_attachment_audio` | audio_tools, attachments | `POST /api/v1/audio/transcribe` | Attachment preview action first per ADR-011; agent tool only if it improves existing workflow. | #259, #258 | Progress/error, transcript linkage, sensitive audio metadata redaction. |
| `inspect_call_session` | realtime_calls | `GET /api/v1/calls/{id}` | Admin/Realtime Debug diagnostic candidate; agent summary only if operator diagnostics is accepted. | #259, #254 | Role gate, diagnostic redaction, unsupported route state. |
| `twilio_realtime_debug` | realtime_calls | `GET /api/v1/realtime/twilio/{provider_call_id}` | Documented exclusion unless an operator diagnostics slice explicitly accepts it. | #259, ADR-011 | No prompt/tool claim while excluded. |

## Explicit Non-Tool Boundaries

| Route family | Boundary |
| --- | --- |
| pke | Documented exclusion from current HotM claims; do not expose agent tools. |
| rate_limit | No general HotM tool; launch proof remains a gate/ops concern. |
| oauth/auth flows | Do not expose token exchange or credential flows as agent tools. Hosted auth remains UI/system flow. |
| auth_api_keys | Do not expose raw API key creation through the agent until copy-once, role, and audit controls are explicitly accepted. |
| destructive backup/archive operations | Keep out of agent tools until #257 proves parity and explicit confirmation/audit UX exists. |
| incoming receiver secrets | Never return raw secrets in agent output. |

## #258 Acceptance Checklist

1. Tool registry maps every enabled tool to Fortemi route family, endpoint, intent set, capability gate, and role/scope requirement.
2. Tool-set tests prove exploratory mode remains read-only and knowledge-action mode only includes approved mutating tools.
3. Capability-disabled fixtures prove unavailable tools are absent or return disabled reason text.
4. Prompt suffixes and tool descriptions do not claim unsupported Fortemi capabilities.
5. Redaction fixtures cover tokens, webhook secrets, connector credentials, tenant/auth diagnostics, private paths, ingest cursors, and API keys.
6. Candidate tools are added only after their dependency issue closes or the issue explicitly accepts a narrower diagnostic-only slice.
7. Route inventory and this matrix are updated together when a route family moves from `gap`, `partial`, or `decision_needed` to `covered`.
8. Registry parity is stated against Fortemi's 43-core-tool / 205-full-tool MCP surface: each MCP capability area is implemented, UI-only, diagnostic-only, deferred with dependency, or explicitly excluded.

## Current #258 Closeout Status

Status: implemented for registry metadata and non-tool boundary evidence; broader gate closeout remains open.

Current agent tools cover a useful notes/search/archive/concept/attachment subset. `agent-proxy/src/tools.ts` now exports `toolMetadata`, `deferredToolDecisions`, and `nonToolBoundaries`; `GET /api/agent/chat` advertises the same metadata. Focused tests prove every enabled tool maps to Fortemi route families, endpoints, intent sets, capability gate text, role/scope, and result policy; exploratory mode remains read-only; prompt/tool descriptions do not claim unsupported MCP parity; and OAuth/API keys, PKE, rate limits, Twilio realtime, destructive backup, and purge-style operations remain non-tools.

Current-server diagnostic candidates for streaming health, ingest, inference, backup/archive, incoming receivers/inbound sources, vision/audio, and call diagnostics are explicitly documented as UI-only, diagnostic candidates, or deferred. Adding any of them as executable tools still requires capability-disabled fixtures, role/scope gates, and redaction evidence.
