# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

HotM is a local-first notes and analysis tool with immutable originals, NLP-powered revisions, and hybrid search. Built with Rust (Axum API) and Tauri (React/TypeScript UI) for Windows 11.

## Tech Stack

- **Languages**: Rust (backend), TypeScript/React (frontend)
- **Runtime**: Rust 1.70+, Node.js 18+
- **Package Manager**: Cargo (Rust), npm (Node.js)
- **Framework**: Axum (API server), Tauri + React 19 (desktop UI)
- **Database**: PostgreSQL 14+ with pgvector extension
- **NLP**: Ollama (local LLM inference)
- **UI Libraries**: Radix UI, TailwindCSS, Vite

## Documentation Structure

Comprehensive documentation is available in the `docs/` directory:
- [Documentation Index](docs/index.md) - Complete navigation guide
- [Requirements](docs/requirements/) - Functional and non-functional requirements
- [Specifications](docs/specifications/) - API, MCP, and data model specs
- [Architecture](docs/architecture/) - System design and NLP pipeline
- [Implementation](docs/implementation/) - Development and testing guides
- [Deployment](docs/deployment/) - Installation and Docker deployment

---

## Team Directives & Standards

<!-- PRESERVED SECTION - Content maintained across regeneration -->

### Testing Discipline

**Act (GitHub Actions locally) is the AUTHORITATIVE standard for all testing**

Before pushing ANY changes to GitHub:
1. Run `gh act -j backend-tests` from repo root and wait for completion
2. Run `gh act -j frontend-tests` from repo root and wait for completion
3. Verify both exit code 0 and all tests passing
4. Only push after confirming green local test runs for both backend and frontend
5. If any tests fail, fix issues and repeat from step 1

**No exceptions - even for "simple" fixes. Act tests are the single source of truth.**

#### Standard Test Commands (Use These)
- **Full backend validation**: `gh act -j backend-tests` (Rust tests, clippy, formatting, security audit)
- **Full frontend validation**: `gh act -j frontend-tests` (React tests, TypeScript build, coverage, security audit)
- **Quick local iteration**: `cd server && cargo test` or `cd ui && npm test -- --run`

All shell-based test scripts have been removed - use `gh act` for consistent CI/CD parity.

### Key Technical Decisions

1. **Immutable Originals**: Never modify original note content; all edits create new revisions
2. **Local-First**: All processing happens locally; network mode requires explicit configuration
3. **Hybrid Search**: Combines PostgreSQL full-text search with pgvector semantic search
4. **Windows Focus**: Primary target is Windows 11 with native styling
5. **MCP Integration**: Embedded MCP server in API for AI assistant integration
6. **SOLID Principles**: Modular, testable architecture with dependency injection
7. **Authentication**: Simple admin auth with API key generation for clients
8. **Greenfield Schema**: Fast iteration via clean schema rebuild (see ADR-002)

### Testing Approach

- **Target Coverage**: 60-80% overall
- **Unit Tests**: Business logic and components
- **Integration Tests**: API endpoints and services
- **E2E Tests**: Critical user journeys
- **Test Organization**: Tests colocated with source, integration tests in `/tests`

See [Testing Strategy](docs/implementation/testing-strategy.md) for comprehensive testing guide.

<!-- /PRESERVED SECTION -->

---

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

**IMPORTANT**: HotM uses a **greenfield schema rebuild approach** for fast development iteration. See [ADR-002](.aiwg/architecture/ADR-002-database-schema-rebuild.md) for rationale.

#### Quick Database Reset (Recommended for Development)

**Linux/WSL:**
```bash
export DATABASE_URL=postgres://hotm:pass@localhost:5432/hotm_dev
./scripts/schema/rebuild-schema.sh
```

**Windows PowerShell:**
```powershell
$env:DATABASE_URL='postgres://hotm:pass@localhost:5432/hotm_dev'
.\scripts\schema\rebuild-schema.ps1
```

This drops all tables and recreates from a consolidated schema file (`scripts/schema/clean-schema.sql`) that includes all migrations (0001-0006). Typical rebuild time: <2 seconds.

#### Traditional Migration Approach (CI/CD Validation)

```bash
# Ensure pgvector extension (required for embeddings)
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations (from server directory)
cd server
sqlx migrate run
```

**Note**: Migrations are kept for historical reference and CI validation, but the clean schema rebuild is preferred for local development.

#### SQLx Offline Mode

After schema changes, update SQLx prepared queries:

```bash
cd server
cargo sqlx prepare
```

#### Schema Files

- **Consolidated Schema**: `scripts/schema/clean-schema.sql` (all migrations in one file)
- **Migration History**: `server/migrations/0001-0006*.sql` (historical reference)
- **Rebuild Scripts**: `scripts/schema/rebuild-schema.{sh,ps1}`
- **Documentation**: `scripts/schema/README.md`

See [Database Schema Management](scripts/schema/README.md) for detailed usage patterns.

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

