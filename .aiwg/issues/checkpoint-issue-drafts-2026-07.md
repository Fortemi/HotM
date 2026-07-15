# HotM Issue Drafts - SDLC Checkpoint 2026-07

## Fortemi v2026.7.1 Implementation Roadmap

**Artifact:** `.aiwg/planning/fortemi-v2026-07-implementation-roadmap.md`
**Issue dependency map:** `.aiwg/planning/fortemi-v2026-07-issue-dependency-map.md`
**Workflow scenarios:** `.aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md`
**Capability matrix:** `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`
**API/client blueprint:** `.aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md`
**Agent tool matrix:** `.aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md`
**MCP/tool surface audit:** `.aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md`
**Scenario test matrix:** `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md`
**Fixture catalog:** `.aiwg/testing/fortemi-v2026-07-fixture-catalog.md`
**Verifier CI runbook:** `.aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md`
**Security controls:** `.aiwg/security/fortemi-v2026-07-security-redaction-controls.md`
**Risk register:** `.aiwg/risks/fortemi-v2026-07-integration-risk-register.md`
**Delivery evidence ledger:** `.aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md`
**Delivery handoff:** `.aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md`
**Artifact index:** `.aiwg/reports/fortemi-v2026-07-artifact-index.md`

### Dependency Order

Use `.aiwg/planning/fortemi-v2026-07-issue-dependency-map.md` as the tracker-level critical path and parallelization guide.

1. Formalize the route inventory verifier and CI guard in #253.
   - The inventory generator now derives Fortemi commit/tag metadata from the sibling Git checkout; #253 should keep `python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check` as the local preflight and fail or document an explicit offline override if metadata cannot be resolved.
   - The local preflight now fails on route-count, family-count, and status-count drift from the current 200-route, 36-family baseline until the baseline is intentionally updated.
   - Use `.aiwg/testing/fortemi-route-verifier-ci-adoption-2026-07.md` to wire the command into CI or capture documented local preflight output before claiming #253 formalization.
2. Establish shared POST stream transport while implementing native chat streaming in #242.
3. Add streaming health and ingest workflows in #254 and #255.
4. Preserve backup/attachment parity and incoming/inbound Admin controls in #257 and #256; local implementation evidence is now present.
5. Refresh agent tools after the API/client primitives stabilize in #258.
6. Resolve vision/audio/realtime call disposition in #259.
7. Refresh #243 and the gate report after implementation evidence exists.

### Capability Closeout

Use `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md` as the issue acceptance checklist. Each implementation issue should update the matrix when its route-family status, surface disposition, or proof requirement changes.

Use `.aiwg/design/fortemi-v2026-07-api-client-implementation-blueprint.md` as the module-boundary guide for expected API clients, UI surfaces, agent boundaries, and primary test files.

Use `.aiwg/requirements/fortemi-v2026-07-ux-workflow-scenarios.md` as the workflow acceptance checklist. Each implementation issue should map its UI/API work to the relevant scenario, including degraded states and test hooks:

- UX-FORTEMI-001 native streaming chat: #242.
- UX-FORTEMI-002 streaming health/backpressure: #254.
- UX-FORTEMI-003 stream ingest with token: #255/#257/#258.
- UX-FORTEMI-004 incoming receivers and inbound sources: #256/#258.
- UX-FORTEMI-005 backup, TUS, and portable shard parity: #257.
- UX-FORTEMI-006 capability-gated agent tool use: #258.
- UX-FORTEMI-007 vision, audio, and realtime call disposition: #259/#253.

Use `.aiwg/testing/fortemi-v2026-07-scenario-test-matrix.md` as the scenario-to-test evidence checklist. Linked implementation issues should update that matrix with actual test commands and evidence when they close.

Use `.aiwg/testing/fortemi-v2026-07-fixture-catalog.md` as the shared fixture naming and minimum payload guide for API, component, e2e, and agent tests.

