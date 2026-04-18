---
name: "memory-log-append"
description: "Append a structured event to a consumer's semantic memory log"
platforms: [codex]
---

# memory-log-append

Append a single structured JSON event to a consumer's `.log.jsonl` file. This is the write primitive for the semantic memory kernel's event stream.

## When to Use

Called internally by other kernel skills (`memory-ingest`, `memory-lint`, `memory-query-capture`) after completing an operation. Can also be called directly for custom event types.

## Parameters

### --consumer (optional)
Consumer ID to log against. Resolved via ADR-021 D4 precedence: explicit > wrapper > auto-detect.

### --op (required)
Operation type: `ingest`, `lint`, `query-capture`, `log-render`, `index-rebuild`, or a custom string.

### --data (required)
JSON object with operation-specific fields per the `memory-log-event` schema.

## Operation

1. **Resolve consumer** — determine which consumer's log to append to.
2. **Load topology** — read `memory.topology.log` path from consumer's `manifest.json`.
3. **Validate event** — ensure required fields (`ts`, `op`, `consumer`, `actor`) are present. Add `ts` and `actor` automatically if missing.
4. **Append** — write single JSON line to the `.log.jsonl` file (create file if first entry).
5. **Activity log** — also append a summary line to `.aiwg/activity.log` per the `activity-log` rule.

## Event Construction

The skill auto-populates:
- `ts` — current ISO 8601 timestamp (UTC)
- `actor` — current model identifier
- `consumer` — resolved consumer ID

The caller provides `op` and all operation-specific fields.

## Error Handling

- Log write failures are **non-blocking** — the calling skill reports success/failure of its primary operation, not the log write.
- If the log file path doesn't exist, create parent directories first.
- If the log file is corrupted (not valid JSONL), append anyway — `memory-lint` will flag the corruption.

## Schema Reference

@semantic-memory/schemas/memory-log-event.md

## Examples

```
# After an ingest operation
memory-log-append --consumer research-complete --op ingest --data '{"source":"paper.pdf","pages_touched":["summaries/paper.md"],"contradictions":0,"duration_ms":5200}'

# After a lint operation
memory-log-append --consumer sdlc-complete --op lint --data '{"findings":{"error":0,"warning":3,"suggestion":8},"duration_ms":2100}'
```
