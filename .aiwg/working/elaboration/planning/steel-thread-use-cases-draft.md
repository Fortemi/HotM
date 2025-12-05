# Steel Thread Use Cases - HotM

**Document Type**: Architecture Validation Planning
**Phase**: Elaboration
**Generated**: 2025-12-04
**Project**: HotM (Hall Of The Mind)
**Version**: 1.0

---

## Executive Summary

This document defines 3 architecturally significant "steel thread" use cases that will validate HotM's core architecture during the Elaboration phase. Steel threads are end-to-end scenarios that exercise critical system components, integration points, and architectural patterns while addressing high-priority risks.

**Purpose**: Prove that the architecture can deliver on core requirements before committing to full Construction phase implementation.

**Success Criteria**: All 3 steel threads implemented, tested, and validated by end of Elaboration phase, with measurable proof that architecture patterns work end-to-end.

---

## What is a Steel Thread?

A **steel thread** is a thin, end-to-end implementation of a system capability that:

1. **Touches all architectural layers** (UI → API → Database → External Services)
2. **Validates key integration points** (API contracts, data flows, error handling)
3. **Proves technical feasibility** (performance, scalability, reliability patterns work)
4. **Reduces architectural risk** (addresses high-probability/high-impact risks early)
5. **Provides working skeleton** (foundation for incremental feature addition)

**Analogy**: Like a steel thread in construction that proves the building's structural integrity before adding walls, plumbing, and finishes.

---

## Selection Criteria

Steel threads for HotM were selected based on:

1. **Risk Coverage**: Address high-priority risks from [risk-list.md](../../../risks/risk-list.md)
2. **Architectural Significance**: Exercise core patterns (client-server, async processing, hybrid search, NLP integration)
3. **MVP Criticality**: Essential for daily use validation (from [mvp-acceptance-criteria.md](../../../requirements/mvp-acceptance-criteria.md))
4. **End-to-End Flow**: Complete user journey from UI action to data persistence to background processing
5. **Validation Value**: Measurable success criteria that prove architecture works

---

## Steel Thread #1: Create Note + AI Enhancement Flow

### Overview

**User Journey**: User creates a note → System stores immutable original → Background job queues NLP processing → AI generates revision, tags, and links → User views enhanced note

**Why Architecturally Significant**: This is the **core value proposition** of HotM. It exercises the complete data flow from user input through persistence, job queue, external AI service (Ollama), and back to storage. Validates async processing, immutability patterns, and AI integration.

### Components Exercised

1. **Tauri Desktop UI**:
   - Global hotkey trigger (Ctrl+Alt+H)
   - Markdown editor with auto-save
   - Note list/detail views
   - Real-time UI updates when enhancement completes

2. **Axum API Server**:
   - `POST /api/v1/notes` (create note endpoint)
   - `GET /api/v1/notes/{id}` (retrieve note with revisions)
   - Request validation and error handling
   - Async database operations

3. **PostgreSQL Database**:
   - Insert into `notes` table (immutable original)
   - Insert into `revisions` table (AI-enhanced version)
   - Insert into `tags`, `links`, `embeddings` tables (NLP results)
   - Insert into `jobs` queue table
   - Transaction handling (ACID guarantees)

4. **Background Job Queue**:
   - Job creation on note insert
   - Job pickup by worker process
   - Job state transitions (pending → running → completed/failed)
   - Retry logic on failure

5. **NLP Pipeline (Ollama Integration)**:
   - Text normalization and chunking
   - Embedding generation (nomic-embed-text model)
   - Revision generation (gpt-oss:20b model)
   - Tag extraction
   - Link discovery (semantic similarity)

6. **Data Flow**:
   - UI → API → Database (sync path)
   - Database → Job Queue → NLP Worker → Database (async path)
   - Database → API → UI (retrieval path)

### Risks Addressed

| Risk ID | Risk Description | How Steel Thread Mitigates |
|---------|------------------|----------------------------|
| **Risk #5** | Core features don't work well enough for daily use | Proves core note capture and enhancement workflow is smooth and reliable |
| **Risk #6** | Performance degrades with growing corpus | Measures and validates background processing performance targets |
| **Risk #8** | Ollama dependency creates barrier | Tests Ollama integration, error handling when unavailable, performance metrics |
| **Risk #12** | Test coverage remains below 60% target | Forces comprehensive test coverage across all layers (unit, integration, E2E) |

### Acceptance Criteria

#### AC-1.1: Note Creation (UI → API → Database)

**Given**: User launches HotM and presses Ctrl+Alt+H
**When**: User types "Machine learning requires large datasets and computational power" and saves
**Then**:
- Note is created in database within 200ms (P95)
- Original content stored in `notes` table with UUID
- Immutability verified (content hash stored, never changes)
- Background job queued in `jobs` table
- API returns 201 Created with note ID
- UI displays note immediately in note list

