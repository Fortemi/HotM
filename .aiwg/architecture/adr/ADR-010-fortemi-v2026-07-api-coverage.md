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

HotM consumes the Fortemi `core-v1` manifest fixture from producer commit
`2eb5c6b739b3bb6a042a35050a3ae89960dd3ed4`. The vendored fixture at
`ui/src/api/contracts/fortemi-core-v1-manifest.json` matches the producer fixture
SHA-256 `4ed7e3b7d4845122653c95bcf2508a7f440cf067fe64ca493f0785519b9300f1`.
The client sends only the producer-owned `include` query, reads `manifest.json`
from the gzip/TAR archive, and rejects unsupported format, profile, schema,
minimum-reader, components, counts, and checksum declarations before upload.

This is a consumer/preflight receipt only. It does not establish clean-server
semantic equality, historical migration support, attachment-byte recovery, or
atomic `core-v1`/`full-v1` conformance; those release gates remain open in
Fortemi #1057 and HotM #269.
