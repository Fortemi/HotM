# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Structure
Comprehensive documentation is available in the `docs/` directory:
- [Documentation Index](docs/00-index.md) - Complete navigation guide
- [Requirements](docs/01-requirements/) - Functional and non-functional requirements
- [Specifications](docs/02-specifications/) - API, MCP, and data model specs
- [Architecture](docs/03-architecture/) - System design and NLP pipeline
- [Implementation](docs/04-implementation/) - Development and testing guides
- [Deployment](docs/05-deployment/) - Installation and Docker deployment

## Project Overview

HotM is a local-first notes and analysis tool that maintains immutable originals while providing revised/summarized views through local NLP processing. Built with Rust (Axum API server) and Tauri (React/TypeScript desktop) for Windows 11.

**Version**: 0.1.0 (Alpha)
**Architecture**: Modular, SOLID principles, fully async
**Target**: Windows 11 primary, network deployment supported

## Testing Discipline

**MANDATORY: Always run full local tests before any git push**

Before pushing ANY changes to GitHub:
1. Run `gh act -j backend-tests` from repo root and wait for completion
2. Run `gh act -j frontend-tests` from repo root and wait for completion
3. Verify both exit code 0 and all tests passing 
4. Only push after confirming green local test runs for both backend and frontend
5. If any tests fail, fix issues and repeat from step 1

**No exceptions - even for "simple" fixes like cache configuration or formatting changes**

### Test Commands Reference
- **Backend tests**: `gh act -j backend-tests` (includes unit tests, clippy, formatting)
- **Frontend tests**: `gh act -j frontend-tests` (includes vitest unit tests, type checking, coverage)
- **Local backend only**: `cd server && cargo test`
- **Local frontend only**: `cd ui && npm test -- --run`

Integration tests are disabled in CI but must be run locally for full validation.

## Development Commands

### Rust Server (Axum API)
```bash
# Set database URL (required)
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev

# Run development server (port 53211)
cd server
RUST_LOG=hotm_server=info,axum=info cargo run

# Run tests
cd server
cargo test

# One-command setup and run (checks Ollama, pulls models, ensures pgvector)
./scripts/dev_server.sh
```

### Tauri UI (React + TypeScript)
```bash
cd ui

# Install dependencies
npm install

# Development mode
npm run dev

# Build production app (creates MSI)
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Run Playwright tests
npm run test
```

### Testing
```bash
# Run all tests with coverage
cd server
cargo test
cargo tarpaulin --out Html

# Run specific test suites
cargo test unit::
cargo test integration::

# UI tests
cd ui
npm run test
npm run test:e2e
```

### Database Setup
```bash
# Ensure pgvector extension (required for embeddings)
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations (from server directory)
cd server
sqlx migrate run
```

### System Prerequisites
```bash
# Install Graphviz (required for PlantUML diagram rendering)
sudo apt-get install -y graphviz
```

### Ollama Models (for NLP features)
```bash
# Pull required models
ollama pull gpt-oss:20b        # Generation model
ollama pull nomic-embed-text    # Embedding model
```

## Architecture

### Core Components

**Storage Layer**: Microsoft DocumentDB (PostgreSQL-compatible)
- JSONB documents for flexible schema evolution
- Full-text search via tsvector/GIN indexes
- Vector embeddings via pgvector (HNSW indexing)
- Immutable original notes with versioned revisions

**API Server**: Rust Axum (port 53211)
- Location: `server/src/`
- Routes defined in `server/src/routes/`
- Database models in `server/src/models.rs`
- Ollama client in `server/src/ollama.rs`
- Uses SQLx for async PostgreSQL with compile-time query verification

**Desktop UI**: Tauri + React
- Location: `ui/src/` (React) and `ui/src-tauri/` (Rust backend)
- Windows 11 visual style (Mica/Acrylic effects)
- Global hotkey: Ctrl+Alt+H
- Tray application with MSI installer

**NLP Pipeline**: Local Ollama
- Revision/summarization via `gpt-oss:20b`
- Semantic embeddings via `nomic-embed-text`
- Hybrid search combining FTS and vector similarity