**Test Strategy**:
- Unit test: Note creation logic, validation, hashing
- Integration test: Full API request → database insert → response
- E2E test: UI interaction → note appears in list
- Performance test: 100 consecutive note creations < 200ms P95

#### AC-1.2: Background Job Processing (Job Queue → NLP Pipeline)

**Given**: Note creation job is queued
**When**: Background worker picks up job
**Then**:
- Job state transitions: pending → running → completed
- NLP pipeline executes all stages:
  - Text normalization and chunking
  - Embedding generation (768-dim vector from nomic-embed-text)
  - Revision generation (summarized/enhanced text from gpt-oss:20b)
  - Tag extraction (3-7 relevant tags)
  - Link discovery (related notes above 0.7 similarity threshold)
- Total processing time < 30s per note (non-blocking)
- Failed jobs marked as failed, not lost

**Test Strategy**:
- Unit test: Each NLP pipeline stage in isolation (mocked Ollama)
- Integration test: Full pipeline with real Ollama (test environment)
- Resilience test: Ollama unavailable → job marked failed, retry works
- Performance test: 10 notes processed < 5 minutes total (batch)

#### AC-1.3: Note Retrieval with Enhancements (Database → API → UI)

**Given**: Note has been enhanced by NLP pipeline
**When**: User views note in UI
**Then**:
- Note displays revised content by default (AI-enhanced)
- Toggle available to view original content (immutable)
- Tags are visible and clickable
- Related links shown (auto-discovered via embeddings)
- Metadata displays: created, updated, format, source
- Retrieval time < 100ms (P95)

**Test Strategy**:
- Unit test: Note model with revisions, tags, links
- Integration test: GET /notes/{id} with full relational data
- E2E test: Click note in list → detail view renders correctly
- Performance test: Retrieve 100 notes sequentially < 100ms P95

#### AC-1.4: Error Handling and Graceful Degradation

**Given**: Ollama service is unavailable
**When**: Background job attempts NLP processing
**Then**:
- Job fails gracefully (not crash)
- Error logged with context
- Job marked for retry (exponential backoff)
- Original note still accessible in UI
- User sees indicator: "Enhancement pending" or "Enhancement failed"
- Manual retry option available

**Test Strategy**:
- Unit test: Ollama client error handling
- Integration test: Mock Ollama failure, verify retry logic
- E2E test: Create note with Ollama down → UI shows pending state
- Chaos test: Kill Ollama mid-processing → system recovers

### Validation Metrics

| Metric | Target | Measured How |
|--------|--------|--------------|
| Note creation latency | < 200ms P95 | API response time logging |
| Background processing | < 30s per note | Job start → completion time |
| Embedding generation | < 10s | Ollama API call duration |
| Tag generation | < 5s | Ollama API call duration |
| Link discovery | < 5s | Vector similarity query time |
| Note retrieval | < 100ms P95 | API response time logging |
| Job success rate | > 95% | Completed jobs / total jobs |
| Test coverage | > 70% | Tarpaulin (Rust), Istanbul (React) |

### Implementation Plan

**Elaboration Phase 1** (Week 1-2):
1. Implement basic note CRUD (no NLP yet)
2. Add job queue table and insertion logic
3. Create note creation E2E test (UI → API → DB)

**Elaboration Phase 2** (Week 3-4):
4. Implement background job worker skeleton
5. Integrate Ollama client (embedding generation only)
6. Create integration test: note → job → embedding

**Elaboration Phase 3** (Week 5-6):
7. Add full NLP pipeline (revision, tags, links)
8. Add error handling and retry logic
9. Complete E2E test: create → enhance → view

**Validation**: Week 6-7
10. Performance benchmarking (100 notes)
11. Chaos testing (Ollama failures, DB connection loss)
12. Documentation and lessons learned

---

## Steel Thread #2: Hybrid Search Query

### Overview

**User Journey**: User enters search query → System executes full-text search (FTS) and vector similarity search in parallel → Reciprocal Rank Fusion (RRF) merges results → User views ranked results

**Why Architecturally Significant**: Hybrid search is the **core discovery mechanism** and a unique architectural differentiator. It validates PostgreSQL's FTS (tsvector/GIN indexes), pgvector's semantic search (HNSW indexes), and the RRF ranking algorithm. Critical for proving search quality and performance scale.

### Components Exercised

1. **Tauri Desktop UI**:
   - Search input with real-time results
   - Result list with relevance scores
   - Filter controls (tags, date range, collections)
   - Pagination for large result sets

