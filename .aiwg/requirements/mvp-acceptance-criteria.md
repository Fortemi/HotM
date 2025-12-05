# MVP Acceptance Criteria

**Document Type**: Requirements Specification
**Generated**: 2025-12-04
**Project**: HotM (Hall Of The Mind)
**Phase**: Prototype → MVP Transition
**Profile**: Personal Validation (Solo Developer, 3-6 Month Use)

---

## Executive Summary

### What "MVP Done" Means

**MVP Goal**: Personal validation through 3-6 months of daily use, demonstrating that HotM effectively solves the knowledge management problem of capturing quick thoughts and automatically connecting them into a larger web of notes.

**Success Definition**: Using HotM daily without major friction for personal knowledge management, with core features (note capture, hybrid search, auto-linking, auto-tagging) working reliably enough to prove the concept's value.

**Personal Validation Criteria**:
- Daily use sustained for 3-6 months
- Core workflows are smooth (quick capture, search, discovery)
- Search finds relevant notes effectively
- Auto-linking discovers meaningful connections
- Tool becomes habitual part of workflow
- Decision point reached: Keep private, open source, or pivot

**Out of Scope for MVP**: See section 7 for explicit deferrals (MCP integration, MSI installer, multi-device sync, advanced UX polish)

---

## 1. Feature Acceptance Criteria

### 1.1 Note Management (CRUD)

**Priority**: Must-Have (Critical)
**Status**: In Development
**Component**: Axum API Server + PostgreSQL

#### Acceptance Criteria

**AC-1.1: Create Note (Quick Capture)**
- Given: User wants to capture a quick thought
- When: User creates a new note with markdown content
- Then:
  - Note is stored with unique UUID
  - Original content is preserved immutably in database
  - Note metadata includes format (markdown), source (manual), timestamps
  - Background NLP job is queued for processing
  - API returns 201 Created with note ID within 200ms
- Verification:
  - POST /notes endpoint accepts markdown content
  - Database contains note in `notes` table with correct fields
  - Job queue contains pending NLP job for note
  - Test: Create 10 notes sequentially, verify all stored correctly

**AC-1.2: Read Note (Retrieve with Metadata)**
- Given: A note exists in the system
- When: User retrieves note by ID
- Then:
  - Returns note with complete metadata (id, format, source, timestamps)
  - Returns both original and revised content (if available)
  - Returns tags associated with note
  - Returns links to/from other notes
  - Response time < 100ms for single note retrieval
- Verification:
  - GET /notes/{id} returns complete note structure
  - Original content matches stored hash (immutability proof)
  - Revised content shows latest AI enhancement
  - Test: Retrieve note before and after NLP processing, verify both states

**AC-1.3: Update Note (Create Revision)**
- Given: A note with original content exists
- When: User or system updates the note content
- Then:
  - Original content remains unchanged (immutable)
  - New revision is created with updated content
  - Revision includes metadata (type: auto/manual, rationale, timestamp)
  - Provenance chain links revisions (parent_revision_id)
  - API returns 200 OK with revision ID
- Verification:
  - PUT /notes/{id}/revised creates new revision
  - Original content hash remains unchanged
  - Database shows revision history in `revisions` table
  - Test: Create note, update 3 times, verify 3 revisions exist

**AC-1.4: Delete Note (Soft Delete)**
- Given: A note exists
- When: User deletes a note
- Then:
  - Note is marked as deleted (soft delete, not physical deletion)
  - Note no longer appears in search results
  - Note is excluded from auto-linking
  - Provenance and revision history are preserved
  - API returns 204 No Content
- Verification:
  - DELETE /notes/{id} sets deleted flag
  - Note not returned by GET /notes or search
  - Database row still exists with deleted_at timestamp
  - Test: Delete note, attempt retrieval, verify 404 response

#### Performance Targets

- Note creation: < 200ms (P95)
- Note retrieval: < 100ms (P95)
- Note update: < 300ms (P95)
- Note deletion: < 100ms (P95)
- Batch creation (10 notes): < 2s

#### Definition of Done

- [ ] All 4 CRUD operations implemented and tested
- [ ] Immutability verified (original content never changes)
- [ ] Revision history tracked correctly
- [ ] Soft delete preserves provenance
- [ ] API endpoints match specification
- [ ] Test coverage: 80%+ for note CRUD
- [ ] Performance targets met on Windows 11 workstation
- [ ] Integration test covers full CRUD lifecycle

---

### 1.2 Hybrid Search

**Priority**: Must-Have (Critical)
**Status**: In Development
**Component**: PostgreSQL FTS + pgvector + Axum API

#### Acceptance Criteria

**AC-2.1: Full-Text Search (PostgreSQL tsvector)**
- Given: Multiple notes exist with diverse content
- When: User searches with keywords (e.g., "machine learning")
- Then:
  - Returns notes matching keywords via tsvector/GIN index
  - Results ranked by relevance (ts_rank)
  - Supports multi-word queries
  - Supports stemming (e.g., "learn" matches "learning")
  - Returns results within 500ms for < 1000 notes
- Verification:
  - GET /search?q=keywords&mode=fts returns ranked results
  - Database uses tsvector index for performance
  - Test: Search 100 notes for common term, verify correct ranking
  - Test: Search with stemmed term, verify matches

**AC-2.2: Semantic Search (pgvector Embeddings)**
- Given: Notes have been processed with Ollama embeddings
- When: User searches with semantic query (e.g., "how to train AI models?")
- Then:
  - Returns notes semantically similar via vector similarity
  - Uses HNSW index for approximate nearest neighbor search
  - Ranked by cosine similarity score
  - Returns results even if exact keywords don't match
  - Returns results within 1s for < 5000 notes
