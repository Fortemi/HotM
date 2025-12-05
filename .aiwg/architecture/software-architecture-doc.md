# Software Architecture Document (SAD)

**Project**: HotM (Hall Of The Mind)
**Version**: 1.0 (BASELINED)
**Phase**: Elaboration
**Status**: BASELINED
**Date**: 2025-12-04
**Primary Author**: Architecture Designer
**Reviewers**: Security Architect, Test Architect

---

## Review Status Summary

| Reviewer | Status | Date | Key Findings |
|----------|--------|------|--------------|
| Security Architect | APPROVED (with conditions) | 2025-12-04 | Architecture security-sound for MVP; network mode requires ADR-006 |
| Test Architect | CONDITIONAL | 2025-12-04 | Strong testability foundation; 5 gaps requiring documentation |

### Security Conditions (Accepted)
1. ADR-003 (Local-First Privacy) must be formally documented - **Tracked**
2. Secrets management policy must be created before MVP release - **Deferred to pre-MVP**
3. Input validation framework must be implemented - **Deferred to Construction**
4. SBOM generation must be added to CI/CD pipeline - **Deferred to Construction**
5. When network mode is enabled, ADR-006 must be completed - **Deferred to post-MVP**

### Testability Conditions (Accepted)
1. Document Ollama mocking strategy (Section 4.5.3.1) - **Integrated**
2. Document WebSocket testing approach (Section 4.6.3) - **Integrated**
3. Document database test isolation pattern (Section 4.4.5) - **Integrated**
4. Document route unit testing guide (Section 4.2.5) - **Integrated**
5. Document concurrent operation testing (Section 9.5) - **Integrated**

### Deferred Items Summary