2. **Axum API Server**:
   - `GET /api/v1/search?q=query&mode=hybrid` endpoint
   - Query parsing and validation
   - Parallel execution of FTS and vector queries
   - RRF algorithm implementation
   - Result aggregation and pagination

3. **PostgreSQL Database**:
   - **Full-Text Search**:
     - tsvector column with GIN index
     - ts_rank scoring
     - Support for multi-word queries, stemming
   - **Vector Search**:
     - pgvector extension with HNSW index
     - Cosine similarity (embedding <=> query_embedding)
     - Approximate nearest neighbor search
   - **Query Optimization**:
     - Index usage verification (EXPLAIN ANALYZE)
     - Pagination (LIMIT/OFFSET or cursor-based)

4. **NLP Pipeline (Query Embedding)**:
   - Real-time embedding generation for search query
   - Caching for repeated queries (optional optimization)

5. **Ranking Algorithm (RRF)**:
   - Combine FTS and vector results
   - Formula: score = 1/(k + rank_fts) + 1/(k + rank_vector)
   - Parameter tuning (k value, weight ratios)

### Risks Addressed

| Risk ID | Risk Description | How Steel Thread Mitigates |
|---------|------------------|----------------------------|
| **Risk #5** | Core features don't work well enough for daily use | Proves search finds relevant notes quickly and accurately |
| **Risk #6** | Performance degrades with growing corpus | Measures search performance at 100/500/1000 note scale |
| **Risk #13** | Personal validation fails (don't use daily) | Search quality directly impacts usability - must be good |

### Acceptance Criteria

#### AC-2.1: Full-Text Search (Keyword Matching)

**Given**: Database contains 100 notes on various topics
**When**: User searches for "machine learning"
**Then**:
- Returns all notes containing "machine learning" or stemmed variants ("learn", "machine")
- Results ranked by ts_rank (frequency, position, density)
- Query completes < 500ms (P95)
- Supports multi-word queries: "neural network training"
- No full table scans (verified via EXPLAIN ANALYZE)

**Test Strategy**:
- Unit test: Query builder, ranking logic
- Integration test: Insert 100 notes, search, verify results
- Performance test: Search with 100/500/1000 notes, measure latency
- Index test: Drop GIN index, verify performance degrades

#### AC-2.2: Semantic Search (Vector Similarity)

**Given**: Database contains 100 notes with embeddings
**When**: User searches for "how to train AI models?"
**Then**:
- Query is embedded in real-time (< 1s)
- Returns notes semantically similar via cosine similarity
- HNSW index used for approximate nearest neighbor search
- Results ranked by similarity score (0.0 - 1.0)
- Finds relevant notes even without exact keyword matches
- Query completes < 1s (P95)

**Test Strategy**:
- Unit test: Embedding generation, similarity calculation
- Integration test: Create notes about "neural networks", search for "deep learning", verify match
- Performance test: Vector search with 100/5000 notes, measure latency
- Index test: Drop HNSW index, verify performance degrades

#### AC-2.3: Hybrid Search (RRF Fusion)

**Given**: Both FTS and vector indexes are available
**When**: User searches for "training neural networks"
**Then**:
- FTS and vector queries execute in parallel
- RRF algorithm merges results:
  - FTS finds exact keyword matches
  - Vector search finds semantically related notes
  - Combined results balance precision (FTS) and recall (vector)
- Final ranking considers both scores
- Returns top 20 results by default
- Query completes < 1s (P95)

**Test Strategy**:
- Unit test: RRF algorithm with mock results
- Integration test: Search query that benefits from hybrid (e.g., "ML training" finds "machine learning", "deep learning", "neural network training")
- Comparison test: Compare hybrid vs FTS-only vs vector-only, measure precision/recall
- Performance test: Hybrid search with 1000 notes < 1s

#### AC-2.4: Search Filters (Tags, Date Range)

**Given**: User wants to refine search results
**When**: User applies filters: tag="work" AND after="2025-01-01"
**Then**:
- Results filtered by specified criteria
- Filters combine with AND logic
- Date filters support ISO 8601 format
- Tag filters support multiple tags (repeated parameter)
- Filtering adds minimal latency (< 200ms overhead)

**Test Strategy**:
- Unit test: Filter query builder
- Integration test: Search with multiple filters, verify correct results
- Performance test: Filter impact on search latency
- Edge case test: No results, empty filters, invalid dates

### Validation Metrics

