---
title: Fortemi v2026.7.1 Scenario Test Matrix
status: proposed
date: 2026-07-15
artifact_type: scenario-test-matrix
related_artifacts:
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/testing/fortemi-route-verifier-spec-2026-07.md
  - .aiwg/testing/fortemi-v2026-07-fixture-catalog.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
---

# Fortemi v2026.7.1 Scenario Test Matrix

## Purpose

Define the test evidence needed to close the Fortemi v2026.7.1 UX workflow scenarios. This matrix complements the API contract addendum by mapping each scenario to test files, test levels, fixtures, redaction checks, and route-family status updates required before the integration gate can move from local implementation evidence and published tracker receipts to final CI/local-preflight policy closure.

Canonical fixture names and minimum data shapes are maintained in `.aiwg/testing/fortemi-v2026-07-fixture-catalog.md`.

## Global Pass/Fail Rules

- Scenario tests must cover success, unsupported capability, degraded/error state, and redaction where applicable.
- New API clients must include unit tests for request shape, response normalization, and error mapping.
- UI components must include fixture-backed component tests for populated, empty, unknown, degraded, and malformed server responses.
- Agent behavior must include tool-set, prompt/tool-description, disabled-reason, and redaction assertions.
- Closing an issue must update the route inventory, capability matrix, workflow scenarios, and this matrix when route-family status changes.

## Scenario Matrix

| Scenario | Issues | Test level | Existing anchors | New or extended test targets | Required fixture states | Gate status |
| --- | --- | --- | --- | --- | --- | --- |
| UX-FORTEMI-001 Native Streaming Chat | #242, #258 | API unit, agent route, component | `ui/src/api/__tests__/chat.test.ts`, `agent-proxy/src/__tests__/chat-route.test.ts`, `ui/src/components/agent/__tests__/useAgentChat.test.ts`, `ui/src/components/agent/__tests__/providers.test.ts` | Implemented native Fortemi POST stream parser tests, Last-Event-ID resume header, error handling, active Agent hook streaming, and sync fallback on stream failure; #258 still owns agent tool capability registry claims. | delta, done, error, resume id, 503 fallback, sync fallback. | Implemented for Fortemi Agent stream; tool boundary remains #258 |
| UX-FORTEMI-002 Streaming Health and Backpressure | #254 | API unit, Admin component | `ui/src/api/__tests__/health.test.ts`, `ui/src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx` | Implemented `/health/streaming` parser tests and Admin API Surface rendering tests. | populated, missing blocks, malformed, unavailable endpoint, chat drop counters, ingest pressure, connector lag/errors, call telemetry summaries. | Implemented; route inventory updated |
| UX-FORTEMI-003 Stream Ingest With Short-Lived Token | #255, #257, #258 | API unit, stream parser, Backup component, redaction | `ui/src/api/__tests__/ingest.test.ts`, `ui/src/components/backup/__tests__/BackupManager.test.tsx`, `agent-proxy/src/agent/__tests__/tool-sets.test.ts` | Implemented token client tests, NDJSON frame parser tests, Backup stream ingest tests, token revocation, progress summary, and no-secret-render checks; agent tool boundary remains #258. | token mint, token revoke, ack, progress, warning, done, error, cursor present, no secret rendered. | Implemented for Backup/API; agent boundary remains #258 |
| UX-FORTEMI-004 Incoming Receiver and Inbound Source Admin | #256, #258 | API unit, Admin component, redaction | `ui/src/api/__tests__/webhooks.test.ts`, `ui/src/components/admin/__tests__/WebhooksPanel.test.tsx` | Implemented incoming receiver and inbound source typed clients plus Admin metadata sections; #258 still owns diagnostics-only agent boundary. | receiver list/create/get/patch/delete, validation errors, secret created/redacted, source disabled, config redacted. | Implemented for Admin/API; agent boundary remains #258 |
| UX-FORTEMI-005 Backup, TUS, and Portable Shard Parity | #257, #297 | API unit, service unit, Backup component, copy assertions | `ui/src/api/__tests__/backup.test.ts`, `ui/src/api/__tests__/attachments.test.ts`, `ui/src/services/__tests__/tusUploader.test.ts`, `ui/src/services/__tests__/uploadStore.test.ts`, `ui/src/components/__tests__/JobQueueMonitor.test.tsx`, `ui/src/components/backup/__tests__/BackupManager.test.tsx` | TUS handles every remote file size and covers creation metadata, `media_optimize`, OPTIONS, HEAD resume/expiry, PATCH content/offset, DELETE termination, finalization, cancellation, malformed metadata, auth expiry, size limits, and redaction. Legacy multipart attachment, base64 shard import, and base64 database upload remain disabled; profile-gated multipart shard recovery remains independently bounded. | OPTIONS, HEAD, PATCH, DELETE, finalization, offset mismatch, max size, auth expiry, malformed metadata, termination, resume, no raw URL/path/credential rendering. | Implemented consumer boundary; excluded backup routes remain unpromoted |
| UX-FORTEMI-006 Capability-Gated Agent Tool Use | #258 | Agent unit, prompt/tool registry, redaction | `agent-proxy/src/__tests__/tools.test.ts`, `agent-proxy/src/agent/__tests__/tool-sets.test.ts`, `agent-proxy/src/__tests__/chat-route.test.ts`, `ui/src/components/agent/__tests__/tools.test.ts`, `ui/src/components/agent/__tests__/AgentSettings.test.tsx` | Implemented registry metadata tests for enabled tools, exploratory read-only enforcement, write-tool intent gating, readiness metadata, no unsupported MCP parity claims, and explicit non-tool boundaries for credential/PKE/rate-limit/Twilio/destructive operations. Disabled reason and redacted output fixtures remain required before adding new diagnostic tools. | enabled metadata, exploratory read-only, write intent, unsupported tool absence, non-tool boundaries, prompt/tool description drift. | Metadata/gating scaffold implemented; diagnostic tools deferred |
| UX-FORTEMI-007 Vision, Audio, and Realtime Call Disposition | #259, #253 | API unit, attachment component, Admin diagnostics, verifier | `ui/src/api/__tests__/mediaTools.test.ts`, `ui/src/api/__tests__/calls.test.ts`, `ui/src/components/attachments/__tests__/AttachmentsPanel.test.tsx`, `ui/src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx` | Implemented vision/audio typed clients and attachment actions, call detail diagnostics, and no-claim tests for excluded Twilio route. | supported media, unsupported media, capability disabled, API error, transcript linkage, call diagnostic redaction, Twilio excluded. | Implemented; Twilio realtime documented exclusion preserved |