### Key Data Flow

1. **Note Creation**: User input → Normalize → Store original → Background NLP pipeline
2. **NLP Pipeline**: Chunk → Summarize/Revise → Extract tags/entities → Detect links → Compute embeddings → Update indexes
3. **Search**: Query → Hybrid retrieval (FTS + vector) → Reciprocal Rank Fusion → Optional re-ranking
4. **Revision Display**: Fetch note → Show revised by default → Preserve link to immutable original
5. **MCP Integration**: AI Assistant → MCP Tools → API Server → Database

### API Endpoints (v1)

Base URL: `http://127.0.0.1:53211/api/v1`

- `POST /notes` - Create note
- `GET /notes/{id}` - Get note with revisions
- `PUT /notes/{id}/revised` - Update revision
- `GET /search` - Hybrid search with filters
- `POST /semantic` - Pure semantic search
- `GET /notes/{id}/provenance` - Get revision history
- `POST /notes/{id}/links` - Create dynamic links
- `POST /tags`, `PUT /notes/{id}/tags` - Tag management
- `POST /collections`, `PUT /notes/{id}/collection` - Collection management

### MCP Server Tools

The MCP server is embedded in the Rust API server and provides:
- **Note Management**: `create_note`, `get_note`, `update_note`, `delete_note`
- **Search**: `search_notes`, `find_similar`
- **Organization**: `set_tags`, `set_collection`
- **Linking**: `link_notes`, `link_external`
- **Analysis**: `get_provenance`, `analytics_query`
- **Export**: `export_notes`
- **System**: `health_check`

See [MCP Tools Specification](docs/02-specifications/mcp-tools-spec.md) for details.

## Project Structure

```
hotm/
├── server/             # Rust Axum API server
│   ├── src/
│   │   ├── main.rs     # Server entry point
│   │   ├── routes/     # API route handlers
│   │   ├── models.rs   # Database models
│   │   ├── db.rs       # Database connection pool
│   │   └── ollama.rs   # Ollama client
│   └── migrations/     # PostgreSQL schema migrations
├── ui/                 # Tauri desktop application
│   ├── src/            # React frontend
│   ├── src-tauri/      # Rust backend for Tauri
│   └── tests/          # Playwright E2E tests
├── docs/               # Architecture and design docs
└── scripts/            # Dev and deployment utilities
```

## Key Technical Decisions

1. **Immutable Originals**: Never modify original note content; all edits create new revisions
2. **Local-First**: All processing happens locally; network mode requires explicit configuration
3. **Hybrid Search**: Combines PostgreSQL full-text search with pgvector semantic search
4. **Windows Focus**: Primary target is Windows 11 with native styling
5. **MCP Integration**: Embedded MCP server in API for AI assistant integration
6. **SOLID Principles**: Modular, testable architecture with dependency injection
7. **Authentication**: Simple admin auth with API key generation for clients

## Testing Approach

- **Target Coverage**: 60-80% overall
- **Unit Tests**: Business logic and components
- **Integration Tests**: API endpoints and services
- **E2E Tests**: Critical user journeys
- **Test Organization**: Tests colocated with source, integration tests in `/tests`

See [Testing Strategy](docs/04-implementation/testing-strategy.md) for comprehensive testing guide.

## Environment Variables

- `DATABASE_URL`: PostgreSQL/DocumentDB connection string (required)
- `TEST_DATABASE_URL`: Test database for integration tests
- `RUST_LOG`: Logging level (default: `hotm_server=info,axum=info`)
- `OLLAMA_URL`: Ollama service URL (default: `http://localhost:11434`)
- `OLLAMA_GENERATION_MODEL`: LLM for text generation (default: `gpt-oss:20b`)
- `OLLAMA_EMBEDDING_MODEL`: Model for embeddings (default: `nomic-embed-text`)
- `JWT_SECRET`: Secret for JWT tokens (v0.2.0+)
- `API_KEY_SALT`: Salt for API key generation (v0.2.0+)