| Item | Owner | Target Phase | Rationale |
|------|-------|--------------|-----------|
| Network authentication (ADR-006) | Security Architect | Post-MVP | Localhost binding sufficient for MVP |
| Encryption at rest guidance | Security Architect | Pre-Beta | User-configurable PostgreSQL encryption is documented |
| TLS 1.3 implementation | Security Architect | Network Mode | Not required for localhost deployment |
| CSRF protection | Security Architect | Network Mode | No cross-origin risk in localhost binding |
| Rate limiting | Security Architect | Network Mode | No external access in MVP |
| Backup/recovery runbook | Operations | Pre-Beta | Critical for production, not MVP validation |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architectural Drivers](#2-architectural-drivers)
3. [System Context](#3-system-context)
4. [Component Architecture](#4-component-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Security Architecture](#6-security-architecture)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Key Architectural Decisions](#8-key-architectural-decisions)
9. [Risks and Mitigations](#9-risks-and-mitigations)
10. [Appendices](#10-appendices)

---

## 1. Introduction

### 1.1 Purpose

This Software Architecture Document (SAD) describes the architecture of HotM (Hall Of The Mind), a local-first personal knowledge management tool. It provides a comprehensive technical overview for developers, maintainers, and stakeholders to understand how the system is structured and why specific architectural decisions were made.

### 1.2 Scope

This document covers:
- System boundaries and external interfaces
- Component architecture and interactions
- Data models and storage strategies
- Security considerations
- Deployment configurations
- Key architectural decisions and their rationale
- Testing approaches per component

**Out of Scope**:
- Multi-device sync architecture (deferred to post-MVP)
- Mobile application design
- Cloud deployment strategies

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| **ADR** | Architecture Decision Record |
| **FTS** | Full-Text Search |
| **HNSW** | Hierarchical Navigable Small World (vector index algorithm) |
| **HotM** | Hall Of The Mind - the project name |
| **IPC** | Inter-Process Communication |
| **MCP** | Model Context Protocol (AI assistant integration) |
| **NLP** | Natural Language Processing |
| **pgvector** | PostgreSQL extension for vector similarity search |
| **RRF** | Reciprocal Rank Fusion (search result merging algorithm) |
| **SAD** | Software Architecture Document |

### 1.4 System Context Overview

HotM is a **local-first** personal knowledge management tool designed for Windows 11. Its core value proposition is:

1. **Immutable Originals**: Notes are never modified after creation; all edits create new revisions
2. **AI-Powered Enhancement**: Local NLP processing via Ollama for summarization, tagging, and linking
3. **Hybrid Search**: Combined full-text and semantic (vector) search for powerful retrieval
4. **Privacy by Default**: All data and processing stays on the local machine (see ADR-003)

**Target Users**: Solo developer (personal use), with potential expansion to technical early adopters.

**Current Phase**: Alpha (v0.1.x) - Core functionality development and personal validation.

---

## 2. Architectural Drivers

### 2.1 Quality Attributes

#### 2.1.1 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Note Retrieval | <100ms | Instant feel for single note fetch |
| Note Creation | <200ms | Responsive UI during quick capture |
| Full-Text Search | <500ms (100 notes) | Acceptable for daily workflow |
| Semantic Search | <1s (100 notes) | Vector similarity with HNSW indexing |
| Hybrid Search | <1s (100 notes) | Combined FTS + vector + RRF fusion |
| Embedding Generation | <3s per note | Background job, non-blocking |
| UI Responsiveness | 60fps render | Native-feel Windows 11 experience |
| App Startup | <2s to interactive | Fast launch from global hotkey |

**Scaling Targets (Personal Use)**:
- Initial corpus: 10-50 notes
- 3-month validation: 100-500 notes
- 12-month target: 1,000-5,000 notes

#### 2.1.2 Reliability Requirements

| Attribute | Target | Implementation |
|-----------|--------|----------------|
| Data Integrity | Zero data loss | Immutable originals, WAL, ACID transactions |
| Crash Recovery | Auto-resume jobs | Persistent job queue in PostgreSQL |
| Graceful Degradation | Works without Ollama | Core CRUD without NLP features |
| Database Consistency | ACID guarantees | PostgreSQL transactions |
| Revision History | Complete audit trail | Provenance tracking, soft delete only |

#### 2.1.3 Maintainability

- **Modular Design**: SOLID principles, clean separation of concerns
- **Test Coverage**: 60-80% target across unit, integration, and E2E tests
- **Documentation**: Comprehensive ADRs and architectural documentation
- **CI/CD Discipline**: `gh act` as authoritative test standard before any push

### 2.2 Constraints

#### 2.2.1 Technology Stack (Fixed)

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Backend Runtime | Rust | stable | Performance, safety, async ecosystem |
| API Framework | Axum | 0.7.x | Async web framework, ergonomic |
| Database | PostgreSQL | 14+ | ACID, JSONB, FTS, mature |
| Vector Search | pgvector | 0.4.x | Semantic embeddings, HNSW |
| ORM/Query | SQLx | 0.8.x | Compile-time query verification |
| Frontend | React | 19.x | UI components, ecosystem |
| Desktop Wrapper | Tauri | 2.4.x | Native Windows, smaller binary |
| Build Tool | Vite | 7.x | Fast frontend bundling |
| NLP Service | Ollama | latest | Local AI inference |
| Generation Model | gpt-oss:20b | - | Text generation/revision |
| Embedding Model | nomic-embed-text | - | Vector embeddings |

#### 2.2.2 Platform Constraints

| Constraint | Specification | Rationale |
|------------|---------------|-----------|
| Primary OS | Windows 11 | Target user platform |
| Secondary OS | Linux (WSL2) | Developer environment |
| macOS Support | Not in MVP | Defer to post-validation |
| Mobile Support | Not planned | Desktop-first focus |

#### 2.2.3 Privacy Constraints (Non-Negotiable)

| Principle | Implementation |
|-----------|----------------|
| All data stays local | PostgreSQL on localhost only |
| All processing stays local | Ollama runs locally, no cloud AI |
| No telemetry | Zero analytics or tracking |
| User owns data | Local filesystem, no third-party storage |
| Future sync: P2P only | Direct device-to-device, no cloud intermediary |

**Reference**: ADR-003: Local-First Privacy (to be formalized)

### 2.3 Assumptions

1. **Single User**: MVP targets solo developer use; multi-user authentication deferred
2. **Local Network**: Server binds to localhost only; network deployment is future scope
3. **GPU Availability**: Ollama performance assumes GPU; CPU fallback acceptable with degraded performance
4. **Windows 11**: Primary development and deployment target
5. **Technical User**: Setup complexity acceptable for initial validation phase

---

## 3. System Context

### 3.1 System Boundary Diagram

```
+-----------------------------------------------------------------------------+
|                          Windows 11 Host Machine                             |
|                                                                              |
|  +------------------+                                                        |
|  |   User           |                                                        |
|  |   (Developer)    |                                                        |
|  +--------+---------+                                                        |
|           |                                                                  |
|           | User Interaction (Mouse, Keyboard, Hotkey: Ctrl+Alt+H)          |
|           v                                                                  |
|  +------------------+          HTTP/WS           +---------------------+     |
|  |  Tauri Desktop   |<------------------------->|   Axum API Server   |     |
|  |  (React UI)      |       localhost:53211     |   (Rust Backend)    |     |
|  |                  |                           |                     |     |
|  |  - Global Hotkey |                           |  - REST API v1      |     |
|  |  - System Tray   |                           |  - WebSocket        |     |
|  |  - Windows 11 UI |                           |  - Job Queue        |     |
|  +------------------+                           |  - MCP Server       |     |
|                                                 +----------+----------+     |
|                                                            |                 |
|                                    +----------+------------+------------+    |
|                                    |          |                         |    |
|                                    v          v                         v    |
|                            +----------+  +----------+            +----------+|
|                            |PostgreSQL|  |PostgreSQL|            |  Ollama  ||
|                            |  (Data)  |  |(pgvector)|            | (AI/NLP) ||
|                            |:5432     |  | Vectors  |            | :11434   ||
|                            +----------+  +----------+            +----------+|
|                                                                              |
+-----------------------------------------------------------------------------+

External Actors:
- User: Solo developer using HotM for personal knowledge management
- (Future) AI Assistant: External AI tool using MCP protocol to interact with notes
```

### 3.2 External Interfaces

#### 3.2.1 PostgreSQL Database

- **Type**: Relational database with extensions
- **Port**: 5432 (localhost)
- **Extensions Required**:
  - `pgvector`: Vector similarity search for embeddings
  - `uuid-ossp`: UUID generation
- **Connection**: SQLx connection pool (async)
- **Data Storage**:
  - JSONB for flexible note metadata
  - tsvector for full-text search
  - vector(768) for embeddings

#### 3.2.2 Ollama NLP Service

- **Type**: Local AI inference engine
- **Port**: 11434 (localhost)
- **API**: REST (OpenAI-compatible)
- **Models Used**:
  - `gpt-oss:20b`: Text generation, summarization, tag extraction
  - `nomic-embed-text`: 768-dimensional embedding vectors
- **Dependency Type**: Optional (graceful degradation without it)

#### 3.2.3 User Interface

- **Type**: Native Windows 11 desktop application
- **Framework**: Tauri 2.4 wrapping React 19
- **Visual Style**: Windows 11 Mica/Acrylic effects
- **Integration Points**:
  - Global hotkey: Ctrl+Alt+H
  - System tray icon
  - Native window chrome
  - MSI installer (future)

### 3.3 User Interaction Model

```
User Workflow (Primary):

1. Quick Capture
   [Ctrl+Alt+H] --> Window appears --> Type note --> [Enter] --> Saved

2. Search & Retrieve
   [Open App] --> Search bar --> Type query --> Results appear --> Click note

3. Explore Connections
   [View Note] --> Click "Related" --> See linked notes --> Navigate web of thoughts

4. Review Revisions
   [View Note] --> Toggle "Original/Revised" --> Compare AI enhancement

5. Organize
   [Select Notes] --> Apply tags --> Create collections --> Filter views
```

---

## 4. Component Architecture

### 4.1 High-Level Component Diagram

```
+-----------------------------+
|        Tauri Desktop        |
|  +------------------------+ |
|  |      React Frontend    | |
|  |  - NoteEditor          | |
|  |  - NoteList            | |
|  |  - SearchBar           | |
|  |  - Settings            | |
|  +----------+-------------+ |
|             |               |
|  +----------v-------------+ |
|  |    Tauri Rust Backend  | |
|  |  - System Tray         | |
|  |  - Global Hotkey       | |
|  |  - Window Management   | |
|  +-----------+------------+ |
+--------------|--------------|
               | HTTP/WS (localhost:53211)
               v
+-----------------------------+
|       Axum API Server       |
|  +------------------------+ |
|  |        Router          | |
|  |  - /api/v1/notes       | |
|  |  - /api/v1/search      | |
|  |  - /api/v1/tags        | |
|  |  - /ws                 | |
|  +-----------+------------+ |
|              |              |
|  +-----------v------------+ |
|  |      Route Handlers    | |
|  |  - notes.rs            | |
|  |  - search.rs           | |
|  |  - tags.rs             | |
|  |  - jobs.rs             | |
|  +-----------+------------+ |
|              |              |
|  +-----------v------------+ |
|  |    Business Logic      | |
|  |  - models.rs           | |
|  |  - db.rs               | |
|  |  - ollama.rs           | |
|  |  - jobs/queue.rs       | |
|  +-----------+------------+ |
+--------------|--------------|
               |
      +--------+--------+
      |                 |
      v                 v
+----------+      +-----------+
|PostgreSQL|      |  Ollama   |
| :5432    |      |  :11434   |
+----------+      +-----------+
```

### 4.2 API Server (Axum)

**Location**: `/home/manitcor/dev/hotm/server/`

#### 4.2.1 Directory Structure

```
server/
├── src/
│   ├── main.rs           # Entry point, router setup, server config
│   ├── routes/           # API route handlers
│   │   ├── mod.rs        # Route module exports
│   │   ├── notes.rs      # Note CRUD endpoints
│   │   ├── search.rs     # Hybrid search endpoints
│   │   ├── tags.rs       # Tag management
│   │   ├── collections.rs # Collection management
│   │   └── jobs.rs       # Job status endpoints
│   ├── models.rs         # Database models (SQLx)
│   ├── db.rs             # Connection pool setup
│   ├── ollama.rs         # Ollama client
│   └── jobs/             # Background job processing
│       ├── mod.rs        # Job module exports
│       ├── queue.rs      # Job queue management
│       ├── embedding.rs  # Embedding generation job
│       ├── revision.rs   # AI revision job
│       ├── linking.rs    # Auto-linking job
│       └── tagging.rs    # Tag extraction job
├── migrations/           # SQLx migrations (historical reference)
└── Cargo.toml            # Dependencies
```

#### 4.2.2 API Routes (v1)

Base URL: `http://127.0.0.1:53211/api/v1`

**Notes**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/notes` | Create new note |
| GET | `/notes/{id}` | Get note with revisions |
| PUT | `/notes/{id}` | Update note metadata |
| DELETE | `/notes/{id}` | Soft delete note |
| PUT | `/notes/{id}/revised` | Update revision content |
| GET | `/notes/{id}/provenance` | Get revision history |
| POST | `/notes/{id}/links` | Create link to another note |
| GET | `/notes/{id}/links` | Get note's links |

**Search**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Hybrid search (FTS + vector + filters) |
| POST | `/semantic` | Pure semantic similarity search |

**Organization**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tags` | Create new tag |
| GET | `/tags` | List all tags |
| PUT | `/notes/{id}/tags` | Set note tags |
| POST | `/collections` | Create collection |
| GET | `/collections` | List collections |
| PUT | `/notes/{id}/collection` | Assign note to collection |

**Jobs**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | List recent jobs |
| GET | `/jobs/{id}` | Get job details |

**System**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

#### 4.2.3 Middleware Stack

```
Request Flow:
  |
  v
[CORS Middleware]     - Allow localhost origins
  |
  v
[Logging Middleware]  - Request/response logging (tracing)
  |
  v
[Error Handler]       - Consistent JSON error responses
  |
  v
[Route Handler]       - Business logic
  |
  v
[Response]
```

**CORS Configuration** (localhost only for MVP):
```rust
CorsLayer::new()
    .allow_origin("http://localhost:1420".parse::<HeaderValue>())
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_headers([CONTENT_TYPE])
```

#### 4.2.4 Error Handling

Standard error response format:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Note with ID xyz not found",
    "details": null
  }
}
```

Error codes:
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND`: Resource does not exist
- `CONFLICT`: Resource state conflict
- `INTERNAL_ERROR`: Server-side failure
- `SERVICE_UNAVAILABLE`: External service (Ollama) unavailable

**Security Note**: In production deployments (future network mode), error details should be filtered to prevent information disclosure. See Security Review Section 11.

#### 4.2.5 Unit Testing Routes

**Testing Approach**: Routes are unit tested via dependency injection of mock services.

```rust
// Example: Unit test for create note route
#[tokio::test]
async fn test_create_note_route() {
    let mock_db = MockDatabase {
        create_note_response: Ok(Note { id: Uuid::new_v4(), title: "Test".to_string(), ... })
    };
    let state = AppState { db: Arc::new(mock_db), ollama: Arc::new(MockOllama::new()) };

    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/notes")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"content":"test note content"}"#))
        .unwrap();

    let response = app(state).oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
}

// Error injection test
#[tokio::test]
async fn test_create_note_database_error() {
    let mock_db = MockDatabase {
        create_note_response: Err(DbError::ConnectionFailed)
    };
    let state = AppState { db: Arc::new(mock_db), ... };

    let response = app(state).oneshot(create_note_request()).await.unwrap();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

    let body: ErrorResponse = parse_body(response).await;
    assert_eq!(body.error.code, "INTERNAL_ERROR");
}
```

**Pattern**: Each route handler accepts `AppState` with trait-based dependencies, enabling mock injection for isolated unit tests without database connections.

### 4.3 Desktop Client (Tauri + React)

**Location**: `/home/manitcor/dev/hotm/ui/`

#### 4.3.1 Directory Structure

```
ui/
├── src/                  # React frontend
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # React entry point
│   ├── components/       # React components
│   │   ├── NoteEditor/   # Markdown editor with preview
│   │   ├── NoteList/     # Note listing and filtering
│   │   ├── Search/       # Search interface
│   │   ├── Sidebar/      # Navigation sidebar
│   │   └── Settings/     # Configuration UI
│   ├── hooks/            # Custom React hooks
│   │   ├── useNotes.ts   # Note data fetching
│   │   ├── useSearch.ts  # Search state
│   │   └── useWebSocket.ts # Real-time updates
│   ├── services/         # API clients
│   │   ├── api.ts        # HTTP client (fetch wrapper)
│   │   └── websocket.ts  # WebSocket client
│   └── stores/           # State management (if using Zustand/Redux)
├── src-tauri/            # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs       # Tauri entry point
│   │   ├── commands.rs   # Tauri IPC commands
│   │   └── tray.rs       # System tray management
│   ├── tauri.conf.json   # Tauri configuration
│   └── Cargo.toml        # Tauri dependencies
├── package.json          # NPM dependencies
└── vite.config.ts        # Vite build configuration
```

#### 4.3.2 Component Hierarchy

```
App
├── Layout
│   ├── TitleBar (Windows 11 chrome)
│   ├── Sidebar
│   │   ├── SearchInput
│   │   ├── NavigationMenu
│   │   └── CollectionList
│   └── MainContent
│       ├── NoteList
│       │   ├── NoteCard (repeated)
│       │   └── Pagination
│       └── NoteEditor
│           ├── ToolbarActions
│           ├── MarkdownEditor
│           ├── PreviewPane
│           └── MetadataPanel
│               ├── TagManager
│               ├── LinkManager
│               └── RevisionHistory
└── Modals
    ├── SettingsModal
    ├── QuickCaptureModal (hotkey triggered)
    └── ConfirmationDialogs
```

#### 4.3.3 State Management

**Local State** (React useState/useReducer):
- Current note being edited
- UI toggle states (sidebar expanded, preview mode)
- Form inputs

**Server State** (React Query or SWR pattern):
- Notes list (paginated, cached)
- Search results
- Tags and collections

**Global State** (Context or Zustand):
- User settings (theme, editor preferences)
- WebSocket connection status
- Authentication state (future)

#### 4.3.4 Tauri IPC Commands

The Tauri backend handles desktop integration only (no business logic):

```rust
// commands.rs
#[tauri::command]
fn show_quick_capture_window(app_handle: AppHandle) -> Result<(), String>;

#[tauri::command]
fn get_server_url() -> String;

#[tauri::command]
fn set_auto_start(enabled: bool) -> Result<(), String>;

#[tauri::command]
fn get_system_theme() -> String; // "light" | "dark"
```

**Architectural Constraint**: NO server code in Tauri backend (ADR-001). All business logic goes through HTTP to Axum server.

#### 4.3.5 Frontend Testing Approach

**Unit Tests** (Vitest + React Testing Library):
- Component rendering tests
- User interaction tests
- Hook behavior tests

**Integration Tests**:
- API service mock tests
- WebSocket service mock tests

**E2E Tests** (Playwright):
- Critical user journeys
- Full application flow

```typescript
// Example: Component unit test
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteEditor } from './NoteEditor';

describe('NoteEditor', () => {
  it('renders markdown content', () => {
    render(<NoteEditor content="# Hello" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello');
  });

  it('calls onSave when save button clicked', () => {
    const onSave = vi.fn();
    render(<NoteEditor content="test" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalled();
  });
});
```

### 4.4 Database Layer (PostgreSQL + pgvector)

#### 4.4.1 Schema Overview

The database schema comprises 17 tables organized into functional groups:

**Core Note Storage**:
- `note`: Main note entity with metadata
- `note_original`: Immutable original content (never modified)
- `note_revised_current`: Current AI-revised version
- `note_revision`: Historical revision versions

**Organization**:
- `collection`: User-defined note collections
- `tag`: Reusable tags
- `note_tag`: Many-to-many junction table

**Relationships**:
- `link`: Connections between notes (explicit and auto-discovered)
- `provenance_edge`: Tracks revision lineage

**Search**:
- `embedding`: Vector embeddings for semantic search (pgvector)

**Jobs**:
- `job_queue`: Active background jobs
- `job_history`: Completed job records

**Configuration**:
- `user_metadata_label`: Custom metadata field definitions
- `user_config`: Application settings
- `activity_log`: Audit trail

#### 4.4.2 Key Tables Detail

**note**:
```sql
CREATE TABLE note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,                              -- AI-generated or user-provided
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,        -- Soft delete only
    collection_id UUID REFERENCES collection(id),
    metadata JSONB DEFAULT '{}'::jsonb,      -- Flexible extra data
    search_vector TSVECTOR                   -- Full-text search
);
```

**note_original**:
```sql
CREATE TABLE note_original (
    id UUID PRIMARY KEY REFERENCES note(id),
    content TEXT NOT NULL,                   -- IMMUTABLE after creation
    content_type VARCHAR(50) DEFAULT 'markdown',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_edited BOOLEAN DEFAULT FALSE        -- Track if manually edited
);
```

**embedding**:
```sql
CREATE TABLE embedding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES note(id),
    chunk_index INT DEFAULT 0,               -- For chunked long notes
    vector vector(768),                      -- nomic-embed-text dimension
    model VARCHAR(100),                      -- Model used for generation
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**link**:
```sql
CREATE TABLE link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_note_id UUID REFERENCES note(id),
    target_note_id UUID REFERENCES note(id),
    link_type VARCHAR(50),                   -- 'explicit', 'semantic', 'citation'
    strength FLOAT,                          -- Semantic similarity score
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.4.3 Indexing Strategy

**Full-Text Search**:
```sql
CREATE INDEX idx_note_search_vector ON note USING GIN(search_vector);
```

**Vector Similarity** (HNSW for fast approximate nearest neighbor):
```sql
CREATE INDEX idx_embedding_vector ON embedding
    USING hnsw (vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

**Common Query Patterns**:
```sql
-- Note by ID
CREATE INDEX idx_note_id ON note(id);

-- Notes by collection
CREATE INDEX idx_note_collection ON note(collection_id) WHERE NOT is_deleted;

-- Recent notes
CREATE INDEX idx_note_created ON note(created_at DESC) WHERE NOT is_deleted;

-- Links by source
CREATE INDEX idx_link_source ON link(source_note_id);
```

#### 4.4.4 SQLx Integration

- **Compile-time Verification**: All queries verified at compile time
- **Prepared Queries**: `.sqlx/` directory contains query metadata
- **Connection Pool**: `sqlx::PgPool` for async connection management
- **Migrations**: `server/migrations/` for schema evolution (ADR-002: clean schema rebuild for development)

#### 4.4.5 Database Test Isolation Pattern

**Test Isolation Strategy**: Use per-test transactions with ROLLBACK to ensure complete isolation.

```rust
// Test database setup helper
async fn setup_test_db() -> (PgPool, Transaction<'static, Postgres>) {
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&std::env::var("TEST_DATABASE_URL").unwrap())
        .await
        .unwrap();

    // Start transaction that will be rolled back
    let tx = pool.begin().await.unwrap();
    (pool, tx)
}

// Test example with isolation
#[sqlx::test]
async fn test_create_note_isolated(pool: PgPool) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    // Test creates note within transaction
    let note_id = sqlx::query_scalar!(
        r#"INSERT INTO note (title) VALUES ($1) RETURNING id"#,
        "Test Note"
    )
    .fetch_one(&mut *tx)
    .await?;

    // Verify note exists
    let count: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM note WHERE id = $1"#,
        note_id
    )
    .fetch_one(&mut *tx)
    .await?;

    assert_eq!(count, 1);

    // Transaction automatically rolled back when tx drops
    // No cleanup needed, test data never committed
    Ok(())
}
```

**Soft Delete Handling in Tests**:
- Tests should explicitly verify `is_deleted = false` in WHERE clauses
- Test fixtures include both active and soft-deleted records
- Parallel test execution is safe due to transaction isolation

**Parallel Test Validation**:
```bash
# Run tests in parallel (default)
cargo test -- --test-threads=8

