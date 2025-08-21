# Architectural Decisions (ADRs)

## ADR-001: Platform and Framework (v1)
- Decision: Tauri (Rust backend + React/TypeScript UI)
- Status: Accepted
- Rationale: Native Windows 11 UX (tray, global hotkeys) with small footprint; Rust provides robust async, SQLite access, and background workers.

## ADR-002: Storage Engine
- Decision: SQLite with FTS5 and vector index (sqlite-vec/sqlite_hnsw). Immutable originals + revised view + revision history.
- Status: Accepted
- Rationale: Single-file DB, rich indexing, local durability. Schema supports provenance and analytics.

## ADR-003: NLP Runtime
- Decision: Ollama on localhost. Models: `gpt-oss:20b` for generation, `nomic-embed-text` for embeddings.
- Status: Accepted
- Rationale: Local-only privacy, reproducible pipelines, easy model management.

## ADR-004: Search Strategy
- Decision: Hybrid search (FTS5 BM25 + vector ANN) with RRF fusion and optional cross-encoder rerank.
- Status: Accepted
- Rationale: Combines precision of keyword with recall of semantic search.

## ADR-005: Security & Privacy
- Decision: Local-only by default. Optional encryption-at-rest via Windows DPAPI with optional passphrase. Audit log of actions.
- Status: Accepted
- Rationale: Personal knowledge base with strong local privacy guarantees.

## ADR-006: Interaction Protocol
- Decision: MCP server in-process. All UI actions map to MCP tools; local HTTP API mirrors these operations and emits WS events.
- Status: Accepted
- Rationale: Deterministic, auditable state changes; easy integration with external clients.