- Verification:
  - POST /semantic with text query returns similar notes
  - Embeddings stored in `embeddings` table with vector column
  - HNSW index exists on embeddings.vector column
  - Test: Query "neural networks training" finds note about "deep learning backpropagation"

**AC-2.3: Hybrid Search (FTS + Vector, RRF Fusion)**
- Given: Both FTS and vector indexes are available
- When: User performs hybrid search (default mode)
- Then:
  - Combines full-text and semantic search results
  - Uses Reciprocal Rank Fusion (RRF) to merge rankings
  - Balances keyword precision with semantic recall
  - Returns top-k results (default: 20, max: 100)
  - Returns results within 1s for < 1000 notes
- Verification:
  - GET /search?q=query&mode=hybrid combines both methods
  - Results include notes from both FTS and semantic search
  - RRF score calculation: 1/(k + rank) for each method
  - Test: Search finds note with exact keywords AND semantically related notes

**AC-2.4: Search Filters**
- Given: User wants to refine search results
- When: User applies filters (tags, date range, collections)
- Then:
  - Results filtered by selected criteria
  - Filters combine with AND logic
  - Date filters support ISO 8601 format (before/after)
  - Tag filters support multiple tags (repeatable parameter)
  - Returns filtered results within same time budget
- Verification:
  - GET /search?q=query&tag=work&after=2025-01-01 applies filters
  - Test: Search with 2 tags, verify only notes with both tags returned
  - Test: Search with date range, verify only notes in range returned

#### Performance Targets

- Full-text search (< 1000 notes): < 500ms (P95)
- Semantic search (< 5000 notes): < 1s (P95)
- Hybrid search (< 1000 notes): < 1s (P95)
- Search with filters: < 1.5s (P95)
- Concurrent searches (5 users): No degradation

#### Definition of Done

- [ ] Full-text search working with tsvector/GIN indexes
- [ ] Semantic search working with pgvector/HNSW indexes
- [ ] Hybrid search combines both with RRF fusion
- [ ] Search filters apply correctly (tags, date, collections)
- [ ] Performance targets met for typical corpus (< 1000 notes)
- [ ] Test coverage: 75%+ for search functionality
- [ ] Integration test covers all search modes
- [ ] Personal use test: "Can I find what I need?" = Yes

---

### 1.3 Auto-Linking

**Priority**: Must-Have (Critical)
**Status**: In Development
**Component**: Background Job Queue + Ollama Embeddings

#### Acceptance Criteria