# Run tests sequentially to verify isolation
cargo test -- --test-threads=1

# Results should be identical - if not, isolation is broken
```

### 4.5 NLP Pipeline (Ollama Integration)

#### 4.5.1 Pipeline Architecture

```
Note Created/Updated
        |
        v
+------------------+
|   Job Queue      |  (PostgreSQL-backed)
|   - embedding    |
|   - revision     |
|   - tagging      |
|   - linking      |
+--------+---------+
         |
         v
+------------------+
|  Job Processor   |  (Tokio task in Axum server)
+--------+---------+
         |
    +----+----+
    |         |
    v         v
+--------+ +--------+
| Ollama | | Ollama |
| Chat   | | Embed  |
+--------+ +--------+
    |         |
    +----+----+
         |
         v
+------------------+
|  Database Update |
|  - note_revision |
|  - embedding     |
|  - note_tag      |
|  - link          |
+------------------+
         |
         v
+------------------+
|  WebSocket Push  |  (Notify client of completion)
+------------------+
```

#### 4.5.2 Job Types

| Job Type | Input | Output | Model |
|----------|-------|--------|-------|
| `embedding` | Note content | 768-dim vector | nomic-embed-text |
| `revision` | Original content | Revised summary | gpt-oss:20b |
| `tagging` | Note content | Suggested tags | gpt-oss:20b |
| `linking` | Note embedding | Related note IDs | Vector similarity |
| `title_generation` | Note content | Title string | gpt-oss:20b |

#### 4.5.3 Ollama Client

```rust
// ollama.rs (simplified)
pub struct OllamaClient {
    base_url: String,  // http://localhost:11434
    http_client: reqwest::Client,
}

