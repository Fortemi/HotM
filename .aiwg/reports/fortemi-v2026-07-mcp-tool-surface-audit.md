---
title: Fortemi v2026.7.1 MCP Tool Surface Audit
status: reconciled-local-evidence
date: 2026-07-15
artifact_type: mcp-tool-surface-audit
related_artifacts:
  - .aiwg/design/fortemi-v2026-07-agent-tool-coverage-matrix.md
  - .aiwg/design/fortemi-v2026-07-capability-surface-matrix.md
  - .aiwg/reports/fortemi-v2026-07-delivery-evidence-ledger.md
  - .aiwg/security/fortemi-v2026-07-security-redaction-controls.md
---

# Fortemi v2026.7.1 MCP Tool Surface Audit

## Purpose

Compare the latest Fortemi MCP tool surface with HotM's embedded agent tool registry and record the #258 tool strategy. The current HotM worktree implements the metadata/gating scaffold for enabled tools and explicit dispositions for deferred or excluded MCP capability areas; new diagnostic tools remain deferred until disabled-state and redaction fixtures are accepted.

## Source Evidence

| Source | Evidence |
| --- | --- |
| Fortemi MCP core registry | `../fortemi/mcp-server/constants/core-tools.js` exports 43 `CORE_TOOL_NAMES`. |
| Fortemi MCP published surface | `../fortemi/README.md` documents 43 core tools and 205 full-mode tools. |
| HotM server agent proxy | `agent-proxy/src/tools.ts` currently registers 12 Fortemi-backed tools with route-family, capability, intent, role/scope, and result-policy metadata. |
| HotM UI-local tool definitions | `ui/src/components/agent/tools.ts` currently defines 9 UI-local tools. |

## Fortemi Core MCP Tool Names

The current core registry contains:

`list_notes`, `get_note`, `update_note`, `delete_note`, `restore_note`, `capture_knowledge`, `search`, `record_provenance`, `manage_tags`, `manage_collection`, `manage_concepts`, `manage_embeddings`, `manage_archives`, `manage_encryption`, `manage_backups`, `explore_graph`, `get_topology_stats`, `get_graph_diagnostics`, `capture_diagnostics_snapshot`, `list_diagnostics_snapshots`, `compare_diagnostics_snapshots`, `recompute_snn_scores`, `pfnet_sparsify`, `coarse_community_detection`, `trigger_graph_maintenance`, `get_cold_spots`, `get_note_links`, `get_related_notes`, `export_note`, `get_documentation`, `get_system_info`, `health_check`, `select_memory`, `get_active_memory`, `manage_attachments`, `get_knowledge_health`, `get_access_frequency`, `manage_jobs`, `manage_inference`, `bulk_reprocess_notes`, `purge_note`, `purge_notes`, `purge_all_notes`.

## HotM Registry Baseline

HotM's server-side agent proxy currently exposes:

`search_notes`, `create_note`, `get_note`, `revise_note`, `update_tags`, `link_notes`, `list_collections`, `search_concepts`, `get_related`, `list_archives`, `list_notes`, `get_attachments`.

The UI-local registry currently mirrors a smaller 9-tool subset and omits server-proxy-only archive/list/attachment helpers.

## Disposition Model

| MCP capability area | HotM disposition |
| --- | --- |
| Notes, search, tags, note links | Preserve current agent tools, with endpoint-family mapping and intent gating. |
| Collections, concepts, archives | Keep partial/read-oriented tools; defer management operations unless UI, capability, and audit requirements are proven. |
| Attachments | Keep read-only listing; upload/delete/download and TUS flows remain UI-first until #257 proves parity and redaction. |
| Jobs, inference, health, documentation, system info | Candidate read-only diagnostics after #254/#258 establish capability-gated summaries and redaction. |
| Incoming/inbound receiver operations | Candidate diagnostics only after #256; create/update/delete/validate operations require role, confirmation, audit, and secret handling. |
| Backup/archive management | Candidate read-only diagnostics after #257; restore/import/export remain high-impact UI flows unless explicitly accepted. |
| Vision/audio/calls | Follow ADR-011 and #259: attachment preview and Admin/Realtime Debug before agent tool exposure. |
| PKE/encryption | Excluded from HotM embedded agent tools for this integration gate. |
| Graph maintenance and diagnostics | Read-only summaries may fit Admin/diagnostic UI; recompute/sparsify/community/maintenance operations are not automatic agent tools. |
| Purge/delete/restore/destructive operations | Excluded from autonomous agent tool exposure unless a later ADR accepts explicit confirmation, role, audit, and recovery requirements. |

## Decision

HotM should not mirror Fortemi's MCP registry one-for-one. The embedded assistant remains a curated, capability-gated product surface whose tools are derived from HotM workflows, implemented API clients, role/scope checks, and redaction evidence.

#258 should close only after it proves:

- Every enabled HotM agent tool maps to a current Fortemi route family, capability gate, role/scope requirement, and intent set. **Implemented in `agent-proxy/src/tools.ts` metadata and tests.**
- Every Fortemi MCP core capability area has one of: implemented HotM tool, UI-only surface, diagnostic-only candidate, documented exclusion, or dependency-backed deferral. **Implemented as `deferredToolDecisions` and `nonToolBoundaries` for current candidates/exclusions.**
- Tool descriptions and prompt suffixes do not imply one-for-one MCP parity. **Covered by focused agent-proxy tests.**
- Tests cover disabled states, redaction, intent filtering, and absence of excluded/destructive operations. **Intent filtering and absence of excluded/destructive operations are covered; disabled-state execution fixtures remain required before adding new diagnostic tools.**

## Issue Impact

- #258 owns the registry parity statement and tool tests; local metadata/gating scaffold evidence is implemented.
- #242, #254, #255, #256, #257, and #259 feed API/client and UX evidence into #258.
- #243 may reference local #258 metadata/gating evidence, but must not claim new diagnostic tool enablement until disabled-state and redaction fixtures are added for those tools.
