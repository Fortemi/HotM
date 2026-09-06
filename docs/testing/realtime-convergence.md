# Realtime Convergence Test Suite

This suite verifies that HotM converges correctly when realtime events are initiated by another client, process, or agent.

## Run Locally

```bash
cd ui
npm run test:realtime
```

## Covered Areas

- Event normalization and routing buckets
- Duplicate suppression (`event_id`) and burst coalescing
- HallOfMind non-initiator convergence (`NoteCreated`, `NoteUpdated`, `NoteDeleted`)
- Attachments panel reactive refresh behavior
- SSE replay cursor reconnect path (`last_event_id`)
- Auth-required classification for reachable Fortemi sessions whose notes or
  SSE requests return `401` or `403`
- Legacy WebSocket `410 Gone` classification as transport incompatibility,
  not a Fortemi outage

## Status Guidance

`Offline Mode` is reserved for health-check or transport reachability failure.
When health is reachable but notes or realtime events are unauthorized, HotM
must show `Auth Required` and keep note mutations disabled until the session has
valid Fortemi authorization. A legacy `/api/v1/ws` `410 Gone` response means the
old anonymous-local WebSocket receive path is incompatible; it should not be
reported as an outage when SSE or health proves Fortemi is reachable.

## CI

The realtime suite is executed in the `quality-gate` job (`.gitea/workflows/ui-ci.yml`) as a dedicated step.

## Flaky Timing Troubleshooting

- Use fake timers (`vi.useFakeTimers`) for reconnection/coalescing logic.
- Keep bounded windows deterministic (`advanceTimersByTime` with explicit durations).
- Prefer fixture-driven event arrays over open-ended async streams.
- Avoid assertions that depend on wall-clock ordering; assert on normalized event identity and final state.