impl OllamaClient {
    pub async fn generate(&self, model: &str, prompt: &str) -> Result<String>;
    pub async fn embed(&self, model: &str, text: &str) -> Result<Vec<f32>>;
    pub async fn is_available(&self) -> bool;
}
```

##### 4.5.3.1 Ollama Testing Strategy

**Mock Interface Pattern**: Define trait for Ollama operations to enable dependency injection.

```rust
#[async_trait]
pub trait OllamaInterface: Send + Sync {
    async fn generate(&self, model: &str, prompt: &str) -> Result<String>;
    async fn embed(&self, model: &str, text: &str) -> Result<Vec<f32>>;
    async fn is_available(&self) -> bool;
}

// Production implementation
impl OllamaInterface for OllamaClient {
    // Real HTTP calls to Ollama
}

// Mock implementation for testing
#[cfg(test)]
pub struct MockOllama {
    pub generate_responses: HashMap<String, String>,
    pub embed_responses: HashMap<String, Vec<f32>>,
    pub available: bool,
}

#[cfg(test)]
#[async_trait]
impl OllamaInterface for MockOllama {
    async fn generate(&self, _model: &str, prompt: &str) -> Result<String> {
        // Deterministic response based on prompt hash
        Ok(self.generate_responses
            .get(prompt)
            .cloned()
            .unwrap_or_else(|| format!("Mock response for: {}", &prompt[..20.min(prompt.len())])))
    }

