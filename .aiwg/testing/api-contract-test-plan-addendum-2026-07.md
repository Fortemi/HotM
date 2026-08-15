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
  - .aiwg/reports/fortemi-hotm-integration-audit-2026-08-15.md
---

# API Contract Test Plan Addendum - Fortemi v2026.7.1

## Objective

Extend the May 2026 API contract checks so HotM can track and verify the Fortemi v2026.7.1 server surface. The test strategy must cover route inventory drift, OpenAPI schemas, AsyncAPI event semantics, Knowledge Shard profiles and losslessness, compatibility negotiation, cross-language auth fixtures, streaming endpoints, operator/admin surfaces, future partial parity regressions, newly discovered decision-needed endpoints, and documented exclusions.

## 2026-08-15 Required Gate Additions

| Gate | Required evidence | Issue |
| --- | --- | --- |
| Runtime compatibility | Pinned producer artifact, correct SemVer, server API revision, minimum client, and mutation denial before dispatch while local-only workflows remain available. | #286 |
| Realtime context | Authenticated SSE/WS tests with two memories and tenants, reconnect continuity, event ownership checks, and URL/log/error redaction. | #285 |
| AsyncAPI payloads | Producer-owned positive and negative fixtures for every event schema through both transport decoders; unknown events remain unknown. | #288 |
| Operation conformance | Per-operation request, response, auth/context, UI, agent, and live evidence; prefix/file-only evidence is rejected. | #290 |
| Agent authority | Mandatory JWT middleware plus server-side privilege decisions, confirmation replay resistance, and least-privilege Fortemi context forwarding. | #123, #231 |
| Knowledge Shard | Revision-21 authority pin, profile-specific `core-v1` and `full-v1` golden receipts, current live recovery receipt, and negative revision/profile/signature/byte tests. | #292 |
| Browser integration | All non-quarantined mocked Playwright scenarios pass and publish exact fixture/commit evidence. | #291 |
| Umbrella workflows | Browser-verifiable user/operator or privileged-agent workflow for every supported operation, or explicit exclusion. | #287 |

These gates are independent. Passing route discovery or artifact byte identity
does not satisfy payload, auth/context, runtime admission, workflow, or live
recovery behavior.

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

- Extracts 202 Fortemi route declarations for source commit `48bc0a0b`.
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
  `5ea08229c9f1565122df5f8e6906e89d98dc7e75`, the producer source path, source
  SHA-256, all 48 namespaced event types, and the default subscription prefixes.
- The pinned producer generator, invoked with version `2026.7.1` and canonical
  server URL `https://example.invalid`, produces a 45,161-byte AsyncAPI 3.0 YAML
  with SHA-256
  `f6a6fbc39af52b713b6f5c40dbb6e46baeb8a1b352a19288e79073863766bdf4`.
- The event and AsyncAPI source checksums are byte-identical to the earlier
  `98c9b29deee43b9c5bd96278f1f96837595882cd` receipt. The SDLC gate verifies
  the pinned producer on pull requests and delivered `main` revisions.
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

- Vendor the producer `core-v1` manifest fixtures for registered schemas
  `1.0.0`, `1.1.0`, and `1.2.0` from Fortemi commit
  `48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`; verify contract revision 19
  and every manifest/component digest from the machine receipt.
- Build a real gzip/TAR archive around that fixture in Vitest and exercise the
  production manifest parser rather than a URL-only mock.
- Reject unknown/unsupported profile, unregistered same-major or next-major
  schema, minimum reader, component, count, checksum, malformed gzip, TAR, and
  manifest states before upload.
- Assert export sends only `include`, multipart upload reports server
  validation failures, and Backup Manager displays profile/schema without a
  lossless/full-recovery claim.

The existing live clean-server and repeated-import receipt remains the
end-to-end semantic proof for `core-v1`; the authority fixture gate keeps its
version boundary current without widening the supported profile.

Delivered extension for HotM #272:

- Pin authority revision 21, its receipt-bound opt-in advertisement, schema
  bundle, field-semantics inventory, runtime receipt, and paired receipt for
  exact `2.0.0/full-v1` before making a current-support claim.
- Require 33 component files, 34 count fields, and a matching 33-file checksum
  inventory during bounded streaming inspection.
- Assert full export uses `schema_version=2.0.0`, `profile=full-v1`, and
  `include_blobs=true`, piping response bytes directly to a writable sink.
- Assert full import first submits `dry_run=true` and
  `verify_signature=require`; no `dry_run=false` request is sent for tampered,
  missing, oversized, unsupported, or skewed preflight failures.
- Preserve exact archive bytes across the HotM pass-through boundary; rely on
  the pinned Fortemi runtime and clean-destination receipt for signature,
  digest, length, reference, presence-state, attachment-byte, and transaction
  semantics.

The historical live preflight confirmed the response stream and attachment
bytes but stopped before mutation when the older production archive lacked
`signature.json`; that failure remains recorded in
`.aiwg/evidence/hotm-full-v1-clean-recovery-preflight-2026-07-24.json`.

