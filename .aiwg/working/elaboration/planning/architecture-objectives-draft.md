# Architecture Objectives - Elaboration Phase

**Project**: HotM (Hall Of The Mind)
**Phase**: Elaboration
**Version**: 0.1.x (Alpha to MVP)
**Last Updated**: 2025-12-04
**Status**: DRAFT

---

## 1. Architectural Drivers (Quality Attributes)

### 1.1 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Note Retrieval** | <100ms | Instant feel for single note fetch |
| **Note Creation** | <200ms | Responsive UI during quick capture |
| **Full-Text Search** | <500ms (100 notes) | Acceptable for daily workflow |
| **Semantic Search** | <1s (100 notes) | Vector similarity with HNSW |
| **Hybrid Search** | <1s (100 notes) | Combined FTS + vector + RRF |
| **Embedding Generation** | <3s per note | Background job, non-blocking |
| **UI Responsiveness** | 60fps render | Native-feel Windows 11 experience |
| **App Startup** | <2s to interactive | Fast launch from hotkey |

**Scaling Targets (Personal Use)**:
- Initial corpus: 10-50 notes
- 3-month validation: 100-500 notes
- 12-month target: 1,000-5,000 notes
- Performance must remain acceptable at each milestone

**Performance Risks** (from Risk Register):
- Risk #6: Performance degradation with growing corpus
- Mitigation: Benchmark suite at 100/500/1000 notes, index optimization

### 1.2 Security Requirements

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **Local-First Data** | All data stored locally in PostgreSQL | NON-NEGOTIABLE |
| **Local-First Processing** | All NLP via local Ollama | NON-NEGOTIABLE |
| **No Cloud Dependencies** | Zero external API calls | NON-NEGOTIABLE |
| **Data Encryption at Rest** | PostgreSQL encryption (user-configurable) | SHOULD |
| **Network Isolation** | Axum server binds to localhost only | MUST (MVP) |
| **API Authentication** | None required (single-user local) | DEFER |
| **Future Sync Encryption** | End-to-end, novel approach | FUTURE |

**Security Architecture Principles**:
1. **Privacy by Default**: No data leaves the local machine
2. **Local Processing**: Ollama runs locally, no cloud AI services
3. **User Control**: User owns and controls all data
4. **Minimal Attack Surface**: localhost-only binding, no external ports
5. **Future-Ready**: Architecture supports adding auth for network mode

**Non-Negotiable Privacy Constraints** (from Option Matrix):
- "Privacy/local-first principles forever"
- "Never consider traditional cloud services"
- "Future sync: novel encryption + direct peer-to-peer"

### 1.3 Reliability Targets

| Attribute | Target | Implementation |
|-----------|--------|----------------|
| **Data Integrity** | Zero data loss | Immutable originals, WAL, transactions |
| **Crash Recovery** | Auto-resume jobs | Job queue with persistent state |
| **Graceful Degradation** | Works without Ollama | Core CRUD without NLP features |
| **Database Consistency** | ACID guarantees | PostgreSQL transactions |
| **Revision History** | Complete audit trail | Provenance tracking, never delete |

**Immutability Principle**:
- Original notes are NEVER modified after creation
- All edits create new revisions
- Provenance edges track relationship between revisions
- Soft delete only (maintain complete history)

**Reliability Risks**:
- Risk #1: Incomplete rollback leaves broken integration
- Risk #2: Rollback breaks working features
- Risk #4: Database schema changes need careful handling
- Mitigation: Test suite, incremental rollback, migration verification

### 1.4 Scalability Approach

**MVP Scope: Single-User Local-First**

| Dimension | MVP Scope | Future Potential |
|-----------|-----------|------------------|
| **Users** | 1 (solo developer) | 5-10 (technical early adopters) |
| **Devices** | 1 (single workstation) | Multi-device (P2P sync) |
| **Data Volume** | <10GB | 100GB+ with attachments |
| **Concurrent Ops** | Low (<10 simultaneous) | Medium (background jobs) |

**Scalability Strategy**:
1. **Vertical First**: Optimize single-node performance
2. **Background Processing**: Job queue for heavy NLP work
3. **Lazy Loading**: Pagination for search results
4. **Connection Pooling**: SQLx connection pool for DB
5. **Caching (Future)**: Redis for frequent queries

