# Project Intake Form (Existing System)

**Document Type**: Brownfield System Documentation
**Generated**: 2025-12-04
**Source**: Codebase analysis of /home/manitcor/dev/hotm

## Metadata

- **Project name**: HotM (Hall Of The Mind)
- **Repository**: https://github.com/jmagly/hotm.git
- **Current Version**: 0.1.2 (Alpha)
- **Last Updated**: 2025-08-24
- **Stakeholders**: Solo Developer (Personal Tool → Potential Open Source)

## System Overview

**Purpose**: Personal memory map and knowledge management tool leveraging versioned, immutable storage with AI-powered embedding generation to create a constantly updating map of thoughts and their connections, searchable via semantic lookup.

**Problem Being Solved**: Captures quick notes and automatically integrates them into a larger "web" of thoughts and documents, maintaining context that is easily lost with scattered notes.

**Current Status**: Alpha (v0.1.2) - Core architecture in place, but integration challenges with single-executable deployment model. Pivoting to client-server architecture.

**Users**: Personal use first (solo developer), then potential open source release after 3-6 months of validation

**Tech Stack**:
- **Languages**: Rust (primary backend), TypeScript/React (frontend), SQL (migrations)
- **Backend**: Axum 0.7 (Rust async web framework)
- **Frontend**: React 19 + Tauri 2.4 (native Windows desktop with web tech)
- **Database**: PostgreSQL 14+ with pgvector extension
- **NLP/AI**: Ollama integration (gpt-oss:20b for generation, nomic-embed-text for embeddings)
- **Deployment**: Docker Compose (development), native binaries (planned), MSI installer (future)

## Problem and Outcomes

**Problem Statement**:
"I often want to capture and collate my thoughts but rarely do. If I do write it down, it's rarely collated or properly connected to the larger web of my work. It's easy to forget the wider context on a quickly scrawled note. This app can take that quick note and tie it into the 'web' of thoughts and documents."

**Target Personas**:
- Primary: Solo developer (personal knowledge management)
- Secondary: Technical users comfortable with self-hosting (researchers, developers)
- Future: Non-technical power users (if single-exe deployment succeeds)

**Success Metrics**:
- Personal validation: Daily use for 3-6 months, integration into workflow
- Note connectivity: Automatic linking working reliably (semantic + explicit)
- Search quality: Hybrid search (FTS + vector) finds relevant notes quickly
- Privacy assurance: All data and processing stays 100% local

## Current Scope and Features

**Core Features** (from codebase analysis):
1. **Immutable Note Storage**: Original notes never modified, only enhanced
2. **AI-Powered Revision**: Ollama-based summarization and enhancement
3. **Hybrid Search**: PostgreSQL full-text search + pgvector semantic search
4. **Smart Linking**: Automatic discovery of related notes via embeddings
5. **Auto-tagging**: AI-generated tags and entity extraction
6. **Windows 11 Native UI**: Tauri app with Mica/Acrylic effects, system tray, global hotkey (Ctrl+Alt+H)
7. **MCP Integration**: Model Context Protocol for AI assistant compatibility (planned)

**Database Schema** (6 migrations):
- Note storage with JSONB (flexible schema evolution)
- Full-text search indexes (tsvector/GIN)
- Vector embeddings (pgvector with HNSW indexing)
- Job queue for background NLP processing
- Link metadata and provenance tracking
- Revision history with complete audit trail

**Recent Development Focus**:
- Attempting single-executable deployment (Tauri + embedded Axum + embedded PostgreSQL)
- Integration challenges led to project instability
- Recent commits: "update architecture for embedded PostgreSQL and cloud sync" (Aug 2025)

**Current State - Needs Cleanup**:
- Single-exe integration work needs to be rolled back
- Return to client-server architecture (Tauri client + separate Axum server)
- External PostgreSQL (Docker or native, user choice)
- External Ollama (Docker or native, user choice)

## Architecture (Current State)

**Architecture Style**: Client-Server (Tauri Desktop + Axum API + PostgreSQL + Ollama)

**Components**:
1. **Frontend (Tauri Desktop)**:
   - Location: `ui/src/` (React/TypeScript), `ui/src-tauri/` (Rust wrapper)
   - React 19 + Radix UI components
   - Markdown editor with KaTeX math, Mermaid diagrams
   - Windows 11 native styling (system tray, global hotkey)
   - Communicates with Axum backend via HTTP/WS

2. **Backend API (Axum Server)**:
   - Location: `server/src/`
   - Rust async API on port 53211
   - Routes: notes CRUD, search (hybrid), semantic queries, tags, collections, provenance
   - SQLx for compile-time verified PostgreSQL queries
   - Background job queue for NLP processing

3. **Database (PostgreSQL + pgvector)**:
   - JSONB document storage for notes
   - Full-text search (tsvector) + vector similarity (HNSW indexes)
   - 6 migrations tracking schema evolution
   - Supports Docker (pgvector/pgvector:pg16) or native install

