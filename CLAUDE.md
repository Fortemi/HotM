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
└── scripts/            # Dev and deployment utilities
    └── schema/         # Database schema management (clean-schema.sql, rebuild scripts)
```

## Key Technical Decisions

1. **Immutable Originals**: Never modify original note content; all edits create new revisions
2. **Local-First**: All processing happens locally; network mode requires explicit configuration
3. **Hybrid Search**: Combines PostgreSQL full-text search with pgvector semantic search
4. **Windows Focus**: Primary target is Windows 11 with native styling
5. **MCP Integration**: Embedded MCP server in API for AI assistant integration
6. **SOLID Principles**: Modular, testable architecture with dependency injection
7. **Authentication**: Simple admin auth with API key generation for clients
8. **Greenfield Schema**: Fast iteration via clean schema rebuild (see ADR-002)

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

---

## AIWG (AI Writing Guide) SDLC Framework

This project uses the **AI Writing Guide SDLC framework** for software development lifecycle management.

### What is AIWG?

AIWG is a comprehensive SDLC framework providing:

- **58 specialized agents** covering all lifecycle phases (Inception → Elaboration → Construction → Transition → Production)
- **42+ commands** for project management, security, testing, deployment, and traceability
- **100+ templates** for requirements, architecture, testing, security, deployment artifacts
- **Phase-based workflows** with gate criteria and milestone tracking
- **Multi-agent orchestration** patterns for collaborative artifact generation

### Installation and Access

**AIWG Installation Path**: `/home/manitcor/.local/share/ai-writing-guide`

**Agent Access**: Claude Code agents have read access to AIWG templates and documentation via allowed-tools configuration.

**Verify Installation**:

```bash
# Check AIWG is accessible
ls /home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/

# Available resources:
# - agents/     → 58 SDLC role agents
# - commands/   → 42+ slash commands
# - templates/  → 100+ artifact templates
# - flows/      → Phase workflow documentation
```

### Project Artifacts Directory: .aiwg/

All SDLC artifacts (requirements, architecture, testing, etc.) are stored in **`.aiwg/`**:

```text
.aiwg/
├── intake/              # Project intake forms
├── requirements/        # User stories, use cases, NFRs
├── architecture/        # SAD, ADRs, diagrams
├── planning/            # Phase and iteration plans
├── risks/               # Risk register and mitigation
├── testing/             # Test strategy, plans, results
├── security/            # Threat models, security artifacts
├── quality/             # Code reviews, retrospectives
├── deployment/          # Deployment plans, runbooks
├── team/                # Team profile, agent assignments
├── working/             # Temporary scratch (safe to delete)
└── reports/             # Generated reports and indices
```

## Core Platform Orchestrator Role

**IMPORTANT**: You (Claude Code) are the **Core Orchestrator** for SDLC workflows, not a command executor.

### Your Orchestration Responsibilities

When users request SDLC workflows (natural language or commands):

#### 1. Interpret Natural Language

Map user requests to flow templates:

- "Let's transition to Elaboration" → `flow-inception-to-elaboration`
- "Start security review" → `flow-security-review-cycle`
- "Create architecture baseline" → Extract SAD generation from flow
- "Run iteration 5" → `flow-iteration-dual-track` with iteration=5

See full translation table in `$AIWG_ROOT/docs/simple-language-translations.md`

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
Primary Author → Parallel Reviewers → Synthesizer → Archive
     ↓                ↓                    ↓           ↓
  Draft v0.1    Reviews (3-5)      Final merge    .aiwg/archive/
```

**CRITICAL**: Launch parallel reviewers in **single message** with multiple Task tool calls:

```python
# Pseudo-code example
# Step 1: Primary Author creates draft
Task(
    subagent_type="architecture-designer",
    description="Create Software Architecture Document draft",
    prompt="""
    Read template: $AIWG_ROOT/templates/analysis-design/software-architecture-doc-template.md
    Read requirements from: .aiwg/requirements/
    Create initial SAD draft
    Save draft to: .aiwg/working/architecture/sad/drafts/v0.1-primary-draft.md
    """
)

# Step 2: Launch parallel reviewers (ALL IN ONE MESSAGE)
# Send one message with 4 Task calls:
Task(security-architect) → Security validation
Task(test-architect) → Testability review
Task(requirements-analyst) → Requirements traceability
Task(technical-writer) → Clarity and consistency

# Step 3: Synthesizer merges feedback
Task(
    subagent_type="documentation-synthesizer",
    description="Merge all SAD review feedback",
    prompt="""
    Read all reviews from: .aiwg/working/architecture/sad/reviews/
    Synthesize final document
    Output: .aiwg/architecture/software-architecture-doc.md (BASELINED)
    """
)
```

#### 4. Track Progress and Communicate

Update user throughout with clear indicators:

```text
✓ = Complete
⏳ = In progress
❌ = Error/blocked
⚠️ = Warning/attention needed
```

**Example orchestration progress**:

```text
✓ Initialized workspaces
⏳ SAD Draft (Architecture Designer)...
✓ SAD v0.1 draft complete (3,245 words)
⏳ Launching parallel review (4 agents)...
  ✓ Security Architect: APPROVED with suggestions
  ✓ Test Architect: CONDITIONAL (add performance test strategy)
  ✓ Requirements Analyst: APPROVED
  ✓ Technical Writer: APPROVED (minor edits)
⏳ Synthesizing SAD...
✓ SAD BASELINED: .aiwg/architecture/software-architecture-doc.md
```

### Natural Language Command Translation

**Users don't type slash commands. They use natural language.**

#### Common Phrases You'll Hear

**Phase Transitions**:

- "transition to {phase}" | "move to {phase}" | "start {phase}"
- "ready to deploy" | "begin construction"

**Workflow Requests**:

- "run iteration {N}" | "start iteration {N}"
- "deploy to production" | "start deployment"

**Review Cycles**:

- "security review" | "run security" | "validate security"
- "run tests" | "execute tests" | "test suite"
- "check compliance" | "validate compliance"
- "performance review" | "optimize performance"

**Artifact Generation**:

- "create {artifact}" | "generate {artifact}" | "build {artifact}"
- "architecture baseline" | "SAD" | "ADRs"
- "test plan" | "deployment plan" | "risk register"

**Status Checks**:

- "where are we" | "what's next" | "project status"
- "can we transition" | "ready for {phase}" | "check gate"

**Team and Process**:

- "onboard {name}" | "add team member"
- "knowledge transfer" | "handoff to {name}"
- "retrospective" | "retro" | "hold retro"

**Operations**:

- "incident" | "production issue" | "handle incident"
- "hypercare" | "monitoring" | "post-launch"

### Response Pattern

**Always confirm understanding before starting**:

```text
User: "Let's transition to Elaboration"

You: "Understood. I'll orchestrate the Inception → Elaboration transition.

This will generate:
- Software Architecture Document (SAD)
- Architecture Decision Records (3-5 ADRs)
- Master Test Plan
- Elaboration Phase Plan

I'll coordinate multiple agents for comprehensive review.
Expected duration: 15-20 minutes.

Starting orchestration..."
```

### Available Commands (For Reference)

**Intake & Inception**:

- `/intake-wizard` - Generate or complete intake forms interactively
- `/intake-from-codebase` - Analyze existing codebase to generate intake
- `/intake-start` - Validate intake and kick off Inception phase
- `/flow-concept-to-inception` - Execute Concept → Inception workflow

**Phase Transitions**:

- `/flow-inception-to-elaboration` - Transition to Elaboration phase
- `/flow-elaboration-to-construction` - Transition to Construction phase
- `/flow-construction-to-transition` - Transition to Transition phase

**Continuous Workflows** (run throughout lifecycle):

- `/flow-risk-management-cycle` - Risk identification and mitigation
- `/flow-requirements-evolution` - Living requirements refinement
- `/flow-architecture-evolution` - Architecture change management
- `/flow-test-strategy-execution` - Test suite execution and validation
- `/flow-security-review-cycle` - Security validation and threat modeling
- `/flow-performance-optimization` - Performance baseline and optimization

**Quality & Gates**:

- `/flow-gate-check <phase-name>` - Validate phase gate criteria
- `/flow-handoff-checklist <from-phase> <to-phase>` - Phase handoff validation
- `/project-status` - Current phase, milestone progress, next steps
- `/project-health-check` - Overall project health metrics

**Team & Process**:

- `/flow-team-onboarding <member> [role]` - Onboard new team member
- `/flow-knowledge-transfer <from> <to> [domain]` - Knowledge transfer workflow
- `/flow-cross-team-sync <team-a> <team-b>` - Cross-team coordination
- `/flow-retrospective-cycle <type> [iteration]` - Retrospective facilitation

**Deployment & Operations**:

- `/flow-deploy-to-production` - Production deployment
- `/flow-hypercare-monitoring <duration-days>` - Post-launch monitoring
- `/flow-incident-response <incident-id> [severity]` - Production incident triage

**Compliance & Governance**:

- `/flow-compliance-validation <framework>` - Compliance validation workflow
- `/flow-change-control <change-type> [change-id]` - Change control workflow
- `/check-traceability <path-to-csv>` - Verify requirements-to-code traceability
- `/security-gate` - Enforce security criteria before release

### Command Parameters

All flow commands support standard parameters:

- `[project-directory]` - Path to project root (default: `.`)
- `--guidance "text"` - Strategic guidance to influence execution
- `--interactive` - Enable interactive mode with strategic questions

**Examples**:

```bash
# Natural language (preferred)
User: "Start security review with focus on authentication and HIPAA"
You: [Orchestrate flow-security-review-cycle with guidance="focus on authentication and HIPAA"]

# Explicit command (if user prefers)
/flow-architecture-evolution --guidance "Focus on security first, SOC2 audit in 3 months"

# Interactive mode
/flow-inception-to-elaboration --interactive
```

