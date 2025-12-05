# Team Onboarding Guide - HotM

**Project**: HotM (Hall Of The Mind)
**Version**: 0.1.2 (Alpha)
**Phase**: Construction (Elaboration complete)
**Last Updated**: 2025-12-04
**Target Audience**: Solo developer (self-reference), future contributors, AI assistants

---

## Welcome to HotM

This guide serves as comprehensive onboarding documentation for the HotM project. While primarily a solo development effort, this guide provides:

1. **Self-Reference**: Quick access to essential project context
2. **Knowledge Preservation**: Captured decisions and architecture for future reference
3. **AI Assistant Context**: Comprehensive context for Claude Code and other AI tools
4. **Future Contributor Foundation**: Ready for when the project expands

---

## 1. Project Overview

### What is HotM?

**HotM (Hall Of The Mind)** is a local-first notes and analysis tool that maintains immutable originals while providing AI-enhanced views through local NLP processing. Think of it as a personal knowledge management system that never forgets, always connects, and continuously learns from your notes.

### Core Value Proposition

**Problem**: You capture quick notes but they become isolated fragments. Context is lost, connections are missed, and finding related thoughts becomes difficult.

**Solution**: HotM automatically:
- Preserves your original notes forever (immutable storage)
- Creates enhanced revisions through local AI processing
- Discovers semantic connections between notes
- Enables hybrid search (keyword + meaning)
- Tags and organizes content automatically

**Key Principle**: "Your thoughts, your machine, forever." All data and processing stays local.

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Desktop UI** | Tauri 2.4 + React 19 | Native Windows 11 app with web tech |
| **API Server** | Rust + Axum 0.7 | Async HTTP API (port 53211) |
| **Database** | PostgreSQL 14+ + pgvector | Document storage + vector search |
| **NLP Engine** | Ollama (local LLM) | Text generation, embeddings, tagging |
| **Build Tools** | Cargo (Rust), Vite (frontend) | Compilation and bundling |
| **Testing** | GitHub Actions + Act | Local CI/CD validation |

### Architecture at a Glance

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│             │         │             │         │              │
│  Tauri UI   │──HTTP──▶│  Axum API   │──SQL───▶│  PostgreSQL  │
│  (React)    │         │  (Rust)     │         │  + pgvector  │
│             │         │             │         │              │
└─────────────┘         └──────┬──────┘         └──────────────┘
                               │
                               │ HTTP
                               ▼
                        ┌──────────────┐
                        │              │
                        │   Ollama     │
                        │  (Local LLM) │
                        │              │
                        └──────────────┘
```

**Flow**: User creates note → Stored immutably → Background job queued → Ollama enhances → Updated indexes → Searchable

---

## 2. Development Environment Setup

### Prerequisites

Before starting, ensure you have:

| Requirement | Version | Installation |
|------------|---------|--------------|
| **Rust** | 1.70+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Node.js** | 20+ | Download from https://nodejs.org |
| **PostgreSQL** | 14+ | Docker (recommended) or native install |
| **Ollama** | Latest | Download from https://ollama.com |
| **Git** | Any recent | `sudo apt install git` (Linux) or download installer |
| **GitHub CLI** | Latest | `sudo apt install gh` (for `gh act` testing) |
| **Act** | Latest | `gh extension install https://github.com/nektos/gh-act` |

**Windows 11 Users**: Install WSL2 for best development experience. Many scripts assume bash.

### Clone and Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/hotm.git
cd hotm

# 2. Start PostgreSQL (Docker - recommended)
docker run -d \
  --name hotm-postgres \
  -e POSTGRES_PASSWORD=dev_pass \
  -e POSTGRES_USER=hotm \
  -e POSTGRES_DB=hotm_dev \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# 3. Set environment variable
export DATABASE_URL=postgres://hotm:dev_pass@localhost:5432/hotm_dev

# 4. Initialize database schema
./scripts/schema/rebuild-schema.sh