## Route Inventory and Evidence Tests

| Control | Test/evidence owner | Required evidence |
| --- | --- | --- |
| Route extraction | #253 | `python3 .aiwg/testing/scripts/fortemi-route-coverage.py` writes JSON/Markdown for 200 routes and zero unclassified families. |
| Evidence map parity | #253 | Family set in route coverage JSON equals `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json`; all non-empty paths exist. |
| Weak covered families | #253 | Graph, provenance, models, and contract-doc rows have focused route evidence; verifier should report zero weak covered families. |
| Mixed route-family disposition | #253/#259 | `realtime_calls` preserves route-level disposition: REST call diagnostics are covered and Twilio realtime remains a documented exclusion. |
| Agent tool overclaim prevention | #258 | Tool metadata, descriptions, prompt suffixes, and chat readiness metadata are checked against the enabled capability set and explicit non-tool boundaries. |

## Redaction Matrix

| Secret or sensitive value | Scenarios | Required assertion |
| --- | --- | --- |
| Ingest token | UX-FORTEMI-003 | Token is copy-once; not persisted in transcript, logs, screenshots, or snapshots. |
| Ingest cursor | UX-FORTEMI-003 | Cursor is summarized or redacted outside resume guidance. |
| Webhook receiver secret | UX-FORTEMI-004 | New secret is copy-once; stored secret is never rendered raw. |
| Connector credentials/private endpoints | UX-FORTEMI-002, UX-FORTEMI-004 | Health and source diagnostics omit raw credential/private endpoint values. |
| API keys/auth tokens | UX-FORTEMI-006 | Agent tools do not expose raw keys or bearer tokens. |
| Provider identifiers/call diagnostics | UX-FORTEMI-007 | Realtime call diagnostics redact provider identifiers unless explicitly accepted for operator-only display. |

## Recommended Execution Order

1. Route verifier and evidence-map parity (#253).
2. Shared stream parser tests (#242) before chat and ingest consumers.
3. Streaming health parser/component tests (#254) are implemented; keep them in the focused preflight set.
4. Ingest token/stream and Backup first UX tests (#255) are implemented; keep them in the focused preflight set.
5. Incoming receiver/inbound source Admin tests (#256).
6. Backup/TUS parity tests (#257).
7. Capability-gated agent registry tests (#258).
8. Media/call tests or no-claim exclusion assertions after #259.

## Completion Criteria

- Every UX-FORTEMI scenario has at least one passing API/client test and one passing UI/agent/verifier test, or an explicit documented exclusion.
- All redaction matrix assertions pass for included workflows.
- Route inventory status changes are reflected in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.
- The gate report cites actual command output and test command output before implementation-pass.
