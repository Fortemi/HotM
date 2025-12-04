# ADR-001: Client-Server Architecture for HotM

**Status**: Accepted
**Date**: 2025-12-04
**Deciders**: Solo Developer (architectural reset after failed single-exe attempt)
**Context**: Inception phase, post-rollback cleanup

---

## Context and Problem Statement

HotM is a local-first knowledge management tool with multiple components:
- **Tauri Desktop Client** (React + TypeScript UI)
- **Axum API Server** (Rust async web framework)
- **PostgreSQL Database** (with pgvector extension)
- **Ollama NLP Service** (local AI inference)

We need to decide how to package and deploy these components. Should they be:
1. **Single Executable** - Everything embedded in one Tauri app
2. **Client-Server** - Separate processes communicating via localhost HTTP/WebSocket
3. **Microservices** - Multiple independent services

## Decision Drivers

**Considered Factors**:
- Deployment complexity (setup friction for users)
- Development velocity (iteration speed during alpha)
- Architecture complexity (embedding vs separation)
- Resource management (memory, CPU isolation)
- Testing and debugging (component isolation)
- Flexibility (deployment scenarios: local, network, cloud-sync)

**User Priority** (from intake):
- Privacy/local-first (#1 non-negotiable)
- Deployment as server first, defer single-exe
- Support both Docker and native for services (user choice)

## Considered Options

### Option 1: Single Executable (Embedded Everything)

**Approach**: Tauri app embeds:
- Axum server (starts on app launch)
- PostgreSQL (embedded database like SQLite or embedded Postgres)
- Ollama (embedded inference or bundled models)

**Pros**:
- Single MSI installer (easiest for non-technical users)
- No external dependencies (everything included)
- Simplified deployment (one executable, double-click to run)

**Cons**:
- **High integration complexity** (embedding PostgreSQL + Ollama non-trivial)
- **Tight coupling** (UI crash takes down database and AI services)
- **Resource management** (all processes compete for resources)
- **Debugging difficulty** (logs interleaved, harder to isolate issues)
- **Testing complexity** (must test embedded vs standalone services)
- **Limited flexibility** (can't easily switch to network deployment)
- **Proven failure** (attempted in commit fcebdd2, rolled back due to instability)

### Option 2: Client-Server Architecture (Selected)

**Approach**: Separate processes:
- **Tauri Client** - Native Windows 11 desktop app (React UI)
- **Axum Server** - Standalone Rust API server (localhost:53211)
- **PostgreSQL** - External database (Docker or native)
- **Ollama** - External NLP service (Docker or native)

**Pros**:
- **Clean separation** (UI independent of backend services)
- **Process isolation** (crash in one component doesn't affect others)
- **Development velocity** (iterate on UI/backend independently)
- **Testing simplicity** (test components in isolation, mock services easily)
- **Flexible deployment** (local, network, hybrid)
- **Resource management** (OS manages resource allocation per process)
- **Debugging** (separate logs per component, clear error attribution)
- **Docker support** (Docker Compose for easy setup)
- **Native support** (users can install PostgreSQL/Ollama directly if preferred)

**Cons**:
- Setup complexity (users must start multiple services)
- Multiple installers (PostgreSQL, Ollama, HotM separately)
- Port management (Axum:53211, PostgreSQL:5432, Ollama:11434)

### Option 3: Microservices

**Approach**: Each feature as separate service (notes service, search service, NLP service, etc.)

**Pros**:
- Maximum flexibility and scalability
- Independent deployment and versioning

**Cons**:
- **Extreme overkill** for single-user local app
- Network latency between services
- Distributed system complexity (tracing, debugging, coordination)
- Not aligned with local-first principle

## Decision Outcome

**Chosen Option**: **Client-Server Architecture** (Option 2)

**Rationale**:
1. **Failed single-exe attempt validates separation**: Integration complexity caused project instability, rolled back after 1 day (commits fcebdd2 → 1b900c0, b47bd08, 40907e6)
2. **Development velocity critical**: Alpha phase requires fast iteration, clean separation enables parallel UI/backend work
3. **Testing and debugging**: Component isolation simplifies troubleshooting during MVP validation
4. **Flexible deployment**: Supports both local (personal use) and network (future multi-device) deployment
5. **User choice**: Docker vs native for PostgreSQL/Ollama (user preference, not forced)

**Trade-Off Accepted**:
- Setup complexity for initial users (technical users comfortable with Docker Compose or native installs)
- Defer single-exe packaging until post-MVP validation (if user demand exists)

## Consequences

### Positive

- **Fast iteration**: UI and backend can be developed/tested independently
- **Clear boundaries**: HTTP/WebSocket API contract between client and server
- **Easy mocking**: Frontend can mock backend responses, backend can mock Ollama
- **Flexible testing**: Integration tests, E2E tests, component tests all straightforward
- **Network deployment**: Same architecture works for localhost and networked use
- **Docker Compose**: One-command setup (`docker-compose up`) for PostgreSQL + Ollama
- **Process isolation**: UI crash doesn't corrupt database, database restart doesn't close UI

### Negative

- **Setup friction**: Users must start PostgreSQL, Ollama, Axum server, then Tauri client
- **Documentation burden**: Need clear setup guides for Docker vs native workflows
- **Port conflicts**: Users need available ports (5432, 11434, 53211)
- **State management**: Multiple processes mean multiple logs, multiple restarts

### Mitigation Strategies

1. **Provide Docker Compose**: One-command setup for dev environment (`docker-compose up -d postgres ollama`)
2. **Create install scripts**: `scripts/dev_server.sh` (Linux/WSL) and `scripts/dev-server.ps1` (Windows) to automate startup
3. **Document both workflows**: Docker (easiest) and native (user preference)
4. **Defer single-exe**: Revisit after MVP validation if user demand exists (likely not needed for technical early adopters)
5. **Future MSI improvements**: Consider bundling PostgreSQL portable + Ollama installer in MSI package (still separate processes, but easier install)

## Implementation Notes

### Current Architecture

```
┌─────────────────────┐
│  Tauri Desktop UI   │  (Windows 11 native)
│  React + TypeScript │  Port: N/A (desktop app)
└──────────┬──────────┘
           │ HTTP/WS (localhost)
           ↓
┌─────────────────────┐
│   Axum API Server   │  (Rust async)
│   Port: 53211       │  localhost only (no external access)
└──────┬──────────────┘
       │ SQLx          │ Reqwest
       ↓               ↓
┌────────────┐  ┌─────────────┐
│ PostgreSQL │  │   Ollama    │
│ Port: 5432 │  │ Port: 11434 │
│ (pgvector) │  │ (local AI)  │
└────────────┘  └─────────────┘
```

### Deployment Scenarios

**Development (Docker Compose)**:
```bash
docker-compose up -d postgres ollama  # Start services
cd server && cargo run                 # Start Axum
cd ui && npm run tauri dev            # Start Tauri
```

**Development (Native)**:
```bash
# User manages PostgreSQL and Ollama
cd server && cargo run
cd ui && npm run tauri dev
```

**Production (MSI + Local)**:
```bash
# Install PostgreSQL and Ollama (native or Docker)
# Install HotM server as Windows Service (future)
# Install HotM client via MSI
# Client connects to localhost:53211
```

**Production (Network Deployment)**:
```bash
# Server machine: PostgreSQL + Ollama + Axum
# Client machines: Tauri desktop app
# Clients connect to network Axum server (e.g., 192.168.1.100:53211)
```

### Directory Structure (Clean Separation)

```
hotm/
├── server/             # Standalone Axum API server
│   ├── src/
│   │   ├── main.rs     # Server entry point
│   │   ├── routes/     # API route handlers
│   │   ├── models.rs   # Database models
│   │   ├── db.rs       # Database connection pool
│   │   └── ollama.rs   # Ollama client
│   ├── Cargo.toml      # Server dependencies (NO workspace)
│   └── migrations/     # PostgreSQL schema migrations
├── ui/                 # Standalone Tauri desktop application
│   ├── src/            # React frontend
│   ├── src-tauri/      # Rust backend for Tauri (NO server code)
│   ├── Cargo.toml      # Tauri dependencies (NO workspace)
│   └── package.json    # Frontend dependencies
└── docker-compose.yml  # PostgreSQL + Ollama for development
```

**Key Architectural Constraints**:
- NO workspace `Cargo.toml` in root (server and ui are independent)
- NO server code in `ui/src-tauri/` (Tauri only handles desktop integration)
- NO embedded database (PostgreSQL is always external)
- NO embedded Ollama (AI service is always external)

## Future Considerations

### Single-Exe Revisit Criteria

We may reconsider single-executable packaging if:

1. **User feedback**: "Setup is too complex, need single installer" becomes common complaint
2. **Non-technical user adoption**: Users without Docker/CLI experience need access
3. **Embedded database maturity**: Embedded PostgreSQL or pgvector-compatible alternatives improve
4. **Tauri sidecar improvements**: Tauri makes it easier to bundle/manage external processes

**Requirements for successful single-exe**:
- Must maintain process isolation (embedded but separate processes, not in-process)
- Must support graceful shutdown (stop services when UI closes)
- Must have clear error messages (which service failed? why?)
- Must be testable (can test embedded vs standalone services with same code)

### Network Deployment (Already Supported)

Client-server architecture already supports networked Axum server:
- Same codebase works for localhost and LAN deployment
- Future: Add basic auth for multi-device access
- Future: Add HTTPS/TLS for network security

### Cloud Sync (Future, Privacy-First)

From option-matrix.md: "Privacy/local-first principles forever. Never consider traditional cloud services. Future sync will use novel encryption + direct peer-to-peer, not cloud providers."

Client-server architecture supports this vision:
- Each device runs local Axum + PostgreSQL + Ollama (full local processing)
- Devices sync via direct peer-to-peer (no cloud intermediary)
- Sync happens at data layer, not API layer (maintains local-first)

## Related Decisions

- **ADR-002**: Database Schema Rebuild Strategy (greenfield approach for fast iteration)
- **Future ADR**: Multi-device sync architecture (novel encryption + P2P, not cloud providers)
- **Future ADR**: MCP server integration (embedded in Axum or separate process?)
- **Future ADR**: Windows Service packaging (how to run Axum as Windows Service)

## References

**Failed single-exe integration**:
- Commit fcebdd2 (2024-08-24): "feat: implement unified runtime architecture with all deployment modes" (103 files)
- Commits 1b900c0, b47bd08, 40907e6 (2024-08-25): Rollback to standalone Tauri
- Rollback analysis: `.aiwg/working/rollback-analysis.md`

**User priorities**:
- Option matrix: `.aiwg/intake/option-matrix.md`
- Privacy-first, server-first deployment, Docker + native support

**Tech stack**:
- Tauri 2.4 (desktop client)
- Axum 0.7 (API server)
- PostgreSQL 14+ with pgvector (database)
- Ollama (local AI inference)

**Current status**:
- Version: 0.1.2 (alpha)
- Architecture: Clean client-server (as of 2024-08-25 rollback)
- Validation phase: 3-6 months personal use