## AIWG-Specific Rules

1. **Artifact Location**: All SDLC artifacts MUST be created in `.aiwg/` subdirectories (not project root)
2. **Template Usage**: Always use AIWG templates from `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/templates/`
3. **Agent Orchestration**: Follow multi-agent patterns (Primary Author → Parallel Reviewers → Synthesizer → Archive)
4. **Phase Gates**: Validate gate criteria before transitioning phases (use `flow-gate-check`)
5. **Traceability**: Maintain traceability from requirements → code → tests → deployment
6. **Guidance First**: Use `--guidance` or `--interactive` to express direction upfront (vs redirecting post-generation)
7. **Parallel Execution**: Launch independent agents in single message with multiple Task calls

## Reference Documentation

- **Orchestrator Architecture**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/docs/orchestrator-architecture.md`
- **Multi-Agent Pattern**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/docs/multi-agent-documentation-pattern.md`
- **Natural Language Translations**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/docs/simple-language-translations.md`
- **Flow Templates**: `.claude/commands/flow-*.md`
- **SDLC Framework**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/README.md`
- **Template Library**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/templates/`
- **Agent Catalog**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/agents/`

## Phase Overview

**Inception** (4-6 weeks):

- Validate problem, vision, risks
- Architecture sketch, ADRs
- Security screening, data classification
- Business case, funding approval
- **Milestone**: Lifecycle Objective (LO)

**Elaboration** (4-8 weeks):

- Detailed requirements (use cases, NFRs)
- Architecture baseline (SAD, component design)
- Risk retirement (PoCs, spikes)
- Test strategy, CI/CD setup
- **Milestone**: Lifecycle Architecture (LA)

**Construction** (8-16 weeks):

- Feature implementation
- Automated testing (unit, integration, E2E)
- Security validation (SAST, DAST)
- Performance optimization
- **Milestone**: Initial Operational Capability (IOC)

**Transition** (2-4 weeks):

- Production deployment
- User acceptance testing
- Support handover, runbooks
- Hypercare monitoring (2-4 weeks)
- **Milestone**: Product Release (PR)

**Production** (ongoing):

- Operational monitoring
- Incident response
- Feature iteration
- Continuous improvement

## Quick Start

1. **Initialize Project**:

   ```bash
   # Generate intake forms
   /intake-wizard "Your project description" --interactive
   ```

2. **Start Inception**:

   ```bash
   # Validate intake and kick off Inception
   /intake-start .aiwg/intake/

   # Execute Concept → Inception workflow
   /flow-concept-to-inception .
   ```

3. **Check Status**:

   ```bash
   # View current phase and next steps
   /project-status
   ```

4. **Progress Through Phases**:

   ```bash
   # When Inception complete, transition to Elaboration
   /flow-gate-check inception  # Validate gate criteria
   /flow-inception-to-elaboration  # Transition phase
   ```

## Common Patterns

**Risk Management** (run weekly or when risks identified):

```bash
# Natural language
User: "Update risks with focus on technical debt"

# Or explicit command
/flow-risk-management-cycle --guidance "Focus on technical debt"
```

**Architecture Evolution** (when architecture changes needed):

```bash
# Natural language
User: "Evolve architecture for database migration"

# Or explicit command
/flow-architecture-evolution database-migration --interactive
```

**Security Review** (before each phase gate):

```bash
# Natural language
User: "Run security review for SOC2 audit prep"

# Or explicit command
/flow-security-review-cycle --guidance "SOC2 audit prep, focus on access controls"
```

**Test Execution** (run continuously in Construction):

```bash
# Natural language
User: "Execute integration tests with 5 minute timeout"

# Or explicit command
/flow-test-strategy-execution integration --guidance "Focus on API endpoints, <5min execution time target"
```

## Troubleshooting

**Template Not Found**:

```bash
# Verify AIWG installation
ls $AIWG_ROOT/agentic/code/frameworks/sdlc-complete/templates/

# Set environment variable if installed elsewhere
export AIWG_ROOT=/custom/path/to/ai-writing-guide
```

**Agent Access Denied**:

- Check `.claude/settings.local.json` has read access to AIWG installation path
- Verify path uses absolute path (not `~` shorthand for user home)

**Command Not Found**:

```bash
# Deploy commands to project
aiwg -deploy-commands --mode sdlc

# Verify deployment
ls .claude/commands/flow-*.md
```

## Resources

- **AIWG Repository**: https://github.com/jmagly/ai-writing-guide
- **Framework Documentation**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/README.md`
- **Phase Workflows**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/flows/`
- **Template Library**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/templates/`
- **Agent Catalog**: `$AIWG_ROOT/agentic/code/frameworks/sdlc-complete/agents/`

## Support

- **Issues**: https://github.com/jmagly/ai-writing-guide/issues
- **Discussions**: https://github.com/jmagly/ai-writing-guide/discussions
- **Documentation**: https://github.com/jmagly/ai-writing-guide/blob/main/README.md