**AC-3.1: Background Job Queue**
- Given: New note is created
- When: Note creation completes
- Then:
  - Background job is queued for NLP processing
  - Job includes note ID and pipeline stages
  - Job is processed asynchronously (doesn't block API)
  - Job status is trackable (pending, running, completed, failed)
  - Failed jobs can be retried
- Verification:
  - Job queue table exists in database
  - Job is inserted on note creation
  - Job processor runs independently of API server
  - Test: Create note, verify job queued within 100ms
  - Test: Kill job processor, verify jobs accumulate and process on restart

**AC-3.2: Embedding Generation (Ollama)**
- Given: Note has been normalized and chunked
- When: Embedding stage executes
- Then:
  - Text is sent to Ollama (nomic-embed-text model)
  - Returns 768-dimensional vector embedding
  - Embedding is stored in database with note reference
  - Handles Ollama unavailability gracefully (retry with backoff)
  - Processing time < 10s per note (background, non-blocking)
- Verification:
  - Ollama client sends POST to /api/embeddings
  - Embeddings table contains vectors with correct dimensions
  - Test: Create note with 500 words, verify embedding generated
  - Test: Simulate Ollama down, verify retry and eventual success

**AC-3.3: Link Discovery (Semantic Similarity)**
- Given: Note has embedding generated
- When: Link detection stage executes
- Then:
  - Finds notes with similar embeddings (cosine similarity)
  - Creates links for notes above similarity threshold (default: 0.7)
  - Link includes score, kind (related), timestamp
  - Bidirectional links created (from → to and to → from)
  - Avoids duplicate links (checks existing before creating)
- Verification:
  - Links table contains discovered relationships
  - GET /notes/{id}/links returns related notes with scores
  - Test: Create 2 notes about same topic, verify link discovered
  - Test: Create 2 unrelated notes, verify no link created

**AC-3.4: Link Quality (Precision)**
- Given: Auto-linking has been running for validation period
- When: User reviews discovered links
- Then:
  - Precision: > 70% of links are relevant (user judgment)
  - Recall: Finds most obvious connections (user judgment)
  - False positives: < 30% irrelevant links
  - Threshold tunable via configuration
- Verification:
  - Personal validation: Review 50 auto-generated links
  - Count relevant vs irrelevant links
  - Adjust threshold if precision < 70%
  - Document optimal threshold for personal corpus

#### Performance Targets

- Job queue latency: < 100ms (job insertion)
- Embedding generation: < 10s per note (background)
- Link discovery: < 5s per note (background)
- Total NLP pipeline: < 30s per note (non-blocking)
- Batch processing: 100 notes/hour (sustained)

#### Definition of Done

- [ ] Background job queue implemented and tested
- [ ] Embedding generation via Ollama working
- [ ] Link discovery finds semantically similar notes
- [ ] Links stored in database with scores
- [ ] Performance targets met for single-user workload
- [ ] Test coverage: 70%+ for auto-linking
- [ ] Integration test covers full pipeline (create → embed → link)
- [ ] Personal validation: Link precision > 70%

---

### 1.4 Auto-Tagging

**Priority**: Must-Have (Important)
**Status**: In Development
**Component**: Ollama LLM + Tag Management

#### Acceptance Criteria

**AC-4.1: AI-Generated Tags (Ollama)**
- Given: Note has been processed by NLP pipeline
- When: Tag generation stage executes
- Then:
  - Extracts key concepts from note content
  - Sends prompt to Ollama (gpt-oss:20b model)
  - Returns 3-7 relevant tags
  - Tags are normalized (lowercase, hyphenated)
  - Tags stored in database linked to note
- Verification:
  - Tags table contains generated tags
  - Note_tags junction table links tags to notes
  - GET /notes/{id} includes tags in response
  - Test: Create note about "machine learning algorithms", verify tags like "ai", "algorithms", "ml"

**AC-4.2: Tag Display on Notes**
- Given: Note has tags (auto-generated or manual)
- When: User views note
- Then:
  - Tags are visible in note metadata
  - Tags are clickable to filter/search
  - Tags indicate source (auto vs manual)
  - Tag count is displayed
- Verification:
  - Tauri UI displays tags on note view
  - Clicking tag filters notes by that tag
  - Test: View note, verify tags displayed correctly

**AC-4.3: Tag Management (Manual Operations)**
- Given: User wants to refine tags
- When: User adds or removes tags manually
- Then:
  - Manual tags override auto-generated tags if conflict
  - PUT /notes/{id}/tags supports add/remove operations
  - Tag changes are reflected immediately
  - Tag usage count updates (for tag list view)
- Verification:
  - API endpoint works as specified
  - Database reflects manual tag changes
  - Test: Add tag "important", remove tag "draft", verify both operations work

**AC-4.4: Tag Quality (Relevance)**
- Given: Auto-tagging has been running for validation period
- When: User reviews generated tags
- Then:
  - Relevance: > 60% of tags are accurate (user judgment)
  - False positives: < 40% irrelevant tags
  - Coverage: Captures main topics of note
  - Tunable via prompt engineering
- Verification:
  - Personal validation: Review tags on 50 notes
  - Count relevant vs irrelevant tags
  - Document common failure patterns
  - Iterate on prompts to improve quality

#### Performance Targets

- Tag generation: < 5s per note (background)
- Tag display: < 50ms (part of note retrieval)
- Tag management: < 200ms (add/remove operations)
- Tag list retrieval: < 300ms (all tags with counts)

#### Definition of Done

- [ ] Auto-tagging via Ollama implemented
- [ ] Tags stored and retrieved correctly
- [ ] Tag display in Tauri UI functional
- [ ] Manual tag management working
- [ ] Performance targets met
- [ ] Test coverage: 60%+ for tagging
- [ ] Personal validation: Tag relevance > 60%

---

### 1.5 Windows 11 Desktop UX

**Priority**: Must-Have (Important)
**Status**: In Development
**Component**: Tauri App + React Frontend

#### Acceptance Criteria

**AC-5.1: Desktop App (Tauri)**
- Given: HotM is installed on Windows 11
- When: User launches application
- Then:
  - Native window with Windows 11 styling
  - Window is resizable, minimizable, maximizable
  - Application state persists (window size, position)
  - App starts within 2s on modern hardware
  - No console window visible (production build)
- Verification:
  - Tauri app builds successfully on Windows 11
  - Window controls work correctly
  - Test: Launch, resize, close, relaunch, verify state restored

**AC-5.2: System Tray Integration**
- Given: HotM is running
- When: User minimizes or closes window
- Then:
  - Application minimizes to system tray (doesn't exit)
  - Tray icon is visible with tooltip "HotM"
  - Right-click shows context menu (Show, Quit)
  - Double-click tray icon shows window
  - Application can auto-start on Windows login (optional)
- Verification:
  - Tray icon appears on minimize/close
  - Context menu functional
  - Test: Minimize to tray, restore via tray icon, verify window restored

**AC-5.3: Global Hotkey (Ctrl+Alt+H)**
- Given: HotM is running (visible or minimized)
- When: User presses Ctrl+Alt+H
- Then:
  - Application window shows (if hidden)
  - Window is brought to foreground
  - Focus is set to note input area (quick capture)
  - Hotkey works from any application
  - Hotkey can be customized in settings (future)
- Verification:
  - Global hotkey registered successfully
  - Test: Minimize HotM, open browser, press Ctrl+Alt+H, verify HotM shown
  - Test: Focus is in note input, ready to type

**AC-5.4: Markdown Editor**
- Given: User wants to create or edit a note
- When: User types in note editor
- Then:
  - Markdown syntax is supported (headings, lists, links, code blocks)
  - Live preview available (split view or toggle)
  - Syntax highlighting for code blocks
  - Auto-save on blur (prevents data loss)
  - Editor responsive with < 50ms keystroke latency
- Verification:
  - Editor supports CommonMark spec
  - Preview renders markdown correctly
  - Test: Type markdown with headers, lists, code, verify preview renders
  - Test: Close without saving, verify auto-save preserved content

**AC-5.5: Note List View**
- Given: Multiple notes exist
- When: User views note list
- Then:
  - Notes displayed in chronological order (newest first)
  - Each note shows: title (first line), snippet, tags, timestamp
  - List is scrollable and virtualized (handles 1000+ notes)
  - Search bar filters list in real-time
  - Click note to view full content
- Verification:
  - Note list renders correctly
  - Scrolling is smooth (60 FPS)
  - Test: Create 50 notes, verify list performance
  - Test: Search filters list correctly

**AC-5.6: Note Detail View**
- Given: User selects a note from list
- When: Note detail loads
- Then:
  - Shows revised content by default (enhanced view)
  - Toggle available to view original content
  - Tags displayed and clickable
  - Links to related notes visible (auto-generated + manual)
  - Metadata visible (created, updated, format, source)
- Verification:
  - Detail view renders complete note information
  - Toggle between original and revised works
  - Test: View note, verify all metadata present
  - Test: Click related link, verify navigation

#### Performance Targets

- App launch: < 2s (cold start)
- Window show/hide: < 100ms
- Global hotkey response: < 200ms
- Note list rendering (100 notes): < 500ms
- Editor keystroke latency: < 50ms
- Note detail load: < 300ms

#### Definition of Done

- [ ] Tauri app builds and runs on Windows 11
- [ ] System tray integration functional
- [ ] Global hotkey works reliably
- [ ] Markdown editor with preview working
- [ ] Note list and detail views functional
- [ ] Performance targets met on Windows 11
- [ ] Test coverage: 60%+ for UI components
- [ ] Personal use test: "UX is smooth and friction-free" = Yes

---

## 2. Performance Targets

### 2.1 API Response Times

| Endpoint | Target (P95) | Max Acceptable |
|----------|--------------|----------------|
| POST /notes (create) | < 200ms | 500ms |
| GET /notes/{id} (read) | < 100ms | 300ms |
| PUT /notes/{id}/revised (update) | < 300ms | 1s |
| DELETE /notes/{id} (delete) | < 100ms | 300ms |
| GET /search (hybrid) | < 1s | 2s |
| POST /semantic | < 1s | 2s |
| GET /tags | < 300ms | 500ms |

### 2.2 Background Processing

| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| NLP pipeline (full) | < 30s | 60s |
| Embedding generation | < 10s | 20s |
| Link discovery | < 5s | 10s |
| Tag generation | < 5s | 10s |
| Job queue latency | < 100ms | 500ms |
| Batch processing | 100 notes/hour | 50 notes/hour |

### 2.3 UI Responsiveness

| Interaction | Target | Max Acceptable |
|-------------|--------|----------------|
| App launch (cold) | < 2s | 5s |
| App launch (warm) | < 1s | 2s |
| Window show/hide | < 100ms | 300ms |
| Global hotkey | < 200ms | 500ms |
| Keystroke latency | < 50ms | 100ms |
| Note list render (100 notes) | < 500ms | 1s |
| Note detail load | < 300ms | 1s |
| Search results update | < 1s | 2s |

### 2.4 Scalability Targets (MVP)

| Metric | MVP Target | Future Scale |
|--------|------------|--------------|
| Total notes | 1,000 | 10,000+ |
| Notes per day | 20 | 100+ |
| Search corpus size | 1,000 notes | 10,000+ notes |
| Concurrent users | 1 (solo) | 10+ (future) |
| Database size | < 1GB | 10GB+ |

### 2.5 Resource Usage

| Resource | Target | Max Acceptable |
|----------|--------|----------------|
| Memory (API server) | < 256MB | 512MB |
| Memory (Tauri app) | < 512MB | 1GB |
| CPU (idle) | < 5% | 10% |
| CPU (processing) | < 50% avg | 80% spike |
| Disk I/O | < 10MB/s | 50MB/s |

---

## 3. Non-Functional Requirements

### 3.1 Privacy (Non-Negotiable)

**NFR-1.1: Local-First Architecture**
- All note data stored locally (PostgreSQL on localhost)
- All AI processing performed locally (Ollama on localhost)
- No data transmitted to external services
- No telemetry or analytics transmitted externally
- User owns and controls all data

**NFR-1.2: Data Immutability**
- Original note content never modified after creation
- All edits create new revisions with provenance
- Revision history is complete and auditable
- Soft deletes preserve data for recovery

**NFR-1.3: Encryption at Rest (Optional)**
- PostgreSQL supports transparent data encryption (user-configurable)
- Database credentials stored securely (environment variables, not committed)
- No plaintext credentials in codebase

### 3.2 Reliability

**NFR-2.1: Data Durability**
- PostgreSQL ACID compliance ensures data consistency
- Write-ahead logging (WAL) prevents data loss
- Database backups recommended but not automated (MVP)
- Soft deletes enable recovery from accidental deletion

**NFR-2.2: Error Handling**
- Ollama unavailable: Graceful degradation (skip enhancement, keep original)
- Database connection loss: Retry with exponential backoff
- Invalid input: Clear error messages returned to user
- Background job failure: Log error, mark job failed, allow manual retry

**NFR-2.3: Fault Tolerance**
- API server crashes: Restart preserves data (stateless server)
- Background job crashes: Jobs remain in queue for retry
- UI crashes: Tauri auto-recovery (relaunch window)
- Database crashes: PostgreSQL recovery on restart

### 3.3 Usability

**NFR-3.1: Learnability**
- Quick capture workflow: < 5 seconds to create note
- Search workflow: < 10 seconds to find note
- No manual required for core features (intuitive UI)
- Keyboard shortcuts for common operations

**NFR-3.2: Efficiency**
- Note creation: 3 clicks or less (or global hotkey)
- Search: Type and go (no complex query syntax required)
- Navigation: Back/forward buttons, breadcrumbs
- Bulk operations: Not required for MVP

**NFR-3.3: Error Prevention**
- Auto-save on blur (prevents data loss)
- Soft delete with undo option (future)
- Confirmation dialog for destructive actions (future)
- Clear validation messages for invalid input

**NFR-3.4: Accessibility (Basic)**
- Keyboard navigation (tab order, focus indicators)
- Screen reader support (basic, not comprehensive)
- Resizable text (respects OS font size settings)
- High contrast support (future)

### 3.4 Maintainability

**NFR-4.1: Code Quality**
- Rust: Clippy warnings addressed (zero warnings)
- Rust: Formatting via rustfmt (consistent style)
- TypeScript: ESLint warnings addressed (zero warnings)
- TypeScript: Prettier formatting (consistent style)

**NFR-4.2: Testing**
- Unit test coverage: 60%+ (MVP baseline)
- Integration test coverage: 50%+ (critical paths)
- E2E test coverage: Core user journeys (create, search, link)
- CI passes all tests before merge (GitHub Actions)

**NFR-4.3: Documentation**
- README: Installation, setup, basic usage
- API specification: Complete endpoint documentation
- Architecture docs: High-level system design
- Code comments: Non-obvious logic explained

**NFR-4.4: Logging**
- Structured logging (tracing crate)
- Log levels: DEBUG (dev), INFO (prod), ERROR (always)
- Log output: Console (dev), file (future)
- No sensitive data in logs (no note content, no credentials)

---

## 4. Validation Metrics (3-6 Months)

### 4.1 Adoption Metrics (Qualitative)

**Daily Use**
- Goal: Use HotM daily for 3-6 months
- Measure: Track in personal journal (binary: Yes/No per day)
- Success: > 80% days used (allows for weekends/vacations)

**Workflow Integration**
- Goal: HotM becomes habitual part of workflow
- Measure: Subjective assessment (Is it a habit? Do I think to use it?)
- Success: Automatic reach for HotM when capturing thoughts

**Friction Points**
- Goal: Identify and fix major workflow blockers
- Measure: List of annoyances/blockers during use
- Success: No critical blockers (P0 issues) remaining

### 4.2 Quality Metrics (Quantitative)

**Note Creation Rate**
- Goal: Capture thoughts regularly
- Measure: Notes created per week
- Success: > 10 notes/week average (indicates active use)

**Search Success Rate**
- Goal: Find notes when needed
- Measure: Track search queries and whether note was found
- Success: > 80% of searches find what I need

**Link Discovery Quality**
- Goal: Auto-linking finds meaningful connections
- Measure: Review 50 auto-generated links, count relevant vs irrelevant
- Success: > 70% of links are relevant (precision)

**Tag Relevance**
- Goal: Auto-tagging captures main topics
- Measure: Review tags on 50 notes, count relevant vs irrelevant
- Success: > 60% of tags are accurate

### 4.3 Performance Metrics (Quantitative)

**Response Time Tracking**
- Goal: System feels responsive
- Measure: Log API response times (P50, P95, P99)
- Success: P95 within targets defined in section 2

**Resource Usage**
- Goal: System doesn't slow down workstation
- Measure: Memory and CPU usage (idle and active)
- Success: < 512MB memory, < 10% CPU idle, < 50% CPU active

**Corpus Growth**
- Goal: System scales with growing note corpus
- Measure: Track total notes, embeddings, links over time
- Success: Performance remains acceptable up to 1000 notes

### 4.4 Value Metrics (Qualitative)

**Context Recovery**
- Goal: Rediscover forgotten notes/connections
- Measure: Subjective assessment (Do I discover things I'd forgotten?)
- Success: Regular "aha!" moments from search/linking

**Insight Generation**
- Goal: Discover connections I'd otherwise miss
- Measure: Subjective assessment (Do I see new patterns?)
- Success: Auto-linking reveals non-obvious relationships

**Time Saved**
- Goal: HotM saves time vs manual note-taking
- Measure: Subjective assessment (Is this faster than alternatives?)
- Success: Feels more efficient than previous methods

**Recommendation**
- Goal: Would I recommend HotM to others?
- Measure: Binary decision at 3-6 month mark
- Success: Yes → Consider open source release

---

## 5. Success Criteria (MVP → Open Source Decision)

### 5.1 Keep Private (Minimal Maintenance)

**Indicators**:
- Using daily, but not exceptional (solves personal need, not revolutionary)
- No enthusiasm to share (works for me, but may not resonate with others)
- Maintenance burden acceptable (continue iterating for personal use)
- Concept is "good enough" but not "must-share"

**Next Steps**:
- Continue lightweight maintenance
- Iterate based on personal needs
- No public documentation or community support

### 5.2 Open Source Release (Expand to Community)

**Indicators**:
- Using daily AND enthusiastic (solves personal need exceptionally well)
- High confidence others would value it (concept resonates, UX polished)
- Willing to support community (answer issues, review PRs, maintain project)
- Decision: "Yes, I would recommend this to others"

**Next Steps**:
- Add CONTRIBUTING.md, issue templates, PR review process
- Expand architecture docs for contributor onboarding
- Increase test coverage to 80%+
- Add security policy (SECURITY.md)
- Consider threat model (prevent malicious contributions)
- Tag v0.2.0 release, publish to GitHub

### 5.3 Pivot (Archive or Change Direction)

**Indicators**:
- Not using daily (too much friction, doesn't solve problem effectively)
- Concept doesn't work (auto-linking unreliable, search quality poor)
- Better alternatives exist (discovered other tools that solve problem better)
- Decision: "This isn't working"

**Next Steps**:
- Archive repository with lessons learned
- Document why concept didn't work (for future reference)
- Consider alternative approaches or different problem to solve

---

## 6. Testing Strategy (MVP)

### 6.1 Unit Tests

**Coverage Target**: 60%+

**Focus Areas**:
- Note CRUD operations (models, validation)
- Search algorithms (FTS, vector, hybrid, RRF)
- NLP pipeline stages (normalization, chunking, embedding)
- Tag and link generation logic
- Ollama client (with mocked responses)

**Test Organization**:
- Rust: Tests colocated with source (`#[cfg(test)]` modules)
- React: Tests colocated with components (`.test.tsx` files)
- Run via: `cargo test` (Rust), `npm test -- --run` (React)

### 6.2 Integration Tests

**Coverage Target**: 50%+

**Focus Areas**:
- API endpoints (full request/response cycle)
- Database operations (CRUD, search, transactions)
- Background job processing (queue, execute, complete)
- Ollama integration (embedding, generation)

**Test Organization**:
- Rust: `server/tests/` directory
- Uses test database (separate from dev/prod)
- Run via: `cargo test --test integration_tests`

### 6.3 E2E Tests

**Coverage Target**: Core user journeys

**Test Scenarios**:
1. **Quick Capture**: Launch app → Create note → Verify stored
2. **Search & Retrieve**: Create notes → Search → View result
3. **Auto-Linking**: Create related notes → Wait for processing → Verify links
4. **Auto-Tagging**: Create note → Wait for processing → Verify tags
5. **Revision History**: Create note → Update → Verify revisions

**Test Organization**:
- Playwright tests in `ui/tests/` (future)
- Manual testing during MVP validation (primary)

### 6.4 CI/CD Testing

**GitHub Actions Workflows**:
- `backend-tests.yml`: Rust tests, clippy, formatting, security audit
- `frontend-tests.yml`: React tests, TypeScript build, coverage, security audit

**Local Testing via Act**:
- Before pushing: `gh act -j backend-tests`
- Before pushing: `gh act -j frontend-tests`
- Both must exit code 0 and all tests passing

### 6.5 Performance Testing

**Manual Benchmarking**:
- Measure API response times (Postman, curl with timing)
- Track background job duration (log analysis)
- Monitor resource usage (Task Manager, htop)
- Test with growing corpus (100, 500, 1000 notes)

**Automated Benchmarks** (future):
- Criterion.rs for Rust benchmarks
- Jest performance tests for React
- Load testing for API (future, multi-user)

---

## 7. Out of Scope (Deferred Post-MVP)

### 7.1 UX Polish (Nice-to-Have)

**Deferred Features**:
- [ ] Advanced markdown features (KaTeX math, Mermaid diagrams, syntax highlighting)
- [ ] Dark mode / theme customization
- [ ] Keyboard shortcuts beyond global hotkey
- [ ] Note templates (daily notes, meeting notes, project notes)
- [ ] Bulk operations (tag multiple notes, delete multiple)
- [ ] Mica/Acrylic effects (Windows 11 native styling)
- [ ] Drag-and-drop file attachments
- [ ] Rich text editor (WYSIWYG alternative to markdown)

**Rationale**: MVP focuses on core functionality (capture, search, link). UX polish can be added iteratively based on personal validation feedback.

### 7.2 Advanced Features (Nice-to-Have)

**Deferred Features**:
- [ ] Collections (organize notes into groups)
- [ ] Note provenance UI (visualize revision history graph)
- [ ] Link graph visualization (interactive web of connections)
- [ ] Export (markdown, JSON, HTML, PDF)
- [ ] Import (from other note apps, markdown files)
- [ ] Search filters UI (date picker, tag selector)
- [ ] Link quality scoring (precision/recall metrics dashboard)
- [ ] Entity extraction display (highlight entities in note)
- [ ] Tag refinement UI (accept/reject AI suggestions)

**Rationale**: Advanced features add complexity. Focus on proving core concept first. Add features based on actual usage patterns during validation.

### 7.3 MCP Integration (Deferred)

**Deferred Features**:
- [ ] MCP server implementation (Model Context Protocol)
- [ ] MCP tools (create_note, search_notes, find_similar, etc.)
- [ ] AI assistant integration (Claude, ChatGPT, etc.)
- [ ] MCP authentication and authorization

**Rationale**: MCP integration is valuable for AI assistant compatibility, but not required for personal validation. Can be added after proving core concept works.

### 7.4 Deployment & Packaging (Deferred)

**Deferred Features**:
- [ ] MSI installer (Windows 11 installer package)
- [ ] Single-executable packaging (Tauri + embedded Axum + embedded PostgreSQL)
- [ ] Auto-update mechanism
- [ ] Install scripts (setup_dev.sh, setup_prod.sh)
- [ ] Docker Compose one-liner (exists but needs testing)
- [ ] Chocolatey package (Windows package manager)
- [ ] Winget package (Windows package manager)

**Rationale**: Deployment complexity is deferred. MVP uses manual setup (Docker Compose or native PostgreSQL/Ollama). Single-exe integration caused project instability, so client-server is simpler for now.

### 7.5 Multi-Device & Sync (Deferred)

**Deferred Features**:
- [ ] Sync architecture design (novel encryption + peer-to-peer)
- [ ] Conflict resolution (CRDT or operational transform)
- [ ] Multi-device UI (mobile, web, other desktop platforms)
- [ ] Cloud backup (optional, user-controlled)
- [ ] Remote server mode (access from multiple devices)

**Rationale**: Multi-device sync is valuable but complex. Must prove single-device concept first. Privacy-first sync requires novel architecture (not traditional cloud sync), which is out of scope for MVP.

### 7.6 Multi-User & Collaboration (Deferred)

**Deferred Features**:
- [ ] Authentication/authorization (JWT, API keys)
- [ ] User management (admin, regular users)
- [ ] Shared collections (collaboration on notes)
- [ ] Permissions and access control
- [ ] Activity logs (audit trail)

**Rationale**: MVP is single-user, local-first. Multi-user support requires authentication, authorization, and potentially server deployment. Out of scope until personal validation proves concept.

### 7.7 Observability & Monitoring (Deferred)

**Deferred Features**:
- [ ] Metrics dashboard (Grafana, Prometheus)
- [ ] Distributed tracing (Jaeger)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (APM)
- [ ] Alerting (PagerDuty, Slack)

**Rationale**: Observability is overkill for single-user local app. Basic logging is sufficient for MVP. Can add if transitioning to multi-user or open source.

---

## 8. Dependencies & Prerequisites

### 8.1 Development Environment

**Required Tools**:
- Rust 1.70+ (stable channel)
- Node.js 20+ (LTS)
- PostgreSQL 14+ (with pgvector extension)
- Ollama 0.1+ (with gpt-oss:20b and nomic-embed-text models)
- Git (version control)
- Windows 11 (primary development platform)

**Optional Tools**:
- Docker Desktop (for containerized PostgreSQL/Ollama)
- Docker Compose (for orchestration)
- Visual Studio Code (recommended editor)
- GitHub CLI (`gh` for act testing)
- Act (local GitHub Actions testing)

### 8.2 External Services

**Ollama Models**:
- `gpt-oss:20b` (text generation, summarization, tagging)
- `nomic-embed-text` (768-dimensional embeddings)

**Ollama Setup**:
```bash
# Pull required models
ollama pull gpt-oss:20b
ollama pull nomic-embed-text

# Verify models available
ollama list
```

### 8.3 Database Setup

**PostgreSQL with pgvector**:
```bash
# Docker Compose (recommended for MVP)
cd /home/manitcor/dev/hotm
docker-compose -f docker-compose.dev.yml up -d postgres

# OR native PostgreSQL
psql -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Database Migrations**:
```bash
cd server
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
sqlx migrate run
```

### 8.4 Environment Variables

**Required**:
- `DATABASE_URL`: PostgreSQL connection string
- `RUST_LOG`: Logging level (default: `hotm_server=info,axum=info`)

**Optional**:
- `OLLAMA_URL`: Ollama service URL (default: `http://localhost:11434`)
- `OLLAMA_GENERATION_MODEL`: LLM model (default: `gpt-oss:20b`)
- `OLLAMA_EMBEDDING_MODEL`: Embedding model (default: `nomic-embed-text`)
- `TEST_DATABASE_URL`: Test database (for integration tests)

---

## 9. MVP Completion Checklist

### 9.1 Architecture Cleanup

- [ ] Roll back single-exe integration work
- [ ] Restore client-server architecture (Tauri client + Axum server)
- [ ] Verify external PostgreSQL works (Docker or native)
- [ ] Verify external Ollama works (Docker or native)
- [ ] Document deployment options (Docker vs native)
- [ ] All CI tests passing (backend + frontend)

### 9.2 Core Features

**Note Management**:
- [ ] Create note (POST /notes)
- [ ] Read note (GET /notes/{id})
- [ ] Update note (PUT /notes/{id}/revised)
- [ ] Delete note (DELETE /notes/{id})
- [ ] Test coverage: 80%+

**Hybrid Search**:
- [ ] Full-text search (tsvector/GIN)
- [ ] Semantic search (pgvector/HNSW)
- [ ] Hybrid search (RRF fusion)
- [ ] Search filters (tags, date, collections)
- [ ] Test coverage: 75%+

**Auto-Linking**:
- [ ] Background job queue
- [ ] Embedding generation (Ollama)
- [ ] Link discovery (semantic similarity)
- [ ] Link storage and retrieval
- [ ] Test coverage: 70%+

**Auto-Tagging**:
- [ ] AI-generated tags (Ollama)
- [ ] Tag display on notes
- [ ] Manual tag management
- [ ] Test coverage: 60%+

**Windows 11 UX**:
- [ ] Desktop app (Tauri)
- [ ] System tray integration
- [ ] Global hotkey (Ctrl+Alt+H)
- [ ] Markdown editor
- [ ] Note list view
- [ ] Note detail view
- [ ] Test coverage: 60%+

### 9.3 Non-Functional Requirements

- [ ] Privacy: All data and processing local
- [ ] Reliability: Error handling and fault tolerance
- [ ] Usability: Intuitive workflows, < 5s quick capture
- [ ] Maintainability: 60%+ test coverage, zero clippy warnings
- [ ] Performance: All targets met (see section 2)

### 9.4 Validation Preparation

- [ ] Documentation: README with setup instructions
- [ ] Documentation: API specification complete
- [ ] Documentation: Architecture overview
- [ ] Personal validation plan: Metrics tracking (see section 4)
- [ ] Iteration plan: Bi-weekly or monthly milestones

### 9.5 MVP Launch

- [ ] Deploy for personal use (local workstation)
- [ ] Start daily use validation (3-6 months)
- [ ] Track adoption metrics (daily use, notes created)
- [ ] Track quality metrics (search success, link precision)
- [ ] Track value metrics (context recovery, insight generation)
- [ ] Decision point at 3-6 months: Keep private, open source, or pivot

---

## 10. Iteration & Evolution

### 10.1 Bi-Weekly Iterations (MVP Phase)

**Iteration Cadence**: Every 2 weeks

**Iteration Structure**:
1. **Planning** (30 min): Review backlog, prioritize next 2 weeks
2. **Development** (10 days): Implement features, fix bugs
3. **Testing** (2 days): Manual testing, CI validation
4. **Retrospective** (30 min): What worked? What didn't? Adjust.

**Iteration Goals**:
- Ship 1-3 features per iteration
- Fix critical bugs within same iteration
- Maintain test coverage above 60%
- No technical debt accumulation (pay as you go)

### 10.2 Feature Prioritization

**P0 (Blocker)**: Prevents daily use
- Fix immediately, can't validate without it

**P1 (Critical)**: Major friction in core workflow
- Fix within 1 iteration (2 weeks)

**P2 (Important)**: Annoying but workaround exists
- Fix within 2-3 iterations (4-6 weeks)

**P3 (Nice-to-Have)**: Quality-of-life improvement
- Defer until post-MVP or never

### 10.3 Technical Debt Management

**Debt Prevention**:
- Pay as you go (fix immediately after creating)
- Refactor as you touch code (Boy Scout Rule)
- No "TODO" without issue tracking

**Debt Payment**:
- Allocate 20% of iteration time to debt reduction
- Prioritize debt that blocks new features
- Document technical debt in ADRs

### 10.4 Evolution Triggers

**When to increase SDLC rigor** (transition from MVP to Production):

**Multi-User** (5+ active users):
- Add authentication/authorization
- Implement basic monitoring (uptime, error rates)
- Increase test coverage to 80%+
- Add deployment automation (CI/CD to staging/prod)

**Open Source Release** (public GitHub repo):
- Add CONTRIBUTING.md (contributor guidelines)
- Set up issue templates (bug reports, feature requests)
- Implement PR review process (even if solo maintainer)
- Add security policy (SECURITY.md)
- Consider threat model (prevent malicious contributions)

**Team Expansion** (2+ developers):
- Formalize requirements (ADRs, design docs)
- Implement code review (PR approvals required)
- Add architecture documentation (SAD, component diagrams)
- Use AIWG iteration workflow (Discovery + Delivery tracks)

**Commercial/Hosted Version** (if offering managed service):
- Add SLA/SLO monitoring
- Implement security compliance (SOC2, penetration testing)
- Add customer support infrastructure (ticketing, documentation)
- Implement billing/subscription (if monetizing)

---

## 11. Sign-Off & Validation

### 11.1 MVP Sign-Off Criteria

**Technical Sign-Off** (Solo Developer):
- [ ] All must-have features implemented (section 1)
- [ ] All performance targets met (section 2)
- [ ] All non-functional requirements satisfied (section 3)
- [ ] Test coverage above 60% (section 6)
- [ ] CI passing consistently (no flaky tests)
- [ ] Documentation complete (README, API spec, architecture)

**Personal Validation Sign-Off** (3-6 Months):
- [ ] Daily use sustained (> 80% of days)
- [ ] Core workflows smooth (quick capture, search, discovery)
- [ ] Search quality acceptable (> 80% success rate)
- [ ] Link quality acceptable (> 70% precision)
- [ ] Tag quality acceptable (> 60% relevance)
- [ ] Decision made: Keep private, open source, or pivot

### 11.2 MVP Acceptance

**Acceptance Date**: TBD (after MVP completion)

**Accepted By**: Solo Developer (Personal Use)

**Acceptance Criteria Met**:
- [ ] All must-have features working
- [ ] No P0 (blocker) issues remaining
- [ ] Performance acceptable for personal use
- [ ] Ready for daily use validation

**Next Steps**:
- Start 3-6 month personal validation
- Track metrics (see section 4)
- Iterate based on friction points
- Decide future direction at validation end

---

## Appendix A: Glossary

**CRUD**: Create, Read, Update, Delete (basic data operations)

**FTS**: Full-Text Search (keyword-based search using PostgreSQL tsvector)

**HNSW**: Hierarchical Navigable Small World (approximate nearest neighbor algorithm for vector search)

**MVP**: Minimum Viable Product (minimal feature set for validation)

**NLP**: Natural Language Processing (AI-powered text analysis)

**pgvector**: PostgreSQL extension for vector similarity search

**P95**: 95th percentile (95% of requests faster than this threshold)

**RRF**: Reciprocal Rank Fusion (method to combine multiple search rankings)

**Tauri**: Framework for building native desktop apps with web technologies

**Vector Embedding**: High-dimensional numerical representation of text for semantic similarity

---

## Appendix B: References

**Project Documentation**:
- [Project Intake](./../intake/project-intake.md)
- [Solution Profile](./../intake/solution-profile.md)
- [Option Matrix](./../intake/option-matrix.md)
- [API Specification](./../../docs/specifications/api-specification.md)
- [NLP Pipeline Architecture](./../../docs/architecture/nlp-pipeline.md)

**External Resources**:
- [Tauri Documentation](https://tauri.app/v2/)
- [Axum Documentation](https://docs.rs/axum/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Ollama Documentation](https://ollama.ai/docs)
- [Reciprocal Rank Fusion (RRF)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-04
**Maintained By**: Solo Developer
**Next Review**: After MVP Completion (TBD)