# 5. Pull Ollama models (runs in background)
ollama pull gpt-oss:20b          # Generation model (~11GB)
ollama pull nomic-embed-text     # Embedding model (~274MB)
```

### Alternative: One-Command Dev Setup

```bash
# Checks dependencies, starts services, initializes database
./scripts/dev_server.sh
```

This script:
- Verifies Ollama is running
- Ensures required models are available
- Creates database if missing
- Runs schema migrations
- Starts the Axum API server

### Environment Variables

Create `.env` file in project root:

```env
# Required
DATABASE_URL=postgres://hotm:dev_pass@localhost:5432/hotm_dev

# Optional (these are defaults)
RUST_LOG=hotm_server=info,axum=info
OLLAMA_URL=http://localhost:11434
OLLAMA_GENERATION_MODEL=gpt-oss:20b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Future (v0.2.0+)
JWT_SECRET=your-secret-key-here
API_KEY_SALT=your-salt-here
```

### Running the Application

**Terminal 1 - API Server**:
```bash
cd server
cargo run
# Server starts on http://127.0.0.1:53211
```

**Terminal 2 - Desktop UI**:
```bash
cd ui
npm install    # First time only
npm run dev
# Tauri window opens automatically
```

**Verify Everything Works**:
```bash
# Health check
curl http://127.0.0.1:53211/api/v1/health

# Create test note
curl -X POST http://127.0.0.1:53211/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Hello HotM"}'
```

---

## 3. Codebase Tour

### Repository Structure

```
hotm/
├── .aiwg/                    # SDLC artifacts (requirements, architecture, testing)
│   ├── intake/               # Project intake and solution profile
│   ├── requirements/         # MVP criteria, use cases
│   ├── architecture/         # Software Architecture Document, ADRs
│   ├── planning/             # Phase plans (Inception, Elaboration, Construction)
│   ├── testing/              # Master Test Plan, coverage reports
│   ├── risks/                # Risk register and mitigation
│   ├── gates/                # Phase gate validation reports
│   └── reports/              # Status reports, transition documents
│
├── docs/                     # User-facing documentation
│   ├── index.md              # Documentation navigation hub
│   ├── requirements/         # Functional and non-functional requirements
│   ├── specifications/       # API spec, MCP tools, data model
│   ├── architecture/         # System architecture, NLP pipeline design
│   ├── implementation/       # Development guide, testing strategy
│   └── deployment/           # Docker deployment, installation guides
│
├── server/                   # Rust API server (Axum)
│   ├── src/
│   │   ├── main.rs           # Server entry point, route registration
│   │   ├── db.rs             # Database connection pool (SQLx)
│   │   ├── models.rs         # Database models (Note, Revision, etc.)
│   │   ├── ollama.rs         # Ollama client for LLM interactions
│   │   ├── routes/           # API endpoint handlers
│   │   │   ├── notes.rs      # Note CRUD operations
│   │   │   ├── search.rs     # Hybrid search (FTS + vector)
│   │   │   ├── tags.rs       # Tag management
│   │   │   └── collections.rs # Collection management
│   │   └── workers/          # Background job processing (future)
│   ├── migrations/           # SQLx database migrations (historical reference)
│   ├── tests/                # Integration tests
│   └── Cargo.toml            # Rust dependencies
│
├── ui/                       # Tauri desktop application
│   ├── src/                  # React frontend (TypeScript)
│   │   ├── App.tsx           # Main application component
│   │   ├── components/       # UI components (NoteList, Editor, Search)
│   │   ├── hooks/            # React hooks (useNotes, useSearch)
│   │   ├── services/         # API client, data fetching
│   │   └── styles/           # Tailwind CSS, global styles
│   ├── src-tauri/            # Rust backend for Tauri
│   │   ├── src/main.rs       # Tauri app entry, system integration
│   │   └── Cargo.toml        # Tauri dependencies
│   ├── tests/                # Playwright E2E tests
│   └── package.json          # Node.js dependencies
│
├── scripts/                  # Development and deployment utilities
│   ├── schema/               # Database schema management
│   │   ├── clean-schema.sql  # Consolidated schema (all migrations)
│   │   ├── rebuild-schema.sh # Fast schema rebuild (Linux/WSL)
│   │   └── rebuild-schema.ps1 # Fast schema rebuild (PowerShell)
│   ├── dev_server.sh         # One-command dev environment setup
│   ├── check_versions.sh     # Verify version consistency
│   └── bump_version.sh       # Update version across all files
│
├── .github/
│   └── workflows/
│       ├── backend-tests.yml # Rust CI (tests, clippy, fmt, audit)
│       ├── frontend-tests.yml # React CI (tests, build, coverage, audit)
│       └── release.yml       # MSI builds, release artifacts
│
├── CLAUDE.md                 # Claude Code guidance (read this first!)
├── README.md                 # Project overview
└── docker-compose.dev.yml    # Docker development environment
```

### Key Files and Their Purposes

**Configuration**:
- `CLAUDE.md` - Primary guidance for AI assistants and developers
- `Cargo.toml` (server, ui/src-tauri) - Rust dependencies and metadata
- `package.json` (ui) - Node.js dependencies and scripts
- `.env` - Environment variables (not committed, create locally)

**Entry Points**:
- `server/src/main.rs` - API server startup and route registration
- `ui/src-tauri/src/main.rs` - Tauri desktop app initialization
- `ui/src/App.tsx` - React UI root component

**Core Business Logic**:
- `server/src/models.rs` - Database models and query methods
- `server/src/routes/` - API endpoint implementations
- `server/src/ollama.rs` - LLM integration for NLP features
- `ui/src/services/` - Frontend API client

**Architecture Documentation**:
- `.aiwg/architecture/software-architecture-doc.md` - Complete system design
- `.aiwg/architecture/adr/` - Architecture Decision Records (ADRs)
- `docs/architecture/system-architecture.md` - User-facing architecture overview

### Understanding the Data Flow

**Creating a Note (Complete Journey)**:

1. **User Input** (UI)
   - User types note in `ui/src/components/NoteEditor.tsx`
   - React component calls `services/api.ts`

2. **API Request** (Frontend → Backend)
   - POST to `http://127.0.0.1:53211/api/v1/notes`
   - JSON body: `{title, content, tags?}`