The passing rerun used immutable sidecar `sidecar-336df3ed834b`. HotM's bounded
streaming inspector accepted the signed archive, the public-key-only clean
destination passed `dry_run=true&verify_signature=require`, two mutating
imports converged, and all 33 component files, 34 count fields, and the
attachment sidecar re-exported identically. Manifest, component, signature,
attachment, missing, oversized, unsupported, and skewed cases returned 400
with a whole-schema zero-mutation fingerprint. The scoped receipt is
`.aiwg/evidence/hotm-full-v1-clean-recovery-receipt-2026-07-24.json`.

Revision-21 authority negatives execute with the contract gate: unknown
revision, unsupported profile, missing advertised opt-in, and evidence digest
drift fail closed. Existing API tests retain signature-tamper and attachment
byte-drift rejection. `record-v1`, suite-wide portability, and complete backup
remain outside the supported claim.

### 1D. Compatibility Negotiation

Required checks:

- Cover supported and unknown compatibility contract revisions.
- Cover minimum-client satisfied, client-too-old, malformed, and absent metadata.
- Keep local workflows available while disabling affected server mutations on negotiation failure.

Delivered for HotM #244/#286:

- Schema `1` and revision `2026-07-06` are the only accepted compatibility
  boundary.
- The minimum client is compared with `ui/package.json` before capability
  normalization.
- Fortemi API versions are limited to `>=2026.7.0 <2027.0.0` with SemVer 2
  numeric prerelease ordering and build metadata handling.
- Authenticated compatibility responses must advertise supported claim-contract
  version `1`; missing and unknown versions fail closed.
- UI startup preflights asynchronously, and every shared-client, direct
  multipart/stream/root-OAuth, legacy-wrapper, and agent-proxy mutation awaits
  the cached decision before dispatch.
- Fixtures cover supported, equal minimum, checkpoint and numeric prerelease,
  future revision, client-too-old, malformed minimum/API, server-too-old/new,
  unsupported schema/auth contract, unreachable state, cached decisions, and
  zero-dispatch denial while reads/local startup remain available.
- `.aiwg/testing/scripts/verify-fortemi-system-compatibility-contract.mjs`
  validates identical UI/proxy receipts and pinned Fortemi profile/source Git
  objects at `48bc0a0b`; CI runs the verifier as an independent SDLC gate.

This gate is runtime compatibility evidence only and cannot satisfy OpenAPI,
AsyncAPI, Knowledge Shard, or cross-language auth conformance.

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
jq -e '.route_count == 202 and (.family_counts.unclassified == null) and .status_counts.gap == 0 and (.status_counts.decision_needed // 0) == 0' .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json
node .aiwg/testing/scripts/verify-fortemi-event-catalog.mjs
node --test .aiwg/testing/scripts/knowledge-shard-authority-policy.test.mjs
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
`5ea08229c9f1565122df5f8e6906e89d98dc7e75`, artifact SHA-256
`9d2d5ea05f21a71d416d713a5cadd2c4f76086a3494105280d50ec328c4056fd`,
and semantic SHA-256
`6e84af14c4f0aebb885123b19dfa639ddfda5e73ef08d0ebbb9ca7ca8db9e633`.
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

The current producer baseline has 193 paths, 251 operations, 563 response
entries, and 257 response schemas. Every operation must retain the shared
schema-bearing RFC 9457 `429` boundary. The gate must report both
schema-bearing-operation and response-schema counts and must not convert
response-description presence into an undeclared success payload type.

### Operation-Level and Realtime Commands

```bash
python3 .aiwg/testing/scripts/test_fortemi_route_coverage.py
python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check
node .aiwg/testing/scripts/verify-fortemi-asyncapi-payloads.mjs
(cd ui && npm test -- --run src/api/__tests__/events.test.ts src/services/__tests__/realtimeEventBus.test.ts)
```

The operation verifier consumes the exact OpenAPI receipt and fails on stale
pins, missing evidence paths, unsupported boundaries, unclassified operations,
or missing focused operations. Its generated JSON and Markdown reports come
from one in-memory model. The current expected disposition counts are 1
integrated, 238 partial, and 12 gap; route-disposition counts are checked
separately.

The AsyncAPI payload verifier resolves all 48 event schemas and executes
schema-derived positives plus four negative categories. Both transports must
accept all 48 valid events; SSE must reject 192 malformed known cases and
WebSocket must reject 179, with 13 envelope-only identifier mutations recorded
as not applicable to the legacy WebSocket shape. Unknown and malformed known
events must remain `Unknown` with raw data preserved. Full #288 closure also
requires producer-owned positive examples, which are absent from the pinned
producer checkout.

### Required Mocked Browser Gate

```bash
cd ui
rm -rf node_modules
npm ci
npx playwright install chromium --with-deps
node scripts/write-mocked-playwright-ci-receipt.cjs --prepare test-results/mocked-ci/receipt.json
CI=1 npx playwright test --config scripts/playwright-mocked-ci.config.cjs
node scripts/write-mocked-playwright-ci-receipt.cjs --finalize test-results/mocked-ci/receipt.json 0
node scripts/write-mocked-playwright-ci-receipt.cjs --verify test-results/mocked-ci/receipt.json
npm test -- --run
npm run typecheck
npm run build
```

The Playwright config must retain desktop 1280 and mobile 390 projects, retries
set to zero, and no unconditional skips for note, search, or tag workflows. CI
uploads the receipt, report, traces, screenshots, and videos on failure. Live
Fortemi and launched Tauri scenarios remain opt-in receipt gates.
