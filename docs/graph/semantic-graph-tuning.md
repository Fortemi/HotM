# Semantic Graph Tuning Presets

This document defines practical frontend defaults for HotM's Sigma + Graphology
graph explorer while backend graph API improvements are in progress.

## Presets

| Preset | `semanticMinScore` | `semanticMaxNeighbors` | When to use |
|---|---:|---:|---|
| `sparse` | `0.45` | `3` | Large/dense archives, high-noise tag vocabularies, overview mode |
| `balanced` | `0.35` | `4` | Default for mixed archive sizes and general exploration |
| `dense` | `0.25` | `7` | Small focused archives or intentional local neighborhood deep dives |

## Selection Guidance

- Start with `balanced`.
- If graph feels like a hairball:
  - switch to `sparse`
  - or increase min score and reduce neighbors.
- If graph feels disconnected or too thin:
  - switch to `dense`
  - or lower min score and raise neighbors.

## Operational Notes

- Frontend always applies dense-edge capping for stability.
- Presets are deterministic and designed to cooperate with filter-state persistence.
- Use diagnostics snapshot + history controls in the graph UI to compare settings
  before/after changes.

## Follow-up

- Backend issues tracking authoritative server defaults and metadata:
  - `Fortemi/fortemi#469`
  - `Fortemi/fortemi#467`
