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

## Cycle98 Mobile Note Controls

Selected-note tabs now grow to contain wrapped rows. Preview/original/edit
headers wrap instead of compressing titles beside fixed-width actions. Compact
star/copy/regeneration controls retain accessible names, tooltips and44px heights;
the regeneration popover is constrained to available viewport width/height.
Long unbroken titles wrap; the edit title input has an explicit accessible name.
This is a UI-only correction, not a producer or integration contract change.

533focused/2178full UI tests, typecheck/build and the actual-daemon HTTP regression
pass. The previous immutable UI build fails the new320px tab-containment check:
the title is about82px wide and Regenerate extends past the viewport. The fixed
production build passes24layout/menu groups at320/390/768/1440px and18browser
controls overall, with long-title,44px action, overlap, menu reachability and
focus-return checks. Screenshots are nonblank and visually inspected. Menu
actions are opened/trial-clicked only; no regeneration or note write is dispatched.
Core220groups/293requests/655durable audit rows and previous job/cache checks pass.

Evidence: suite Cycle98 candidate, layout-red and layout-green receipts.
Automated selected-note layout acceptance is PASS, not physical-device,
human usability or AI-output quality acceptance. Per the operator, discuss
needed human evaluations next; do not start inference/model acceptance or widen
the lane autonomously. Full lane/CI/delivery/release gates and all prior holds,
suite NO-GO and public-readiness boundaries remain; candidate is unreleased.

## Cycle97 Context-Owned Job Cache: Phase2

The job cache now uses a strict, bounded v2 envelope and an opaque owner derived
from endpoint, effective session/tenant hint, selection, and server-resolved
archive name/schema. Current read-authorized context resolution must succeed
before hydration. Foreign, malformed, oversized and legacy unknown-owner data
is never hydrated; existing bytes are preserved. The owner is a cache
discriminator, not authentication or encryption. Live updates during admission
win over the saved snapshot; stale admission/digest completions cannot hydrate.
Effective API endpoint changes also invalidate requests, views and streams.
Buffered event coalescers and dedup state reset on context changes; reentrant
listeners cannot receive an in-flight event from the previous context.

Final500focused/2177full UI tests, typecheck and build pass with zero unhandled
errors. The production browser against the actual owned hosted daemon passes
17controls, including three real model-free worker jobs, matching visible job
content, same-context reload while the real jobs endpoint returns503, separate
tenant/archive cache owners, foreign-context/logout clearing, and unchanged
legacy/local-only bytes. Automatic reconnect sends a cursor from a nonempty
live stream. This is not proof of a nonempty replay response.

The producer runtime, OpenAPI and installed Core package are unchanged. The
harness adds only three predefined job controls with bounded file handshakes.
Core220groups/293requests and655durable audit rows pass. Ten serial Phase2 jobs
are terminal:4PASS,5failures and1intentional stop; failed receipts are retained.
The runner now rejects duplicate cache/deadline options instead of silently
replacing an earlier value. Eight runner tests pass; containment is unchanged.

This is a source-bound candidate, not delivered compatibility or full session
isolation. Default/archive administration without a client context change,
other persisted stores, nonempty replay, native and full lifecycle/every-consumer
acceptance remain. The390px selected-note toolbar still clips and compresses its
title; mobile usability is NOT_PASS. No authority/profile/pin promotion or
destructive data migration. Source rollback is possible, but old code would
restore its old unscoped-cache behavior; preserved legacy data is not safe to
rehydrate merely because rollback was chosen. Full CI/delivery/release sweep,
publication holds and suite NO-GO remain. Evidence: suite Cycle97
phase2-summary.json and browser-third/browser-receipt.json.

## Cycle97 Live Job Store Lifetime: First Stage

The central job store now resets live job/queue/step/pause/staleness state on
effective session, tenant-hint or archive changes, including cross-tab storage
and logout. Subscriptions are replaced with revision-bound callbacks so old
callbacks cannot repopulate the reset view. Pause refreshes reject obsolete
context and out-of-order same-context completions. Idempotent disposal removes
only this store's subscriptions and timer; shared transport is not stopped.
HMR and test teardown call disposal. Connection/staleness-only notifications
no longer rewrite the saved job data.

The 11 regression failures reproduced before the fix. Final focused30 and
broader426 tests, full2145 UI tests, typecheck and production build pass with
zero unhandled errors, inside three serial bounded jobs. No browser/daemon
acceptance was rerun for this stage. Source rollback is available.

