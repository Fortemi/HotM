---
title: "ADR-010: Fortemi v2026.7.1 API Coverage Strategy"
status: proposed
date: 2026-07-14
artifact_type: adr
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/architecture/impact/fortemi-api-contract-drift-2026-07.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/architecture/adr/ADR-011-fortemi-media-call-surface-disposition.md
---

# ADR-010: Fortemi v2026.7.1 API Coverage Strategy

## Context

HotM previously integrated the Fortemi v2026.5.x surface. Fortemi now ships v2026.7.1, with major additions in streaming chat, streaming ingest, incoming webhook receivers, inbound event-source connectors, TUS uploads, upgrade safety, and Intel/vLLM deployment support. HotM also has an existing compatibility guard path and enterprise capability-gated UX plan.

The current HotM API client is broad but not exhaustive. A seamless integration target requires a formal coverage model: each server capability must be implemented in UI/API client/agent tooling, or explicitly excluded with rationale and a tracker item.

The route inventory generated from Fortemi commit `f6733252` extracts 200 Fortemi route declarations and currently classifies them as 186 covered, 0 partial, 0 gap, 0 decision-needed, and 14 documented exclusions. That classification establishes route disposition, not request/response, event, portable-data, compatibility-negotiation, or authentication conformance.

The route-family proof checklist for moving those classifications to implementation evidence is maintained in `.aiwg/design/fortemi-v2026-07-capability-surface-matrix.md`.

## Decision

HotM will adopt a three-tier Fortemi API coverage model:

1. **Primary UX coverage** for user/operator workflows that require direct controls: native streaming chat, streaming health, ingest tokens/stream, incoming receivers, inbound sources, backup/archive, attachments/TUS, inference config, compatibility, notes/search/archive/job surfaces.
2. **Agent/tool coverage** for server capabilities best used through the embedded assistant: search, note creation, retrieval, linking, attachments, archive selection, and future ingest/inference operations.
3. **Documented exclusion** for capabilities that are server-only, deployment-only, or not currently user-facing. Exclusions must have a reason, compatibility behavior, and issue reference.

HotM will not use the local `docs/openapi.json` as the sole source of truth until it is normalized into a canonical OpenAPI object or replaced by upstream `/openapi.yaml` generation. Until then, route-source extraction from Fortemi plus focused contract tests is the control.

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

### Realtime Contract Receipt (HotM #268)

The realtime consumer gate is implemented against the sidecar-pinned Fortemi commit
`98c9b29deee43b9c5bd96278f1f96837595882cd`. The source-derived catalog at
`ui/src/api/contracts/fortemi-event-catalog.json` records all 48 names returned by
`ServerEvent::namespaced_event_type` and the SHA-256 of
`crates/matric-core/src/events.rs`. The CI verifier rejects revision, checksum, or
catalog drift.

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
`81fbeaf065df3818edd046ed8a744f10eeb00e6f`, contract revision 19. The
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
commit `6343bd899958445bbc7e7e87b0dc92a8429d5a06`, contract revision 20,
contract SHA-256
`5bf8d2fd8147d8df92599b1a3ce6b405ce022c83893f37547aefa7ca659f0783`.
The machine receipt pins the 33 component identifiers, 34 count fields, schema
bundle, 220-field presence inventory, runtime receipt, and paired
cross-repository receipt.

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

### Compatibility Guard Receipt (HotM #244)

`ui/src/api/systemCompatibility.ts` accepts only schema `1` and contract
revision `2026-07-06`. It compares Fortemi's
`minimum_hotm_enterprise_client` with the exact version from
`ui/package.json` before capability normalization. Unsupported schemas,
unknown revisions, malformed minimum-client policies, and client-too-old
responses throw typed contract errors, preserving the existing
unavailable/degraded UI path and leaving local workflows available.

Focused fixtures cover compatible, exactly-equal minimum, checkpoint
prerelease, current-plus-one revision, client-too-old, malformed minimum, and
unsupported-schema states. Route presence and a successful HTTP response do
not bypass this boundary.

### OpenAPI Consumer Receipt (HotM #270)

HotM consumes the Fortemi-generated OpenAPI 3.1 artifact at producer commit
`ec14e0447711c45a8d5c5445ce47a35f26d4346a`, stable path
`contracts/openapi/openapi.yaml`, and SHA-256
`4d1f9655c60ed6f97f86c790cab64ea9826ac9ca61084250a3b242fd10a7e30c`.
The `hotm-openapi-v1` semantic projection has SHA-256
`52ea99780e621b2073e0fb4bd1f0166c1a343c81d548f9856b8b1bc6ca886535`
and compares parameters, request bodies, responses/statuses, component schemas,
nullability, enums, error metadata, and security requirements.

The gate accepts contract revision `1`, exercises current-minus-one `2026.2.8`,
current `2026.2.9`, and a rejected breaking `2027.0.0` fixture, and emits a CI
receipt containing exact producer and consumer commits. The delivered call
response schema exposed and corrected a real consumer mismatch: call transcript
segments now use producer fields `id`, `call_id`, `text`, `sequence`,
`created_at`, `speaker_label`, `start_ts`, `end_ts`, and `confidence`.

The producer artifact has 191 paths and 249 operations. All 249 operations now
carry the global middleware's schema-bearing `429 application/problem+json`
boundary, producing 255 schema-bearing responses across 559 response entries.
The gate requires that shared boundary on every operation and preserves the six
producer-declared typed success schemas. This does not claim typed success
payloads where Fortemi has not declared them.