3. **API Handler** (Backend)
   - `server/src/routes/notes.rs::create_note()`
   - Validates input
   - Calls `models::Note::create()`

4. **Database Insert** (Backend → PostgreSQL)
   - `server/src/models.rs::Note::create()`
   - SQLx inserts into `notes` table
   - Returns `Note` with generated ID

5. **Job Queueing** (Backend → Job Queue)
   - Insert job into `jobs` table
   - Job type: `enhance_note`
   - Payload: `{note_id, content}`

6. **Response** (Backend → Frontend)
   - Returns created note JSON
   - HTTP 201 Created

7. **Background Processing** (Job Worker)
   - Worker polls job queue
   - Calls `ollama.rs::generate_embedding()`
   - Calls `ollama.rs::generate_summary()`
   - Updates `revisions` and `embeddings` tables

8. **UI Update** (Frontend)
   - Displays note immediately (optimistic UI)
   - Polls or WebSocket for enhancement completion
   - Shows enhanced version when ready

---

## 4. Development Workflow

### Making Changes

**Standard Development Cycle**:

1. **Create Feature Branch** (optional for solo dev):
   ```bash
   git checkout -b feature/add-note-export
   ```

2. **Make Changes**:
   - Edit code in `server/src/` or `ui/src/`
   - Follow Rust/TypeScript conventions
   - Add tests for new functionality

3. **Run Tests Locally**:
   ```bash
   # Quick iteration (unit tests only)
   cd server && cargo test
   cd ui && npm test -- --run

   # Full validation (use before committing)
   gh act -j backend-tests
   gh act -j frontend-tests
   ```

4. **Format Code**:
   ```bash
   cd server && cargo fmt
   cd ui && npm run format
   ```

5. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: add note export functionality"
   ```

6. **Push to Remote**:
   ```bash
   git push origin feature/add-note-export
   ```

### Running Tests

**CRITICAL**: `gh act` is the **authoritative standard** for all testing.

**Before pushing ANY changes**:
```bash
# 1. Run backend tests
gh act -j backend-tests

# 2. Run frontend tests
gh act -j frontend-tests

