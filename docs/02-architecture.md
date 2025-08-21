# Architecture Overview

## High-Level
- API service (`FastAPI`) exposes endpoints for notes CRUD, search, and LLM utilities
- Storage is local filesystem for raw notes and SQLite for metadata/search
- LLM integration via Ollama local HTTP API

## Components
- API: `app/main.py`, routers in `app/routers/*`
- Storage:
  - Markdown notes under `data/notes/`
  - SQLite database at `data/hotm.sqlite3` using FTS5 for search
- LLM:
  - `app/llm/ollama_client.py` for generation and embeddings

## Data Model (initial)
- Note
  - `id` (UUID string)
  - `title`
  - `path` (filesystem path)
  - `tags` (comma-separated or JSON list)
  - `created_at`, `updated_at`
- Search Index
  - FTS5 virtual table over `title` and `content`

## API (initial)
- `POST /notes` create a note (title, content, tags)
- `GET /notes/{id}` read
- `PUT /notes/{id}` update
- `DELETE /notes/{id}` delete
- `GET /search?q=` full-text search
- `POST /llm/summarize` summarize note content

## Rationale
- Keep raw notes as Markdown for durability and manual edits
- Use SQLite to avoid complex infra and enable fast search
- Keep LLM local via Ollama for privacy and control

## Future Options
- Web UI with HTMX/Alpine for minimal JS
- Sync via Git or Syncthing
- Import/export from Obsidian, Bear, etc.
