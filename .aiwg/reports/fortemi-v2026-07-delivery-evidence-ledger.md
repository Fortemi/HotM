---
title: Fortemi v2026.7.1 Delivery Evidence Ledger
status: local-evidence-pass-ci-open
date: 2026-07-15
artifact_type: delivery-evidence-ledger
related_artifacts:
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/testing/fortemi-v2026-07-fixture-catalog.md
  - .aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md
  - .aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/risks/fortemi-v2026-07-integration-risk-register.md
  - .aiwg/security/fortemi-v2026-07-security-redaction-controls.md
---

# Fortemi v2026.7.1 Delivery Evidence Ledger

## Purpose

Define the evidence each implementation issue must attach before HotM can move the Fortemi v2026.7.1 gate from local implementation evidence and published tracker receipts to final CI/local-preflight policy closure. This ledger converts the route inventory, scenario matrix, security controls, and risk register into closeout proof requirements.

## Current Evidence State

| Evidence area | Current state | Gate impact |
| --- | --- | --- |
| Route inventory | Generated and locally passing with 200 routes, 36 families, 186 covered routes, 14 documented exclusions, and clean diagnostics; `.gitea/workflows/sdlc-gates.yml` now wires the verifier as `fortemi-route-inventory`. | Passing live CI receipt or accepted local-preflight-only decision still required by #253. |
| Implementation tests | Local UI full suite, UI typecheck, agent-proxy test/typecheck, route verifier, JSON validation, and hygiene checks passed. | Tracker/PR closeout needs the command output attached. |
| UX/API implementation | Native chat stream, streaming health, #255 streaming ingest Backup/API, #256 incoming/inbound Admin surfaces, #257 backup/TUS parity, contract docs, #247 OAuth diagnostics/API parity, provenance route-level tests, model catalog route tests, graph route-level tests, and #259 media/call surfaces implemented. | Remaining gate risk is issue-backed verification breadth and tracker delivery closure, not weak covered-family evidence. |
| Redaction/security proof | Token, secret, media, provider, archive, call, and agent non-tool boundaries have focused local tests. | Keep fixtures attached to closeout and preserve security controls for future tool enablement. |
| Risk retirement | Risks updated with local mitigation/retirement evidence. | Final gate still needs CI/local verifier adoption decision. |

## Issue Evidence Ledger

