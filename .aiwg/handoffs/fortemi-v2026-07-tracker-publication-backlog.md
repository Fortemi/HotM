---
title: Fortemi v2026.7.1 Tracker Publication Backlog
status: published
date: 2026-07-15
artifact_type: tracker-publication-backlog
related_artifacts:
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
  - .aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md
  - .aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md
  - .aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md
  - .aiwg/scripts/publish-fortemi-tracker-comments.py
  - .aiwg/reports/fortemi-v2026-07-completion-audit.md
  - .aiwg/reports/fortemi-v2026-07-tracker-publication-receipts.md
---

# Fortemi v2026.7.1 Tracker Publication Backlog

## Publication Status

The comments in this backlog were published to Gitea on 2026-07-15 through the `mcp__git_gitea.issue_write` connector. Published receipt IDs are recorded in `.aiwg/reports/fortemi-v2026-07-tracker-publication-receipts.md`.

This backlog remains the replay/source text for future publication refreshes.

## Original Publication Blocker

Tracker comments could not be published from the current environment:

- `tea comment 253 ...` failed with `Error: no available login`.
- `tea logins list` returned no configured Gitea login rows.
- `gh issue comment 253 --repo Fortemi/HotM ...` failed because GitHub could not resolve issue `#253`; the active tracker issues appear to live in Gitea.

Use this backlog as the source text for an authenticated Gitea run. Use `.aiwg/handoffs/fortemi-v2026-07-pr-closeout-package.md` when publishing equivalent closeout through the implementation PR instead of per-issue comments.

Dry-run the prepared comments:

```bash
.aiwg/scripts/publish-fortemi-tracker-comments.py
```

Publish after authenticating with a Gitea token:

```bash
GITEA_TOKEN=... .aiwg/scripts/publish-fortemi-tracker-comments.py --post
```

To publish a single issue comment, add `--only 253` or repeat `--only` for multiple issues.

## Shared Validation Receipt

```text
Fortemi baseline:
- Fortemi commit: f6733252
- Fortemi tag: v2026.7.1
- Routes: 200
- Families: 36
- Route status: 186 covered, 14 documented exclusions
- Verifier diagnostics: no metadata issues, no unclassified routes, no status drift, no evidence issues

Local validation:
- npm run test -- --run (ui): 110 test files, 1543 tests passed
- npm run typecheck (ui): passed
- npm run test (agent-proxy): 14 test files, 240 tests passed
- npm run typecheck (agent-proxy): passed
- python3 -m json.tool .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json: passed
- .aiwg/testing/scripts/verify-fortemi-route-inventory.sh: passed
- .gitea/workflows/sdlc-gates.yml includes the fortemi-route-inventory CI job; YAML parses locally with PyYAML
- .aiwg/scripts/publish-fortemi-tracker-comments.py parses this backlog and dry-runs the prepared comments
- git diff --check: passed
- find . -type d -name __pycache__ -print: no output
- stale-reference rg scan for weak/model/graph wording: no output
```

The UI full-suite run emits jsdom `HTMLCanvasElement.prototype.getContext` warnings from attachment media GPU detection tests, but the suite exits successfully.

## Issue Comments To Publish

### #242 Native Chat Stream

Native Fortemi chat stream is locally implemented and verified.

Route inventory impact: `native_chat_stream` is covered.

UX/API surfaces changed: `ui/src/api/chat.ts`, Agent Fortemi provider streaming path, provider capability semantics.

Validation: shared receipt above plus focused chat/agent stream tests in `ui/src/api/__tests__/chat.test.ts`, `ui/src/components/agent/__tests__/useAgentChat.test.ts`, and `ui/src/components/agent/__tests__/providers.test.ts`.

Remaining exclusions or risks: proxy-backed providers remain on the existing provider transport; agent diagnostic tools remain governed by #258.

### #247 OAuth/Auth Diagnostics

OAuth/API key parity and Admin auth diagnostics are locally implemented and verified.

Route inventory impact: OAuth discovery, authorize, consent/form, register, token, introspect, revoke, and API key helper coverage is strong.

UX/API surfaces changed: `ui/src/api/auth.ts`, Admin auth diagnostics in API capabilities/Admin surfaces.

Validation: shared receipt above plus focused auth API/Admin tests.

Remaining exclusions or risks: hosted session/role production UX stays capability-gated until Fortemi advertises the required hosted contract.

### #253 Route Verifier And Evidence Parity

Route verifier and evidence parity are locally clean for Fortemi `v2026.7.1`.

