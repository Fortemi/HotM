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
- Native EventSource visible-status probing so same-origin `401`/`403`/`410`
  handshakes become terminal auth/incompatibility states instead of retry churn
- Reauthentication recovery with a new bearer token and tenant-bound fetch SSE
  subscription
- Legacy WebSocket admission policy for anonymous-local, unscoped sessions only;
  opaque browser WebSocket handshake failures remain transport failures unless a
  close reason/status is actually visible

## Status Guidance

`Offline Mode` is reserved for health-check or transport reachability failure.
When health is reachable but notes or realtime events are unauthorized, HotM
must show `Auth Required` and keep note mutations disabled until the session has
valid Fortemi authorization. Fetch-based SSE can classify `401`/`403` and `410`
directly. Native EventSource cannot expose HTTP status through `onerror`, so
HotM performs a same-origin fetch status probe and cancels native reconnects
when that probe reveals an auth or incompatibility terminal state.

The legacy `/api/v1/ws` path is allowed only for the advertised anonymous-local,
unscoped profile. Browser WebSocket upgrade failures usually surface as opaque
`1006` closes without the HTTP status; those are treated as transport failures
and may retry. Only an actually visible `410` status/reason is classified as
legacy incompatibility.

## CI

The realtime suite is executed in the `quality-gate` job (`.gitea/workflows/ui-ci.yml`) as a dedicated step.

## Flaky Timing Troubleshooting

- Use fake timers (`vi.useFakeTimers`) for reconnection/coalescing logic.
- Keep bounded windows deterministic (`advanceTimersByTime` with explicit durations).
- Prefer fixture-driven event arrays over open-ended async streams.
- Avoid assertions that depend on wall-clock ordering; assert on normalized event identity and final state.