Use `.aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md` as the issue closeout proof checklist. Closing comments or PR descriptions should include route inventory impact, test commands, UX/API surfaces changed, security/redaction evidence, artifact updates, and remaining exclusions or risks.

Use `.aiwg/security/fortemi-v2026-07-security-redaction-controls.md` as the sensitive-data and fail-closed behavior checklist for any issue touching tokens, cursors, receiver secrets, connector credentials, API keys, provider identifiers, private paths, media transcripts, or agent tool output.

### Risk Closeout

Use `.aiwg/risks/fortemi-v2026-07-integration-risk-register.md` as the integration risk checklist. P1 risks must remain explicitly mitigated before the Fortemi integration gate can move from local implementation evidence to final tracker/CI closure:

- FTI-001 route inventory drift: #253.
- FTI-002 stream transport duplication: #242/#255.
- FTI-006 backup/TUS/archive claim drift: #257.

Security and product-safety P2 risks remain issue-backed through #244, #247, #253, #255, #256, #257, #258, and #259.

### Delivery Handoff

Use `.aiwg/handoffs/fortemi-v2026-07-discovery-to-delivery-handoff.md` as the conditional handoff packet for implementers. It defines the delivery work order, final gate blockers, and baseline verification commands. It does not authorize a seamless-integration or implementation-pass claim.

Use `.aiwg/reports/fortemi-v2026-07-artifact-index.md` as the navigation index for the full planning package.

## 1. Plan and implement HotM enterprise UX update for hosted/backoffice demo

**Filed:** `Fortemi/HotM#243`

**Labels:** `hotm-ux`, `sdlc/checkpoint`, `phase/enterprise`, `planning`

### Problem

The current UX design set predates the latest streaming/security work and does not describe how HotM will demonstrate hosted auth, realtime state, premium components, or backoffice tooling.

### Acceptance Criteria

- Adopt `.aiwg/planning/hotm-ux-enterprise-update-plan-2026-07.md` or a repo-local equivalent.
- Define the demo persona, target, priority, claim boundary, HUX-REQ-010 live CI caveat handling, and private registry posture through OP-2026-07-001 through OP-2026-07-006 before treating the fixture-backed demo script as final.
- Choose target API version once `Fortemi/fortemi#1018` defines the compatibility contract.
- Identify which surfaces are production-backed versus flagged preview.
- Add test/QA checklist for the demo path.

## 2. Add Fortemi API compatibility guard

**Filed:** `Fortemi/HotM#244`

**Labels:** `api`, `delivery`, `hotm-ux`, `security`

### Problem

HotM can break silently when Fortemi API contracts shift. Enterprise demos need a visible compatibility and degraded-mode story.

### Acceptance Criteria

- HotM queries Fortemi version/capability metadata before enabling advanced flows.
- UI distinguishes local sidecar, single-tenant, hosted multi-tenant, and unavailable modes.
- Unsupported features are disabled with a clear reason.
- Contract tests cover at least compatible, too-old, and unreachable API states.

### Checkpoint Artifact

- `.aiwg/architecture/fortemi-compatibility-consumption-2026-07.md` defines HotM normalization, enablement, fixture, and test rules for the Fortemi compatibility response.

## 3. Pin sidecar artifact provenance for demo builds

**Filed:** `Fortemi/HotM#245`

**Labels:** `delivery`, `supply-chain`, `sdlc/checkpoint`

### Problem

Using a floating sidecar artifact can make a previously working HotM demo fail when upstream changes.

### Acceptance Criteria

- Demo/release builds pin the Fortemi sidecar by upstream commit and checksum.
- Build docs explain how to update the pinned sidecar.
- CI fails if checksum verification is absent or mismatched.

### Checkpoint Artifact

- `release/sidecar-provenance.json` pins the current Fortemi sidecar assets to upstream commit `5b389cb86e4e8d8a610955d2e68f7f3e0a5de371` and SHA-256 values.
- `scripts/download-pinned-sidecar.sh` downloads, verifies, and writes sidecar provenance receipts.
- `.aiwg/supply-chain/sidecar-provenance-gate-2026-07.md` documents the gate, update procedure, and remaining signature-verification caveat.

