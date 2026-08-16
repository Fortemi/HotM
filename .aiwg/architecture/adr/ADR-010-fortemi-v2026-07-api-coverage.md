---
title: "ADR-010: Fortemi v2026.7.1 API Coverage Strategy"
status: accepted
date: 2026-07-14
artifact_type: adr
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/architecture/impact/fortemi-api-contract-drift-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
  - .aiwg/reports/fortemi-hotm-integration-audit-2026-08-15.md
---

# ADR-010: Fortemi v2026.7.1 API Coverage Strategy

## Context

HotM previously integrated the Fortemi v2026.5.x surface. Fortemi now ships v2026.7.1, with major additions in streaming chat, streaming ingest, incoming webhook receivers, inbound event-source connectors, TUS uploads, upgrade safety, and Intel/vLLM deployment support. HotM also has an existing compatibility guard path and enterprise capability-gated UX plan.

The current HotM API client is broad but not exhaustive. A seamless integration target requires a formal coverage model: each server capability must be implemented in UI/API client/agent tooling, or explicitly excluded with rationale and a tracker item.

The current route inventory generated from Fortemi source commit `48bc0a0b` extracts 202
Fortemi route declarations and classifies them as 188 covered, 0 partial, 0 gap,
0 decision-needed, and 14 documented exclusions. The added `/livez` and `/readyz` probes are
classified under health, while the operator OpenAPI and AsyncAPI paths replace the removed root
document paths under `contract_docs`. That classification establishes route disposition, not
request/response, event, portable-data, compatibility-negotiation, or authentication conformance.

The route-family proof checklist for moving those classifications to implementation evidence is maintained in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.

### 2026-08-15 Audit Amendment

The route count remains useful for discovery and disposition, but the current
classifier can derive `covered` from route prefixes and source-file existence.
That cannot support an operation-level integration claim. #290 therefore owns
a method/path/operation-ID evidence model with independent request, response,
auth/context, UI, agent, and live-receipt states. #287 owns the resulting
umbrella-interface gaps.

