---
title: API Contract Test Plan Addendum - Fortemi v2026.7.1
status: proposed
date: 2026-07-14
artifact_type: test-plan-addendum
related_artifacts:
  - .aiwg/testing/master-test-plan.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-05.md
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md
  - .aiwg/planning/fortemi-v2026-07-implementation-roadmap.md
  - .aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md
  - .aiwg/testing/fortemi-route-verifier-spec-2026-07.md
  - .aiwg/reports/fortemi-v2026-07-api-integration-traceability.md
  - .aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md
---

# API Contract Test Plan Addendum - Fortemi v2026.7.1

## Objective

Extend the May 2026 API contract checks so HotM can track and verify the current Fortemi v2026.7.1 server surface. The test strategy must cover route inventory drift, streaming endpoints, operator/admin surfaces, future partial parity regressions, newly discovered decision-needed endpoints, and documented exclusions.

## Existing Guards To Preserve

| Guard | Keep / extend |
| --- | --- |
| `ui/src/api/__tests__/openapi-contract.test.ts` | Preserve May coverage for create note, reprocess, backup import, document types, and outbound webhooks. |
| API client unit tests | Continue covering base URL normalization, request serialization, retry behavior, and memory-routing headers. |
| Compatibility parser tests | Preserve compatibility metadata behavior from #244/#252/#253. |
| Redaction tests | Extend to new ingest/webhook/source/agent-tool secrets. |

## New Contract Controls

### 1. Route Inventory Control

Command:

```bash
python3 .aiwg/testing/scripts/fortemi-route-coverage.py
```

Acceptance:

- Extracts 200 Fortemi route declarations for commit `f6733252`.
- Produces `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md`.
- Produces `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json`.
- Produces zero `unclassified` route families.
- Preserves or intentionally updates status counts when Fortemi changes.

### 2. Native Chat Stream Tests (#242)

Required checks:

- POST-SSE request sends the same request shape as `/api/v1/chat`.
- `delta` frames append content incrementally.
- `done` marks terminal success and releases loading state.
- `error` marks terminal failure and preserves retry affordance.
- HTTP 503 maps to GPU-busy/degraded state.
- Abort cancels the stream and does not append late chunks.
- Unsupported streaming falls back to synchronous `/chat`.

### 3. Streaming Health Tests (#254)

Required checks:

- `GET /api/v1/health/streaming` API parser accepts chat, SSE/RTP, ingest, and connector blocks.
- Missing blocks render as unknown/unsupported.
- Chat dropped-token/client-disconnect counters render without alarming when zero.
- Ingest 429/backpressure counters render as degraded when non-zero or high pressure.
- Connector lag/error counters render by connector without exposing credentials.

### 4. Ingest Stream Tests (#255)

Required checks:

- Ingest token mint response is copy-once and redacted afterward.
- Token revoke handles 204/idempotent success and not-found semantics.
- NDJSON stream parses `ack`, `progress`, `done`, and `error`.
- 401, 410, and 429 paths map to explicit UI guidance.
- Resume uses server-provided cursor state, not a client-invented cursor.

### 5. Incoming Receiver and Inbound Source Tests (#256)

Required checks:

- Incoming receiver list/create/get/patch/delete.
- Payload validation success and JSON-pointer validation errors.
- HMAC/signature guidance and secret redaction.
- Idempotency-key conflict state.
- Inbound source list/create/delete.
- Disabled/cost-gated state when external sources are not enabled.

### 6. Attachment and Backup Parity Tests (#257)

Required checks:

- TUS create/options/head/patch/get/delete route behavior.
- Offset mismatch, checksum mismatch, termination, and resume state.
- Backup route coverage for implemented download/import/upload/snapshot/restore/list/metadata paths.
- UX copy and tests preserve the portable sidecar boundary: reference-only shards remain valid, but server-side byte restore is not claimed.

### 7. Agent Tool Coverage Tests (#258)

Required checks:

- Tool coverage matrix maps every exposed agent tool to a Fortemi endpoint family.
- Unsupported server capabilities do not appear as enabled tools.
- New tools include capability checks and redaction tests.
- Prompt/tool descriptions match the enabled tool set.

### 8. Decision-Needed Endpoint Tests (#259)

The proposed disposition is recorded in `.aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md`.

If implemented:

- Add typed API tests and UI/agent tests for vision, audio, and realtime call surfaces.
- Vision: typed API, attachment action, unsupported media, error, and redaction tests.
- Audio: typed API, attachment action progress/error, transcript linkage/rendering, and redaction tests.
- Call detail: Admin/Realtime Debug diagnostic fetch and provider identifier redaction tests.

If excluded:

- Route inventory marks the family as `documented_exclusion`.
- Traceability report records rationale and compatibility behavior.
- No UI text or agent prompt claims support.
- Twilio realtime starts as an ADR-011 documented exclusion unless a diagnostics slice accepts it.

## Gate Criteria

| Criterion | Required evidence |
| --- | --- |
| Route inventory current | Regenerated JSON/Markdown with zero unclassified families. |
| P0/P1 gaps issue-backed | Every future `gap` or `partial` P0/P1 row maps to an open issue; the current baseline has zero such rows. |
| Implemented route families tested | Unit/component/integration tests cover serialization, success, degraded, and error states. |
| Exclusions documented | Excluded route families have rationale and no user-facing support claim. |
| Secret redaction | Tests cover API keys, ingest tokens, webhook secrets, connector credentials, private paths, tenant/auth diagnostics. |
| Local-first fallback | Older or unavailable Fortemi features do not break core notes/search/archive workflows. |
| UX disposition | Each current covered or documented-exclusion route family maps to a concrete HotM surface or exclusion; each future gap/partial/decision route family must do the same before closure. |

## Verification Commands

Current planning-slice command:

```bash
python3 .aiwg/testing/scripts/fortemi-route-coverage.py
jq -e '.route_count == 200 and (.family_counts.unclassified == null) and .status_counts.gap == 0 and (.status_counts.decision_needed // 0) == 0' .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json
```

Future implementation PRs should add focused Vitest/Playwright commands beside the issue they close.

The recommended issue order and prerequisite relationships are captured in `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md`; tests should land with the phase that introduces the covered capability.

The per-route-family proof target is captured in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`; implementation PRs should use that matrix to choose fixtures and regression checks.

The baseline evidence-strength audit in `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md` identifies covered families that still need stronger route-level assertions before an implementation-pass gate.

The #253 verifier should consume `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` or an equivalent generated successor when checking source/test evidence for route families.

The detailed verifier contract, pass/fail rules, and mixed-disposition requirement are defined in `.aiwg/testing/fortemi-route-verifier-spec-2026-07.md`.

The scenario-level test ownership, fixture states, redaction assertions, and planned test-file targets are defined in `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md`.