## 4. Design realtime activity drawer

**Filed:** `Fortemi/HotM#246`

**Labels:** `ux`, `realtime`, `streaming`

### Problem

Recent streaming/realtime support needs a user-visible status model in HotM for jobs, sync, MCP activity, and retries.

### Acceptance Criteria

- Design describes event types, empty states, error states, retry states, and accessibility behavior.
- Implementation is feature-flagged until backend contracts are stable.
- No secret, token, or tenant-sensitive values appear in UI logs or telemetry.

## 5. Design hosted auth onboarding states for enterprise demo

**Filed:** `Fortemi/HotM#247`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

HotM needs a hosted-auth onboarding surface that separates local mode, hosted sign-in, tenant context, insufficient role, and auth failure states.

### Acceptance Criteria

- UI state model covers unauthenticated, authenticating, authenticated tenant admin, authenticated insufficient role, tenant-context missing, auth failure, and local mode.
- Enterprise controls remain disabled unless role/scope and capability state allow them.
- Local/private workflows remain available when hosted auth is unavailable.
- Tests use fixtures from `.aiwg/testing/enterprise-demo-test-plan-2026-07.md`.
- No credentials, bearer tokens, tenant secrets, or sensitive auth diagnostics appear in rendered UI or telemetry fixtures.

## 6. Design premium components catalog states for enterprise demo

**Filed:** `Fortemi/HotM#248`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

HotM needs a premium components catalog that makes premium capability availability visible without leaking private implementation, license, or configuration details.

### Acceptance Criteria

- Catalog supports available, unavailable, license-required, admin-required, preview-only, and unknown states.
- Unknown capability state disables related controls by default.
- Catalog displays coarse capability status only.
- Tests cover every catalog state from `.aiwg/testing/enterprise-demo-test-plan-2026-07.md`.
- Backend contract absence links to or references `Fortemi/fortemi#1020`.

## 7. Design backoffice console preview states for tenant-admin demo

**Filed:** `Fortemi/HotM#249`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

HotM needs a tenant-admin backoffice console preview for tenant health, audit posture, quota status, KMS status, and support diagnostics while production actions remain disabled until backend gates close.

### Acceptance Criteria

- Console contains capability-gated panels for tenant health, audit posture, quota status, KMS status, and support diagnostics.
- Each panel supports enabled, disabled, degraded, preview-only, and unavailable states.
- Production-affecting actions remain disabled unless capability, role, backend contract, and audit requirements are satisfied.
- Disabled actions include reason text and backend blocker references.
- UI does not expose sensitive tenant, KMS, license, or support diagnostic values.

## 8. Add enterprise demo fixture suite, redaction checks, and runbook

**Filed:** `Fortemi/HotM#250`

**Labels:** `hotm-ux`, `phase/enterprise`, `scope: ui`, `type: feature`

### Problem

The enterprise demo needs fixture-backed tests and a reproducible manual runbook so backend blockers produce explicit UI states instead of ambiguous failures.

### Acceptance Criteria

- Add fixtures for local sidecar, single-tenant, hosted admin, insufficient-role, incompatible-version, unknown-capabilities, unreachable API, and preview-only backoffice states.
- Add redaction checks for tokens, tenant secrets, raw license material, and sensitive KMS identifiers.
- Add a demo runbook covering HUX-DEMO-001 through HUX-DEMO-005.
- Test output identifies backend blockers explicitly.
- Local sidecar workflows remain usable in fixtures where enterprise metadata is unavailable.

## 9. Track manifest endpoint rate-limit launch proof

**Filed:** `Fortemi/HotM#251`

**Labels:** `security`, `phase: mobile-expansion`, `scope: cross-cutting`, `type: chore`

### Problem