    async fn embed(&self, _model: &str, text: &str) -> Result<Vec<f32>> {
        // Return seeded 768-dim vector for deterministic testing
        Ok(self.embed_responses
            .get(text)
            .cloned()
            .unwrap_or_else(|| {
                // Generate deterministic vector from text hash
                let seed = text.bytes().fold(0u64, |acc, b| acc.wrapping_add(b as u64));
                (0..768).map(|i| ((seed + i as u64) % 1000) as f32 / 1000.0).collect()
            }))
    }

    async fn is_available(&self) -> bool {
        self.available
    }
}
```

**Test Fixtures**:
```rust
#[cfg(test)]
mod fixtures {
    pub fn mock_ollama_available() -> MockOllama {
        MockOllama {
            generate_responses: HashMap::from([
                ("summarize: test content".to_string(), "Summary: test".to_string()),
            ]),
            embed_responses: HashMap::new(),
            available: true,
        }
    }

    pub fn mock_ollama_unavailable() -> MockOllama {
        MockOllama {
            generate_responses: HashMap::new(),
            embed_responses: HashMap::new(),
            available: false,
        }
    }
}
```

**Environment Variable**: `USE_MOCK_AI=true` activates mock in integration tests.

#### 4.5.4 Graceful Degradation

When Ollama is unavailable:
- Note CRUD: **Full functionality** (no AI dependency)
- Search: **Full-text only** (semantic search disabled)
- Linking: **Manual only** (no auto-discovery)
- Tags: **Manual only** (no AI suggestions)
- UI Status: **Clear indication** ("AI features unavailable")

### 4.6 WebSocket Layer

#### 4.6.1 Connection Management

**Endpoint**: `ws://localhost:53211/ws`

**Connection Lifecycle**:
```
1. Client connects to /ws
2. Server accepts, assigns connection ID
3. Client subscribes to channels (optional)
4. Server pushes events on relevant channels
5. Client disconnects or connection times out
```

#### 4.6.2 Message Types

**Server -> Client**:
```json
{
  "type": "job_progress",
  "payload": {
    "job_id": "uuid",
    "note_id": "uuid",
    "job_type": "revision",
    "status": "processing",
    "progress": 50,
    "message": "Generating summary..."
  }
}
```

```json
{
  "type": "note_updated",
  "payload": {
    "note_id": "uuid",
    "updated_fields": ["revised_content", "tags"]
  }
}
```

```json
{
  "type": "search_index_ready",
  "payload": {
    "note_id": "uuid"
  }
}
```

**Client -> Server**:
```json
{
  "type": "subscribe",
  "payload": {
    "channels": ["notes", "jobs"]
  }
}
```

#### 4.6.3 WebSocket Testing Approach

**Backend WebSocket Testing** (tokio-tungstenite):

```rust
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[tokio::test]
async fn test_websocket_job_progress_notification() {
    // Start test server
    let (server_tx, _) = broadcast::channel::<WsMessage>(100);
    let server = spawn_test_server(server_tx.clone()).await;

    // Connect WebSocket client
    let (ws_stream, _) = connect_async(format!("ws://127.0.0.1:{}/ws", server.port))
        .await
        .expect("Failed to connect");
    let (_, mut read) = ws_stream.split();

    // Simulate job progress event from server
    server_tx.send(WsMessage::JobProgress {
        job_id: "test-job-id".to_string(),
        note_id: "test-note-id".to_string(),
        status: "processing".to_string(),
        progress: 50,
    }).unwrap();

    // Assert client receives message
    let msg = tokio::time::timeout(Duration::from_secs(1), read.next())
        .await
        .expect("Timeout waiting for message")
        .expect("Stream ended")
        .expect("WebSocket error");

    if let Message::Text(text) = msg {
        let parsed: WsMessage = serde_json::from_str(&text).unwrap();
        assert!(matches!(parsed, WsMessage::JobProgress { progress: 50, .. }));
    } else {
        panic!("Expected text message");
    }
}

#[tokio::test]
async fn test_websocket_multi_client_broadcast() {
    let (server_tx, _) = broadcast::channel::<WsMessage>(100);
    let server = spawn_test_server(server_tx.clone()).await;

    // Connect two clients
    let (ws1, _) = connect_async(format!("ws://127.0.0.1:{}/ws", server.port)).await.unwrap();
    let (ws2, _) = connect_async(format!("ws://127.0.0.1:{}/ws", server.port)).await.unwrap();
    let (_, mut read1) = ws1.split();
    let (_, mut read2) = ws2.split();

    // Broadcast message
    server_tx.send(WsMessage::NoteUpdated {
        note_id: "note-123".to_string(),
        updated_fields: vec!["title".to_string()],
    }).unwrap();

    // Both clients should receive
    let msg1 = read1.next().await.unwrap().unwrap();
    let msg2 = read2.next().await.unwrap().unwrap();
    assert_eq!(msg1, msg2);
}

#[tokio::test]
async fn test_websocket_reconnection() {
    let server = spawn_test_server_with_reconnect_support().await;

    // Initial connection
    let (ws, _) = connect_async(format!("ws://127.0.0.1:{}/ws", server.port)).await.unwrap();
    drop(ws); // Simulate disconnect

    // Reconnect after delay
    tokio::time::sleep(Duration::from_millis(100)).await;
    let (ws2, _) = connect_async(format!("ws://127.0.0.1:{}/ws", server.port)).await.unwrap();

    // Should successfully reconnect and receive messages
    assert!(ws2.get_ref().is_some());
}
```

**Frontend WebSocket Testing** (Vitest mock):

```typescript
// websocket.mock.ts
export class MockWebSocket {
  private listeners: Map<string, Function[]> = new Map();
  public readyState = WebSocket.CONNECTING;

  constructor(url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.emit('open', {});
    }, 0);
  }

  addEventListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  simulateMessage(data: object) {
    this.emit('message', { data: JSON.stringify(data) });
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

// Test example
describe('useWebSocket', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('handles job progress messages', async () => {
    const { result } = renderHook(() => useWebSocket());

    // Get mock instance
    const mockWs = result.current.socket as unknown as MockWebSocket;

    // Simulate server message
    mockWs.simulateMessage({
      type: 'job_progress',
      payload: { job_id: '123', progress: 50 }
    });

    await waitFor(() => {
      expect(result.current.lastJobProgress?.progress).toBe(50);
    });
  });
});
```

---

## 5. Data Architecture

### 5.1 Entity Relationships

```
                            +-------------+
                            |  collection |
                            +------+------+
                                   |
                                   | 1:N
                                   v
+------------+     1:1     +-------+-------+     1:N     +---------------+
|note_original|<---------->|     note      |<---------->|  note_revision|
+------------+             +-------+-------+             +---------------+
                                   |
                    +------+-------+-------+------+
                    |      |               |      |
                   1:N    N:M             N:M    1:N
                    v      v               v      v
            +-------+  +---+---+     +----+----+  +--------+
            |  link |  |note_tag|    |embedding|  |job_queue|
            +-------+  +---+---+     +---------+  +--------+
                           |
                          N:1
                           v
                       +---+---+
                       |  tag  |
                       +-------+

Key Relationships:
- note -> note_original: 1:1 (every note has exactly one original)
- note -> note_revision: 1:N (notes can have multiple revisions)
- note -> collection: N:1 (notes belong to one collection)
- note <-> tag: N:M (via note_tag junction)
- note -> embedding: 1:N (long notes chunked into multiple embeddings)
- note -> link: N:N (notes link to other notes, bidirectional)
```