1. **Note Creation**: User input -> Normalize -> Store original -> Background NLP pipeline
2. **NLP Pipeline**: Chunk -> Summarize/Revise -> Extract tags/entities -> Detect links -> Compute embeddings -> Update indexes
3. **Search**: Query -> Hybrid retrieval (FTS + vector) -> Reciprocal Rank Fusion -> Optional re-ranking
4. **Revision Display**: Fetch note -> Show revised by default -> Preserve link to immutable original
5. **MCP Integration**: AI Assistant -> MCP Tools -> API Server -> Database

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
│   └── migrations/     # PostgreSQL schema migrations (historical reference)
├── ui/                 # Tauri desktop application
│   ├── src/            # React frontend
│   ├── src-tauri/      # Rust backend for Tauri
│   └── tests/          # Playwright E2E tests
├── docs/               # Architecture and design docs
├── .aiwg/              # SDLC artifacts (requirements, architecture, testing)
└── scripts/            # Dev and deployment utilities
    └── schema/         # Database schema management (clean-schema.sql, rebuild scripts)
```

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

### Release Channels

Release channels allow community testing while maintaining clean package versions:

- **`alpha`**: Early development releases with experimental features
- **`beta`**: Pre-release builds for community testing (default)
- **`rc`**: Release candidates - stable builds awaiting final testing
- **`stable`**: Production releases

Channel configuration is stored in `release.json`.

### MSI Installer Components

The Windows MSI installer offers flexible deployment options:

**Desktop Client**:
- Tauri-based rich desktop interface
- Global hotkey support (Ctrl+Alt+H)
- System tray integration with auto-startup
- Connects to local or remote HotM server

**API Server (Centralized Deployment)**:
- Rust HTTP API server (port 53211)
- Windows Service installation
- PostgreSQL database with pgvector
- Ollama integration for NLP processing

## Environment Variables

- `DATABASE_URL`: PostgreSQL/DocumentDB connection string (required)
- `TEST_DATABASE_URL`: Test database for integration tests
- `RUST_LOG`: Logging level (default: `hotm_server=info,axum=info`)
- `OLLAMA_URL`: Ollama service URL (default: `http://localhost:11434`)
- `OLLAMA_GENERATION_MODEL`: LLM for text generation (default: `gpt-oss:20b`)
- `OLLAMA_EMBEDDING_MODEL`: Model for embeddings (default: `nomic-embed-text`)
- `JWT_SECRET`: Secret for JWT tokens (v0.2.0+)
- `API_KEY_SALT`: Salt for API key generation (v0.2.0+)

## Important Files

- `server/Cargo.toml` - Rust server dependencies
- `ui/package.json` - Frontend dependencies and scripts
- `ui/src-tauri/tauri.conf.json` - Tauri configuration
- `scripts/schema/clean-schema.sql` - Database schema
- `.github/workflows/` - CI/CD pipelines
- `release.json` - Release channel configuration

## Configuration Files

| File | Purpose |
|------|---------|
| `server/Cargo.toml` | Rust backend dependencies |
| `ui/package.json` | Frontend dependencies and npm scripts |
| `ui/vite.config.ts` | Vite build configuration |
| `ui/tailwind.config.js` | TailwindCSS styling |
| `ui/src-tauri/tauri.conf.json` | Tauri app configuration |
| `.github/workflows/*.yml` | GitHub Actions CI/CD |
| `.claude/settings.local.json` | Claude Code permissions |

---

## AIWG Framework Integration

This project uses the **AI Writing Guide SDLC framework** for software development lifecycle management.

### Installed Frameworks

| Framework | Version | Status |
|-----------|---------|--------|
| sdlc-complete | 1.0.0 | healthy |
| media-marketing-kit | 1.0.0 | healthy |

### Deployed Resources

- **Agents**: 57 SDLC role agents in `.claude/agents/`
- **Commands**: 73 slash commands in `.claude/commands/`
- **Artifacts**: `.aiwg/` directory with requirements, architecture, planning, testing

### Current Project State

- **Phase**: Construction (Iteration 1 complete)
- **Key Artifacts**:
  - `.aiwg/architecture/software-architecture-doc.md` - SAD
  - `.aiwg/architecture/ADR-*.md` - Architecture Decision Records
  - `.aiwg/planning/iteration-plan-*.md` - Iteration plans
  - `.aiwg/testing/master-test-plan.md` - Test strategy
  - `.aiwg/requirements/mvp-acceptance-criteria.md` - MVP criteria

### Claude Code Configuration

Local permissions configured in `.claude/settings.local.json`:
- PostgreSQL CLI commands allowed
- Process management commands allowed
- Read/write access to project files

### Core Platform Orchestrator Role

**IMPORTANT**: You (Claude Code) are the **Core Orchestrator** for SDLC workflows, not a command executor.

When users request SDLC workflows (natural language or commands):