The manifest endpoint is unauthenticated and is the first network call for mobile/cloud clients. `HotM/.aiwg/architecture/manifest-schema-v1.md` still treats the 60 requests/minute per-IP token bucket as a provisional value and explicitly says the number must be tightened before public launch based on observed traffic.

This is not a blocker for the current fixture-backed enterprise demo, but it is a hosted/mobile launch-readiness loose end before the manifest endpoint can support production readiness claims.

### Acceptance Criteria

- Replace or justify the provisional 60 requests/minute launch value with an explicit baseline and burst policy.
- Define the enforcement layer for `GET /v1/manifest`, including whether limits are per-IP only or combined with tenant/session controls after authentication.
- Add or link test evidence for HTTP `429 Too Many Requests`, `Retry-After`, cache/ETag behavior under rate limiting, and non-bypass by cache headers.
- Keep `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs` passing as local preflight evidence for the expected limiter/cache semantics; this fixture proof is not enough to close the issue without staging, gateway, hosted `matric-api`, or CI evidence from the selected enforcement layer.
- Document the telemetry window or production-observation input used to tighten the value before public launch.
- Keep the current enterprise demo claim boundary fixture-backed until hosted production, live CI, and operator signoff gates close.

## 10. Surface Fortemi streaming health and backpressure telemetry

**Filed:** `Fortemi/HotM#254`

**Labels:** `phase: fortemi-integration`, `scope: ui`, `type: feature`

### Problem

Fortemi v2026.6+ exposes `GET /api/v1/health/streaming` with chat stream, ingest, SSE/RTP, and inbound connector counters. HotM has realtime plumbing but needs a current operator-facing health surface for these metrics.

### Acceptance Criteria

- Add typed API coverage for `GET /api/v1/health/streaming`.
- Render chat counters, ingest backpressure/rate-limit state, and inbound connector lag/error summaries where present.
- Treat missing blocks as unsupported/unknown, not healthy.
- Add populated, missing, degraded, and malformed payload tests.
- Follow the roadmap dependency on shared stream/degraded-state primitives from #242 where practical.

## Issue #242 implementation checkpoint — native Fortemi chat stream

- Implemented HotM native chat stream API coverage for `POST /api/v1/chat/stream` in `ui/src/api/chat.ts`, including POST-SSE request shape, `delta`/`done`/`error` parsing, bridge-frame tolerance, and `Last-Event-ID` resume header support.
- Updated active Agent chat behavior in `ui/src/components/agent/useAgentChat.ts` so the Fortemi provider uses native `/chat/stream` and falls back to synchronous `/chat` on stream failure; proxy-backed providers remain on the existing AI SDK transport.
- Updated provider capability semantics in `ui/src/components/agent/providers.ts` so Fortemi is treated as streaming-capable.
- Added focused tests in `ui/src/api/__tests__/chat.test.ts`, `ui/src/components/agent/__tests__/useAgentChat.test.ts`, and `ui/src/components/agent/__tests__/providers.test.ts`.
- Reclassified `native_chat_stream` from `gap` to `covered`; route verifier now reports 200 routes, 36 families, 186 covered routes, 14 documented exclusions, no `gap` status, and clean diagnostics.

### Implementation Evidence

- `ui/src/api/health.ts` adds `getStreamingHealth()` for `/health/streaming`.
- `ui/src/components/admin/ApiCapabilitiesPanel.tsx` renders a `Streaming Health` card for chat, ingest, realtime events, inbound connectors, and realtime calls.
- `ui/src/api/__tests__/health.test.ts` covers populated, missing, and malformed streaming-health blocks.
- `ui/src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx` covers populated, missing/malformed, and unavailable streaming-health endpoint states.
- Local validation: `npm run test -- src/api/__tests__/health.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`; `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh`.

## 11. Support Fortemi NDJSON stream ingest and ingest tokens

**Filed:** `Fortemi/HotM#255`