### 5.2 Storage Strategy

#### 5.2.1 Immutable Originals Pattern

**Principle**: Original note content is NEVER modified after creation.

```
Create Note:
  1. INSERT into note (metadata only)
  2. INSERT into note_original (content, IMMUTABLE)
  3. COMMIT transaction
  4. Queue NLP jobs (async)

Edit Note (creates revision):
  1. INSERT into note_revision (new content)
  2. INSERT into provenance_edge (links to original)
  3. UPDATE note_revised_current (pointer to new revision)
  4. Original UNTOUCHED
```

**Benefits**:
- Complete audit trail
- No accidental data loss
- Easy sync (append-only)
- Provenance tracking for AI revisions

**Security Note**: This pattern provides strong data integrity for audit trails (Security Review Section 3.2).

#### 5.2.2 JSONB for Flexible Metadata

The `metadata JSONB` column allows schema evolution without migrations:

```json
// Current metadata structure
{
  "source": "quick_capture",
  "context": "meeting notes",
  "custom_fields": {
    "project": "HotM",
    "priority": "high"
  }
}
```

**Querying JSONB**:
```sql
-- Find notes with specific metadata
SELECT * FROM note
WHERE metadata->>'source' = 'quick_capture';

-- Index for performance
CREATE INDEX idx_note_metadata ON note USING GIN (metadata);
```

#### 5.2.3 Vector Storage (pgvector)

- **Dimension**: 768 (nomic-embed-text output)
- **Index Type**: HNSW (Hierarchical Navigable Small World)
- **Distance Metric**: Cosine similarity
- **Chunking**: Long notes split into ~500 token chunks, each gets separate embedding

**Semantic Search Query**:
```sql
SELECT n.*, 1 - (e.vector <=> $1::vector) AS similarity
FROM note n
JOIN embedding e ON n.id = e.note_id
WHERE NOT n.is_deleted
ORDER BY e.vector <=> $1::vector
LIMIT 10;
```

### 5.3 Hybrid Search Algorithm

```
Hybrid Search Flow:

1. Parse Query
   - Extract keywords for FTS
   - Generate embedding for semantic search

2. Parallel Retrieval
   +------------------+    +------------------+
   | Full-Text Search |    | Semantic Search  |
   |  (tsvector)      |    |  (pgvector)      |
   +--------+---------+    +--------+---------+
            |                       |
            v                       v
   +--------+---------+    +--------+---------+
   |  Top 50 results  |    |  Top 50 results  |
   |  with FTS score  |    | with similarity  |
   +--------+---------+    +--------+---------+

3. Reciprocal Rank Fusion (RRF)
   - Combine rankings from both sources
   - Score = sum(1 / (k + rank)) for k=60
   - Handles different score distributions

4. Re-ranking (optional)
   - LLM-based relevance scoring
   - Only for top 10 candidates

5. Return Results
   - Final ranked list with scores
   - Pagination via cursor
```

---

## 6. Security Architecture

### 6.1 Security Principles

| Principle | Implementation |
|-----------|----------------|
| Privacy by Default | All data local, no cloud (ADR-003) |
| Minimal Attack Surface | localhost binding only |
| Data Integrity | Immutable originals, ACID |
| User Control | User owns all data |
| Least Privilege | No admin/root required |

### 6.2 Network Security

#### 6.2.1 Local-Only Binding (MVP)

```rust
// Axum server binds to localhost only
let addr = SocketAddr::from(([127, 0, 0, 1], 53211));
axum::Server::bind(&addr).serve(app.into_make_service());
```

**No external access** - network requests to 53211 from other machines are refused.

**Threat Mitigation**: Localhost binding prevents remote access by design. Source code review confirms binding address. (Security Review: Threat Model - Localhost Binding Bypass)

#### 6.2.2 Future Network Mode

When network deployment is enabled (post-MVP):
- TLS 1.3 required (minimum, no 1.2 fallback)
- API key or JWT authentication (ADR-006)
- Configurable allowed origins
- Rate limiting (100 req/min per IP)
- CSRF protection for state-changing operations

**Deferred**: Network mode security controls will be specified in ADR-006 before network deployment is enabled.

### 6.3 Authentication (Planned)

**MVP**: No authentication required (single-user, localhost)

**Future (Network Mode)**:
```
Authentication Flow:

1. Admin creates API key via CLI or UI
2. API key stored (hashed) in user_config table
3. Clients include API key in X-API-Key header
4. Server validates key, returns 401 if invalid

Header Format:
X-API-Key: hotm_ak_xxxxxxxxxxxxxxxxxxxxx
```

Environment variables (future):
- `JWT_SECRET`: Secret for JWT token signing
- `API_KEY_SALT`: Salt for API key hashing

**Deferred**: Authentication implementation deferred to ADR-006 (network mode).

### 6.4 Data Security

#### 6.4.1 Data at Rest

- **PostgreSQL Encryption**: User-configurable via PostgreSQL settings
- **File System**: Standard OS permissions
- **Sensitive Data**: No credentials stored in database (environment variables)

**Deferred**: Encryption at rest guidance (pgcrypto, TDE, BitLocker) will be documented before beta release per Security Review recommendation.

#### 6.4.2 Data in Transit

- **MVP (localhost)**: Unencrypted HTTP (acceptable for localhost loopback)
- **Future (network)**: TLS 1.3 required, Perfect Forward Secrecy (PFS) cipher suites only

#### 6.4.3 Secrets Management

```
Environment Variables:
- DATABASE_URL     : PostgreSQL connection string
- OLLAMA_URL       : Ollama service URL
- JWT_SECRET       : (future) JWT signing key
- API_KEY_SALT     : (future) API key hashing salt

Storage:
- .env file (development, gitignored)
- System environment (production)
- Windows Credential Manager (future installer option)
```

**Security Note**: Pre-commit hooks should prevent .env commits (Security Review Section 6).

### 6.5 Security Risks (from Security Review)

| Risk | Mitigation | Status |
|------|------------|--------|
| Localhost binding bypassed | Firewall rules, no public IP, code review | Mitigated |
| SQL injection | SQLx compile-time verification, parameterized queries | Mitigated |
| XSS in note content | React escaping, CSP headers | Mitigated |
| Dependency vulnerabilities | `cargo audit`, `npm audit` in CI | Monitored |
| Error information disclosure | Production error filtering (future) | Deferred |

### 6.6 Input Validation (Planned)

**Deferred to Construction**: Input validation framework will be implemented per Security Review Section 7.

Validation requirements:
- Note content max length limits
- Metadata field type checking
- Collection/tag name character restrictions
- API endpoint input schema validation

---

## 7. Deployment Architecture

### 7.1 Development Environment

#### 7.1.1 Docker Compose (Recommended)

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: hotm_dev
      POSTGRES_USER: hotm
      POSTGRES_PASSWORD: dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  postgres_data:
  ollama_models:
```

**Startup Commands**:
```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# Pull Ollama models (first time)
docker exec ollama ollama pull gpt-oss:20b
docker exec ollama ollama pull nomic-embed-text

# Start Axum server
cd server && cargo run

# Start Tauri client
cd ui && npm run tauri dev
```

#### 7.1.2 Native Setup (Alternative)

For users preferring native installations:

```bash
# PostgreSQL with pgvector
# (Install PostgreSQL 14+, compile pgvector extension)
psql -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Ollama
# (Download from ollama.ai, install, pull models)
ollama pull gpt-oss:20b
ollama pull nomic-embed-text