# 3. Verify both exit code 0 and all tests pass
# 4. Only push after confirming green local test runs
```

**What `gh act` validates**:

**Backend** (`backend-tests.yml`):
- Rust unit tests (`cargo test`)
- Clippy lints (`cargo clippy`)
- Code formatting (`cargo fmt --check`)
- Security audit (`cargo audit`)

**Frontend** (`frontend-tests.yml`):
- React unit tests (`npm test`)
- TypeScript compilation (`npm run build`)
- Test coverage reporting
- Security audit (`npm audit`)

**Quick Local Iteration** (not comprehensive):
```bash
# Run specific test file
cargo test --test integration_tests

# Run with output
cargo test -- --nocapture

# Frontend watch mode
npm test -- --watch
```

### Commit Conventions

Use semantic commit prefixes:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `feat:` | New feature | `feat: add WebSocket real-time sync` |
| `fix:` | Bug fix | `fix: correct search result ranking` |
| `refactor:` | Code restructuring | `refactor: extract Ollama client to module` |
| `test:` | Add/update tests | `test: add coverage for note linking` |
| `docs:` | Documentation only | `docs: update API specification` |
| `chore:` | Maintenance tasks | `chore: update dependencies` |
| `perf:` | Performance improvement | `perf: optimize vector search query` |
| `ci:` | CI/CD changes | `ci: add coverage threshold enforcement` |

**No additional attribution**: Commits should contain only relevant content (per CLAUDE.local.md).

### Quality Gates

**Must Pass Before Merging**:
- [ ] All tests pass (`gh act -j backend-tests` and `gh act -j frontend-tests`)
- [ ] No clippy warnings (`cargo clippy`)
- [ ] Code formatted (`cargo fmt`, `npm run format`)
- [ ] No security vulnerabilities (`cargo audit`, `npm audit`)
- [ ] Documentation updated (if applicable)

**No exceptions** - even for "simple" fixes. Act tests are single source of truth.

---

## 5. Key Documentation

### Essential Reading

**Start Here**:
1. `CLAUDE.md` - Development commands, testing discipline, version management
2. `README.md` - Project overview and quick start
3. `docs/index.md` - Documentation navigation hub

**Architecture & Design**:
1. `.aiwg/architecture/software-architecture-doc.md` - Complete system architecture
2. `.aiwg/architecture/adr/` - Architecture Decision Records:
   - ADR-001: Client-Server Architecture
   - ADR-002: Database Schema Rebuild Strategy
   - ADR-003: Local-First Privacy Principles
3. `docs/architecture/nlp-pipeline.md` - NLP processing flow

**Requirements**:
1. `.aiwg/requirements/mvp-acceptance-criteria.md` - MVP feature scope
2. `docs/requirements/` - Detailed functional and non-functional requirements

**API Reference**:
1. `docs/specifications/api-specification.md` - REST API endpoints
2. `docs/specifications/mcp-tools-spec.md` - MCP server integration
3. `docs/specifications/data-model.md` - Database schema

**Testing**:
1. `.aiwg/testing/master-test-plan.md` - Testing strategy and coverage targets
2. `docs/implementation/testing-strategy.md` - Test organization and best practices

**Development**:
1. `docs/implementation/development-guide.md` - Detailed setup and workflow
2. `scripts/schema/README.md` - Database schema management

### SDLC Artifacts (.aiwg/ Directory)

The `.aiwg/` directory contains comprehensive Software Development Lifecycle artifacts:

**Purpose**: Track project lifecycle from Inception → Elaboration → Construction → Transition → Production

**Key Artifacts**:

| Directory | Contents | Purpose |
|-----------|----------|---------|
| `intake/` | Project intake, solution profile | Initial project scoping |
| `requirements/` | MVP criteria, use cases, acceptance tests | What we're building |
| `architecture/` | SAD, ADRs, design decisions | How we're building it |
| `planning/` | Phase plans (Inception, Elaboration, Construction) | When and how we execute |
| `testing/` | Master Test Plan, coverage reports | Quality assurance strategy |
| `risks/` | Risk register, mitigation plans | What could go wrong |
| `gates/` | Phase gate validation reports | Quality gates between phases |
| `reports/` | Status reports, transition documents | Progress tracking |
| `working/` | Temporary work-in-progress files | Safe to delete after archiving |

**Current Phase**: Construction (Elaboration complete, ABM validated)

**Using SDLC Artifacts**:
```bash
# Check current project phase
cat .aiwg/planning/phase-plan-elaboration.md