**Labels:** `phase: fortemi-integration`, `scope: cross-cutting`, `type: feature`

### Problem

Fortemi added `POST /api/v1/ingest/stream`, `POST /api/v1/ingest/tokens`, and `DELETE /api/v1/ingest/tokens/{token_id}`. HotM has no typed client or UX/agent path for tokenized resumable NDJSON ingest.

### Acceptance Criteria

- Add typed API/client support for minting and revoking ingest tokens.
- Add POST-SSE/ReadableStream parsing for `ack`, `progress`, `done`, and `error`.
- Surface 401, 410, and 429 states with actionable UX.
- Decide whether first UX is Admin import, agent bulk-ingest tool, or both.
- Land after or with shared stream transport from #242; expose the first UX in Backup before enabling an agent ingest tool in #258.

## 12. Add incoming webhook receiver and inbound source controls

**Filed:** `Fortemi/HotM#256`

**Labels:** `phase: fortemi-integration`, `scope: ui`, `type: feature`

### Problem

HotM Admin covers outbound webhooks, but Fortemi now exposes incoming receiver lifecycle/validation and opt-in inbound event-source connectors.

### Acceptance Criteria

- Add incoming receiver list/create/get/patch/delete and payload validation coverage.
- Clearly distinguish outbound webhooks from incoming receivers.
- Add inbound source list/create/delete coverage.
- Render disabled/cost-gated connector states and redact secrets.
- Provide a diagnostics-only boundary that #258 can reuse for agent summaries without enabling unsafe create/delete tool actions by default.

### Implementation Evidence

- `ui/src/api/webhooks.ts` adds incoming receiver list/create/get/update/delete/validate and inbound source list/create/delete methods.
- `ui/src/components/admin/WebhooksPanel.tsx` adds separate `Incoming Receivers` and `Inbound Sources` metadata-only Admin sections next to outbound webhooks.
- Incoming receiver UI renders id, lengths, signature class, secret-set state, activity state, and schema class/length only; it does not render raw slug, provider, schema document, or HMAC secret values after submission.
- Inbound source UI renders id, name/kind lengths, config class/length/key count, enabled state, and config-sensitive flag only; it does not render raw source names, kinds, URLs, headers, credentials, or connector config.
- Local validation: `npm run test -- src/api/__tests__/webhooks.test.ts src/components/admin/__tests__/WebhooksPanel.test.tsx --run`; `npm run typecheck`; `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh`.

## Issue #255 implementation checkpoint — streaming ingest tokens and NDJSON stream

- Implemented HotM typed ingest API coverage for token mint/revoke plus `POST /api/v1/ingest/stream` SSE parsing in `ui/src/api/ingest.ts`.
- Added Backup > Stream NDJSON Import UI with rate-limit input, progress counters, summary metadata, token revocation, and no-secret-render behavior in `ui/src/components/backup/BackupManager.tsx`.
- Added parser/client tests in `ui/src/api/__tests__/ingest.test.ts` and Backup UI tests in `ui/src/components/backup/__tests__/BackupManager.test.tsx`.
- Reclassified `streaming_ingest` from `gap` to `covered`; route verifier now reports 200 routes, 36 families, 186 covered routes, 14 documented exclusions, no `gap` status, and clean diagnostics.

## 13. Complete backup, attachment, and portable shard parity

**Filed:** `Fortemi/HotM#257`

**Labels:** `phase: fortemi-integration`, `scope: cross-cutting`, `type: feature`

### Problem

HotM has backup and TUS support, but the current server route family and portable attachment-shard boundary need explicit parity tests and UX wording.

### Acceptance Criteria

- Add/refresh tests for all current TUS verbs and offset/checksum/termination/resume errors.
- Extend or document exclusions for database download, memory download, knowledge archive download/upload, and metadata update.
- Ensure UI copy does not overstate portable byte-sidecar support; server import currently does not restore attachment records or bytes.
- Keep backup/archive diagnostics available for #258 only after parity and sidecar limitation wording are tested.