4. **NLP Pipeline (Ollama)**:
   - Local AI models (gpt-oss:20b, nomic-embed-text)
   - Runs on localhost:11434
   - Background jobs: chunking, summarization, embedding, linking, tagging
   - 131 Ollama-related code references (core feature)

**Integration Points**:
- Ollama API (localhost:11434) - local LLM inference
- No external cloud services (privacy-first)
- Future: Local sync via novel encryption + direct connections to trusted personal systems

**Data Models**: ~10 primary entities
- Notes (immutable originals, JSONB metadata)
- Revisions (AI-enhanced versions)
- Embeddings (vector representations)
- Links (semantic + explicit relationships)
- Tags & Collections (organization)
- Jobs (background NLP processing)

## Scale and Performance (Current)

**Current Capacity**: Single-user, local workstation

**Performance Characteristics**:
- Target: Responsive UI (<100ms note retrieval, <1s search)
- Async Rust backend (Tokio runtime, multi-threaded)
- Lazy loading for large note collections
- Background job processing (non-blocking UI)

**Performance Patterns Detected**:
- Async/await throughout (127 database connection references)
- PostgreSQL connection pooling (SQLx)
- Vector similarity with HNSW indexes (approximate nearest neighbor)
- Likely pagination for search results (hybrid retrieval pattern)

**Bottlenecks/Pain Points** (from user input):
- Single-exe integration complexity caused project instability
- Need to "undo that work, clean things up"
- Ollama dependency requires GPU/inference capability (heavyweight)

**Optimization Opportunities**:
- Caching layer for frequent searches (Redis optional)
- Incremental embedding generation (avoid re-processing entire note corpus)
- Batch NLP jobs intelligently (prioritize recent notes)

## Security and Compliance (Current)

**Security Posture**: Baseline (local-first, no authentication needed for single-user)