**Explicit Non-Goals for MVP**:
- Horizontal scaling (multiple server instances)
- Multi-tenant architecture
- Cloud deployment
- High availability (99.99% uptime)

---

## 2. Architectural Constraints

### 2.1 Technology Stack (Fixed)

| Layer | Technology | Version | Constraint Source |
|-------|------------|---------|-------------------|
| **Backend Runtime** | Rust | stable | Core language choice |
| **API Framework** | Axum | 0.7.x | Async web framework |
| **Database** | PostgreSQL | 14+ | ACID, JSONB, FTS |
| **Vector Search** | pgvector | 0.4.x | Semantic embeddings |
| **ORM/Query** | SQLx | 0.8.x | Compile-time verification |
| **Frontend Framework** | React | 19.x | UI components |
| **Desktop Wrapper** | Tauri | 2.4.x | Windows native |
| **Build Tool** | Vite | 7.x | Frontend bundling |
| **NLP Service** | Ollama | latest | Local AI inference |
| **Generation Model** | gpt-oss:20b | - | Text generation |
| **Embedding Model** | nomic-embed-text | - | Vector embeddings |

**Technology Constraints Rationale**:
- **Rust**: Performance, safety, async ecosystem
- **PostgreSQL + pgvector**: Mature, feature-rich, vector support
- **Tauri**: Smaller binary than Electron, native integration
- **Ollama**: Local inference, model flexibility

### 2.2 Platform Constraints

| Constraint | Specification | Rationale |
|------------|---------------|-----------|
| **Primary OS** | Windows 11 | Target user platform |
| **Secondary OS** | Linux (WSL2) | Developer environment |
| **macOS Support** | Not in MVP | Defer to post-validation |
| **Mobile Support** | Not planned | Desktop-first focus |
| **Browser Support** | N/A | Native desktop app |

**Windows 11 Requirements**:
- Global hotkey (Ctrl+Alt+H)
- System tray integration
- Native window styling (Mica/Acrylic effects)
- MSI installer (future)
- Windows Service for server (future)

### 2.3 Privacy Constraints (Non-Negotiable)

| Principle | Implementation | Enforcement |
|-----------|----------------|-------------|
| **All data stays local** | PostgreSQL on localhost | No cloud DB connections |
| **All processing stays local** | Ollama on localhost | No cloud AI APIs |
| **No telemetry** | Zero analytics/tracking | No external HTTP calls |
| **User owns data** | Local filesystem | No third-party storage |
| **Future sync: P2P only** | Direct device-to-device | No cloud intermediary |

### 2.4 Budget/Resource Constraints

| Resource | Constraint | Impact |
|----------|------------|--------|
| **Developer Time** | Solo developer, part-time | Prioritize MVP features |
| **Infrastructure Cost** | $0 (local only) | No cloud expenses |
| **Hardware** | Consumer workstation | Optimize for typical PC |
| **GPU Requirement** | Optional (CPU fallback) | Graceful Ollama degradation |
| **Timeline** | Flexible (no deadline) | Quality over speed |

---

## 3. Component Boundaries

### 3.1 API Server (Axum)

**Location**: `/home/manitcor/dev/hotm/server/`

**Responsibilities**:
- HTTP REST API (port 53211)
- WebSocket connections (real-time updates)
- Database operations via SQLx
- Ollama client for NLP requests
- Background job queue management
- MCP server (Model Context Protocol)

**API Boundaries**:
```
/api/v1/
  /notes          # CRUD operations
  /search         # Hybrid search (FTS + vector)
  /semantic       # Pure semantic search
  /tags           # Tag management
  /collections    # Collection management
  /jobs           # Background job status
  /health         # Health checks
```

**Internal Components**:
```
server/src/
├── main.rs           # Entry point, router setup
├── routes/           # API route handlers
│   ├── notes.rs      # Note CRUD endpoints
│   ├── search.rs     # Search endpoints
│   ├── tags.rs       # Tag endpoints
│   └── jobs.rs       # Job status endpoints
├── models.rs         # Database models
├── db.rs             # Connection pool setup
├── ollama.rs         # Ollama client
├── jobs/             # Background job processing
│   ├── queue.rs      # Job queue management
│   ├── embedding.rs  # Embedding generation
│   ├── revision.rs   # AI revision
│   └── linking.rs    # Auto-linking
└── mcp/              # MCP server (future)
```