# Environment
export DATABASE_URL=postgres://hotm:password@localhost:5432/hotm_dev
export OLLAMA_URL=http://localhost:11434

# Run
cd server && cargo run
cd ui && npm run tauri dev
```

#### 7.1.3 One-Command Setup

```bash
# Linux/WSL
./scripts/dev_server.sh
# - Checks Ollama availability
# - Pulls required models
# - Ensures pgvector extension
# - Starts Axum server
```

### 7.2 Production Architecture (Local)

```
+------------------------------------------------------------+
|                     Windows 11 Host                         |
|                                                             |
|  +--------------------------------------------------+      |
|  |  System Tray                                     |      |
|  |  +-------------+  +-------------------------+    |      |
|  |  | HotM Icon   |  | Status: Running         |    |      |
|  |  +-------------+  | Server: localhost:53211 |    |      |
|  |                   | DB: Connected           |    |      |
|  |                   | Ollama: Available       |    |      |
|  |                   +-------------------------+    |      |
|  +--------------------------------------------------+      |
|                                                             |
|  +------------------+    +-------------------+              |
|  | Tauri App (UI)   |    | Axum Server       |              |
|  | (Auto-start)     |    | (Windows Service) |              |
|  +--------+---------+    +---------+---------+              |
|           |                        |                        |
|           | HTTP :53211            | SQLx                   |
|           v                        v                        |
|  +------------------+    +-------------------+              |
|  |   localhost      |    |   PostgreSQL      |              |
|  |   (loopback)     |    |   (Service)       |              |
|  +------------------+    +-------------------+              |
|                                   |                        |
|                                   v                        |
|                          +-------------------+              |
|                          |   Ollama          |              |
|                          |   (Service)       |              |
|                          +-------------------+              |
+------------------------------------------------------------+
```

**Production Features** (future):
- Axum server as Windows Service
- Auto-start on login
- MSI installer for easy deployment
- Health monitoring dashboard

### 7.3 Network Deployment (Future)

```
+---------------------+          +-----------------------------+
|  Client Machine A   |          |      Server Machine         |
|                     |          |                             |
|  +---------------+  |   HTTPS  |  +---------------------+    |
|  | Tauri Client  +--+----------+->| Axum Server         |    |
|  +---------------+  |   :53211 |  | (Windows Service)   |    |
|                     |          |  +----------+----------+    |
+---------------------+          |             |               |
                                 |     +-------+-------+       |
+---------------------+          |     |               |       |
|  Client Machine B   |          |     v               v       |
|                     |          |  +-------+    +---------+   |
|  +---------------+  |   HTTPS  |  |Postgres|   | Ollama  |   |
|  | Tauri Client  +--+----------+->|        |   |  (GPU)  |   |
|  +---------------+  |   :53211 |  +-------+    +---------+   |
|                     |          |                             |
+---------------------+          +-----------------------------+