### Implementation Evidence

- `ui/src/api/backup.ts` and `ui/src/components/backup/BackupManager.tsx` cover legacy backup, knowledge shard import/upload, database download/snapshot/upload/restore, memory download, archive download/upload, list/detail/swap, metadata get/update, route-group UX controls, and portable sidecar limitation copy.
- `ui/src/services/tusUploader.ts`, `ui/src/services/uploadStore.ts`, and `ui/src/components/JobQueueMonitor.tsx` cover TUS creation metadata, `media_optimize` query handling, OPTIONS discovery, HEAD resume headers, PATCH required headers/offset, DELETE termination, GET finalization, termination aborts, offset mismatch, chunk-too-large, expired/not-found recovery, and no checksum-extension claim.
- Local validation: `npm run test -- src/api/__tests__/backup.test.ts src/components/backup/__tests__/BackupManager.test.tsx src/services/__tests__/tusUploader.test.ts src/services/__tests__/uploadStore.test.ts src/components/__tests__/JobQueueMonitor.test.tsx --run`; `npm run typecheck`; `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh`.

## 14. Refresh HotM agent tools for current Fortemi server capabilities

**Filed:** `Fortemi/HotM#258`

**Labels:** `phase: fortemi-integration`, `scope: cross-cutting`, `type: feature`

### Problem

The embedded agent tool set covers a selective Fortemi surface. Current server capabilities need either tool coverage or explicit exclusion so the assistant does not imply unavailable operations.

### Acceptance Criteria

- Create a tool coverage matrix mapping agent tools to Fortemi endpoint families.
- Reconcile HotM's curated registry with Fortemi's MCP surface so every MCP capability area is implemented, UI-only, diagnostic-only, dependency-deferred, or explicitly excluded.
- Add capability discovery/gating for tool enablement.
- Decide which new operations become tools: ingest, inference provider status/test, backup/archive, incoming/inbound diagnostics, vision/audio, and call diagnostics.
- Consume completed API/client primitives from #242, #255, #256, and #257 before claiming tool coverage.

### Planning Artifact

- `.aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md` records the current 12-tool registry, candidate tool dispositions, explicit non-tool boundaries, and #258 closeout checklist.
- `.aiwg/reports/fortemi-v2026-07-mcp-tool-surface-audit.md` records the Fortemi MCP 43-core-tool / 205-full-tool comparison and the non-mirror decision for HotM's embedded assistant.

## 15. Decide and implement vision, audio, and realtime call surface coverage

**Filed:** `Fortemi/HotM#259`

**Labels:** `phase: fortemi-integration`, `scope: ui`, `type: feature`

### Problem

Fortemi exposes `POST /api/v1/vision/describe`, `POST /api/v1/audio/transcribe`, `GET /api/v1/calls/{id}`, and Twilio realtime WS diagnostics. HotM needs to implement or explicitly exclude these surfaces before claiming complete current-server integration.

### Acceptance Criteria

- Decide whether vision/audio belong in capture UX, attachment preview UX, agent tools, or documented exclusions.
- Decide whether call sessions/Twilio realtime diagnostics belong in Admin, realtime debug, media UX, or documented exclusions.
- For included surfaces, add typed API coverage, UI/tool integration, and tests.
- Preserve the landed typed clients for `/vision/describe`, `/audio/transcribe`, and `/calls/{id}` while completing UI/tool integration or documented exclusions.
- Reclassify the affected route families from `partial` to covered or documented exclusion in the route inventory after the final #259 decision lands.
- Use `.aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md` as the proposed disposition: vision and audio as attachment actions first, call detail as Admin/Realtime Debug diagnostics, Twilio realtime as documented exclusion unless an operator diagnostics slice accepts it.
- Use generated `route_level_overrides` in `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json` as planning metadata for mixed dispositions; typed API tests are implementation evidence for the partial client layer only, not for final UX coverage or Twilio exclusion.