#### 1. Interpret Natural Language

Map user requests to flow templates:
- "Let's transition to Elaboration" -> `flow-inception-to-elaboration`
- "Start security review" -> `flow-security-review-cycle`
- "Create architecture baseline" -> Extract SAD generation from flow
- "Run iteration 5" -> `flow-iteration-dual-track` with iteration=5

#### 2. Read Flow Commands as Orchestration Templates

**NOT bash scripts to execute**, but orchestration guides containing:
- **Artifacts to generate**: What documents/deliverables
- **Agent assignments**: Who is Primary Author, who reviews
- **Quality criteria**: What makes a document "complete"
- **Multi-agent workflow**: Review cycles, consensus process
- **Archive instructions**: Where to save final artifacts

Flow commands are located in `.claude/commands/flow-*.md`

#### 3. Launch Multi-Agent Workflows via Task Tool

**Follow this pattern for every artifact**:

```text
Primary Author -> Parallel Reviewers -> Synthesizer -> Archive
     |                 |                    |           |
  Draft v0.1    Reviews (3-5)      Final merge    .aiwg/archive/
```

**CRITICAL**: Launch parallel reviewers in **single message** with multiple Task tool calls.

#### 4. Track Progress and Communicate

Update user throughout with clear indicators:
- Complete
- In progress
- Error/blocked
- Warning/attention needed

### Available Commands (Key Categories)

**Intake & Inception**:
- `/intake-wizard` - Generate or complete intake forms interactively
- `/intake-from-codebase` - Analyze existing codebase to generate intake
- `/intake-start` - Validate intake and kick off Inception phase
- `/flow-concept-to-inception` - Execute Concept -> Inception workflow

**Phase Transitions**:
- `/flow-inception-to-elaboration` - Transition to Elaboration phase
- `/flow-elaboration-to-construction` - Transition to Construction phase
- `/flow-construction-to-transition` - Transition to Transition phase

**Continuous Workflows**:
- `/flow-risk-management-cycle` - Risk identification and mitigation
- `/flow-requirements-evolution` - Living requirements refinement
- `/flow-architecture-evolution` - Architecture change management
- `/flow-test-strategy-execution` - Test suite execution and validation
- `/flow-security-review-cycle` - Security validation and threat modeling

**Quality & Gates**:
- `/flow-gate-check <phase-name>` - Validate phase gate criteria
- `/project-status` - Current phase, milestone progress, next steps
- `/project-health-check` - Overall project health metrics

**Team & Process**:
- `/flow-team-onboarding <member> [role]` - Onboard new team member
- `/flow-knowledge-transfer <from> <to> [domain]` - Knowledge transfer workflow
- `/flow-retrospective-cycle <type> [iteration]` - Retrospective facilitation

**Deployment & Operations**:
- `/flow-deploy-to-production` - Production deployment
- `/flow-incident-response <incident-id> [severity]` - Production incident triage

### AIWG-Specific Rules

1. **Artifact Location**: All SDLC artifacts MUST be created in `.aiwg/` subdirectories (not project root)
2. **Agent Orchestration**: Follow multi-agent patterns (Primary Author -> Parallel Reviewers -> Synthesizer -> Archive)
3. **Phase Gates**: Validate gate criteria before transitioning phases (use `flow-gate-check`)
4. **Traceability**: Maintain traceability from requirements -> code -> tests -> deployment
5. **Parallel Execution**: Launch independent agents in single message with multiple Task calls

### Phase Overview

**Inception** (4-6 weeks):
- Validate problem, vision, risks
- Architecture sketch, ADRs
- **Milestone**: Lifecycle Objective (LO)

**Elaboration** (4-8 weeks):
- Detailed requirements (use cases, NFRs)
- Architecture baseline (SAD, component design)
- **Milestone**: Lifecycle Architecture (LA)

**Construction** (8-16 weeks):
- Feature implementation
- Automated testing (unit, integration, E2E)
- **Milestone**: Initial Operational Capability (IOC)

**Transition** (2-4 weeks):
- Production deployment
- User acceptance testing
- **Milestone**: Product Release (PR)

---

## Troubleshooting

**Template Not Found**:
- Verify AIWG installation at `~/.local/share/ai-writing-guide`
- Check `.claude/settings.local.json` has read access to AIWG path

**Agent Access Denied**:
- Verify path uses absolute path (not `~` shorthand for user home)

**Command Not Found**:
- Run `/aiwg-refresh` to redeploy commands

## Resources

- **AIWG Repository**: https://github.com/jmagly/ai-writing-guide
- **Project Documentation**: [docs/index.md](docs/index.md)
- **API Specification**: [docs/specifications/api-specification.md](docs/specifications/api-specification.md)
- **Architecture**: [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)

---

<!--
  USER NOTES
  Add team-specific directives, conventions, or notes below.
  Use <!-- PRESERVE --> markers for content that must survive regeneration.
-->