Requirements for Network Mode:
- TLS certificate (self-signed or Let's Encrypt)
- API key authentication enabled (ADR-006)
- Firewall allows port 53211
- Server has GPU for Ollama performance
```

### 7.4 CI/CD Pipeline

```
+----------+     +----------+     +----------+     +----------+
|  Commit  | --> |  Build   | --> |   Test   | --> |  Deploy  |
+----------+     +----------+     +----------+     +----------+
                      |                |                |
                      v                v                v
               +------+------+  +------+------+  +------+------+
               | cargo build |  | backend-    |  | (Manual)    |
               | npm run     |  |   tests     |  | Release     |
               |   build     |  | frontend-   |  | artifacts   |
               +-------------+  |   tests     |  +-------------+
                                +-------------+

CI Jobs (GitHub Actions):
- backend-tests: Rust tests, clippy, formatting, security audit
- frontend-tests: React tests, TypeScript build, coverage, security audit
- release: MSI builds, deployment artifacts (on tag)
```

**Local CI Validation** (required before push):
```bash
gh act -j backend-tests   # Full Rust validation
gh act -j frontend-tests  # Full React validation
```

---

## 8. Key Architectural Decisions

### 8.1 ADR-001: Client-Server Architecture

**Status**: Accepted (2025-12-04)

**Decision**: Use separate processes for Tauri client, Axum server, PostgreSQL, and Ollama rather than embedding everything in a single executable.

**Context**: An attempt to embed all components in Tauri caused project instability and was rolled back.

**Consequences**:
- **Positive**: Clean separation, process isolation, easier debugging, flexible deployment
- **Negative**: Setup complexity, multiple processes to manage

**Trade-off Accepted**: Setup complexity acceptable for technical early adopters; single-exe packaging deferred to post-MVP if user demand exists.

**Testability Impact**: POSITIVE - Enables independent testing of components (Test Architect Review).

**Reference**: `/home/manitcor/dev/hotm/.aiwg/architecture/ADR-001-client-server-architecture.md`

### 8.2 ADR-002: Greenfield Database Schema Rebuild

**Status**: Accepted (2025-12-04)

**Decision**: Use a consolidated `clean-schema.sql` file for rapid development iteration instead of running migrations sequentially.

**Context**: Pre-production development requires fast database resets; no production data to preserve.

**Consequences**:
- **Positive**: <2 second database resets, simpler mental model, perfect for testing
- **Negative**: Migrations may drift from clean schema, requires manual sync

**Trade-off Accepted**: Development velocity prioritized over migration rigor; will switch to migration-based approach before beta release.

**Testability Impact**: POSITIVE - Fast reset supports test isolation; use transaction rollback for per-test isolation (Test Architect Review).

**Reference**: `/home/manitcor/dev/hotm/.aiwg/architecture/ADR-002-database-schema-rebuild.md`

### 8.3 ADR-003: Local-First Privacy

**Status**: To be formalized (per Security Review)

**Decision**: All data and processing stays on the local machine; no cloud services, no telemetry.

**Context**: Privacy is a non-negotiable core principle from project inception.

**Consequences**:
- **Positive**: Complete user control, no data breaches, no ongoing costs
- **Negative**: No built-in sync, user responsible for backups

**Future Sync Strategy**: Novel encryption + direct peer-to-peer, not cloud providers.

**Security Impact**: Foundation of HotM's security posture; provides audit trail via immutable originals (Security Review Section 2).

**Reference**: To be created at `/home/manitcor/dev/hotm/.aiwg/architecture/ADR-003-local-first-privacy.md`

### 8.4 Pending ADRs

| ADR | Topic | Trigger | Security/Test Impact |
|-----|-------|---------|----------------------|
| ADR-003 | Local-First Privacy | Formal documentation (recommended) | Security foundation |
| ADR-004 | Multi-Device Sync | When approaching sync implementation | Encryption requirements |
| ADR-005 | Windows Service Packaging | When production deployment ready | Service isolation |
| ADR-006 | Authentication for Network Mode | When enabling network deployment | TLS, API keys, CSRF, rate limiting |
| ADR-007 | MCP Server Integration | When implementing AI assistant integration | API authentication |

---

## 9. Risks and Mitigations

### 9.1 Architecture-Related Risks

| Risk ID | Risk | Impact | Probability | Status |
|---------|------|--------|-------------|--------|
| #1 | Incomplete rollback leaves broken integration | HIGH | MEDIUM | Mitigating |
| #2 | Rollback breaks working features | HIGH | MEDIUM | Mitigating |
| #3 | Test coverage insufficient for safe iteration | HIGH | HIGH | Identified |
| #4 | Database schema changes need careful handling | MEDIUM | MEDIUM | Mitigating |

### 9.2 Technical Risks

| Risk ID | Risk | Impact | Probability | Mitigation |
|---------|------|--------|-------------|------------|
| #6 | Performance degrades with growing corpus | MEDIUM | MEDIUM | Benchmark suite at 100/500/1000 notes |
| #8 | Ollama dependency creates barrier to entry | MEDIUM | MEDIUM | Graceful degradation, model alternatives |
| #9 | Setup complexity deters users | MEDIUM | HIGH | Docker Compose, install scripts |
| #11 | Stack has limited community | MEDIUM | LOW | Over-document, active in communities |
| #12 | Test coverage below 60% target | MEDIUM | MEDIUM | Coverage gates in CI |

### 9.3 Validation Risks

| Risk ID | Risk | Impact | Probability | Mitigation |
|---------|------|--------|-------------|------------|
| #5 | Core features inadequate for daily use | HIGH | MEDIUM | Define "good enough" criteria, rapid iteration |
| #7 | Windows UX friction prevents habitual use | HIGH | LOW | Integration checklist, multi-monitor testing |
| #13 | Personal validation fails | HIGH | MEDIUM | Usage metrics, friction log, pivot criteria |

### 9.4 Graceful Degradation Matrix

| Component Failure | Impact | Fallback Behavior |
|-------------------|--------|-------------------|
| Ollama unavailable | MEDIUM | Note CRUD works, no AI features, clear UI indicator |
| PostgreSQL unavailable | CRITICAL | Application does not start, clear error message |
| WebSocket disconnected | LOW | Polling fallback, delayed updates |
| Embedding model fails | LOW | Skip embedding, queue for retry |
| Generation model fails | LOW | Skip revision, queue for retry |

### 9.5 Concurrent Operation Testing

**Testing Strategy** (per Test Architect Review):

```rust
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_concurrent_note_creation() {
    let pool = setup_test_pool().await;

    let handles: Vec<_> = (0..10)
        .map(|i| {
            let pool = pool.clone();
            tokio::spawn(async move {
                create_note(&pool, format!("Concurrent Note {}", i)).await
            })
        })
        .collect();

    let results = futures::future::join_all(handles).await;

    // Verify all notes created successfully
    assert!(results.iter().all(|r| r.is_ok()));

    // Verify all notes exist in database
    let count: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM note")
        .fetch_one(&pool)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(count, 10);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_concurrent_job_processing() {
    let pool = setup_test_pool().await;

    // Create 10 notes, each should queue an embedding job
    for i in 0..10 {
        create_note(&pool, format!("Job Test Note {}", i)).await.unwrap();
    }

    // Verify 10 embedding jobs queued
    let job_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM job_queue WHERE job_type = 'embedding'"
    )
    .fetch_one(&pool)
    .await
    .unwrap()
    .unwrap();
    assert_eq!(job_count, 10);

    // Process jobs concurrently
    let processor = JobProcessor::new(pool.clone(), MockOllama::new());
    processor.process_all().await.unwrap();

    // Verify all jobs completed
    let remaining: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM job_queue WHERE status = 'pending'"
    )
    .fetch_one(&pool)
    .await
    .unwrap()
    .unwrap();
    assert_eq!(remaining, 0);
}
```

**Race Condition Prevention**:
- Database constraints prevent duplicate note IDs
- Job queue uses SELECT FOR UPDATE SKIP LOCKED
- Embedding updates use optimistic locking

---

## 10. Appendices

### 10.1 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Test only | - | Test database connection |
| `RUST_LOG` | No | `hotm_server=info,axum=info` | Logging level |
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama service URL |
| `OLLAMA_GENERATION_MODEL` | No | `gpt-oss:20b` | LLM for generation |
| `OLLAMA_EMBEDDING_MODEL` | No | `nomic-embed-text` | Model for embeddings |
| `USE_MOCK_AI` | Test only | `false` | Enable mock Ollama for tests |
| `JWT_SECRET` | Future | - | JWT signing secret |
| `API_KEY_SALT` | Future | - | API key hashing salt |

### 10.2 Port Assignments

| Service | Port | Binding | Purpose |
|---------|------|---------|---------|
| Axum API | 53211 | localhost | REST API and WebSocket |
| PostgreSQL | 5432 | localhost | Database |
| Ollama | 11434 | localhost | AI inference |
| Tauri Dev | 1420 | localhost | Development server |

### 10.3 File Paths

| Path | Purpose |
|------|---------|
| `/home/manitcor/dev/hotm/server/` | Axum API server source |
| `/home/manitcor/dev/hotm/ui/` | Tauri + React client source |
| `/home/manitcor/dev/hotm/scripts/schema/` | Database schema management |
| `/home/manitcor/dev/hotm/.aiwg/` | SDLC artifacts |
| `/home/manitcor/dev/hotm/docs/` | Project documentation |

### 10.4 Related Documents

| Document | Location |
|----------|----------|
| Project Intake | `.aiwg/intake/project-intake.md` |
| Option Matrix | `.aiwg/intake/option-matrix.md` |
| Risk Register | `.aiwg/risks/risk-list.md` |
| Architecture Objectives | `.aiwg/working/elaboration/planning/architecture-objectives-draft.md` |
| ADR-001: Client-Server | `.aiwg/architecture/ADR-001-client-server-architecture.md` |
| ADR-002: Schema Rebuild | `.aiwg/architecture/ADR-002-database-schema-rebuild.md` |
| ADR-003: Local-First Privacy | `.aiwg/architecture/ADR-003-local-first-privacy.md` (to be created) |
| Security Review | `.aiwg/working/architecture/sad/reviews/security-architect-review.md` |
| Testability Review | `.aiwg/working/architecture/sad/reviews/test-architect-review.md` |
| Coverage Baseline | `.aiwg/testing/coverage-baseline.md` |
| CLAUDE.md | `CLAUDE.md` |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2025-12-04 |
| Baselined | 2025-12-04 |
| Version | 1.0 (BASELINED) |
| Primary Author | Architecture Designer |
| Reviewers | Security Architect, Test Architect |
| Review Status | APPROVED (with conditions) |
| Next Review | End of Elaboration phase |

**Change Log**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-12-04 | Architecture Designer | Initial draft |
| 1.0 | 2025-12-04 | Architecture Documenter | Integrated security/testability reviews, added testing sections, baselined |

---

## Sign-Off

**Required Approvals**:
- [x] Architecture Designer: APPROVED - 2025-12-04
- [x] Security Architect: APPROVED (with conditions) - 2025-12-04
- [x] Test Architect: CONDITIONAL - 2025-12-04

**Security Conditions Accepted**:
1. ADR-003 formalization - Tracked for completion
2. Input validation framework - Construction phase
3. SBOM generation - Construction phase
4. ADR-006 before network mode - Post-MVP

**Testability Conditions Integrated**:
1. Section 4.5.3.1 - Ollama mocking strategy
2. Section 4.6.3 - WebSocket testing approach
3. Section 4.4.5 - Database test isolation pattern
4. Section 4.2.5 - Route unit testing guide
5. Section 9.5 - Concurrent operation testing

---

*End of Software Architecture Document v1.0 (BASELINED)*
