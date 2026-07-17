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

Extend the May 2026 API contract checks so HotM can track and verify the Fortemi v2026.7.1 server surface. The test strategy must cover route inventory drift, OpenAPI schemas, AsyncAPI event semantics, Knowledge Shard profiles and losslessness, compatibility negotiation, cross-language auth fixtures, streaming endpoints, operator/admin surfaces, future partial parity regressions, newly discovered decision-needed endpoints, and documented exclusions.

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

Passing this control proves only that every route has a disposition. It does not satisfy the following contract controls.

### 1A. OpenAPI Schema and HTTP Semantics

Required checks:

- Fetch or generate the canonical Fortemi OpenAPI artifact and pin its producer revision/checksum.
- Fail on unreviewed breaking changes to parameters, bodies, nullability, enums, success/error statuses, response schemas, or security requirements.
- Exercise HotM serializers and parsers with producer-owned golden examples.
- Reject a release pairing when only route names match.

### 1B. AsyncAPI and Realtime Envelope Semantics

Required checks:

- Pin the canonical AsyncAPI artifact and exercise the same event fixtures through SSE and WebSocket parsers.
- Preserve the top-level event envelope, including `event_type`, event identifier, timestamp, resource/subject references, and `metadata`.
- Verify each subscribed event payload against the producer catalog.
- Treat unknown events as unknown with bounded diagnostics; never coerce them into `QueueStatus` or another known event.

Delivered for HotM #268:

- The source-derived fixture pins sidecar commit
  `98c9b29deee43b9c5bd96278f1f96837595882cd`, the producer source path, source
  SHA-256, all 48 namespaced event types, and the default subscription prefixes.
- The pinned producer generator, invoked with version `2026.7.1` and canonical
  server URL `https://example.invalid`, produces a 45,161-byte AsyncAPI 3.0 YAML
  with SHA-256
  `f6a6fbc39af52b713b6f5c40dbb6e46baeb8a1b352a19288e79073863766bdf4`.
- SSE listener tests exercise every catalog name.
- WebSocket normalization tests exercise every catalog name through the shared
  envelope boundary.
- Golden envelope tests preserve `event_id`, `event_type`, `occurred_at`,
  `memory`, `tenant_id`, structured `actor`, entity references, correlation and
  causation IDs, and `payload_version`.
- Negative fixtures prove missing and future event names remain `Unknown`.
- The source drift verifier runs after the sidecar-pinned Fortemi checkout in the
  SDLC gate.

This source-derived receipt covers the current producer event implementation while
the broader generated AsyncAPI schema-diff control remains a separate gate.

### 1C. Knowledge Shard Interoperability

Required checks:

- Validate schema version, `min_reader_version`, profile, component manifest, counts, and checksums before mutation.
- Run server-export -> HotM -> server-import golden round trips for every HotM-supported profile.
- Compare stable identities, relationships, collection/template memberships, null/tombstone state, timestamps, and attachment references/bytes.
- Fail the portability gate on silent skips, dangling references, unsupported default-export components, or missing attachment bytes; an explicit loss report is not a lossless pass.

Implemented consumer checks for HotM #269:

- Vendor the producer `core-v1` manifest fixture from Fortemi commit
  `2eb5c6b739b3bb6a042a35050a3ae89960dd3ed4` and verify digest
  `4ed7e3b7d4845122653c95bcf2508a7f440cf067fe64ca493f0785519b9300f1`.
- Build a real gzip/TAR archive around that fixture in Vitest and exercise the
  production manifest parser rather than a URL-only mock.
- Reject unknown/unsupported profile, schema, minimum reader, component, count,
  checksum, malformed gzip, TAR, and manifest states before upload.
- Assert export sends only `include`, multipart upload reports server
  validation failures, and Backup Manager displays profile/schema without a
  lossless/full-recovery claim.

These checks are a prerequisite, not a substitute, for the still-required live
clean-server semantic roundtrip.

### 1D. Compatibility Negotiation

Required checks:

- Cover supported and unknown compatibility contract revisions.
- Cover minimum-client satisfied, client-too-old, malformed, and absent metadata.
- Keep local workflows available while disabling affected server mutations on negotiation failure.

### 1E. Cross-Language Auth Fixtures

Required checks:

- Pin a versioned `fortemi-auth` fixture manifest.
- Run identical positive and negative claim cases in Rust and HotM Node verification.
- Compare tenant derivation, scopes, time validation, error codes, and redaction behavior.
- Do not claim parity from documentation review alone.

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
| OpenAPI compatible | Pinned canonical artifact, reviewed diff, and typed consumer tests pass. |
| AsyncAPI compatible | Pinned event catalog and SSE/WS golden fixtures pass without event coercion. |
| Knowledge Shard interoperable | Supported profiles pass lossless cross-repository round trips including attachment bytes. |
| Compatibility negotiated | Contract revision and minimum-client fixture matrix passes fail-closed behavior. |
| Auth behavior aligned | Rust and Node pass the same versioned claim fixture manifest. |
| P0/P1 gaps issue-backed | Every future `gap` or `partial` P0/P1 row maps to an open issue; the current baseline has zero such rows. |
| Implemented route families tested | Unit/component/integration tests cover serialization, success, degraded, and error states. |
| Exclusions documented | Excluded route families have rationale and no user-facing support claim. |
| Secret redaction | Tests cover API keys, ingest tokens, webhook secrets, connector credentials, private paths, tenant/auth diagnostics. |
| Local-first fallback | Older or unavailable Fortemi features do not break core notes/search/archive workflows. |
| UX disposition | Each current covered or documented-exclusion route family maps to a concrete HotM surface or exclusion; each future gap/partial/decision route family must do the same before closure. |

## Verification Commands

Current route-inventory command:

```bash
python3 .aiwg/testing/scripts/fortemi-route-coverage.py
jq -e '.route_count == 200 and (.family_counts.unclassified == null) and .status_counts.gap == 0 and (.status_counts.decision_needed // 0) == 0' .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json
node .aiwg/testing/scripts/verify-fortemi-event-catalog.mjs
node .aiwg/testing/scripts/verify-fortemi-knowledge-shard-contract.mjs
(cd ui && npm run test:realtime)
(cd ui && npm test -- --run src/api/__tests__/knowledgeShard.test.ts src/api/__tests__/backup.test.ts src/components/backup/__tests__/BackupManager.test.tsx)
```

Future implementation PRs should add focused Vitest/Playwright commands beside the issue they close.

The route-inventory command is not a release-level interoperability receipt. Release evidence must also identify and pass the pinned OpenAPI, AsyncAPI, Knowledge Shard, compatibility, and auth fixture revisions.

The recommended issue order and prerequisite relationships are captured in `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md`; tests should land with the phase that introduces the covered capability.

The per-route-family proof target is captured in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`; implementation PRs should use that matrix to choose fixtures and regression checks.

The baseline evidence-strength audit in `.aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md` identifies covered families that still need stronger route-level assertions before an implementation-pass gate.

The #253 verifier should consume `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` or an equivalent generated successor when checking source/test evidence for route families.

The detailed verifier contract, pass/fail rules, and mixed-disposition requirement are defined in `.aiwg/testing/fortemi-route-verifier-spec-2026-07.md`.

The scenario-level test ownership, fixture states, redaction assertions, and planned test-file targets are defined in `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md`.

### OpenAPI Contract Gate Receipt

The #270 gate pins Fortemi commit
`cb1899368d763920091dd2fd5c22066d27e9fad0`, artifact SHA-256
`654db79e541a1a9117acf599476eb8ef4559b7e8d8f3ac7c471034ee383e705a`,
and semantic SHA-256
`b67ce9d3b557f435b85c533344a18b2c902df9e7d374200e21d9224791e4aaf8`.
CI must compare exact producer bytes, validate its semantic fingerprint, run
negative mutations for parameters, bodies, response schemas/statuses, errors,
nullability, enums, and security, and publish a receipt with both exact commits.

Focused Vitest coverage must run the real calls serializer against the delivered
path/query definition, validate the returned `CallDetailResponse` recursively,
validate `ProblemDetails`, and reject malformed transcript/error fixtures.
Version-skew fixtures cover current-minus-one `2026.2.8`, current `2026.2.9`,
and rejected breaking-next-major `2027.0.0`.

Verification commands:

```bash
node .aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs ../fortemi
(cd ui && npm test -- --run src/api/__tests__/calls.test.ts src/api/__tests__/delivered-openapi-contract.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx)
```

The current producer baseline has 191 paths, 249 operations, 310 response
entries, and only 6 response schemas. The gate must report this ratio and remain
partial; it cannot convert route or response-description presence into typed
response coverage.
