HotM — Personal Notes, Interaction, and Analysis

A highly personal, local-first notes and analysis tool designed to be easy to manage and modify. Runs entirely on your machine, with optional local LLM support via Ollama.

Features (initial scope)
- Local-first storage using plain Markdown files in `data/notes/`
- Fast API server with simple HTTP endpoints
- Full-text search via SQLite FTS5
- Optional local LLM integration (summarize, extract, tag)
- Minimal dependencies; easy to hack and extend

Quickstart
- Install Python 3.11+
- Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- (Optional) Install Ollama and pull a model:

```bash
# See: https://ollama.com
ollama pull mistral
ollama pull nomic-embed-text
```

- Run the server:

```bash
./scripts/dev.sh
```

- Open http://localhost:8000/docs for API docs.

Project Layout
- `app/` — FastAPI app and modules
- `app/llm/` — Local LLM client wrappers
- `data/` — Local data (notes, database)
- `docs/` — Architecture, decisions, and roadmap
- `scripts/` — Utilities for dev and ops

Notes
- This repo prefers incremental, readable code with the least moving parts.
- All data stays local by default. LLM calls are to your local Ollama.