| Metric | Target | Measured How |
|--------|--------|--------------|
| FTS query latency (100 notes) | < 500ms P95 | API response time |
| Vector query latency (1000 notes) | < 1s P95 | API response time |
| Hybrid query latency (1000 notes) | < 1s P95 | API response time |
| Query embedding generation | < 1s | Ollama API call duration |
| Search precision (FTS) | > 80% | Manual relevance assessment (50 queries) |
| Search recall (vector) | > 70% | Manual relevance assessment (50 queries) |
| Hybrid improvement | > 10% over single method | Precision/recall comparison |
| Test coverage | > 75% | Tarpaulin (search module) |

### Implementation Plan

**Elaboration Phase 1** (Week 1-2):
1. Implement FTS with tsvector/GIN indexes
2. Create integration test: insert notes → search → verify results
3. Benchmark FTS performance at 100/500/1000 notes

**Elaboration Phase 2** (Week 3-4):
4. Implement vector search with pgvector/HNSW
5. Add real-time query embedding (Ollama)
6. Create integration test: semantic search finds related notes

**Elaboration Phase 3** (Week 5-6):
7. Implement RRF fusion algorithm
8. Add search filters (tags, date range)
9. Complete E2E test: UI search → results display

**Validation**: Week 6-7
10. Performance benchmarking (scaling test)
11. Search quality assessment (manual relevance judgments)
12. Index optimization (EXPLAIN ANALYZE, tuning)

---

## Steel Thread #3: Real-Time Note Updates via WebSocket

### Overview

**User Journey**: User creates or updates note → System broadcasts change event via WebSocket → Other open UI instances (or same UI) update in real-time without refresh

**Why Architecturally Significant**: Validates **real-time synchronization** architecture critical for future multi-device support and smooth UX. Tests WebSocket infrastructure, event-driven patterns, state synchronization, and optimistic UI updates. While MVP is single-device, this proves the architecture can scale to multi-device later.

### Components Exercised

1. **Tauri Desktop UI**:
   - WebSocket client connection to API server
   - Event listeners for note created/updated/deleted
   - Optimistic UI updates (immediate feedback)
   - State reconciliation on WebSocket message
   - Connection handling (reconnect on disconnect)

2. **Axum API Server**:
   - WebSocket endpoint (`/ws`)
   - Connection manager (track active clients)
   - Event broadcasting (pub/sub pattern)
   - Message serialization (JSON over WebSocket)
   - Authentication (future: validate client before broadcast)

3. **Event Flow**:
   - REST API mutation (POST/PUT/DELETE) → Trigger event
   - Event → Connection Manager → Broadcast to subscribers
   - WebSocket message → UI event handler → State update → Re-render

4. **State Management**:
   - Client-side state (React context or Zustand)
   - Optimistic updates (assume success, rollback on error)
   - Reconciliation (merge server state on WebSocket message)
   - Conflict resolution (last-write-wins for MVP)

### Risks Addressed

| Risk ID | Risk Description | How Steel Thread Mitigates |
|---------|------------------|----------------------------|
| **Risk #5** | Core features don't work well enough for daily use | Real-time updates prevent stale UI, improve perceived responsiveness |
| **Risk #7** | Windows 11 UX friction prevents habitual use | Smooth, real-time updates make app feel native and responsive |
| **Risk #10** | Local-first sync design unproven (future) | WebSocket infrastructure validates event-driven sync foundation |

### Acceptance Criteria

#### AC-3.1: WebSocket Connection Establishment

**Given**: User launches HotM desktop app
**When**: App initializes
**Then**:
- WebSocket connection established to API server (`ws://localhost:53211/ws`)
- Connection status visible in UI (connected/disconnected indicator)
- Automatic reconnection on disconnect (exponential backoff)
- Connection authenticated (future: JWT token in upgrade request)
- Connection established < 500ms

**Test Strategy**:
- Unit test: WebSocket client connection logic
- Integration test: Connect, disconnect, reconnect sequence
- E2E test: Launch app, verify connection indicator shows "connected"
- Resilience test: Kill server, verify reconnection

#### AC-3.2: Note Created Event Broadcast

**Given**: WebSocket connection is active
**When**: User creates a new note via REST API
**Then**:
- API broadcasts `note.created` event to all connected clients
- Event payload includes: note ID, title (first line), created_at, created_by (future)
- WebSocket message sent < 100ms after note creation
- UI receives message and updates note list without refresh
- Optimistic update: note appears immediately on creation, confirmed by WebSocket

**Test Strategy**:
- Unit test: Event broadcasting logic
- Integration test: Create note via API → verify WebSocket message
- E2E test: Create note in one window → verify appears in another (two app instances)
- Performance test: Broadcast to 10 concurrent connections < 100ms

#### AC-3.3: Note Updated Event Broadcast