# Review architecture decisions
ls .aiwg/architecture/adr/

# Understand risk landscape
cat .aiwg/risks/risk-list.md

# View test strategy
cat .aiwg/testing/master-test-plan.md
```

---

## 6. Getting Help

### Documentation Resources

**Quick Reference**:
- Development commands: `CLAUDE.md`
- API endpoints: `docs/specifications/api-specification.md`
- Common issues: Check GitHub Issues or search codebase

**Deep Dives**:
- Architecture questions: `.aiwg/architecture/software-architecture-doc.md`
- Testing questions: `.aiwg/testing/master-test-plan.md`
- Deployment questions: `docs/deployment/docker-deployment.md`

### AI Assistant Usage

**Claude Code Integration**:

This project is designed for AI-assisted development. Claude Code has comprehensive context from:
- `CLAUDE.md` (primary guidance)
- `.aiwg/` (SDLC artifacts)
- `docs/` (technical documentation)

**Asking Effective Questions**:

```text
Good: "How do I add a new API endpoint for note export?"
→ Specific, actionable, scoped

Bad: "Make the app better"
→ Too vague, unclear intent

Good: "Review the search query performance. The hybrid search is taking 2 seconds at 1000 notes."
→ Provides context, specific problem

Good: "Implement ADR-004 for hybrid search with RRF fusion"
→ References existing decision, clear scope
```

**AI Agent Roles** (from AIWG framework):

When working with AI assistants, you can invoke specialized roles:

| Role | Use When | Example |
|------|----------|---------|
| **Requirements Analyst** | Clarifying features, acceptance criteria | "As Requirements Analyst, validate this use case..." |
| **Code Architect** | Designing components, integration | "As Code Architect, design a job queue for background tasks..." |
| **QA Specialist** | Test strategy, coverage | "As QA Specialist, create tests for note linking..." |
| **Security Architect** | Security reviews, threat modeling | "As Security Architect, review authentication approach..." |
| **Technical Writer** | Documentation clarity | "As Technical Writer, review this API documentation..." |

### Common Issues and Solutions

**Issue**: Database connection fails
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Verify DATABASE_URL
echo $DATABASE_URL

# Recreate schema
./scripts/schema/rebuild-schema.sh
```

**Issue**: Ollama models not found
```bash
# Check Ollama is running
ollama list

# Pull required models
ollama pull gpt-oss:20b
ollama pull nomic-embed-text
```

**Issue**: Frontend won't start
```bash
# Reinstall dependencies
cd ui
rm -rf node_modules package-lock.json
npm install

# Verify API server is running
curl http://127.0.0.1:53211/api/v1/health
```

**Issue**: Tests fail in `gh act`
```bash
# Run locally to see detailed output
cd server && cargo test -- --nocapture

# Check for missing environment variables
cat .env

# Ensure test database exists
psql $DATABASE_URL -c "SELECT version();"
```

---

## 7. Next Steps

### Immediate Actions (First Day)

- [ ] Clone repository
- [ ] Install prerequisites (Rust, Node.js, PostgreSQL, Ollama)
- [ ] Run setup scripts (`./scripts/dev_server.sh`)
- [ ] Start API server (`cd server && cargo run`)
- [ ] Start UI (`cd ui && npm run dev`)
- [ ] Create first note
- [ ] Run tests (`gh act -j backend-tests`, `gh act -j frontend-tests`)

### Short-Term Goals (First Week)

- [ ] Read `CLAUDE.md` thoroughly
- [ ] Review `.aiwg/architecture/software-architecture-doc.md`
- [ ] Explore codebase structure
- [ ] Run and understand test suite
- [ ] Make small code change and verify CI passes
- [ ] Review ADRs to understand key decisions

### Medium-Term Goals (First Month)