**Design Constraints**:
- Stateless request handling
- Connection pooling for database
- Async throughout (Tokio runtime)
- No server code in Tauri (ADR-001)

### 3.2 Desktop Client (Tauri + React)

**Location**: `/home/manitcor/dev/hotm/ui/`

**Responsibilities**:
- Windows 11 native desktop experience
- React-based UI components
- HTTP client for Axum API
- WebSocket client for real-time updates
- Global hotkey handling
- System tray integration
- Local settings storage

**Frontend Structure**:
```
ui/src/
├── App.tsx           # Main application
├── components/       # React components
│   ├── NoteEditor/   # Markdown editor
│   ├── NoteList/     # Note listing
│   ├── Search/       # Search interface
│   └── Settings/     # Configuration
├── hooks/            # Custom React hooks
├── services/         # API clients
│   ├── api.ts        # HTTP client
│   └── websocket.ts  # WS client
└── stores/           # State management
```

**Tauri Backend**:
```
ui/src-tauri/
├── src/
│   ├── main.rs       # Tauri entry point
│   ├── commands.rs   # Tauri commands (IPC)
│   └── tray.rs       # System tray
└── tauri.conf.json   # Tauri configuration
```

**Design Constraints**:
- NO server code in Tauri (ADR-001)
- Thin Tauri backend (only desktop integration)
- All business logic in Axum server
- API-first design (client is replaceable)

### 3.3 Database Layer (SQLx + pgvector)

**Location**: External PostgreSQL (Docker or native)

**Responsibilities**:
- Note storage (JSONB for flexible schema)
- Full-text search (tsvector + GIN indexes)
- Vector embeddings (pgvector + HNSW indexes)
- Job queue persistence
- Revision history and provenance

**Schema Components** (from ADR-002):
- 17 tables covering notes, revisions, links, tags, collections, jobs
- Materialized views for performance
- Functions and triggers for automation
- Comprehensive indexing strategy

**Design Constraints**:
- Greenfield rebuild during development (ADR-002)
- Clean schema file for fast iteration
- Migrations for CI validation
- SQLx compile-time query verification

### 3.4 NLP Pipeline (Ollama Integration)

**Location**: External Ollama service (Docker or native)

**Responsibilities**:
- Text generation (gpt-oss:20b)
- Embedding generation (nomic-embed-text)
- API at localhost:11434

**Pipeline Stages**:
```
Note Created
    ↓
[Job Queue]
    ↓
1. Chunking (if long)
    ↓
2. Embedding Generation (nomic-embed-text)
    ↓
3. Revision/Summary (gpt-oss:20b)
    ↓
4. Tag Extraction (gpt-oss:20b)
    ↓
5. Link Discovery (vector similarity)
    ↓
[Update Database]
```

**Design Constraints**:
- Non-blocking (background jobs)
- Graceful degradation (core CRUD without Ollama)
- Model fallbacks (smaller models if needed)
- Queue persistence (resume after restart)

### 3.5 Job Queue (Background Processing)

**Location**: Integrated in Axum server, persisted in PostgreSQL

**Responsibilities**:
- Async job scheduling
- Progress tracking (WebSocket updates)
- Retry logic for failures
- Job history and cleanup

**Job Types**:
- `embedding`: Generate vector embedding
- `revision`: AI revision/summary
- `linking`: Auto-discover related notes
- `tagging`: Extract/suggest tags
- `title_generation`: Generate note title

**Design Constraints**:
- PostgreSQL-backed (no Redis required for MVP)
- Single worker (sufficient for single-user)
- Priority queue for recent notes
- Cleanup old jobs (keep last 100)

---

## 4. Integration Architecture

### 4.1 HTTP API (REST)

**Protocol**: HTTP/1.1 (HTTPS for network mode)
**Port**: 53211
**Binding**: localhost only (MVP)
**Format**: JSON

**API Design Principles**:
- RESTful resource-oriented
- Consistent error responses
- Pagination for list endpoints
- Filter parameters for search