Route inventory impact: 200 routes, 36 families, 186 covered routes, 14 documented exclusions; zero gap, partial, decision-needed, unclassified, or weak covered-family rows.

Artifacts updated: route coverage JSON/Markdown, family evidence map, coverage evidence audit, verifier spec, scenario matrix, risk register, gate report, handoff, and delivery ledger.

Validation: shared receipt above.

Remaining exclusions or risks: the CI job is wired; a passing live `fortemi-route-inventory` receipt or accepted local-preflight-only decision is still required for final gate closure.

### #254 Streaming Health

Streaming health/backpressure telemetry is locally implemented and verified.

Route inventory impact: `streaming_health` is covered.

UX/API surfaces changed: `ui/src/api/health.ts`, `ApiCapabilitiesPanel` streaming-health card for chat, ingest, SSE, inbound, and RTP blocks.

Validation: shared receipt above plus focused `ui/src/api/__tests__/health.test.ts` and `ui/src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx`.

Remaining exclusions or risks: omitted or malformed blocks intentionally render as unknown/missing/malformed, not healthy.

### #255 Stream Ingest And Tokens

Fortemi stream ingest and ingest-token support are locally implemented and verified.

Route inventory impact: `streaming_ingest` is covered.

UX/API surfaces changed: `ui/src/api/ingest.ts`, Backup stream NDJSON import/token flow.

Validation: shared receipt above plus focused ingest API and BackupManager tests.

Security/redaction evidence: minted token is used for stream requests and revoked afterward; raw tokens and cursor internals are not rendered.

Remaining exclusions or risks: agent ingest tools remain deferred behind #258 capability, role/scope, and redaction gates.

### #256 Incoming Receivers And Inbound Sources

Incoming webhook receivers and inbound sources are locally implemented and verified.

Route inventory impact: `incoming_webhook_receivers` and `inbound_sources` are covered.

UX/API surfaces changed: `ui/src/api/webhooks.ts`, `WebhooksPanel` outbound/incoming/inbound sections.

Validation: shared receipt above plus focused webhooks API and WebhooksPanel tests.

Security/redaction evidence: receiver secrets, schema documents, connector config, and raw credential-like values are not rendered.

### #257 Backup/TUS/Portable Shard Parity

Backup/archive and TUS parity are locally implemented and verified.

Route inventory impact: `backup_archive` and `attachments_tus` are covered; no partial backup route rows remain.

UX/API surfaces changed: `ui/src/api/backup.ts`, `BackupManager`, TUS uploader, upload store, JobQueueMonitor.

Validation: shared receipt above plus focused backup API, BackupManager, TUS uploader, upload store, and JobQueueMonitor tests.

Security/product evidence: UI copy preserves the limitation that server import does not currently restore attachment records or bytes; no TUS checksum-extension support is claimed.

### #258 Agent Tool Metadata/Gating

Agent tool metadata and gating scaffold are locally implemented and verified.

Route inventory impact: existing enabled agent tools map to covered route families; deferred and excluded operations have explicit dispositions.

Agent surfaces changed: `agent-proxy/src/tools.ts`, `agent-proxy/src/routes/chat.ts`, agent tool-set tests.

Validation: shared receipt above plus agent-proxy test/typecheck.

Remaining exclusions or risks: new diagnostic tools remain deferred until disabled-state and redaction fixtures are accepted.

### #259 Media/Call Disposition

Vision/audio tools and REST call diagnostics are locally implemented and verified; Twilio realtime remains intentionally excluded.

Route inventory impact: `vision_tools`, `audio_tools`, and REST call detail are covered; Twilio realtime is documented as excluded.

UX/API surfaces changed: `ui/src/api/mediaTools.ts`, `ui/src/api/calls.ts`, AttachmentsPanel actions, API capabilities call diagnostics.

Validation: shared receipt above plus media tools, attachments, calls, and API capabilities tests.

Security/redaction evidence: provider call IDs, archive IDs, speaker IDs, transcript text, private paths, and raw media/transcript internals are not rendered.

### #243 Umbrella Integration Gate

Fortemi v2026.7.1 local implementation evidence is ready for PR packaging and review.

Route inventory impact: 200 routes, 36 families, 186 covered, 14 documented exclusions; no gap, partial, decision-needed, unclassified, or weak covered-family rows.

Validation: shared receipt above.

Artifacts updated: gate report, delivery ledger, traceability report, route verifier spec, scenario matrix, risk register, handoff, tracker publication backlog, route coverage artifacts, and family evidence map.

Remaining closure requirement: capture a passing live Gitea Actions receipt for `fortemi-route-inventory` or record an accepted local-preflight-only decision.
