HotM — Personal Notes, Interaction, and Analysis

HotM is a local-first notes and analysis tool. It keeps your original content immutable, presents a revised/summarized view by default, and uses local NLP to enrich, organize, and search your knowledge — all on your machine.

Key goals
- Immutable originals; default revised view with dynamic links
- UTC timestamps for storage; display in system local time
- Local-only NLP via Ollama (generation: `gpt-oss:20b`, embeddings: `nomic-embed-text`)
- Fast hybrid search: Microsoft DocumentDB (PostgreSQL-compatible) tsvector + pgvector (HNSW)
- Tasteful Windows 11 UX (tray app, global hotkey Ctrl+Alt+H)
- Standard local API and an MCP server; UI actions map to MCP tools

Status
- Current prototype: Python + FastAPI local-only server (see Quickstart below).
- v1 plan: Tauri (Rust + React/TypeScript) Windows app with Microsoft DocumentDB (PostgreSQL-compatible with JSONB + pgvector), local Ollama, MCP server, hybrid semantic search, and background pipelines. See `docs/02-architecture.md`.

Quickstart (current server + UI)
- Database: set `DATABASE_URL` (PostgreSQL/DocumentDB) and ensure `vector` extension.
- One command to run the server (pulls Ollama models if available):

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
./scripts/dev_server.sh
```

- UI (dev):

```bash
cd ui
npm install
npm run dev
```

Documentation
- `docs/01-vision.md` — Product vision and goals
- `docs/02-architecture.md` — Architecture overview (v1 plan)
- `docs/03-decisions.md` — ADRs
- `docs/04-data-model-pg.sql` — PostgreSQL/DocumentDB schema (v1)
- `docs/05-storage-documentdb.md` — Storage rationale and setup

Project Layout (prototype)
- `app/` — FastAPI app and modules
- `app/llm/` — Local LLM client wrappers
- `data/` — Local data (notes)
- `docs/` — Architecture, decisions, and roadmap
- `scripts/` — Utilities for dev and ops
- `server/` — Rust Axum API server (DocumentDB/Postgres)

Privacy
- All data and NLP run locally by default. Optional encryption-at-rest and audit log are planned for v1.