| Issue | Scope | Required route evidence | Required test evidence | Required UX/security evidence | Required artifact updates before closeout | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| #242 | Native Fortemi streaming chat and shared stream parser | `native_chat_stream` moved from `gap` to `covered` after `/api/v1/chat/stream` client and active Agent hook evidence. | `npm run test -- src/api/__tests__/chat.test.ts src/components/agent/__tests__/useAgentChat.test.ts src/components/agent/__tests__/providers.test.ts --run`; `npm run typecheck`. | Fortemi provider uses native stream when available and falls back to synchronous `/chat` on stream failure; proxy-backed providers remain unchanged. | Route inventory, capability matrix, workflow scenarios UX-FORTEMI-001, scenario matrix, gate report. | Implemented; tracker update pending |
| #253 | Route verifier and evidence parity | `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh` passes locally with clean diagnostics and coherent evidence metadata; `.gitea/workflows/sdlc-gates.yml` has a CI job for the same wrapper. | Verifier output captured locally; live CI receipt or local-preflight-only acceptance remains open. | N/A beyond proving no stale path/tracker/evidence metadata. | Gate report, artifact index if adoption path changes, verifier spec/runbook, coverage evidence audit. | Local evidence and CI wiring present; tracker/live CI receipt pending |
| #254 | Streaming health/backpressure | `streaming_health` moved from `gap` to `covered` after typed `/api/v1/health/streaming` client and Admin API Surface evidence. | `npm run test -- src/api/__tests__/health.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`. | Missing/malformed blocks render as missing/malformed rather than healthy; inbound connector summaries use aggregate counters only. | Route inventory, capability matrix, workflow scenarios UX-FORTEMI-002, scenario matrix, gate report. | Implemented; tracker update pending |
| #255 | Ingest stream and ingest tokens | `streaming_ingest` moved from `gap` to `covered` after token mint/revoke and stream route client evidence. | `npm run test -- src/api/__tests__/ingest.test.ts src/components/backup/__tests__/BackupManager.test.tsx --run`; `npm run typecheck`. | Minted token is passed only to the stream request, token id is revoked afterward, UI renders cursor length only, and tests assert the raw token is not rendered; agent ingest tool remains disabled until #258. | Route inventory, capability matrix, workflow scenarios UX-FORTEMI-003, scenario matrix, gate report. | Implemented; tracker update pending |
| #256 | Incoming receivers and inbound sources | `incoming_webhook_receivers` and `inbound_sources` moved from `gap` to `covered` after typed client and Admin metadata-surface evidence. | `npm run test -- src/api/__tests__/webhooks.test.ts src/components/admin/__tests__/WebhooksPanel.test.tsx --run`; `npm run typecheck`. | Receiver secrets and connector config are not rendered; inbound sources are registered disabled by default; outbound webhooks remain distinct. | Route inventory, capability matrix, workflow scenarios UX-FORTEMI-004, scenario matrix, gate report. | Implemented; tracker update pending |
| #257 | Backup, TUS, and portable shard parity | `attachments_tus` and `backup_archive` are covered. | Backup API and BackupManager tests cover current backup/download/archive/metadata routes, route-group UX controls, and portable sidecar limitation copy; TUS tests cover POST/OPTIONS/GET/HEAD/PATCH/DELETE, creation query, resume headers, required PATCH headers, termination, finalization, offset mismatch, chunk-too-large, expired/not-found recovery, and no checksum-extension claim. | Portable shard copy states server import does not restore attachment records or bytes; archive/path values are redacted; upload UX does not claim TUS checksum-extension support. | Route inventory, capability matrix, workflow scenarios UX-FORTEMI-005, scenario matrix, security controls, risk FTI-006. | Implemented |
| #258 | Agent tool refresh | Enabled agent tools now have machine-readable route-family, endpoint, intent, capability gate, role/scope, and result-policy metadata; candidate and excluded MCP capability areas have explicit dispositions. | `npm run test -- src/__tests__/tools.test.ts src/agent/__tests__/tool-sets.test.ts src/__tests__/chat-route.test.ts`; `npm run typecheck` in `agent-proxy`. | Exploratory tools remain read-only; write tools stay knowledge-action only; chat readiness exposes metadata; OAuth/API keys, PKE, rate limits, Twilio realtime, destructive backup, and purge-style operations remain non-tools. | Agent tool matrix, MCP/tool surface audit, workflow scenario matrix, security controls, risk FTI-008. | Metadata/gating scaffold implemented; new diagnostic tools remain deferred until disabled-state and redaction fixtures are accepted. |
| #259 | Vision, audio, and realtime call disposition | `vision_tools`, `audio_tools`, and REST call detail are covered; Twilio realtime is a documented exclusion. | Attachment action tests; call diagnostic UX/redaction tests; Twilio no-claim exclusion assertion. | Media previews do not leak media/transcript internals; provider call identifiers, archive IDs, speakers, and transcript text are not rendered. | ADR-011 accepted, route inventory, capability matrix, workflow scenarios UX-FORTEMI-007, scenario matrix, security controls. | Implemented; tracker update pending |
| #243 | Umbrella integration gate | All issue-backed route gaps, partial rows, decision-needed rows, and weak covered-family rows are closed or explicitly excluded in the verifier baseline. | Aggregated local test command output from #242/#253/#254/#255/#256/#257/#258/#259 exists and is represented in published tracker receipts. | Security controls and P1 risks are locally mitigated; future tool enablement remains gated. | Gate report, traceability report, artifact index, delivery handoff, tracker publication receipts. | Local evidence and tracker publication passed; CI/local-preflight policy pending |

Implementation PRs should use `.aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md` to identify expected API modules, UI surfaces, agent boundaries, and primary test files for each issue row above.

Implementation PRs should use `.aiwg/testing/fortemi-v2026-07-fixture-catalog.md` for shared fixture names and minimum payload sketches.

## Gate Promotion Checklist

The gate may move to final closure only when:

- Every issue row above has command output or documented exclusion evidence attached to tracker comments or PR closeout.
- `verifier_diagnostics` is clean for the adopted #253 path and CI/local-preflight policy is explicit.
- Route inventory status changes are intentional and reflected in capability matrix and traceability.
- Scenario matrix rows move from planned/open to actual test evidence.
- Security controls are satisfied for all included sensitive route families and preserved for deferred tools.
- P1 risks FTI-001, FTI-002, and FTI-006 remain explicitly mitigated by current evidence.

## Evidence Attachment Rule

Every implementation issue should include the following closeout comment or PR section before closure:

```text
Route inventory impact:
Test commands:
UX/API surfaces changed:
Security/redaction evidence:
Artifacts updated:
Remaining exclusions or risks:
```

This ledger records the current local implementation proof and published tracker receipts. It does not by itself prove CI/local-preflight policy closure.