The audit also identifies independent blockers that route coverage cannot
retire: runtime compatibility admission (#286), authenticated realtime context
(#285), per-event AsyncAPI payload validation (#288), agent runtime privilege
and auth enforcement (#123 and #231), current Knowledge Shard revision-21
consumption (#292), and a reliable browser gate (#291). Existing July receipts
remain historical evidence only at their exact pins and named profiles.

## Decision

HotM will adopt a three-tier Fortemi API coverage model:

1. **Primary UX coverage** for user/operator workflows that require direct controls: native streaming chat, streaming health, ingest tokens/stream, incoming receivers, inbound sources, backup/archive, attachments/TUS, inference config, compatibility, notes/search/archive/job surfaces.
2. **Agent/tool coverage** for server capabilities best used through the embedded assistant: search, note creation, retrieval, linking, attachments, archive selection, and future ingest/inference operations.
3. **Documented exclusion** for capabilities that are server-only, deployment-only, or not currently user-facing. Exclusions must have a reason, compatibility behavior, and issue reference.

HotM will not use the local `docs/openapi.json` as the sole source of truth until it is normalized into a canonical OpenAPI object or replaced by upstream `/api/v1/operator/openapi.yaml` generation. Until then, route-source extraction from Fortemi plus focused contract tests is the control.

HotM will maintain independent release gates for:

1. route inventory and product disposition;
2. canonical OpenAPI schema and HTTP semantics;
3. canonical AsyncAPI event envelope and SSE/WS payload semantics;
4. Knowledge Shard schema/profile negotiation and lossless golden round trips;
5. compatibility contract revision, server API revision, and minimum-client enforcement; and
6. versioned cross-language auth claim fixtures.

A green route-inventory gate cannot satisfy any of gates 2-6. User-facing support and portability claims require the gate relevant to that claim.

## Consequences

### Positive

- Fortemi API drift becomes visible before release.
- Enterprise and local UX claims can be tied to endpoint/capability evidence.
- New streaming and ingest surfaces can share parser and degraded-state patterns.
- Agent tools gain a clearer capability boundary.

### Negative

- More CI/test maintenance is required when Fortemi changes route declarations.
- Some server endpoints will remain intentionally non-UI until a product decision is made.
- Generated OpenAPI parity remains a dependency if the team wants schema-level request/response diffing instead of route-level drift checks.
- Release verification becomes multi-axis; a route may be classified `covered` while its schema or semantic gate remains blocked.

## Implementation Notes

- Reuse the existing capability guard for unknown, preview, degraded, and unavailable states.
- Prefer feature-gated Admin panels for operational controls.
- Build POST-SSE parsing once and share it between `/chat/stream`, `/inference/stream`, and `/ingest/stream` where event framing allows.
- Keep local sidecar workflows usable when advanced server capabilities are unavailable.
- Update the capability surface matrix whenever a route family changes coverage tier, UX disposition, or proof requirement.
- Use ADR-011 for the proposed vision/audio/call/Twilio route dispositions until #259 lands implementation or exclusion evidence.
- Consume Fortemi-owned OpenAPI, AsyncAPI, Knowledge Shard, and compatibility artifacts by pinned revision; HotM does not redefine producer semantics locally.
- Treat `fortemi-auth` as a normative specification boundary until Rust workspace, CI, release, and shared downstream fixture evidence exist.

### Supported-Platform Consumer Adherence Gate (HotM #284)

The suite proof treats HotM strictly as a consumer. Fortemi owns and enforces the
OpenAPI, AsyncAPI, authentication, persistence, and Knowledge Shard
`2.0.0/full-v1` authority. `@fortemi/core` consumes that authority and enforces
the browser-side portable-data boundary. HotM must call those APIs through its
production client and must not redefine producer schemas or substitute a
HotM-specific persistence format.

The automated suite matrix in the Fortemi authority repository pins the exact
schema authority, runtime, immutable native sidecar assets, React/core package,
and HotM consumer revisions. For HotM `2026.7.1`, the release inputs are
Fortemi runtime `5ea08229c9f1565122df5f8e6906e89d98dc7e75`
(`v2026.7.19`), React/core
`5cab4ea2d3d4bb985ea0d38f8bcb1ea790b32cf7`
(`@fortemi/core@2026.7.15`), and immutable sidecar
`sidecar-5ea08229c9f1`. The authority-owned matrix adds the exact HotM release
commit and emits the platform and aggregate receipts. These are receipt
identities, not consumer-defined authority.

For each required platform, Linux x86_64 on `matric-builder`, native Linux
arm64 in mutsu's Colima VM, and native macOS arm64 on `mutsu`, the HotM gate
runs authenticated HTTP lifecycle operations, browser TUS upload/download,
headless Tauri commands, signed `full-v1` export, required-signature dry-run,
and mutating import through `createBackupApi`. The recovery memory is exported
before import and must contain zero records and no blobs. Child evidence files
are independently hashed and checked by both the HotM receipt verifier and the
suite aggregate.

Windows is the only deferred operating system because no Windows execution
authority is available. [Fortemi #1096](https://git.integrolabs.net/Fortemi/fortemi/issues/1096)
owns native Windows validation as a separate deferred story. Passing the three
required cells does not establish universal platform portability, complete
backup of all product state, a launched desktop GUI/native-dialog claim, or a
shared schema across the AIWG static index, Knowledge Shard, and Fortemi
persistence planes.

### Realtime Contract Receipt (HotM #268)

The realtime consumer gate is implemented against the delivered sidecar-pinned Fortemi commit
`5ea08229c9f1565122df5f8e6906e89d98dc7e75`. The source-derived catalog at
`ui/src/api/contracts/fortemi-event-catalog.json` records all 48 names returned by
`ServerEvent::namespaced_event_type` and the SHA-256 of
`crates/matric-core/src/events.rs`. The CI verifier rejects revision, checksum, or
catalog drift. The event and AsyncAPI source bytes are unchanged from the earlier
`98c9b29deee43b9c5bd96278f1f96837595882cd` receipt; the repin aligns this
consumer fixture with `release/sidecar-provenance.json`.

The same fixture records the generated AsyncAPI 3.0 YAML receipt. At the pinned
commit, `build_asyncapi_spec("2026.7.1", "https://example.invalid")` produces
45,161 bytes with SHA-256
`f6a6fbc39af52b713b6f5c40dbb6e46baeb8a1b352a19288e79073863766bdf4`;
the generator source SHA-256 is pinned alongside it.

Both SSE and WebSocket inputs pass through the same canonical envelope unwrapping
and exact-name normalization boundary. Unknown or missing event names remain
`Unknown`; they are not converted to queue status. This receipt proves the pinned
catalog, envelope fields, and HotM consumer behavior. It does not replace broader
producer AsyncAPI schema-diff coverage.

### Knowledge Shard Consumer Receipt (HotM #269)

HotM consumes the Fortemi `core-v1` authority at producer commit
`48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`, contract revision 19. The
machine receipt pins exact producer fixtures for schemas `1.0.0`, `1.1.0`, and
`1.2.0`; the current vendored manifest SHA-256 is
`246b89d6ca1d2e2c4a19b650e4cebe7825b69d39306280e281f4a94c80c2b008`.
The client sends only the producer-owned `include` query, reads `manifest.json`
from the gzip/TAR archive, and rejects unsupported format, profile,
unregistered schema, minimum-reader, components, counts, and checksum
declarations before upload.

The visible HotM -> clean-server and repeated-import receipt establishes
semantic equality for the selected `core-v1` profile. The version gate now
retains the registered historical window and consumes current schema 1.2. This
does not establish attachment-byte recovery or `full-v1`/`record-v1`
conformance.

### Full-v1 Recovery Consumer Receipt (HotM #272)

HotM additionally consumes the exact `2.0.0/full-v1` tuple at Fortemi authority
commit `48bc0a0bd68fd9e4eeb742c5af8a54207cbcc425`, contract revision 21,
contract SHA-256
`ac417e23181ec80741d776b6b29fa38236091dfa649b01255aaac30ebb53969f`.
The machine receipt pins the receipt-bound opt-in advertisement, 33 component
identifiers, 34 count fields, schema bundle, 220-field presence inventory,
runtime receipt, and paired cross-repository receipt.

The export path requests `schema_version=2.0.0`, `profile=full-v1`, and
`include_blobs=true`, then pipes `Response.body` directly to an
operator-selected writable stream. The browser does not construct a complete
archive `Blob`. Import locally validates the exact tuple, bounded gzip/TAR
structure, complete component/count/checksum inventory, and resource limits.
It then requires a Fortemi `dry_run=true&verify_signature=require` response
before sending `dry_run=false`. Signature, component/blob digest, byte length,
reference, presence-state, and database/blob mutation checks remain at the
Fortemi authority boundary.

The live recovery cell now passes against immutable Fortemi sidecar
`sidecar-336df3ed834b` at commit
`336df3ed834be581d1a0f0a3d252fb48e723b987`. The released HotM consumer
accepted the signed 7,086-byte archive through its bounded streaming
inspector. A public-key-only clean Fortemi destination passed explicit
required-signature dry-run before two mutating imports, then re-exported all
33 component files, 34 count fields, and the attachment sidecar byte-for-byte.
Manifest, component, signature, attachment, missing, oversized, unsupported,
and skewed inputs all returned 400 without changing the destination.

This establishes `fullV1Interoperability=true` only for the named exact
React-fixture -> immutable Fortemi producer -> released HotM pass-through ->
clean Fortemi destination cell. `suiteWide` and `completeBackup` remain false,
and `record-v1` remains unsupported. The historical unsigned preflight receipt
is retained separately from the passing receipt.

The producer advertises only exact `2.0.0/full-v1`; `2.0.0/core-v1` and
`2.0.0/record-v1` are explicitly unadvertised. The consumer verifier fails
closed on any unknown revision, advertisement/evidence drift, or broadened
suite-wide, complete-backup, or parity claim.

### Compatibility Admission Receipt (HotM #244/#286)

`ui/src/api/systemCompatibility.ts` accepts only schema `1` and contract
revision `2026-07-06`. It compares Fortemi's
`minimum_hotm_enterprise_client` with the exact version from
`ui/package.json` before capability normalization and admits only Fortemi API
versions `>=2026.7.0 <2027.0.0` using SemVer 2 precedence. Unsupported schemas,
unknown revisions, malformed values, client-too-old, server-too-old/new,
unavailable, and unsupported auth-contract responses throw typed errors.

The UI starts a non-blocking preflight and gates all shared-client plus direct
multipart/stream/root-OAuth mutations before dispatch. The legacy wrapper and
agent-proxy use the same policy. Focused tests cover correct numeric prerelease
ordering, all typed block states, cached decisions, zero-dispatch denial, and
local/read-only continuity.

The duplicated consumer receipts pin Fortemi commit `48bc0a0b`,
`contracts/suite-conformance/platform-matrix.json`, and the response source;
`.aiwg/testing/scripts/verify-fortemi-system-compatibility-contract.mjs`
verifies both copies and producer checksums in CI. Authenticated mode requires
claim-contract version `1`; the current producer omits it and therefore fails
closed. This receipt is not OpenAPI, AsyncAPI, Knowledge Shard, or
`fortemi-auth` parity evidence.

### OpenAPI Consumer Receipt (HotM #270)

HotM consumes the Fortemi-generated OpenAPI 3.1 artifact at producer commit
`5ea08229c9f1565122df5f8e6906e89d98dc7e75`, stable path
`contracts/openapi/openapi.yaml`, and SHA-256
`9d2d5ea05f21a71d416d713a5cadd2c4f76086a3494105280d50ec328c4056fd`.
The `hotm-openapi-v1` semantic projection has SHA-256
`6e84af14c4f0aebb885123b19dfa639ddfda5e73ef08d0ebbb9ca7ca8db9e633`
and compares parameters, request bodies, responses/statuses, component schemas,
nullability, enums, error metadata, and security requirements.

The gate accepts contract revision `1`, exercises current-minus-one `2026.2.8`,
current `2026.2.9`, and a rejected breaking `2027.0.0` fixture, and emits a CI
receipt containing exact producer and consumer commits. The delivered call
response schema exposed and corrected a real consumer mismatch: call transcript
segments now use producer fields `id`, `call_id`, `text`, `sequence`,
`created_at`, `speaker_label`, `start_ts`, `end_ts`, and `confidence`.

The producer artifact has 193 paths and 251 operations. All 251 operations now
carry the global middleware's schema-bearing `429 application/problem+json`
boundary, producing 255 schema-bearing responses across 559 response entries.
The gate requires that shared boundary on every operation and preserves the six
producer-declared typed success schemas. This does not claim typed success
payloads where Fortemi has not declared them.

### Decision Amendment: Executable Operation Evidence

The route-family disposition decision is amended by #290. The normative
coverage record is now generated from the pinned OpenAPI artifact plus
`.aiwg/testing/data/fortemi-operation-conformance-v2026-07.json`. Evidence is
keyed by method, path, and operation ID; mixed dispositions within a route
family are allowed. An operation is `integrated` only when every applicable
request, response, auth/context, UI, agent, and live dimension is conformant.
Missing evidence is reported as `partial` or `gap`, never inferred from a path
prefix or source-file match.

The current generated result is 1 integrated, 249 partial, and 1 gap operation
with zero pin, boundary, evidence-path, or unclassified-operation diagnostics.
Route inventory, OpenAPI, AsyncAPI, Knowledge Shard, compatibility, and auth
remain independent release gates. The schema-derived AsyncAPI transport receipt
does not close #288 because no producer-owned event example corpus exists at the
pinned Fortemi revision. The desktop/mobile mocked Playwright gate introduced by
#291 is likewise UI evidence, not live or auth/context evidence.

### Decision Amendment: Authenticated Runtime and Product Disposition

HotM will enforce compatibility and authentication before agent-proxy request
parsing, bind privilege sessions to authenticated tenant/principal/memory
identity, and forward only that admitted bearer and memory context. Required
auth with a missing or unsupported claim-contract revision is denied; an
advertised local `anonymous_local` profile remains usable.

Scoped realtime uses header-capable fetch SSE with `Last-Event-ID` replay and
consumer-side tenant/memory rejection. Legacy WebSocket is not a scoped
fallback until Fortemi #953 supplies auth and canonical envelope context.

The product-disposition control is
`ui/src/api/contracts/fortemi-operation-dispositions.json`, generated and
verified from the #290 operation matrix. Every pinned operation has an explicit
privilege and one of UI workflow, agent workflow, operator diagnostic, or
documented exclusion. This control never upgrades conformance. Historical
explicit-link POST/DELETE claims are removed. The #294 decision is to consume
no replacement mutation: neither the pinned OpenAPI nor current Fortemi
authority defines one. Read-only `get_note_links` remains distinct from
server-owned semantic/wiki-link maintenance. A future user-authored link
operation requires a new pinned Fortemi contract and a coordinated ADR
amendment; historical route shape is not authority.

### Decision Amendment: Verifiable Umbrella Workflows (2026-08-16)

Accept #295's 60 core entries and #296's 76 operator entries as exact pinned
workflow promotions. Their 18 overlaps produce 118 unique operations. Support
is admitted only when the generated ledger matches method, path, and operation
ID and the runtime compatibility gate accepts the server contract. Response
handling must be bounded and typed or redacted; malformed and oversized
payloads fail closed. Every mutation requires an explicit confirmation in its
rendered workflow.

Before the #297 disposition amendment, the generated conformance result was 1
integrated, 249 partial, and 1 gap.
This count records stronger executable request/response/UI evidence; it does
not upgrade operation-specific auth, agent, or live dimensions. Restricted
secret/key and binary/Knowledge Shard transfer operations remain unpromoted
under #297. Route disposition, matching family names, and mocked browser
receipts remain insufficient to claim full Fortemi conformance.

### Decision Amendment: Sensitive Operations (2026-08-16)

Accept the generated #297 decision ledger as the product boundary for its
exact 41 rows. Five TUS operations are typed UI workflows using
`tus-js-client` and direct browser/Tauri byte transport; five authenticated
attachment/media reads are external browser/native protocol handoffs; and 31
credential, PKE, legacy attachment, and underspecified backup operations are
disabled documented exclusions.

The 31 exclusions cannot be enabled by route inventory, implementation
presence, response prose, or a mocked browser receipt. Promotion requires
producer-owned request, response, and auth artifacts at the pinned revision
and focused consumer verification. OAuth remains excluded while
`fortemi-auth` is specification-only. PKE remains excluded while success
schemas and private-key custody/redaction receipts are absent. Backup and
legacy attachment upload remain excluded where binary media types, headers, or
request/success schemas are absent.

All remote attachment uploads use TUS; uncontracted multipart and large
base64-in-JSON paths are disabled. Transfer failures expose only bounded
categories. Credential material, upload URLs, tenant IDs, local paths, and raw
binary never enter generic agent inputs, logs, telemetry, screenshots, or
generic errors. This decision records 31 explicit exclusions rather than
promoting them: after the #298 reconciliation, the current operation result is
1 integrated, 219 partial, no gaps, and 31 documented exclusions.

## Agent Evidence Reconciliation (2026-08-16)

#298 corrects the curated related-notes tool from the unpinned `/similar`
route to the producer-owned `GET /api/v1/notes/{id}/related` operation and
binds every declared tool endpoint to the pinned operation ledger. Twelve
exact operations now have conformant local agent-dispatch and privilege
evidence. Ten remain assigned to the agent product surface; `list_archives`
and `get_note_tags` retain their UI product disposition while independently
recording agent evidence.

`create_job` moves from `gap` to `partial`: its typed serializer/decoder and
the constrained `revise_note` workflow are verified, but the producer's `201`
response is not schema-bearing and no arbitrary-job UI, operation-specific
authorization receipt, or exact-operation live receipt exists. The generated
result is therefore 1 integrated, 219 partial, 0 gaps, and 31 documented
exclusions. All 251 live dimensions remain gaps; the authenticated asset
workflow run is not reclassified as operation-bound evidence.
