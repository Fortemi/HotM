# ADR-001: Journal-Based Sync with LWW Merge

- Status: Accepted
- Date: 2025-08-24
- Owners: @s92501/agent-tech-lead, @s92501/agent-program-manager

## Context
We need multi-device synchronization for Stage 2 that supports offline edits, low-latency merges, and preserves immutable originals. We also require a clear security boundary for optional E2EE and usage metering for paid tiers.

## Decision
Adopt an append-only, account-scoped journal as the source of truth for synchronization with:
- Push/pull protocol using monotonic cursors per account and idempotency keys.
- Last-Writer-Wins (LWW) pointer for the current revised content, while keeping full revision history.
- Set-union for additive metadata (tags/links) with tombstones for deletes.
- Optional end-to-end encryption of content payloads (backend stores encrypted blobs; merges operate on metadata/pointers).

## Rationale
- Simplicity: replayable journal enables deterministic rebuilds and easy audit.
- Robustness: idempotent writes and monotonic cursors handle retries and partial failures.
- UX: LWW for the visible head plus preserved branches simplifies conflict UI.
- Privacy: E2EE guards content; backend only needs envelopes and minimal metadata.

## Consequences
- Requires background compaction/replay tooling.
- Tombstone management is necessary for deletes.
- Some merges may surface as user-facing conflicts requiring manual resolution.

## Alternatives Considered
- CRDT per field: higher complexity, harder to reason about for rich text and AI revisions.
- State-based snapshot sync: larger payloads, trickier conflict attribution.

## Security
- TLS for transport; short-lived tokens.
- KEK/DEK model for optional E2EE; device enrollment includes key handshake.
- Strict logging hygiene; journal entries omit secrets and avoid sensitive content when E2EE is enabled.
