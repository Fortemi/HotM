# Semantic Graph API Contract (Draft)

## Purpose

Define a stable payload contract for the Sigma + Graphology graph explorer so
the UI can render explainable graphs with mixed edge layers (`explicit`,
`semantic`) and predictable truncation behavior.

## Endpoint Shape (Candidate)

- `GET /api/v1/graph/:note_id`
- Query params:
  - `depth` (int)
  - `max_nodes` (int)
  - `min_score` (float)
  - `edge_layers` (`explicit|semantic|both`)
  - `include_metadata` (`true|false`)

## Response

```json
{
  "graph_version": "v1",
  "generated_at": "2026-02-18T06:00:00Z",
  "root_note_id": "uuid",
  "nodes": [
    {
      "id": "uuid",
      "title": "Note title",
      "depth": 0,
      "collection_id": "uuid|null",
      "tags": ["tag/a", "tag/b"],
      "concepts": ["Concept A", "Concept B"],
      "archived": false,
      "created_at_utc": "2026-02-10T01:00:00Z",
      "updated_at_utc": "2026-02-17T23:50:00Z",
      "community_id": "c-12"
    }
  ],
  "edges": [
    {
      "source": "uuid",
      "target": "uuid",
      "edge_type": "semantic",
      "score": 0.72,
      "rank": 2,
      "provenance": {
        "origin": "embedding_knn",
        "embedding_set": "default",
        "model": "nomic-embed-text",
        "computed_at": "2026-02-18T05:58:00Z"
      }
    },
    {
      "source": "uuid",
      "target": "uuid",
      "edge_type": "explicit_link",
      "score": 0.44,
      "rank": 1,
      "provenance": {
        "origin": "note_link",
        "computed_at": "2026-02-18T05:58:00Z"
      }
    }
  ],
  "meta": {
    "returned_nodes": 128,
    "returned_edges": 2000,
    "total_candidate_nodes": 218,
    "total_candidate_edges": 9462,
    "truncated_nodes": false,
    "truncated_edges": true
  }
}
```

## Contract Requirements

1. Node IDs and edge endpoints are stable across repeated requests with the same
   parameters when source data is unchanged.
2. `edge_type` is always present to support mixed-layer rendering.
3. `provenance.origin` is always present to power explainability UI.
4. Truncation flags are mandatory when caps are applied.
5. Timestamps use UTC ISO-8601 strings.

## UI Consumption Notes

1. `community_id` is optional: UI can compute communities if absent.
2. UI should degrade gracefully when `tags`/`concepts` are missing by hiding
   those facets.
3. UI should show explainability details from `provenance` and `score`.

## Open Questions

1. Should semantic edges be precomputed server-side only, or optionally
   generated client-side for small graphs?
2. Should contract expose separate arrays by layer (`explicit_edges`,
   `semantic_edges`) or keep unified `edges` with `edge_type`?
3. Should API provide recommended render caps in `meta`?

## Legacy Compatibility (Transition Plan)

Current client code may still receive the legacy edge shape:

```json
{ "from": "uuid-a", "to": "uuid-b", "score": 0.5 }
```

### Client Normalization Rule

If `source`/`target` are missing and `from`/`to` are present, normalize to:

```json
{
  "source": "uuid-a",
  "target": "uuid-b",
  "edge_type": "explicit_link",
  "score": 0.5
}
```

### Sunset Guidance

1. Support both formats during one compatibility window.
2. Return `graph_version` in responses during transition.
3. Remove legacy `from`/`to` once all clients are confirmed on the new contract.
