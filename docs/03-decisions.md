# Architectural Decisions (ADRs)

## ADR-001: Language and Framework
- Decision: Python 3.11 + FastAPI
- Status: Accepted
- Rationale: You can rapidly modify Python; FastAPI is lightweight with great DX.

## ADR-002: Storage
- Decision: Markdown files + SQLite (FTS5)
- Status: Accepted
- Rationale: Files are easy to hand-edit; SQLite is simple and powerful for search.

## ADR-003: Local LLM Provider
- Decision: Ollama
- Status: Accepted
- Rationale: Easiest local setup with a stable HTTP API and many models.

## ADR-004: Minimal Dependencies
- Decision: Keep deps lean and versions pinned
- Status: Accepted
- Rationale: Reduce maintenance overhead and lock-in.