**Data Classification**: Personal/Private (user's own notes and thoughts)

**Security Controls**:
- **Authentication**: Not required (single-user local app)
  - Future server mode: Basic auth or API keys for multi-device access
- **Authorization**: File system permissions (local data)
- **Data Protection**:
  - Immutable originals (append-only, never delete)
  - PostgreSQL encryption at rest (user-configurable)
  - No data leaves local machine (privacy principle)
- **Secrets Management**: Environment variables (.env files, not committed)

**Compliance Requirements**: None
- No PII of others (only user's own data)
- No regulatory requirements (personal tool)
- Privacy focus: "local-first forever" principle
- Future sync: Novel encryption + direct peer-to-peer, no cloud providers

**Privacy Principles (Non-Negotiable)**:
- All data stays local
- All processing stays local (Ollama runs locally)
- Future cloud/sync: User-controlled, end-to-end encrypted, no trusted third parties

## Team and Operations (Current)

**Team Size**: Solo developer (1 person)

**Development Velocity**:
- 190 commits in last 6 months (~1.3 commits/day average)
- Active development, consistent progress

**Process Maturity**: Moderate
- **Version Control**: Git (GitHub)
- **Branch Strategy**: Main branch, feature work likely in same branch or short-lived branches
- **Code Review**: Solo dev (self-review)
- **Testing**:
  - Rust: 4 test files (unit tests)
  - Frontend: 11 test files/dirs (React components, hooks, services)
  - CI/CD: GitHub Actions (backend-tests.yml, frontend-tests.yml)
- **Versioning**: Semantic versioning (0.1.2)
- **Documentation**: Comprehensive README, docs/ directory (architecture, API spec, MCP tools)

**CI/CD**:
- **Platform**: GitHub Actions
- **Workflows**:
  - backend-tests.yml (Rust tests, clippy, formatting, security audit)
  - frontend-tests.yml (React tests, TypeScript build, coverage, security audit)
  - release.yml (MSI builds, deployment artifacts)
  - sdlc-gates.yml (phase gate validation)
  - docs-link-check.yml (documentation integrity)

**Operational Support**:
- **Monitoring**: None detected (pre-production)
- **Logging**: Rust tracing (tracing-subscriber with env-filter)
- **Alerting**: Not applicable (local dev tool)
- **Support**: Solo developer (self-support)

## Dependencies and Infrastructure

**Key Backend Dependencies** (server/Cargo.toml):
- axum 0.7 (async web framework)
- tokio 1 (async runtime)
- sqlx 0.8.6 (PostgreSQL with compile-time query verification)
- pgvector 0.4.1 (vector similarity search)
- serde/serde_json (serialization)
- reqwest 0.12 (HTTP client for Ollama)
- tracing/tracing-subscriber (structured logging)

**Key Frontend Dependencies** (ui/package.json):
- @tauri-apps/api 2.4.0 (desktop integration)
- react 19.1.0, react-dom 19.1.0 (UI framework)
- @radix-ui/* (accessible UI primitives)
- @uiw/react-md-editor (markdown editing)
- mermaid 11.10.1 (diagram rendering)
- katex 0.16.22 (math rendering)
- tailwindcss 3.4.17 (styling)
- vite 7.0.4 (build tool)
- vitest (testing)

**Infrastructure**:
- **Hosting**: Local workstation (no hosting)
- **Deployment**: Docker Compose for development (docker-compose.yml, docker-compose.dev.yml)
- **Database**: PostgreSQL 14+ (pgvector/pgvector:pg16 Docker image)
- **NLP**: Ollama (local installation, models: gpt-oss:20b, nomic-embed-text)
- **Build**:
  - Rust: cargo (native compilation)
  - Frontend: npm + vite (bundling)
  - Tauri: MSI installer for Windows 11

**Deployment Options (User Choice)**:
1. **Docker**: PostgreSQL + Ollama in containers, native binaries for app
2. **Native**: PostgreSQL + Ollama installed directly, native binaries
3. **Hybrid**: Mix of Docker and native based on user preference

## Known Issues and Technical Debt

**Critical Issues** (from user input):
1. **Single-Exe Integration Instability**:
   - Attempted to embed Axum server + PostgreSQL into Tauri app
   - Led to project instability, "multiple steps not properly functional"
   - **Action Required**: Roll back single-exe work, return to client-server

2. **Architecture Cleanup Needed**:
   - Undo embedded integration work
   - Restore original client-server design
   - Support both Docker and native for PostgreSQL + Ollama

**Technical Debt**:
- Documentation likely out of sync with recent integration attempts
- Test coverage unknown (need to verify CI passes after cleanup)
- Single-exe code paths may have created dead code or conditional complexity

**Modernization Opportunities**:
- Simplify deployment: Provide install scripts for common platforms
- Consider SQLite + extensions as lightweight PostgreSQL alternative (future)
- Document architecture decisions (ADRs) for future reference
- Add performance benchmarks (note count, search latency, memory usage)

## Why This Intake Now?

**Context**: Project cleanup and architectural reset

**Immediate Goals**:
1. **Undo single-exe integration work** that caused instability
2. **Return to client-server architecture** (proven, simpler)
3. **Define MVP scope** for personal validation (3-6 months)
4. **Size SDLC framework appropriately** for solo dev, local-first tool

**User Intent** (from interactive questions):
- Priority: Deploy as server first (client-server), defer single-exe
- Blocker: Tauri + Axum integration caused instability
- Users: Personal use first (solo), then share with technical users later
- Trade-offs: Privacy/local-first is #1 priority (non-negotiable)
- Evolution: Local-first forever, novel sync solutions (not cloud providers)

**What's at Stake**:
- Personal productivity: Need this tool working for own knowledge management
- Validation: 3-6 months of daily use to prove concept
- Future potential: "May become more profound in its use" - currently solving personal problem, but concept could resonate with others

## Attachments

- Solution profile: [solution-profile.md](./solution-profile.md)
- Option matrix: [option-matrix.md](./option-matrix.md)
- Codebase location: `/home/manitcor/dev/hotm`
- Repository: `https://github.com/jmagly/hotm.git`

## Next Steps

**Immediate (This Week)**:
1. ✅ **Complete intake documentation** (this document)
2. **Roll back single-exe integration work**:
   - Identify commits that introduced embedded server/PostgreSQL
   - Create cleanup branch
   - Remove conditional complexity added for single-exe
   - Restore clean client-server separation

**Short-term (Next 2-4 Weeks)**:
3. **Define MVP scope** (see option-matrix.md for detailed breakdown):
   - Core: Note create, search (hybrid), auto-linking
   - Defer: Advanced UX polish, MSI installer, MCP integration
4. **Stabilize client-server architecture**:
   - Document deployment options (Docker vs native)
   - Create install scripts (setup_dev.sh, setup_prod.sh)
   - Verify CI passes (backend + frontend tests)
5. **Personal validation loop**:
   - Use daily for own knowledge management
   - Track bugs and UX friction
   - Iterate on search quality and linking accuracy

**Medium-term (3-6 Months)**:
6. **Validate concept** through personal use
7. **Document architectural decisions** (ADRs)
8. **Consider open source release** if concept proves valuable
9. **Reassess SDLC rigor** if transitioning to multi-user or public release

**SDLC Framework Application**:
- Use `/project-status` to track progress against MVP scope
- Lightweight iteration workflow: `/flow-iteration-dual-track` (Discovery + Delivery)
- Skip heavy governance (solo dev, pre-launch)
- Focus on: Requirements (MVP scope), Architecture (ADRs), Testing (stability)

**Note**: You do NOT need to run `/intake-start` - these intake documents are already complete and validated. Proceed directly to architecture cleanup and MVP scoping.
