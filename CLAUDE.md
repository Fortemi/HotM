# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Structure
Comprehensive documentation is available in the `docs/` directory:
- [Documentation Index](docs/index.md) - Complete navigation guide
- [Requirements](docs/requirements/) - Functional and non-functional requirements
- [Specifications](docs/specifications/) - API, MCP, and data model specs
- [Architecture](docs/architecture/) - System design and NLP pipeline
- [Implementation](docs/implementation/) - Development and testing guides
- [Deployment](docs/deployment/) - Installation and Docker deployment

## Project Overview

HotM is a local-first notes and analysis tool that maintains immutable originals while providing revised/summarized views through local NLP processing. Built with Rust (Axum API server) and Tauri (React/TypeScript desktop) for Windows 11.

**Version**: 0.1.0 (Alpha)
**Architecture**: Modular, SOLID principles, fully async
**Target**: Windows 11 primary, network deployment supported

## Testing Discipline

**Act (GitHub Actions locally) is the AUTHORITATIVE standard for all testing**

Before pushing ANY changes to GitHub:
1. Run `gh act -j backend-tests` from repo root and wait for completion
2. Run `gh act -j frontend-tests` from repo root and wait for completion  
3. Verify both exit code 0 and all tests passing
4. Only push after confirming green local test runs for both backend and frontend
5. If any tests fail, fix issues and repeat from step 1

**No exceptions - even for "simple" fixes. Act tests are the single source of truth.**

### Standard Test Commands (Use These)
- **Full backend validation**: `gh act -j backend-tests` (Rust tests, clippy, formatting, security audit)
- **Full frontend validation**: `gh act -j frontend-tests` (React tests, TypeScript build, coverage, security audit)
- **Quick local iteration**: `cd server && cargo test` or `cd ui && npm test -- --run`

All shell-based test scripts have been removed - use `gh act` for consistent CI/CD parity.

## Version Management

### Version Consistency
All version numbers are automatically synchronized across:
- `ui/package.json` - Frontend package version
- `ui/src-tauri/Cargo.toml` - Tauri application version  
- `ui/src-tauri/tauri.conf.json` - Tauri configuration version
- `server/Cargo.toml` - Backend server version
- `ui/build-windows.ps1` - Dynamically reads from package.json

### Version Commands
```bash
# Check current version status across all files
./scripts/check_versions.sh

# Bump version across all project files
./scripts/bump_version.sh 0.1.3           # Linux/WSL
# OR (Windows PowerShell)
./scripts/bump_version.ps1 0.1.3          # Windows PowerShell
```

### Release Process

1. **Check Version Consistency**:
```bash
./scripts/check_versions.sh               # Ensure all files match
```

2. **Bump Version**:
```bash
./scripts/bump_version.sh 0.2.0          # Updates all config files
```

3. **Review and Test**:
```bash
git diff                                  # Review all changes
cd ui && npm run build                    # Test build works
```

4. **Commit and Tag**:
```bash
git add . && git commit -m "bump: version 0.2.0"
git tag v0.2.0
git push && git push --tags
```

### MSI Installer Components

The Windows MSI installer offers flexible deployment options for security-minded users and developers:

**Desktop Client**:
- Tauri-based rich desktop interface
- Global hotkey support (Ctrl+Alt+H)
- System tray integration with auto-startup
- Connects to local or remote HotM server
- For individual workstations and development

**API Server (Centralized Deployment)**:
- Rust HTTP API server (port 53211)
- Windows Service installation
- PostgreSQL database with pgvector
- Ollama integration for NLP processing
- For centralized home/office deployments

**Deployment Scenarios**:
- **Local Development** - Both components on developer machine
- **Home Network Hub** - Server on central system with GPU/inference power
- **Small Office Setup** - Dedicated server, multiple client workstations
- **Hybrid Mode** - Mix of local and networked deployments

### Release Channels

Release channels allow community testing while maintaining clean package versions:

- **`alpha`**: Early development releases with experimental features
- **`beta`**: Pre-release builds for community testing (default)  
- **`rc`**: Release candidates - stable builds awaiting final testing
- **`stable`**: Production releases

Channel configuration is stored in `release.json`.

### Version Management

**Package Versions** (clean semantic versioning):
- `server/Cargo.toml` (Rust API server)
- `ui/src-tauri/Cargo.toml` (Tauri app)  
- `ui/src-tauri/tauri.conf.json` (Tauri config)
- `ui/package.json` (Node.js frontend)
- `README.md` (version badge)
- `docs/specifications/api-specification.md`

**Git Tags** (with channel suffixes):
- `v0.2.0-alpha`, `v0.2.0-beta`, `v0.2.0-rc`, `v0.2.0` (stable)

## Development Commands

### Rust Server (Axum API)
```bash
# Set database URL (required)
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev

# Run development server (port 53211)
cd server
RUST_LOG=hotm_server=info,axum=info cargo run

# Run tests (use act for full validation)
gh act -j backend-tests

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

# Run tests (use act for full validation)
gh act -j frontend-tests
```

### Testing (Use Act - Authoritative Standard)
```bash
# STANDARD: Run full backend test suite (includes tests, clippy, formatting, security)
gh act -j backend-tests

# STANDARD: Run full frontend test suite (includes tests, build, coverage, security)  
gh act -j frontend-tests

# Quick local iteration only (not comprehensive)
cd server && cargo test        # Basic Rust unit tests only
cd ui && npm test -- --run     # Basic React unit tests only
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

**Linux/WSL:**
```bash
# Install Graphviz (required for PlantUML diagram rendering)
sudo apt-get install -y graphviz

# Install PostgreSQL client tools (required for build processes)
sudo apt-get install -y postgresql-client
```

**Windows (for MSI installer builds):**
- **Docker Desktop**: Install from https://www.docker.com/products/docker-desktop/
  - Required for temporary PostgreSQL test containers during builds
  - Ensures isolated, reproducible database environments for SQLx compilation
- **Inno Setup**: Install from https://jrsoftware.org/isinfo.php (for MSI installer creation)

**Note**: The build process now uses Docker containers for database setup, eliminating the need to install PostgreSQL locally. The temporary database containers are automatically created, configured with pgvector, migrated, and cleaned up.

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

See [MCP Tools Specification](docs/specifications/mcp-tools-spec.md) for details.

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

See [Testing Strategy](docs/implementation/testing-strategy.md) for comprehensive testing guide.

## Environment Variables

- `DATABASE_URL`: PostgreSQL/DocumentDB connection string (required)
- `TEST_DATABASE_URL`: Test database for integration tests
- `RUST_LOG`: Logging level (default: `hotm_server=info,axum=info`)
- `OLLAMA_URL`: Ollama service URL (default: `http://localhost:11434`)
- `OLLAMA_GENERATION_MODEL`: LLM for text generation (default: `gpt-oss:20b`)
- `OLLAMA_EMBEDDING_MODEL`: Model for embeddings (default: `nomic-embed-text`)
- `JWT_SECRET`: Secret for JWT tokens (v0.2.0+)
- `API_KEY_SALT`: Salt for API key generation (v0.2.0+)