This is not complete job-store or application isolation: legacy unscoped
hotm.jobStore hydration still exists, and persistence needs explicit ownership,
same-context reload preservation and rejection of foreign/unknown ownership.
Buffered event delivery to newly registered listeners also needs adversarial
coverage. Do not infer those properties from tests of old callback closures.
Mobile clipping, nonempty browser replay and the full lane/CI/delivery/release
gates remain. No wire/schema/pin promotion; suite NO-GO is unchanged.

## Cycle96 View And Request Acceptance

RED:21new view/request assertions fail against Cycle95; four later gate-reset/
context assertions fail before the gate fix. Final400focused/2133full UI assertions,
typecheck/build PASS with explicit zero unhandled errors. One intermediate green
focused run failed only TypeScript target compatibility in the new tests. Another
full run had2129passing assertions but an uncaught Radix focus-cleanup timer in
MemberManager.test.tsx after DOM teardown. That file now awaits unmount focus work;
no exception filter, guard relaxation or claim about Cycle94's unknown cause.

Actual production browser passes eleven controls through unchanged GET proxy to
the real daemon. Correct note IDs selected in three tenant/archive contexts; old
content clears on foreign404/logout401. The first enclosing HTTP run failed its
old four-read assertion because the browser correctly added one detail access.
The final fixture verifies browser counts1/1 before Core and exactly four more
after enrichment, retaining the original failed receipt. Core220groups/293requests,
635durable audit rows,12metadata requests/12schema vectors/six worker streams24events,
five Rust functions and four fixture-profile tests PASS.

Desktop/mobile pixels are nonblank. Mobile selected-note toolbar clipping is
visually confirmed despite scrollWidth equaling viewport width: do not substitute
that width metric for usability. External job store/other caches, nonempty browser
replay, native/default-admin and all delivery gates remain independent.

## Cycle95 Actual Browser Acceptance

Final326 focused and2102 full UI assertions, typecheck/build pass with zero reported
unhandled errors. Two earlier focused runs failed three parameterized fixture cases;
unique event IDs and receiver reset fixed the fixtures without weakening deduplication.
The exact production asset inventory is served to an isolated sandboxed installed
Chrome with a fresh profile and two owned-origin tabs. Six stream lifecycle checks
pass through a read-only proxy to the actual hosted daemon. No response/auth stub.
The cached Chromium sandbox refusal and two pre-browser harness failures are retained;
no --no-sandbox or host policy change was used.

Desktop1440x900/mobile390x844 screenshots have nonblank pixels and matching page/
viewport widths. They reveal stale tenant A notes after the B switch, not a full UI
isolation pass. Browser streams have zero event bytes, so reconnect evidence covers
admission and replacement, not nonempty replay. Add negative fixtures for note/job
cache retention, async result races, logout, archive changes and disposed subscriptions.
Core220 groups/293 requests,625 durable audit rows,12metadata requests, six separate
worker live/replay streams with24events, five Rust functions and four profile tests
pass. Native independent-default19request coverage remains distinct from browser
default administration. See suite Cycle95 receipts for exact source/process identities.

## Objective

Cycle94 replaces inventory mocks with the selected-context API and tests the real
HTTP client: request path/auth/selection, no retries on401/403/404/500/503,
invalid/extra-field JSON, Unicode name limits, canonical schema and advertised/
streamed4096byte limits. Retain delayed-selection/close fencing and cursor/queue
replacement tests. Compare the real decoder with generated producer JSON Schema;
actual-daemon controls cover auth/read denial, foreign/unknown memories, default
resolution and six real client/parser live/seeded-replay streams. Full UI and
binary tests must exit successfully; passing JSON counts alone are insufficient.
Launched browser/native lifecycle and immutable delivered pins remain separate.

Cycle93 adds a producer-only selected-context contract candidate. Next consumer
acceptance must cover two independent tenant defaults, explicit/public routing,
foreign/unknown/invalid metadata, read versus admin policy and context changes,
using the real `/api/v1/memory/context` client before actual-server SSE. Retain
Cycle92's failing inventory-based receipt; no consumer success is asserted yet.

Cycle92 adds `realtime-context.test.ts`, `websocket-archive-context.test.ts` and
`websocket-archive-view.test.ts`: exact name/schema separation, default/public,
malformed metadata and lookup denial, current-tenant filtering, Last-Event-ID on
same-context reconnect, stream/cursor replacement, delayed lookup/close fencing,
pending coalescence discard and rendered queue reset. Existing events, terminal
states, real producer corpus and full UI tests remain regression gates.