**Given**: WebSocket connection is active AND note exists
**When**: User or system updates note content (new revision)
**Then**:
- API broadcasts `note.updated` event
- Event payload includes: note ID, revision ID, updated_at, changed fields (tags, links, etc.)
- UI receives message and updates note detail view if visible
- Version conflict handling: last-write-wins for MVP, visual indicator for future conflict resolution

**Test Strategy**:
- Unit test: Update event generation
- Integration test: Update note → verify WebSocket message
- E2E test: View note in detail → update in another window → verify detail view refreshes
- Conflict test: Simultaneous updates → verify last-write-wins behavior

#### AC-3.4: State Synchronization and Reconciliation

**Given**: User performs optimistic update (e.g., adds tag to note)
**When**: WebSocket confirmation arrives
**Then**:
- Client state reconciled with server state
- If optimistic update matches server: no change (silent success)
- If optimistic update conflicts: rollback or merge (conflict resolution strategy)
- No duplicate notes in UI (deduplication by ID)
- UI remains responsive during reconciliation

**Test Strategy**:
- Unit test: State reconciliation logic (mock optimistic updates)
- Integration test: Optimistic update → server rejects → verify rollback
- E2E test: Create note offline → reconnect → verify sync
- Performance test: Reconcile 100 pending updates < 1s

### Validation Metrics

| Metric | Target | Measured How |
|--------|--------|--------------|
| WebSocket connection time | < 500ms | Connection establishment duration |
| Event broadcast latency | < 100ms | REST mutation → WebSocket message |
| UI update latency | < 200ms | WebSocket message → UI re-render |
| Reconnection time | < 2s | Disconnect → reconnect duration |
| Message throughput | 100 events/sec | Broadcast 100 events, measure time |
| Connection stability | > 99% uptime | Monitor disconnects over 1 hour |
| Test coverage | > 70% | Jest (UI), Tarpaulin (API) |

### Implementation Plan

**Elaboration Phase 1** (Week 1-2):
1. Implement WebSocket endpoint in Axum
2. Create connection manager (track clients)
3. Basic message broadcast (echo test)

**Elaboration Phase 2** (Week 3-4):
4. Add event types (note.created, note.updated)
5. Integrate with REST API (trigger events on mutations)
6. Create WebSocket client in Tauri UI

**Elaboration Phase 3** (Week 5-6):
7. Implement optimistic updates in UI
8. Add state reconciliation logic
9. Complete E2E test: multi-window sync

**Validation**: Week 6-7
10. Performance testing (latency, throughput)
11. Resilience testing (disconnect/reconnect scenarios)
12. User experience testing (perceived responsiveness)

---

## Cross-Cutting Concerns

### Testing Strategy Across All Steel Threads

**Test Pyramid**:
- **Unit Tests (60% of tests)**:
  - Business logic in isolation
  - Pure functions (no I/O)
  - Mocked external dependencies
  - Fast execution (< 1s per module)
  - Target: 70%+ coverage

- **Integration Tests (30% of tests)**:
  - API endpoint full request/response cycle
  - Database queries with test data
  - Ollama integration (real or mocked)
  - Moderate execution time (< 30s per suite)
  - Target: 60%+ coverage of critical paths

- **E2E Tests (10% of tests)**:
  - Complete user journeys
  - Playwright/Tauri test harness
  - Real database + Ollama (test environment)
  - Slow execution (1-2 min per test)
  - Target: Core workflows only

**Coverage Gates**:
- CI fails if overall coverage < 60%
- Steel thread modules must have > 70% coverage
- Critical paths (note CRUD, search, NLP pipeline) must have > 80% coverage

### Performance Validation

**Benchmarking Process**:
1. **Establish Baseline**: Measure performance with 10/100/500/1000 notes
2. **Define Targets**: Set P50/P95/P99 latency targets from MVP acceptance criteria
3. **Continuous Monitoring**: Log response times in development, alert on regressions
4. **Optimization Cycle**: Profile slow queries (EXPLAIN ANALYZE), optimize indexes, refactor
5. **Validation**: Re-run benchmarks after optimizations, verify improvements

**Key Metrics**:
- API response times (P50/P95/P99)
- Database query times (per operation type)
- Background job processing time (per pipeline stage)
- WebSocket message latency (broadcast and UI update)
- Memory usage (API server, Tauri app, database)
- CPU usage (idle, active processing)

### Error Handling and Resilience

**Failure Scenarios to Test**:
1. **Ollama Unavailable**:
   - Graceful degradation (skip enhancement, keep original)
   - Job marked failed, retry with backoff
   - UI shows "enhancement pending" state

2. **Database Connection Loss**:
   - Connection pool exhaustion
   - Transaction rollback on error
   - Retry logic with exponential backoff
   - UI shows error message, allow retry

