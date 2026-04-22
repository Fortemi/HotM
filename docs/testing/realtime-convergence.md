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

## CI

The realtime suite is executed in the `quality-gate` job (`.gitea/workflows/ui-ci.yml`) as a dedicated step.

## Flaky Timing Troubleshooting

- Use fake timers (`vi.useFakeTimers`) for reconnection/coalescing logic.
- Keep bounded windows deterministic (`advanceTimersByTime` with explicit durations).
- Prefer fixture-driven event arrays over open-ended async streams.
- Avoid assertions that depend on wall-clock ordering; assert on normalized event identity and final state.