The suite Cycle92 private actual-server fixture must use the compiled real
candidate archive resolver, HTTP client and SSE parser with no header-name
rewrite or metadata stub. Record source/bundle hashes, metadata requests, live
and seeded replay events, zero owned PG slot refusals, terminal process status
and fixture cleanup. These client/resolver checks are not automatic reconnect
or launched browser/native application qualification. Keep each evidence scope
explicit, including every remaining lifecycle/consumer/CI/release gate.

Executed Cycle92 result: 279 focused and2066 full UI tests pass without skips;
typecheck, Vite build and pinned48-event/four-transport regression pass. The
private actual-server test is NOT_PASS: metadata GET returns503 and no SSE
connection opens. Preserve that failure independently of local passes. The
archive-list admin policy is a further source-confirmed reader dependency.

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
from one in-memory model. After #298, the current expected disposition counts
are 1 integrated, 219 partial, 0 gaps, and 31 documented exclusions;
route-disposition counts are checked separately.

The AsyncAPI payload verifier resolves all 48 event schemas and executes
schema-derived positives plus four negative categories. Both transports must
accept all 48 valid events; SSE must reject 192 malformed known cases and
WebSocket must reject 179, with 13 envelope-only identifier mutations recorded
as not applicable to the legacy WebSocket shape. Unknown and malformed known
events must remain `Unknown` with raw data preserved. The SDLC gate regenerates
the corpus from the pinned producer, uses the sidecar publication time as its
deterministic source marker, and fails on any resulting artifact diff. Full
#288 closure also requires the independent producer-owned positive-example
gate below, consuming Fortemi/fortemi#1097 at the live authority pin. The
packaged producer pin and its schema-derived negative corpus remain unchanged.

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

### Auth, Realtime, and Operation-Disposition Commands

```bash
node scripts/ci/verify-fortemi-operation-dispositions.mjs --check
cd agent-proxy
npm run typecheck
npx vitest run src/auth/middleware.test.ts src/__tests__/chat-route.test.ts \
  src/__tests__/privileges.test.ts src/__tests__/tools.test.ts
cd ../ui
npm run typecheck
npx vitest run src/api/__tests__/events.test.ts \
  src/services/__tests__/websocket.test.ts \
  src/components/admin/__tests__/OperationCatalogPanel.test.tsx \
  src/api/__tests__/links.test.ts
```

Required negative cases include missing/expired/wrong-audience bearer,
unsupported auth contract, cross-tenant and cross-memory context, privilege
session rebinding, replayed/altered confirmation, credential-free realtime
URLs, mismatched event ownership, stale operation ledger, incompatible-server
catalog state, and absence of #294's removed link mutation methods, tools,
prompt claims, and static OpenAPI operations. The disposition verifier also
fails if a non-GET `/api/v1/notes/{id}/links` operation enters the pinned
ledger. Because no mutation contract exists, mutation success/error/auth/live
tests are not simulated; a future producer operation must add those receipts.
Scoped WebSocket success remains not applicable until Fortemi #953 provides a
context-preserving producer contract; it must not be simulated as conformance.

### Core And Operator Workflow Commands (2026-08-16)

```bash
cd ui
npx vitest run \
  src/api/__tests__/client.test.ts \
  src/api/__tests__/contract-codecs.test.ts \
  src/api/__tests__/core-content-operation-evidence.test.ts \
  src/api/__tests__/core-content-second-increment.test.ts \
  src/api/__tests__/operator.test.ts \
  src/components/admin/__tests__/CoreContentLifecyclePanel.test.tsx \
  src/components/admin/__tests__/CoreContentLifecyclePanelSecondIncrement.test.tsx \
  src/components/admin/__tests__/OperatorConsole.test.tsx \
  src/components/admin/__tests__/AdminPanel.test.tsx
npx playwright test --project=e2e-mocked \
  e2e/tests/core-content-lifecycle-responsive.spec.ts \
  e2e/tests/operator-console-responsive.spec.ts
cd ..
python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check
node scripts/ci/verify-fortemi-operation-dispositions.mjs --check
```

The focused tests must cover all 60 #295 and 76 #296 manifest entries against
the pinned ledger, bounded JSON/text/SSE handling, unknown SSE event counting,
redaction, compatibility failure, independent unauthorized/unavailable/empty
states, confirmation, and desktop/mobile rendering. These are deterministic
mocked receipts. No test may convert them into operation-specific auth or live
Fortemi evidence. #297 operations remain excluded unless separately authorized
and verified against their named auth, binary, or Knowledge Shard profile.