3. **WebSocket Disconnect**:
   - Automatic reconnection (exponential backoff)
   - State resynchronization on reconnect
   - No data loss (queue messages if offline)

4. **Concurrent Modifications**:
   - Optimistic locking (version field)
   - Last-write-wins (MVP strategy)
   - Conflict detection and visual indicator (future)

5. **Invalid Input**:
   - Validation on client and server
   - Clear error messages
   - No server crashes on malformed input

### Documentation Requirements

**Per Steel Thread**:
1. **Architecture Decision Record (ADR)**:
   - Why this approach was chosen
   - Alternatives considered
   - Trade-offs and constraints
   - Consequences and risks

2. **Integration Patterns**:
   - API contracts (request/response schemas)
   - Database schemas (tables, indexes, relationships)
   - Event schemas (WebSocket message format)
   - Error response format

3. **Runbook**:
   - Setup instructions (dependencies, environment)
   - How to run tests
   - How to debug common issues
   - Performance tuning guidance

---

## Success Metrics (Elaboration Phase Exit)

### Steel Thread Completion Criteria

Each steel thread must meet the following criteria before Elaboration phase exit:

| Criteria | Target | Validation Method |
|----------|--------|-------------------|
| **Functionality** | All acceptance criteria met | Manual testing checklist |
| **Test Coverage** | > 70% for steel thread code | Tarpaulin/Istanbul reports |
| **Performance** | All targets met (see per thread) | Automated benchmarks |
| **Reliability** | Zero critical bugs | Issue tracker review |
| **Documentation** | ADR + integration docs complete | Documentation review |
| **Demonstration** | E2E demo successful | Stakeholder demo (self) |

### Overall Elaboration Success

**Technical Success**:
- [ ] All 3 steel threads implemented and validated
- [ ] Architecture proves feasible for MVP scope
- [ ] No high-risk architectural unknowns remaining
- [ ] Test coverage > 60% overall, > 70% for steel threads
- [ ] Performance targets validated (at least at 100-note scale)
- [ ] CI/CD pipeline green (all tests passing via `gh act`)

**Risk Mitigation**:
- [ ] **Risk #1** (Incomplete rollback): Mitigated or retired
- [ ] **Risk #3** (Insufficient test coverage): Mitigated (coverage gates in place)
- [ ] **Risk #5** (Core features inadequate): Mitigated (steel threads prove usability)
- [ ] **Risk #6** (Performance degradation): Mitigated (benchmarks show acceptable scaling)

**Lessons Learned**:
- [ ] Architecture patterns documented (ADRs written)
- [ ] Integration pain points identified and resolved
- [ ] Testing strategy validated (pyramid approach working)
- [ ] Performance bottlenecks understood and optimized

### Go/No-Go Decision (End of Elaboration)

**Go to Construction** if:
- All steel threads meet success criteria
- No P0 (blocker) architectural issues
- Confidence that MVP can be built in Construction (12 weeks)
- Test coverage and performance foundations solid

**No-Go (Extend Elaboration)** if:
- Any steel thread fails validation
- Major architectural risk unresolved
- Performance targets not met with significant gap
- Test coverage infrastructure incomplete

**Pivot** if:
- Architecture fundamentally doesn't work
- Ollama integration proves infeasible
- Performance unacceptable even after optimization
- Complexity exceeds solo developer capacity

---

## Elaboration Phase Schedule

### Timeline: 6-7 Weeks

**Phase 1: Steel Thread #1 (Note Creation + Enhancement)** - Weeks 1-2
- Focus: Core data flow, NLP integration, job queue
- Deliverable: End-to-end note creation with AI enhancement working
- Validation: Manual testing, basic performance benchmarks

**Phase 2: Steel Thread #2 (Hybrid Search)** - Weeks 3-4
- Focus: Search algorithms, index optimization, ranking
- Deliverable: Hybrid search returning relevant results < 1s
- Validation: Search quality assessment, performance benchmarks

**Phase 3: Steel Thread #3 (WebSocket Updates)** - Weeks 5-6
- Focus: Real-time infrastructure, state synchronization
- Deliverable: Multi-window note sync via WebSocket
- Validation: Latency testing, reconnection resilience

**Phase 4: Validation and Documentation** - Week 6-7
- Consolidate test coverage (ensure > 60% overall)
- Complete ADRs for all steel threads
- Run full benchmark suite (100/500/1000 notes)
- Conduct retrospective (lessons learned)
- Go/No-Go decision for Construction

---

## Dependencies and Prerequisites

### Technical Prerequisites

**Infrastructure**:
- [ ] PostgreSQL 14+ with pgvector extension running (Docker or native)
- [ ] Ollama installed with models pulled (gpt-oss:20b, nomic-embed-text)
- [ ] Rust 1.70+ and Node.js 20+ installed
- [ ] Git, GitHub CLI (`gh`), and Act configured
- [ ] Windows 11 workstation with adequate resources (16GB+ RAM, GPU for Ollama)