- [ ] Complete a feature end-to-end (UI → API → DB → Tests)
- [ ] Add test coverage for new code
- [ ] Document architectural decisions (if needed)
- [ ] Validate MVP features work as expected
- [ ] Begin daily personal use for validation

---

## 8. Project Status and Roadmap

### Current Status

**Version**: 0.1.2 (Alpha)
**Phase**: Construction (Week 1)
**Last Major Milestone**: ABM (Architecture Baseline Milestone) - Validated 2025-12-04

**What's Working**:
- Note CRUD operations
- Basic search (FTS + vector)
- Ollama integration (embeddings, summarization)
- Tauri desktop app (Windows 11)
- Database schema with pgvector

**In Progress** (Construction Phase):
- Test coverage push (target 60%+)
- Performance optimization
- WebSocket real-time updates
- Enhanced UI/UX polish

**Not Yet Implemented**:
- MCP server integration
- Authentication and multi-user support
- MSI installer
- Cross-platform builds (Linux, macOS)

### MVP Scope

See `.aiwg/requirements/mvp-acceptance-criteria.md` for complete list.

**Core Features**:
1. Create, view, edit notes
2. AI-powered enhancement (summarization, tagging)
3. Hybrid search (keyword + semantic)
4. Automatic note linking
5. Collections and tags
6. Windows 11 native app

**Deferred to v0.2.0+**:
- Cloud sync
- Mobile clients
- Advanced collaboration features
- Embedded database option

### Roadmap

**v0.1.x (Current - Alpha)**:
- Personal validation (3-6 months daily use)
- Core stability and performance
- Test coverage target (60%+)

**v0.2.0 (Beta)**:
- MCP server implementation
- Authentication and API keys
- Multi-device support (same user)
- MSI installer for Windows

**v1.0.0 (Stable)**:
- Public release (open source)
- Cross-platform support (Windows, Linux, macOS)
- Comprehensive documentation
- Community onboarding

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **ABM** | Architecture Baseline Milestone - End of Elaboration phase |
| **ADR** | Architecture Decision Record - Documents key architectural choices |
| **AIWG** | AI Writing Guide - SDLC framework for AI-assisted development |
| **FTS** | Full-Text Search - PostgreSQL tsvector search |
| **HNSW** | Hierarchical Navigable Small World - Vector indexing algorithm |
| **LOM** | Lifecycle Objective Milestone - End of Inception phase |
| **MVP** | Minimum Viable Product - Core features for initial release |
| **NLP** | Natural Language Processing - AI text analysis |
| **RRF** | Reciprocal Rank Fusion - Search result merging algorithm |
| **SAD** | Software Architecture Document - Comprehensive architecture spec |
| **Steel Thread** | End-to-end implementation validating architecture |

---

## Appendix B: Quick Command Reference

**Development**:
```bash
# Start API server
cd server && cargo run

# Start UI dev mode
cd ui && npm run dev

# Run tests (authoritative)
gh act -j backend-tests
gh act -j frontend-tests

# Quick local tests
cargo test && npm test -- --run

# Format code
cargo fmt && npm run format

# Check for issues
cargo clippy && npm run lint
```

**Database**:
```bash
# Fast schema rebuild
./scripts/schema/rebuild-schema.sh

# Traditional migrations
cd server && sqlx migrate run

# Update SQLx prepared queries
cd server && cargo sqlx prepare
```

**Ollama**:
```bash
# Pull models
ollama pull gpt-oss:20b
ollama pull nomic-embed-text

# Check models
ollama list

# Test generation
ollama run gpt-oss:20b "Summarize: Your note text"
```

**Version Management**:
```bash
# Check version consistency
./scripts/check_versions.sh

# Bump version
./scripts/bump_version.sh 0.1.3
```

---

## Appendix C: Contact and Support

**Primary Contact**: Solo developer (self-managed)

**Issue Tracking**: GitHub Issues (when public)

**Documentation**:
- Technical: `docs/` directory
- SDLC: `.aiwg/` directory
- Code guidance: `CLAUDE.md`

**AI Assistant**: Claude Code (configured for project context)

---

**Document Status**: COMPLETE
**Last Review**: 2025-12-04
**Next Review**: At phase transition or team expansion

---

**Welcome aboard! Happy coding.**