### Sensitive Operation Verification Commands (2026-08-16)

```bash
node scripts/ci/verify-fortemi-operation-dispositions.mjs --check
cd ui
npm run typecheck
npx vitest run \
  src/api/__tests__/attachments.test.ts \
  src/api/__tests__/backup.test.ts \
  src/services/__tests__/tusUploader.test.ts \
  src/services/__tests__/uploadStore.test.ts \
  src/components/agent/__tests__/SaveAsNoteButton.test.tsx \
  src/components/admin/__tests__/OperationCatalogPanel.test.tsx \
  src/components/admin/__tests__/AdminPanel.test.tsx
```

The disposition verifier must produce exactly 41 sensitive decisions: 5
`typed_ui_workflow`, 5 `external_browser_protocol_handoff`, and 31
`continued_exclusion`. Every continued exclusion must have `enabled=false`, a
named owner and blocker, and a visible disabled catalog row.

Negative transfer cases must cover cancellation/termination, resume offset and
expiry headers, range failure, advertised maximum size, malformed metadata,
401/403 expiry, 413, 416, 429, and server failure. Assertions must inject raw
problem text containing bearer artifacts, upload URLs, tenant IDs, and local
paths and prove none reach rendered errors. Browser/Tauri primitives carry
bytes directly; tests must fail if multipart/base64 fallback or raw producer
error propagation returns.

These are consumer workflow and redaction tests. They do not supply missing
producer success schemas, operation-specific authorization, live Fortemi
outcomes, Knowledge Shard profile receipts, or a `fortemi-auth` release.

### Agent Operation Reconciliation Commands (2026-08-16)

```bash
python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check
python3 .aiwg/testing/scripts/test_fortemi_route_coverage.py
node scripts/ci/verify-fortemi-operation-dispositions.mjs --check
(cd agent-proxy && npm test -- --run src/__tests__/tools.test.ts src/__tests__/privileges.test.ts)
(cd ui && npm test -- --run src/api/__tests__/core-content-second-increment.test.ts)
```

The generator must report 12 conformant agent dimensions and reject a curated
operation whose operation ID no longer resolves to its pinned method/path.
Agent tests must reject any declared endpoint absent from the pinned ledger.
The `create_job` case must prove its exact serializer and bounded decoder, and
the related-notes case must prove dispatch to `/notes/{id}/related` with both
wrapped and bounded result handling. No mocked or workflow-level receipt may
change an exact operation's live dimension; all 251 remain `gap` until an
operation-bound live receipt is retained and verified.


## Custom CA authority release integration (2026-09-07)

Fortemi/fortemi-auth#50 and Fortemi/fortemi#1144 introduce explicit custom PEM
trust roots for the server's discovery and JWKS HTTPS client. HotM consumes the
new exact authority release `v2026.9.0`, retaining contract `1.1.0`, profile
`rust-node-jwt-v1`, RS256 verification, and the unchanged authority corpus.
The UI and agent proxy must advance their admission receipts together with the
server's advertised tuple. Auth fixtures consume the vendored producer policy.

The current source and consumer conformance receipt is
`.aiwg/reports/fortemi-auth-node-conformance-receipt-2026-09-07.md`.
It pins signed authority `v2026.9.0` and server source
`088932c008af8e4f89ef6055ef85d700001c2dd5`; the canonical source verifier
passes. Server CI/release publication remain separate delivery gates. Earlier
dated receipts retain their original release identities and evidence scope.
Custom certificate configuration belongs to the Fortemi server deployment;
this change adds no browser certificate override. Live hosted authentication,
tenant isolation, and reauthentication/realtime recovery still require the
configured environment and a separate executed receipt.


## Independent live-server AsyncAPI authority (2026-09-07)

`fortemi-live-asyncapi-authority-receipt.json` independently pins the current
server's canonical AsyncAPI document and producer sources. Its verifier reads
exact Git objects, excluding only `info` metadata when comparing the complete
wire document against the packaged baseline. Existing 48-event payload fixtures,
validation rules, event catalog, and desktop sidecar provenance retain their
original identities and run their existing conformance gates. The new CI gate
rejects schema, channel, operation, server, protocol, source-hash, or fixture
coverage drift. This separates live-server compatibility evidence from packaged
sidecar delivery; neither source comparison nor fixtures prove live transport
execution. The live receipt must contain an immutable producer SHA before release.