**Codebase State**:
- [ ] Architecture cleanup complete (single-exe rollback done)
- [ ] Client-server architecture restored and validated
- [ ] CI/CD pipeline passing (backend-tests, frontend-tests)
- [ ] Database migrations current (all 6 migrations applied)
- [ ] Environment variables configured (DATABASE_URL, RUST_LOG, etc.)

**Development Environment**:
- [ ] Visual Studio Code (or preferred editor) set up
- [ ] Rust Analyzer, ESLint, Prettier extensions installed
- [ ] Test runners configured (`cargo test`, `npm test`)
- [ ] Coverage tools installed (cargo-tarpaulin, Istanbul)
- [ ] Debugging setup (Rust debugger, Chrome DevTools)

### Knowledge Prerequisites

**Concepts to Understand**:
- Rust async programming (Tokio, async/await)
- Axum web framework (handlers, extractors, state)
- SQLx query patterns (compile-time verification)
- PostgreSQL full-text search (tsvector, ts_rank)
- pgvector usage (embeddings, cosine similarity, HNSW indexes)
- React hooks and state management
- Tauri IPC (invoke commands, event listeners)
- WebSocket protocol and patterns
- Reciprocal Rank Fusion algorithm

**Resources**:
- [Axum Documentation](https://docs.rs/axum/)
- [SQLx Documentation](https://docs.rs/sqlx/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Tauri Documentation](https://tauri.app/v2/)
- [RRF Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)

---

## Appendix A: Risk Mapping

### Risks Addressed by Steel Threads

| Risk ID | Risk Title | Steel Thread(s) | Mitigation Status |
|---------|------------|-----------------|-------------------|
| **Risk #1** | Incomplete rollback leaves dead code | N/A (prerequisite) | Must be resolved before Elaboration |
| **Risk #2** | Rollback breaks working features | N/A (prerequisite) | Validated by steel thread tests passing |
| **Risk #3** | Test coverage insufficient | All 3 threads | 70%+ coverage requirement per thread |
| **Risk #5** | Core features inadequate for daily use | All 3 threads | Each thread validates critical workflow |
| **Risk #6** | Performance degrades with corpus growth | Thread #1, #2 | Benchmarking at 100/500/1000 notes |
| **Risk #7** | Windows 11 UX friction | Thread #3 | Real-time updates improve perceived responsiveness |
| **Risk #8** | Ollama dependency barrier | Thread #1 | Error handling, graceful degradation tested |
| **Risk #10** | Sync design unproven (future) | Thread #3 | WebSocket infrastructure validates event-driven foundation |
| **Risk #12** | Test coverage remains below 60% | All 3 threads | Coverage gates enforced in CI |
| **Risk #13** | Personal validation fails | All 3 threads | Usability validated through steel threads |

### Risks NOT Addressed (Deferred)

| Risk ID | Risk Title | Reason Deferred |
|---------|------------|-----------------|
| **Risk #4** | Database schema changes | No schema changes planned in steel threads |
| **Risk #9** | PostgreSQL + Ollama setup complexity | UX issue, not architectural |
| **Risk #11** | Rust + React + Tauri stack community | Ongoing, not specific to Elaboration |
| **Risk #14** | Concept doesn't resonate with others | Post-MVP concern |
| **Risk #15** | Better alternatives emerge | External risk, no mitigation |

---

## Appendix B: Architecture Decision Records (ADR) Index

Steel thread implementation will generate the following ADRs:

1. **ADR-001: Client-Server Architecture** (Thread #1)
   - Decision: Separate Tauri client and Axum server
   - Context: Rollback from single-exe integration
   - Consequences: Simpler deployment, external dependencies

2. **ADR-002: Async Background Job Queue** (Thread #1)
   - Decision: Database-backed job queue vs message broker
   - Context: NLP processing must be async, non-blocking
   - Consequences: Simple, no external deps, but limited scalability

3. **ADR-003: Hybrid Search with RRF** (Thread #2)
   - Decision: Combine FTS + vector with RRF fusion
   - Context: Balance precision (keywords) and recall (semantic)
   - Consequences: Better search quality, but complexity + latency

4. **ADR-004: WebSocket for Real-Time Updates** (Thread #3)
   - Decision: WebSocket over HTTP polling
   - Context: Real-time sync for future multi-device support
   - Consequences: Immediate updates, but connection management overhead

5. **ADR-005: Immutable Originals + Versioned Revisions** (Thread #1)
   - Decision: Never modify original, store revisions separately
   - Context: Preserve provenance, support future conflict resolution
   - Consequences: Audit trail, but storage overhead

---

## Appendix C: Testing Checklist

### Steel Thread #1: Note Creation + Enhancement

**Unit Tests**:
- [ ] Note model validation (valid/invalid markdown)
- [ ] Immutability verification (content hash calculation)
- [ ] Job queue insertion logic
- [ ] NLP pipeline stages (mocked Ollama):
  - [ ] Text normalization
  - [ ] Chunking
  - [ ] Embedding generation
  - [ ] Revision generation
  - [ ] Tag extraction
  - [ ] Link discovery
- [ ] Error handling (Ollama unavailable, DB failure)

**Integration Tests**:
- [ ] POST /notes → database insert → job queued
- [ ] GET /notes/{id} → returns note with revisions
- [ ] Background job pickup → NLP pipeline execution
- [ ] Ollama client (real API call to test environment)
- [ ] Transaction rollback on error

**E2E Tests**:
- [ ] Launch app → press Ctrl+Alt+H → create note → appears in list
- [ ] Wait for enhancement → note shows revised content
- [ ] Toggle original/revised view
- [ ] View tags and links

**Performance Tests**:
- [ ] 100 note creations < 200ms P95
- [ ] 10 background jobs < 5 minutes
- [ ] Note retrieval < 100ms P95

### Steel Thread #2: Hybrid Search

**Unit Tests**:
- [ ] Query parsing and validation
- [ ] RRF algorithm (mock FTS and vector results)
- [ ] Search filter logic (tags, dates)
- [ ] Ranking and sorting

**Integration Tests**:
- [ ] FTS query returns correct results
- [ ] Vector query returns similar notes
- [ ] Hybrid query combines both methods
- [ ] Search filters apply correctly
- [ ] Pagination works (LIMIT/OFFSET)

**E2E Tests**:
- [ ] Search in UI → results display
- [ ] Click result → note detail view
- [ ] Apply filters → results update
- [ ] No results case handled gracefully

**Performance Tests**:
- [ ] FTS with 100/500/1000 notes < 500ms P95
- [ ] Vector with 100/5000 notes < 1s P95
- [ ] Hybrid with 1000 notes < 1s P95

**Quality Tests**:
- [ ] Manual relevance assessment (50 queries, precision/recall)
- [ ] Compare hybrid vs FTS-only vs vector-only

### Steel Thread #3: WebSocket Updates

**Unit Tests**:
- [ ] WebSocket connection logic
- [ ] Event serialization/deserialization
- [ ] Reconnection with exponential backoff
- [ ] Optimistic update and rollback

**Integration Tests**:
- [ ] WebSocket connection establishment
- [ ] Event broadcast (note.created, note.updated)
- [ ] Multiple clients receive messages
- [ ] Connection authentication (future)

**E2E Tests**:
- [ ] Launch app → connection indicator shows "connected"
- [ ] Create note in one window → appears in another
- [ ] Update note → other window refreshes
- [ ] Disconnect server → reconnect → state syncs

**Performance Tests**:
- [ ] Connection time < 500ms
- [ ] Event broadcast latency < 100ms
- [ ] UI update latency < 200ms
- [ ] 100 events/sec throughput

**Resilience Tests**:
- [ ] Kill server → verify reconnection
- [ ] Slow network (throttle bandwidth) → verify graceful handling
- [ ] Concurrent updates → verify conflict resolution

---

## Appendix D: Performance Benchmark Template

### Benchmark Execution

**Setup**:
1. Fresh database with known dataset (10/100/500/1000 notes)
2. Ollama running with models loaded (warm cache)
3. API server and Tauri app on same Windows 11 workstation
4. No other resource-intensive applications running

**Measurement**:
- Use `curl` with `--write-out` for API latency
- Use `EXPLAIN ANALYZE` for database query profiling
- Use `tracing` logs for internal timing (Rust)
- Use browser DevTools for UI rendering time (React)

**Metrics to Collect**:
| Operation | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) | Avg (ms) |
|-----------|----------|----------|----------|----------|----------|
| POST /notes | | | | | |
| GET /notes/{id} | | | | | |
| GET /search (hybrid) | | | | | |
| Background job (full pipeline) | | | | | |
| WebSocket event broadcast | | | | | |

**Analysis**:
- Identify outliers (P99 vs P50 spread)
- Profile slow operations (EXPLAIN ANALYZE, flamegraph)
- Document bottlenecks and optimization opportunities

---

**Document Status**: Draft
**Next Review**: After Inception phase completion
**Owner**: Requirements Analyst → Architecture Lead (Elaboration)
**Stakeholder**: Solo Developer (Personal Validation)
