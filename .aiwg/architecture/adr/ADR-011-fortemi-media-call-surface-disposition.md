---
title: "ADR-011: Fortemi Media and Realtime Call Surface Disposition"
status: accepted
date: 2026-07-14
artifact_type: adr
related_artifacts:
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/design/fortemi-v2026-07-ux-integration-addendum.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/reports/fortemi-v2026-07-coverage-evidence-audit.md
---

# ADR-011: Fortemi Media and Realtime Call Surface Disposition

## Context

The Fortemi v2026.7.1 route inventory originally left four media/call routes in `decision_needed` state. The accepted disposition now has attachment-safe vision/audio coverage, redacted Admin REST call diagnostics, and a documented exclusion for Twilio realtime WebSocket diagnostics:

| Route | Family | Current status | Current tracker |
| --- | --- | --- | --- |
| `POST /api/v1/vision/describe` | vision_tools | covered | #259 |
| `POST /api/v1/audio/transcribe` | audio_tools | covered | #259 |
| `GET /api/v1/calls/{id}` | realtime_calls | covered | #259 |
| `GET /api/v1/realtime/twilio/{provider_call_id}` | realtime_calls | documented_exclusion | #259 |

These endpoints should not become top-level navigation simply because they exist. The decision preserves the product shape: attachments and capture remain user workflows; Admin API Surface remains the operator diagnostics area; Agent tools remain capability-gated and must not imply unsupported actions.

## Decision Criteria

| Criterion | Weight | Notes |
| --- | ---: | --- |
| User workflow fit | 0.30 | Does this belong in an existing user job rather than an endpoint browser? |
| Security/privacy posture | 0.25 | Does the surface avoid leaking media, provider call identifiers, transcripts, private URLs, tokens, or diagnostics? |
| Implementation dependency | 0.20 | Can the surface land after existing API/client primitives without blocking P0/P1 work? |
| Operational value | 0.15 | Does the surface help operators diagnose server state or user-visible failures? |
| Product complexity | 0.10 | Does the surface avoid creating a new product area prematurely? |

## Options

| Option | Summary | Pros | Cons |
| --- | --- | --- | --- |
| A | Make all four endpoints first-class user workflows. | Maximizes visible server coverage. | Overfits UI to endpoints; creates premature call/media product scope; raises privacy risk. |
| B | Implement vision/audio as attachment actions, calls as Admin/Realtime Debug diagnostics, and keep Twilio realtime WS excluded unless diagnostics require it. | Fits existing HotM surfaces; limits product complexity; preserves diagnostics path. | Still requires typed clients and tests for included surfaces; Twilio exclusion must be explicit. |
| C | Expose all four as agent tools only. | Fast conversational access; avoids new panels. | Agent may imply unsafe capability; poor fit for provider-call diagnostics; weaker auditability. |
| D | Document all four as exclusions for now. | Lowest implementation burden. | Leaves useful media capabilities inaccessible and weakens complete integration claim. |

## Scoring

Scores use 1-5 where 5 is strongest. Weighted total uses the criteria weights above.

| Option | User workflow fit | Security/privacy | Dependency | Operational value | Complexity | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 2 | 2 | 2 | 3 | 1 | 2.10 |
| B | 5 | 4 | 4 | 4 | 4 | 4.30 |
| C | 3 | 2 | 3 | 2 | 4 | 2.75 |
| D | 2 | 5 | 5 | 1 | 5 | 3.40 |

## Decision

Adopt Option B as the proposed HotM disposition:

1. `POST /api/v1/vision/describe`
   - Primary surface: Attachments preview action for image attachments.
   - Secondary surface: Agent tool only after #258 capability gating can bind the selected attachment context and role/scope.
   - Do not expose as a generic raw upload tool in the first slice.

2. `POST /api/v1/audio/transcribe`
   - Primary surface: Attachments preview action for audio/video attachments.
   - Secondary surface: Capture/import helper only if it clearly improves note creation from an existing media attachment.
   - Agent tool may summarize transcript state later, but initial mutation/transcription should remain UI-driven.

3. `GET /api/v1/calls/{id}`
   - Primary surface: Admin API Surface diagnostic detail for known call/session IDs.
   - No primary user call-session UX until HotM has a real call workflow.
   - Redact provider identifiers and avoid rendering raw transcript text or media transport internals.

4. `GET /api/v1/realtime/twilio/{provider_call_id}`
   - Initial disposition: documented exclusion from HotM product claims.
   - Revisit only if an operator diagnostics slice needs live provider stream validation.
   - If included later, keep it under Admin/Realtime Debug and require explicit provider-gated diagnostics tests.

## Consequences

### Positive

- Vision/audio features improve existing attachment workflows without adding a new top-level product area.
- Call diagnostics remain operator-facing and do not imply HotM supports active call management.
- Twilio provider-specific internals stay excluded until there is a concrete operational need.
- Agent tool exposure remains dependent on #258 capability gating rather than prompt text.

### Negative

- #259 must preserve the media/call coverage evidence and route inventory disposition while broader agent-tool work remains gated by #258.
- The vision/audio UI slice has attachment action tests, unsupported media handling, and redaction tests; agent exposure remains gated by #258.
- Twilio realtime coverage remains a documented exclusion and must be visible in traceability.

## Implementation Requirements

| Capability | Required first slice | Tests required | Inventory outcome after completion |
| --- | --- | --- | --- |
| Vision describe | Attachment preview action for supported images. | UI action test, unsupported media test, error/redaction test. | `vision_tools` is covered; preserve regression evidence. |
| Audio transcribe | Attachment preview action for audio/video. | UI progress/error test, transcript rendering/linkage test, redaction test. | `audio_tools` is covered; preserve regression evidence. |
| Call detail | Admin API Surface diagnostic detail. | Diagnostic UX test and redaction test for provider identifiers, archive IDs, speakers, and transcript text. | REST call detail is covered. |
| Twilio realtime WS | Documented exclusion unless diagnostics slice is accepted later. | Exclusion assertion: no UI/agent support claim and traceability rationale present. | Twilio realtime route is a documented exclusion inside the mixed `realtime_calls` family. |

## Follow-ups

- #259 owns preservation of implementation or explicit exclusion evidence for all four routes.
- #258 owns any later agent-tool exposure for vision/audio or call diagnostics.
- #253 now records route-level mixed dispositions so `realtime_calls` can represent `GET /api/v1/calls/{id}` as covered while Twilio remains excluded.
- `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` must be updated when #259 changes any route-family status.

## Status Handling

This ADR records the accepted disposition. Typed API client, attachment action, and Admin call-diagnostic evidence now supports covered classification for vision/audio and REST call detail, while Twilio realtime is documented as excluded.

The generated route inventory includes `route_level_overrides` that mirror the final dispositions above and the route matrix now classifies the two realtime call routes independently.
