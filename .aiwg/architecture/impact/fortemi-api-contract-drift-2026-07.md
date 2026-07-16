---
title: Fortemi v2026.7.1 API Contract Drift Impact Analysis
status: proposed
date: 2026-07-14
artifact_type: architecture-impact-analysis
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
---

# Fortemi v2026.7.1 API Contract Drift Impact Analysis

## Change Summary

Fortemi has advanced beyond the HotM v2026.5.x integration baseline. The latest server checkout exposes roughly 200 route declarations and the 2026.6/2026.7 releases add streaming chat, streaming ingest, incoming webhook receivers, inbound event sources, finished TUS resumable uploads, Intel/vLLM routing support, hardened upgrades, and portable attachment-shard contract boundaries.

The generated route inventory confirms 200 extracted route declarations: 186 covered, 0 partial, 0 gap, 0 decision-needed, and 14 documented-exclusion rows.

The capability surface matrix translates those route-family states into HotM surfaces, tracker issues, and proof requirements for the implementation pass.

## Impact Assessment

| Area | HotM state | Gap / impact | Risk |
| --- | --- | --- | --- |
| Contract inventory | `docs/openapi.json` exists but is not a normal object-shaped OpenAPI document; previous docs note no canonical upstream OpenAPI diff. | Need a source-derived or generated route inventory that can fail CI when Fortemi adds/removes API surface. | High |
| Chat | HotM has synchronous chat and agent-proxy AI SDK streaming, plus open issue #242 for Fortemi `/chat/stream`. | Native Fortemi token stream is not wired into the agent/chat UX. | High |
| Streaming health | SSE/WS event bus exists and inference config events are handled. | `/health/streaming` counters for chat, ingest, connector lag/errors are not fully surfaced as operator health. | Medium |
| Ingest stream | No HotM API module for `/ingest/stream` or ingest tokens was found. | Bulk/agent ingest cannot use server resumable NDJSON stream, cursor resume, or rate-limit semantics. | High |
| Incoming webhooks | Admin Webhooks covers outbound lifecycle. | Incoming receiver lifecycle and validation are distinct and absent from HotM Admin. | Medium |
| Inbound sources | No HotM module for `/inbound-sources`. | Operators cannot configure Redis Stream/SSE/Kafka connectors from HotM. | Medium |
| TUS uploads | HotM has `tusUploader` and upload store. | Need explicit current server verb/error coverage and UI handling for offset/checksum/termination. | Medium |
| Backup/archive | HotM covers export/import/status/list/snapshot/upload/restore/swap/metadata. | Missing current download and memory/knowledge-archive coverage; portable byte-sidecar boundary must be represented accurately. | Medium |
| Vision/audio | Typed HotM multipart API coverage and attachment preview actions exist for ad-hoc describe/transcribe. | Agent-tool exposure remains gated by #258; preserve #259 action and redaction tests. | Low |
| Realtime calls | Typed HotM call-detail API coverage and Admin API Surface diagnostics exist for `/calls/{id}`; Twilio realtime WS remains unclaimed by design. | Preserve redaction tests and the Twilio documented-exclusion boundary under #259. | Low |
| Agent tools | Agent-proxy tools cover notes/search/collections/concepts/archives/attachments/jobs. | Tools do not cover new streaming ingest, native chat stream, inference provider status, incoming sources, or backup operations. | Medium |

## Migration Plan

1. Add a contract inventory script/test that extracts Fortemi route declarations or consumes `/openapi.yaml` from a running server and compares against HotM route coverage metadata.
2. Land native Fortemi streaming chat consumption under issue #242, sharing POST-SSE parsing with inference stream semantics.
3. Add API modules and Admin UX slices for ingest stream/tokens, incoming receivers, inbound sources, and streaming health.
4. Extend backup and attachment tests to current v2026.7.1 route/error semantics.
5. Implement or explicitly exclude the ADR-011 disposition for vision/audio and realtime call surfaces.
6. Review agent-proxy tool coverage and add a capability-aware tool registry so the assistant can invoke only supported Fortemi operations.
7. Use `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md` as the closeout checklist for route-family proof and UX disposition.

## Rollback / Compatibility

All new surfaces should remain capability-gated. If a Fortemi instance is older than v2026.6.0 or does not advertise a capability, HotM should hide or disable the related production action and retain existing local sidecar workflows.

## Decision

Proceed with a phased integration. Prioritize P0/P1 operational surfaces before optional media/call diagnostics. Do not claim complete server API coverage until the contract inventory and traceability report prove every endpoint is implemented, intentionally excluded, or tracked.