## Hosted browser session binding (HotM304 / ITops727)

The browser decodes the canonical `fortemi:tenant_id` UUID only as a local
SSE filtering hint; the pinned server still verifies the bearer, issuer,
audience, expiry and tenant. Reloaded and replacement sessions derive their
filter from the current bearer. An unbound bearer reaches the server for its
real 401/403 response, but no authenticated event is dispatched without a
tenant filter, even if the endpoint responds 200. No client hint grants access.
The consumed hosted claim contract remains 1.1.0, authority commit
`cff36d293d73080c186e2f35115dd92a594982d2`; the API and event contracts are unchanged.

Regression evidence: `ui/src/api/__tests__/auth-context-hosted.test.ts` and
`ui/src/api/__tests__/events.test.ts`. Live acceptance remains the unchanged
`ui/scripts/qualify-hosted-realtime.mjs` against the isolated titan deployment.

## Producer-Owned Event Corpus (HotM #288, 2026-09-11)

Consume [Fortemi #1097](https://git.integrolabs.net/Fortemi/fortemi/issues/1097)
at the existing independent live AsyncAPI authority
`c3bfd40b275decd5a24c4e9a656d830a383b3de2`. The exact receipt pin is
`ui/src/api/contracts/fortemi-producer-event-fixture-pin.json`; its SHA-256 is
`2318bf0ff3ba2801929767c9417ed5cc0dd83ffb91ceae7276efcc8979b763aa`.
Producer manifest SHA-256:
`73ce991d31aba0bfaa7d126f9f8ca7cb42d9941fd65ecd67d4dba8d7a4faaada`.
Corpus SHA-256:
`ee09b909863b868b57c3bf95daa47d3e24f84eb7eb487c1d64c0ef40ef4dc6ad`.

The importer reads exact Git objects and verifies the receipt, manifest, all
48 raw fixture hashes, lexicographically concatenated corpus digest, four-schema
inventory, event/variant/schema mapping, envelope revision 1, and payload
revision 1. It compares the full live wire document with the packaged baseline
excluding only informational metadata. Imported JSON values preserve the Rust
producer envelopes; the consolidated HotM file is not an independent authority.

Required commands:

```bash
node --test .aiwg/testing/scripts/producer-event-fixtures.test.mjs
node .aiwg/testing/scripts/verify-fortemi-producer-event-fixtures.mjs ../fortemi
node .aiwg/testing/scripts/verify-fortemi-producer-event-transports.mjs ../fortemi .aiwg/working/producer-event-transports/receipt.json
```

The transport gate executes all 48 examples through EventSource, split-chunk
fetch SSE, and the production WebSocket message handler with canonical envelopes
and legacy payloads. It asserts exact payload and envelope metadata preservation,
including structured actors, nulls, identifiers, tenant, memory and timestamps.
Its receipt binds source/test/lockfile hashes, producer and catalog digests,
event/schema counts, each passed event per transport, and the hashed Vitest report.
The existing negative and unknown-event tests run in the same gate.

SDLC CI rejects byte, pin, mapping, revision, schema and decoder drift and uploads
the transport receipt. Legacy WebSocket fixtures do not grant scoped fallback:
admission still requires unscoped `anonymous_local`. Network boundaries are
mocked; this is not live authorization, tenant isolation, supported-platform,
sidecar replacement, Knowledge Shard, or suite-wide compatibility evidence.
The packaged sidecar and historical schema-derived receipts are unchanged.
[HotM #288](https://git.integrolabs.net/Fortemi/HotM/issues/288) remains open
until exact-source CI and delivery are verified. Suite NO-GO remains.

## v2026.9.10 Verification Baseline (2026-09-19)

Current checks must bind Fortemi source
`306bae55a41eff7e4f8b8349304765322865e6cc`, OpenAPI SHA-256
`0cc3f1260fed076cc559a00719e39302d657c24eacd2770e7da7ef9cef2c6869`,
202 paths, 261 schema-bearing operations, and 606 response entries with 292
schema-bearing responses. Route verification must report 211 routes, 36
families, 193 covered rows, 18 documented exclusions, and zero diagnostics.

Operation verification must report 1 integrated, 225 partial, 0 gaps, and 35
documented exclusions. It must preserve all 261 live dimensions as gaps, verify
the selected-memory context typed client, and reject promotion of the four bulk
lifecycle-purge orchestration routes. These checks supersede prior current-count
expectations while preserving dated historical receipts.
