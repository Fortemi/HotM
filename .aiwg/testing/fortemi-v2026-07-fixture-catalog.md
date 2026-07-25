---
title: Fortemi v2026.7.1 Test Fixture Catalog
status: proposed
date: 2026-07-14
artifact_type: fixture-catalog
related_artifacts:
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md
  - .aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md
  - .aiwg/security/fortemi-v2026-07-security-redaction-controls.md
---

# Fortemi v2026.7.1 Test Fixture Catalog

## Purpose

Define canonical fixture names and required data shapes for the Fortemi v2026.7.1 HotM integration tests. Implementation PRs should use this catalog when adding Vitest, component, e2e, or agent fixtures so success, degraded, unsupported, and redaction states stay consistent across issues.

## Fixture Rules

- Fixtures must never contain real tokens, API keys, webhook secrets, connector credentials, private endpoints, provider call IDs, archive paths, or media transcripts.
- Secret-like values must use obvious placeholders such as `redacted_*`, `copy_once_*`, or `fixture_*`.
- Every feature fixture set should include success, unsupported/unknown, degraded/error, and redaction-oriented variants where applicable.
- Fixture filenames should include the route family and state, for example `streaming-health-degraded.json` or `ingest-token-copy-once.json`.
- If a fixture changes route-family status, update the route inventory, scenario matrix, capability matrix, evidence ledger, and linked issue.

## Fixture Sets

| Fixture set | Owner issue | Primary consumers | Required variants |
| --- | --- | --- | --- |
| `chat-stream` | #242 | `ui/src/api/__tests__/chat.test.ts`, `useAgentChat` tests, optional `agent-proxy` chat route tests | `delta-done`, `error-terminal`, `abort`, `busy-503`, `unsupported-sync-fallback`, `malformed-frame` |
| `streaming-health` | #254 | `health.test.ts`, `ApiCapabilitiesPanel` tests, Realtime Debug tests | `populated`, `missing-blocks`, `degraded-chat`, `degraded-ingest`, `connector-lag`, `malformed` |
| `ingest-stream` | #255 | `ingest.test.ts`, stream parser tests, `BackupManager` tests | `token-mint-copy-once`, `token-revoke`, `ack-progress-done`, `line-error`, `expired-401`, `cursor-expired-410`, `rate-limited-429` |
| `incoming-receiver` | #256 | `webhooks.test.ts`, `WebhooksPanel` tests, agent diagnostics tests | `receiver-list`, `receiver-created-secret-copy-once`, `payload-validation-error`, `receiver-redacted`, `delete-confirmed` |
| `inbound-source` | #256 | `inboundSources.test.ts`, `WebhooksPanel` tests, streaming health connector tests | `source-list`, `source-disabled`, `source-cost-gated`, `source-lagging`, `source-error-redacted` |
| `backup-archive` | #257 | `backup.test.ts`, `BackupManager` tests, agent backup diagnostics tests | `database-download`, `memory-download`, `knowledge-archive-upload`, `knowledge-archive-download`, `metadata-update`, `sidecar-bytes-not-restored` |
| `knowledge-shard-core-v1` | #269 | `knowledgeShard.test.ts`, `backup.test.ts`, `BackupManager` tests | `current`, `full-profile-unsupported`, `record-profile-unsupported`, `next-major`, `newer-minimum-reader`, `unknown-component`, `bad-count`, `bad-checksum`, `server-partial` |
| `knowledge-shard-full-v1` | #272 | `knowledgeShard.test.ts`, `backup.test.ts`, `BackupManager` tests, pinned Fortemi runtime/paired receipts, `.aiwg/evidence/hotm-full-v1-clean-recovery-receipt-2026-07-24.json` | `exact-2.0.0`, `all-33-components`, `all-34-count-fields`, `direct-stream`, `signed-dry-run`, `repeated-import`, `attachment-byte-reexport`, `tampered-zero-mutation`, `missing-zero-mutation`, `oversized-zero-mutation`, `unsupported-zero-mutation`, `skewed-zero-mutation` |
| `system-compatibility-boundary` | #244 | `systemCompatibility.test.ts`, API index tests, `ApiCapabilitiesPanel` tests | `supported`, `equal-minimum`, `checkpoint-minimum`, `future-revision`, `client-too-old`, `malformed-minimum`, `unsupported-schema`, `unreachable` |
| `attachments-tus` | #257 | `attachments.test.ts`, `tusUploader.test.ts`, `AttachmentsPanel` tests | `options`, `head-offset`, `patch-progress`, `checksum-failure`, `offset-mismatch`, `terminate`, `resume` |
| `agent-capability-gates` | #258 | `tools.test.ts`, `tool-sets.test.ts`, agent settings/tool picker tests | `enabled`, `unsupported-server`, `insufficient-role`, `preview-only`, `unknown-capability`, `redacted-result` |
| `media-tools` | #259 | `mediaTools.test.ts`, attachment preview tests, agent no-claim tests | `vision-supported-image`, `vision-unsupported-media`, `audio-transcript-linked`, `audio-error-redacted`, `capability-disabled` |
| `call-diagnostics` | #259 | `calls.test.ts`, Realtime Debug/Admin tests, no-claim tests | `call-detail-redacted`, `call-not-found`, `provider-id-redacted`, `twilio-excluded-no-claim` |

## Required Field Sketches

These sketches define minimum fields, not final TypeScript contracts.

### `streaming-health`

```json
{
  "chat": { "started": 12, "completed": 11, "errored": 1, "dropped_tokens": 0 },
  "ingest": { "active": 1, "buffer_pressure": 0.42, "rate_limited": 0 },
  "realtime": { "sse_connected": true, "lag_ms": 20, "resync_required": false },
  "connectors": [{ "id": "fixture_source", "state": "lagging", "lag_ms": 1200, "errors": 1 }]
}
```

### `ingest-stream`

```json
{
  "token": "copy_once_fixture_token",
  "expires_at": "2026-07-14T20:00:00Z",
  "frames": [
    { "type": "ack", "cursor": "redacted_cursor" },
    { "type": "progress", "processed": 3, "failed": 0 },
    { "type": "done", "processed": 3, "failed": 0 }
  ]
}
```

### `incoming-receiver`

```json
{
  "receiver": {
    "id": "fixture_receiver",
    "provider": "generic",
    "enabled": true,
    "secret": "redacted_secret",
    "last_validated_at": "2026-07-14T20:00:00Z"
  }
}
```

### `agent-capability-gates`

```json
{
  "capability": "streaming_ingest",
  "enabled": false,
  "reason": "unsupported-server",
  "tool_visible": false,
  "redacted_result": true
}
```

### `call-diagnostics`

```json
{
  "call_id": "fixture_call",
  "provider_call_id": "redacted_provider_call_id",
  "state": "completed",
  "diagnostics": { "transport": "redacted", "errors": 0 }
}
```

## Closeout Use

Implementation issues should cite which fixture variants they added or updated. If an issue cannot use this catalog because Fortemi response contracts differ, update this catalog and the API/client blueprint in the same change.

This catalog is planning guidance. It does not prove any fixture files or tests exist until implementation PRs add them and cite passing command output.
