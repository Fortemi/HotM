# Architecture Overview

This document describes the v1 architecture that centers NLP-driven revision, summarization, and dynamic linking while preserving immutable originals.

## High-Level
- Client/UI: Tauri + React/TypeScript with Windows 11 visual style (Mica/Acrylic, rounded corners)
- Core service: Rust (Tokio) inside the Tauri backend
- Storage: SQLite with FTS5 for keyword search; vector index via SQLite extension (sqlite-vec/sqlite_hnsw) or embedded HNSW
- NLP runtime: Ollama on `localhost` (generation model `gpt-oss:20b`; embeddings `nomic-embed-text`)
- Background workers: async jobs for ingest, revise, tag, embed, link, reindex
- API: Local HTTP + WebSocket events; OpenAPI at `/openapi.json`
- MCP server: In-process, exposing deterministic tools that the UI calls
- Security: Local-only by default; optional encryption-at-rest (Windows DPAPI) and audit log

## Data Model (SQLite)
The full schema is in `docs/04-data-model.sql`. Key tables:
- `note`, `note_original` (immutable text), `note_revised_current`, `note_revision` (history)
- `provenance_edge` for revision inputs and external sources
- `link` for dynamic intra-note and external links
- `tag`, `note_tag`, `collection`
- `note_fts` FTS5 index across original and revised content, plus tags
- `embedding` for chunked vectors (stored via SQLite vector extension)
- `activity_log` for analytics and auditability

## Search
- Hybrid retrieval: FTS5 BM25 + vector ANN; fuse via Reciprocal Rank Fusion; optional local cross-encoder re-ranking
- Filters: `tag:`, `collection:`, `before:`/`after:`, `source:`

## NLP Pipelines
- On create/import: normalize → chunk → summarize/revise → extract tags/entities → suggest collection → detect links → write revision + provenance → compute embeddings → update indexes
- On edit: diff → regenerate revised content and summary → selective link refresh
- On search: hybrid retrieval with filters

## API (v1)
Base: `http://127.0.0.1:53211/api/v1`
- Notes: `POST /notes`, `GET /notes/{id}`, `PUT /notes/{id}/revised`, provenance and linking endpoints
- Search: `GET /search` (mode `hybrid|fts|vector`), `POST /semantic`
- Collections/Tags: CRUD + assignment
- Analytics/Chat: `POST /chat` for command interface, `GET /stats`
- System: `GET /health`, `GET/PUT /config`; WS `/events` for progress and streams

## MCP server (tools)
- `create_note`, `get_note`, `revise_note`, `search_notes`, `link_notes`, `link_external`, `get_provenance`, `set_tags`, `set_collection`, `analytics_query`, `export_notes`, `health_check`

## UX (Windows 11)
- Tray app + global shortcut Ctrl+Alt+H; compact overlay with command palette, recent notes, note view (Revised/Original/Provenance tabs), and assistant panel
- Quick capture and immediate revised view once background pipeline completes
- Inline dynamic link chips with previews; confidence threshold controls visibility

## Packaging and Startup
- Tauri bundler produces MSI, registers tray and global shortcut; optional launch at login
- First-run: check Ollama, pull models, run DB migrations, test vector extension; fall back to embedded HNSW

## Telemetry and Privacy
- Default: no outbound network beyond localhost Ollama and optional favicon fetch for known URLs; optional updates can be disabled

## Implementation plan (v1)
- Foundation (Tauri app, schema, vector extension wiring)
- Ollama integration (health, generation, embeddings)
- NLP pipeline jobs with progress events
- Core UI (capture, revised/original toggle, provenance, command palette, links)
- MCP server toolset and routing from UI
- Hybrid search with filters
- Settings (models, performance, privacy, shortcuts, API/MCP)
