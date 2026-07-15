---
title: HotM Plan for Fortemi v2026.7.1 Integration
status: proposed
date: 2026-07-14
artifact_type: implementation-plan
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
  - .aiwg/reports/fortemi-v2026-07-api-integration-traceability.md
---

# HotM Plan for Fortemi v2026.7.1 Integration

## Evidence Inputs

- Fortemi latest local commit: `f6733252`.
- Fortemi latest release tag: `v2026.7.1`.
- Server route source: `fortemi/crates/matric-api/src/main.rs`.
- HotM client source: `HotM/ui/src/api`, `HotM/ui/src/services`, `HotM/agent-proxy/src/tools.ts`.
- Generated coverage inventory: `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md` and `.json`.
- Existing relevant issues: #242, #243, #244, #246, #250, #252, #253.

## Work Packages

| Package | Scope | Tracker |
| --- | --- | --- |
| WP1 Contract inventory | Generate route inventory from Fortemi source or live `/openapi.yaml`; compare to HotM client coverage and intentional exclusions. Current verifier baseline: 200 routes, 186 covered, 0 partial, 0 gaps, 0 decision-needed, 14 documented exclusions. | #253 |
| WP2 Native streaming chat | Implement `POST /api/v1/chat/stream` in HotM agent/chat UX, with POST-SSE parser, fallback, cancellation, 503 handling, and tests. | #242 |
| WP3 Streaming health | Extend Admin/API Surface/realtime debug with `/health/streaming` chat, ingest, SSE/RTP, and inbound connector counters. | #254 |
| WP4 Streaming ingest | Add API client and operator/agent workflow for ingest tokens and NDJSON stream ack/progress/error/done/cursor behavior. | #255 |
| WP5 Incoming receivers and inbound sources | Add Admin panels or tabs for incoming webhook receiver lifecycle, validation, and inbound event-source connectors. | #256 |
| WP6 Attachments and backup parity | Expand tests/UX for full TUS verb coverage and current backup/download/knowledge archive/portable sidecar boundaries. | #257 |
| WP7 Optional media/call tools | Decide disposition for vision/audio endpoints and realtime call diagnostics. Implement included surfaces or document exclusions. | #259 |
| WP8 Agent tools refresh | Map agent-proxy tools to current server endpoints; add capability-aware tool registry and selected new tools. | #258 |

## Architecture and Verification Addenda

| Artifact | Purpose |
| --- | --- |
| `.aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md` | Defines the component, stream transport, Admin UX, agent tool, compatibility, security, and deployment deltas for Fortemi v2026.7.1 integration. |
| `.aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md` | Proposes the #259 disposition for vision, audio, call detail, and Twilio realtime routes. |
| `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md` | Lists each Fortemi route family, HotM surface disposition, tracker, and proof needed before seamless integration can be claimed. |
| `.aiwg/design/fortemi-v2026-07-ux-integration-addendum.md` | Maps covered route families and documented exclusions to existing or new HotM UX surfaces; future gap/partial/decision rows must be added there before closure. |
| `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md` | Defines phase order, dependencies, and closeout rules for moving from planning baseline to implementation evidence. |
| `.aiwg/testing/api-contract-test-plan-addendum-2026-07.md` | Defines route inventory, chat stream, streaming health, ingest, incoming/inbound, backup/TUS, agent tool, and exclusion verification controls. |
| `.aiwg/gates/fortemi-api-integration-gate-2026-07-14.md` | Records the current local implementation evidence pass, published tracker receipts, remaining CI/local-preflight blocker, and final closure criteria. |

## Sequencing

The detailed phase and dependency matrix is maintained in `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md`.

1. Contract inventory first, because it defines the coverage target and prevents accidental narrowing (#253).
2. Shared stream transport and streaming chat next, because native chat is the most user-visible v2026.6+ gap (#242).
3. Streaming health and ingest, because they share event parsing and degraded-state work (#254, #255).
4. Backup/attachment parity and incoming/inbound admin controls (#257, #256).
5. Agent-tool refresh after API client primitives stabilize (#258).
6. Vision/audio/call disposition after tool and diagnostic boundaries are clear (#259).

## Exit Criteria

- Every Fortemi route family has one of: HotM API client coverage, HotM UI coverage, agent tool coverage, documented exclusion, or tracked deferred boundary.
- `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh` regenerates the route inventory without unclassified route families or evidence-map drift.
- P0/P1 requirements in `.aiwg/requirements/fortemi-api-integration-requirements-2026-07.md` have local implementation evidence or documented exclusions.
- Compatibility, redaction, UI, API, and agent-proxy tests continue to pass.
- Tracker comments and CI/local-preflight policy are published before final gate closure.