**Core Endpoints**:
```
# Notes
POST   /api/v1/notes                 # Create note
GET    /api/v1/notes/{id}            # Get note with revisions
PUT    /api/v1/notes/{id}            # Update note metadata
DELETE /api/v1/notes/{id}            # Soft delete note
PUT    /api/v1/notes/{id}/revised    # Update revision

# Search
GET    /api/v1/search?q=...          # Hybrid search
POST   /api/v1/semantic              # Pure semantic search

# Organization
POST   /api/v1/tags                  # Create tag
PUT    /api/v1/notes/{id}/tags       # Set note tags
POST   /api/v1/collections           # Create collection
PUT    /api/v1/notes/{id}/collection # Set note collection

# Links
POST   /api/v1/notes/{id}/links      # Create link
GET    /api/v1/notes/{id}/links      # Get note links

# Jobs
GET    /api/v1/jobs                  # List job status
GET    /api/v1/jobs/{id}             # Get job details

# System
GET    /api/v1/health                # Health check
```

### 4.2 WebSocket (Real-Time Updates)

**Protocol**: WebSocket
**Endpoint**: `ws://localhost:53211/ws`
**Use Cases**:
- Job progress updates
- Note change notifications
- Search index updates

**Message Format**:
```json
{
  "type": "job_progress" | "note_updated" | "search_ready",
  "payload": { ... }
}
```

### 4.3 MCP Server (AI Assistant Integration)

**Status**: Planned for post-MVP
**Protocol**: Model Context Protocol
**Location**: Embedded in Axum server

**MCP Tools** (from specification):
- `create_note`: Create new note
- `get_note`: Retrieve note
- `search_notes`: Hybrid search
- `find_similar`: Semantic similarity
- `set_tags`: Tag management
- `link_notes`: Create links
- `export_notes`: Bulk export

**Design Decision**: MCP server embedded in Axum (not separate process) for simplicity.

---

## 5. Deployment Architecture

### 5.1 Development Environment

**Docker Compose** (Recommended):
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: hotm_dev
      POSTGRES_USER: hotm
      POSTGRES_PASSWORD: dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama
    ports: ["11434:11434"]
    volumes:
      - ollama_models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

**Native Setup** (Alternative):
```bash
# PostgreSQL (native install with pgvector extension)
# Ollama (native install, ollama pull models)
# Set DATABASE_URL and OLLAMA_URL environment variables
```

### 5.2 Production Architecture (Local)

```
┌─────────────────────────────────────────────────────────┐
│                    Windows 11 Host                       │
│                                                          │
│  ┌──────────────┐    HTTP     ┌─────────────────┐       │
│  │ Tauri Client │◄──────────►│  Axum Server    │       │
│  │ (React UI)   │   :53211   │  (API + Jobs)   │       │
│  └──────────────┘            └────────┬────────┘       │
│                                       │                 │
│                          ┌────────────┼────────────┐   │
│                          │            │            │   │
│                          ▼            ▼            ▼   │
│                    ┌──────────┐ ┌──────────┐           │
│                    │PostgreSQL│ │ Ollama   │           │
│                    │ :5432    │ │ :11434   │           │
│                    │(pgvector)│ │ (AI)     │           │
│                    └──────────┘ └──────────┘           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Network Deployment (Future)

```
┌─────────────────────┐          ┌─────────────────────────┐
│  Client Machine A   │          │    Server Machine       │
│  ┌───────────────┐  │   HTTP   │  ┌─────────────────┐   │
│  │ Tauri Client  │◄─┼─────────►│  │  Axum Server    │   │
│  └───────────────┘  │  :53211  │  │  (+ PostgreSQL  │   │
└─────────────────────┘          │  │   + Ollama)     │   │
                                 │  └─────────────────┘   │
┌─────────────────────┐          │                         │
│  Client Machine B   │          │                         │
│  ┌───────────────┐  │   HTTP   │                         │
│  │ Tauri Client  │◄─┼─────────►│                         │
│  └───────────────┘  │  :53211  │                         │
└─────────────────────┘          └─────────────────────────┘
```

**Network Mode Requirements** (Future):
- TLS/HTTPS for encryption in transit
- API key or JWT authentication
- Firewall configuration for port 53211
- Server runs as Windows Service

---

## 6. Risk Mitigation Architecture

### 6.1 Architecture-Related Risks

| Risk | Architectural Mitigation |
|------|-------------------------|
| **#1: Incomplete rollback** | ADR-001 defines clean separation |
| **#3: Low test coverage** | Component boundaries enable isolation testing |
| **#5: Core features inadequate** | MVP scope limits feature set |
| **#6: Performance degradation** | Indexing strategy, pagination |
| **#8: Ollama dependency** | Graceful degradation pattern |
| **#9: Setup complexity** | Docker Compose, setup scripts |

### 6.2 Graceful Degradation Strategy

**Scenario: Ollama Unavailable**
- Note CRUD: Full functionality
- Search: Full-text only (no semantic)
- Linking: Manual only (no auto-discovery)
- Tags: Manual only (no AI suggestions)
- Status: Clear indication in UI

**Scenario: PostgreSQL Unavailable**
- Application: Does not start
- Error: Clear message with troubleshooting

### 6.3 Data Integrity Architecture

```
Note Creation Flow:
  1. INSERT original (immutable)
  2. COMMIT transaction
  3. Queue NLP jobs (async)
  4. Jobs update revisions
  5. Original NEVER modified

Revision Update Flow:
  1. CREATE new revision
  2. Link to original via provenance
  3. Update "current" pointer
  4. Previous revisions preserved
```

---

## 7. Architectural Decision Records (ADRs)

### Existing ADRs

| ADR | Title | Status | Key Decision |
|-----|-------|--------|--------------|
| ADR-001 | Client-Server Architecture | Accepted | Separate processes, no embedded server |
| ADR-002 | Greenfield Database Schema Rebuild | Accepted | Clean schema for development |

### Pending ADRs

| ADR | Title | Trigger |
|-----|-------|---------|
| ADR-003 | MCP Server Integration | When implementing MCP tools |
| ADR-004 | Multi-Device Sync Architecture | When approaching sync implementation |
| ADR-005 | Windows Service Packaging | When production deployment ready |
| ADR-006 | Authentication for Network Mode | When enabling network deployment |

---

## 8. Implementation Roadmap

### Phase 1: Architecture Stabilization (Elaboration)

**Objective**: Clean, testable client-server architecture

**Deliverables**:
- [ ] Verify ADR-001 implementation complete
- [ ] Validate Docker Compose setup
- [ ] Confirm test coverage baseline
- [ ] Document API contract
- [ ] Performance baseline benchmarks

### Phase 2: Core Feature Implementation (Construction)

**Objective**: MVP features working end-to-end

**Architecture Focus**:
- [ ] Note CRUD fully implemented
- [ ] Hybrid search operational
- [ ] Job queue processing
- [ ] WebSocket updates

### Phase 3: Validation and Polish (Transition)

**Objective**: Ready for daily personal use

**Architecture Focus**:
- [ ] Performance optimization
- [ ] Error handling completeness
- [ ] Graceful degradation tested
- [ ] Setup documentation

---

## 9. Success Metrics

### Architecture Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Component Isolation** | Clean boundaries | No cross-boundary imports |
| **Test Coverage** | 60%+ | CI coverage reports |
| **API Response Time** | <500ms p95 | Benchmark suite |
| **Database Query Time** | <100ms p95 | Query profiling |
| **Build Time** | <5min | CI duration |

### Validation Criteria

- [ ] Daily use for 30+ days without major friction
- [ ] Search finds relevant notes consistently
- [ ] Auto-linking discovers meaningful connections
- [ ] Performance acceptable at 100+ notes
- [ ] Architecture supports planned features

---

## Document Control

**Created**: 2025-12-04
**Author**: Architecture Designer
**Review Cycle**: Phase gates
**Next Review**: End of Elaboration phase

**Related Documents**:
- Project Intake: `.aiwg/intake/project-intake.md`
- Option Matrix: `.aiwg/intake/option-matrix.md`
- Risk Register: `.aiwg/risks/risk-list.md`
- ADR-001: `.aiwg/architecture/ADR-001-client-server-architecture.md`
- ADR-002: `.aiwg/architecture/ADR-002-database-schema-rebuild.md`
