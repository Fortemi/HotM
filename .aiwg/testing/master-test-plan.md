# Master Test Plan - HotM v0.1 MVP

**Document Type**: SDLC Artifact - Quality Assurance
**Phase**: Elaboration
**Version**: 1.0
**Date**: 2025-12-04
**Status**: BASELINE
**Primary Author**: Test Architect
**Reviewers**: Security Architect, Architecture Designer

---

## Executive Summary

This Master Test Plan defines how quality will be measured and assured throughout the HotM MVP lifecycle. It aligns with the Software Architecture Document (v1.0 BASELINED), Coverage Baseline (v1.0), and MVP Acceptance Criteria, establishing a test-first approach with local GitHub Actions (Act) as the authoritative standard.

**Key Metrics**:
- **Target Coverage**: 60% line coverage for MVP gate (currently 33.48% frontend, ~17.5% backend)
- **Test Approach**: Unit → Integration → E2E, with emphasis on critical workflows
- **CI/CD Standard**: Act (`gh act`) for local validation before any push
- **Quality Gates**: Zero clippy warnings, all tests passing, coverage targets met

---

## 1. Test Strategy Overview

### 1.1 Philosophy: Test-First with Act as Authority

HotM uses a **test-first approach** where:

1. **Act is the Single Source of Truth** - GitHub Actions workflows (via `act`) are the authoritative validation standard
2. **No Exceptions** - All code changes require passing Act validation before push, even "simple" fixes
3. **Local-Remote Parity** - Local Act execution exactly replicates GitHub Actions CI/CD
4. **Comprehensive Validation** - Tests include functionality, performance, security, and formatting

### 1.2 Test Levels and Coverage

| Level | Purpose | Scope | Coverage Target |
|-------|---------|-------|-----------------|
| **Unit Tests** | Verify business logic in isolation | Functions, models, services | 80% of critical paths |
| **Integration Tests** | Verify components interact correctly | API endpoints, database, Ollama | 50% of workflows |
| **E2E Tests** | Verify complete user journeys | Desktop app, API, database | Core workflows only |
| **Performance Tests** | Verify targets are met | Response times, resource usage | Baseline + threshold |
| **Security Tests** | Verify security controls | Dependency audits, input validation | Continuous monitoring |

### 1.3 Coverage Baseline (2025-12-04)

| Component | Current | Target (MVP) | Priority | Gap |
|-----------|---------|--------------|----------|-----|
| **Frontend** | 33.48% | 60% | HIGH | +26.52% |
| **Backend** | ~17.5% | 60% | CRITICAL | +42.5% |
| **Overall** | ~25% | 60% | CRITICAL | +35% |

### 1.4 Quality Gates

**MVP Gate Criteria** (all must pass):
- [ ] Frontend line coverage ≥ 60%
- [ ] Backend line coverage ≥ 60%
- [ ] `gh act -j backend-tests` exit code 0
- [ ] `gh act -j frontend-tests` exit code 0
- [ ] Zero P0 (blocker) issues in tested code
- [ ] All critical user journeys tested and passing

---

## 2. Test Levels (Detailed)

### 2.1 Unit Tests

**Definition**: Test individual functions, methods, and components in isolation with mocked dependencies.

**Framework**:
- **Rust Backend**: Native `#[tokio::test]` with mock services
- **React Frontend**: Vitest + React Testing Library

**Scope - Backend (Rust)**:

```text
Coverage Priority (by criticality):
1. Note CRUD (HIGH) → models, db operations
2. Search algorithms (HIGH) → FTS, vector, RRF
3. NLP pipeline (MEDIUM) → embedding, tagging
4. Route handlers (MEDIUM) → input validation, response mapping
5. Job queue (MEDIUM) → queue ops, retry logic
6. Ollama client (LOW) → mocking external calls
```

**Example - Backend Unit Test**:

```rust
#[tokio::test]
async fn test_create_note_validates_content() {
    // Arrange
    let mock_db = MockDatabase::new();
    let invalid_content = "";

    // Act
    let result = create_note(&mock_db, invalid_content).await;

    // Assert
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("content required"));
}

#[tokio::test]
async fn test_embedding_generation_handles_large_text() {
    let mock_ollama = MockOllama::new();
    let large_text = "word ".repeat(5000); // ~25KB

    let embedding = mock_ollama.embed("test-model", &large_text).await;

    assert!(embedding.is_ok());
    assert_eq!(embedding.unwrap().len(), 768); // nomic-embed-text dimension
}
```

**Scope - Frontend (React)**:

```text
Coverage Priority (by criticality):
1. Core services (HIGH) → api.ts, websocket.ts
2. Main component (MEDIUM) → HallOfMind.tsx
3. Editor/preview (MEDIUM) → MarkdownEditor, MarkdownPreview
4. Search/filter (LOW) → SearchDropdown, NoteMetadata
5. UI components (LOW) → badge, button, dialog wrappers
```

**Example - Frontend Unit Test**:

```typescript
describe('api.createNote', () => {
  it('sends correct payload to /notes endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'note-123' })
    });
    global.fetch = mockFetch;

    const result = await api.createNote('Test content');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/notes'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'Test content' })
      })
    );
    expect(result.id).toBe('note-123');
  });

  it('throws error on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(
      new Error('Network error')
    );

    await expect(api.createNote('Test')).rejects.toThrow('Network error');
  });
});
```

**Target**: 80% of critical business logic (note operations, search, linking)

---

### 2.2 Integration Tests

**Definition**: Test groups of components working together with real or mocked external services.

**Frameworks**:
- **Rust Backend**: `server/tests/` directory with real database (test database)
- **React Frontend**: Vitest with mocked API services

**Scope - Backend Integration Tests**:

| Test Category | Location | Coverage Target |
|---------------|----------|-----------------|
| **API Endpoints** | `server/tests/api/*.rs` | All CRUD operations |
| **Database Operations** | `server/tests/integration.rs` | Transactions, constraints |
| **Hybrid Search** | `server/tests/search*.rs` | FTS + Vector + RRF |
| **Background Jobs** | `server/tests/test_ai_pipeline.rs` | Queue, execute, complete |
| **Tag/Link Taxonomy** | `server/tests/taxonomy_links.rs` | CRUD and relationships |

**Example - Backend Integration Test**:

```rust
#[tokio::test]
async fn test_create_note_full_pipeline() {
    let pool = setup_test_db().await;
    let state = AppState::connect_test(&pool, MockOllama::new()).await.unwrap();

    // 1. Create note via API
    let request = build_create_note_request("Test note content");
    let response = test_app(state.clone()).oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let body: CreateNoteResponse = parse_body(response).await;
    let note_id = body.id;

    // 2. Verify note persisted
    let note = db::get_note(&pool, note_id).await.unwrap();
    assert_eq!(note.content, "Test note content");
    assert_eq!(note.is_deleted, false);

    // 3. Verify job queued
    let jobs = db::get_pending_jobs(&pool).await.unwrap();
    assert!(jobs.iter().any(|j| j.note_id == note_id && j.job_type == "embedding"));

    // 4. Process job
    let processor = JobProcessor::new(pool.clone(), MockOllama::new());
    processor.process_pending().await.unwrap();

    // 5. Verify embedding created
    let embedding = db::get_embedding(&pool, note_id).await.unwrap();
    assert_eq!(embedding.vector.len(), 768);
}

#[tokio::test]
async fn test_hybrid_search_combines_results() {
    let pool = setup_test_db().await;

    // Create notes with different content patterns
    let note1 = create_test_note(&pool, "machine learning algorithms").await;
    let note2 = create_test_note(&pool, "neural network training").await;
    let note3 = create_test_note(&pool, "cooking recipes").await;

    // Full-text search: exact match on "algorithms"
    let fts_results = db::search_fts(&pool, "algorithms").await.unwrap();
    assert_eq!(fts_results.len(), 1);
    assert_eq!(fts_results[0].id, note1.id);

    // Semantic search: "deep learning models"
    let query_embedding = MockOllama::embed_text("deep learning models").await;
    let semantic_results = db::search_semantic(&pool, query_embedding, 0.7).await.unwrap();
    assert!(semantic_results.iter().any(|r| r.id == note1.id)); // Should find similar
    assert!(!semantic_results.iter().any(|r| r.id == note3.id)); // Should not find cooking

    // Hybrid search: combines both
    let hybrid_results = db::search_hybrid(&pool, "neural", query_embedding, 0.7).await.unwrap();
    assert!(hybrid_results.len() >= 2); // Should get at least note1 and note2
}
```

**Target**: 50% of all workflows, focus on critical paths (CRUD, search, linking)

---

### 2.3 End-to-End Tests

**Definition**: Test complete user workflows from UI through API to database.

**Framework**: Manual testing + Playwright (future)

**Scope - Critical User Journeys**:

| Journey | Scenario | Success Criteria |
|---------|----------|------------------|
| **Quick Capture** | Hotkey → Create → Store | Note appears in list within 1s |
| **Search & Retrieve** | Create notes → Search → View | Correct note returned within 1s |
| **Auto-Linking** | Create related notes → Wait → View | Links discovered within 30s |
| **Auto-Tagging** | Create note → Wait → View tags | Tags generated within 20s |
| **Revision History** | Create → Edit → Compare | Both original and revised visible |

**Manual E2E Test Checklist** (MVP):

```markdown
## Quick Capture Journey
- [ ] Press Ctrl+Alt+H (global hotkey)
- [ ] Window appears and focuses on input
- [ ] Type note content "Test note"
- [ ] Press Enter
- [ ] Note appears in list within 1 second
- [ ] Note contains original content
- [ ] Job indicator shows "Processing" (NLP running)

## Search Journey
- [ ] Create 5 diverse notes
- [ ] Type search term in search bar
- [ ] Results appear within 1 second
- [ ] Results include relevant notes
- [ ] Irrelevant notes not shown
- [ ] Can filter by tag
- [ ] Can sort by date

## Auto-Linking Journey
- [ ] Create note: "Machine learning basics"
- [ ] Create note: "Neural network training"
- [ ] Wait 30 seconds (NLP processing)
- [ ] View first note
- [ ] "Related" section shows second note
- [ ] Link score displayed (similarity)
- [ ] Can click to navigate

## Desktop UX
- [ ] App launches within 2 seconds
- [ ] Window is responsive (60 FPS when scrolling)
- [ ] Minimize → tray icon appears
- [ ] Click tray → window restores
- [ ] Close window → app doesn't exit
- [ ] System tray context menu works
```

**Target**: Core 5 workflows, all must pass before MVP sign-off

---

### 2.4 Performance Tests

**Definition**: Verify that response times and resource usage meet targets.

**Measurement Tools**:
- **API Response Times**: `curl -w @curl-format.txt` or Postman
- **Resource Usage**: Windows Task Manager or Linux `top`
- **Load Testing**: Apache JMeter (future, post-MVP)

**Performance Targets** (from MVP Acceptance Criteria):

| Operation | Target (P95) | Max Acceptable |
|-----------|------|-----------------|
| Note creation | <200ms | 500ms |
| Note retrieval | <100ms | 300ms |
| Note update | <300ms | 1s |
| Full-text search (100 notes) | <500ms | 1.5s |
| Semantic search (100 notes) | <1s | 2s |
| Hybrid search (100 notes) | <1s | 2s |
| Embedding generation | <10s (bg) | 20s |
| Link discovery | <5s (bg) | 10s |
| Tag generation | <5s (bg) | 10s |

**Baseline Testing (Manual)**:

```bash
# Note creation timing
time curl -X POST http://localhost:53211/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"content":"Test note"}'

# Search timing (100 notes)
time curl "http://localhost:53211/api/v1/search?q=test"

# Resource monitoring
# Windows: Task Manager → Details tab → Monitor "hotm_server" memory/CPU
# Linux: watch -n 1 "ps aux | grep hotm"
```

**Target**: Establish baseline, monitor for regressions

---

### 2.5 Security Tests

**Definition**: Verify security controls and compliance.

**Automated Checks** (via Act):

```bash
# Backend security audit
cargo audit                    # Dependency vulnerabilities

# Frontend security audit
npm audit --audit-level high   # Dependency vulnerabilities
npm run typecheck              # Type safety (prevents some vulns)

# Code quality
cargo clippy -- -D warnings    # Rust best practices
```

**Manual Security Review** (quarterly):

- [ ] Input validation on all API endpoints
- [ ] No credentials in logs
- [ ] No production data in test fixtures
- [ ] SQL injection protection (SQLx compile-time checks)
- [ ] XSS prevention in note rendering
- [ ] CORS policy validated

**Target**: Zero known vulnerabilities, continuous monitoring

---

## 3. Test Organization and Execution

### 3.1 Directory Structure

```
hotm/
├── server/                                    # Backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── routes/
│   │   ├── models.rs
│   │   ├── db.rs
│   │   └── [test modules with #[cfg(test)]]
│   └── tests/                                 # Integration tests
│       ├── integration.rs                     # Core operations
│       ├── search_hybrid.rs                   # Search functionality
│       ├── search_tests.rs                    # FTS/semantic
│       ├── taxonomy_links.rs                  # Tags and links
│       ├── test_ai_pipeline.rs                # NLP pipeline
│       ├── api/                               # API endpoint tests
│       │   ├── notes_test.rs
│       │   ├── search_test.rs
│       │   └── links_test.rs
│       └── common/                            # Test utilities
│           ├── mod.rs
│           └── fixtures.rs
│
├── ui/                                        # Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── HallOfMind.tsx
│   │   │   ├── __tests__/                     # Component tests
│   │   │   │   ├── HallOfMind.title.test.tsx
│   │   │   │   ├── HallOfMind.websocket.test.tsx
│   │   │   │   └── JobQueueIndicator.test.tsx
│   │   │   └── ui/
│   │   │       └── __tests__/
│   │   │           ├── badge.test.tsx
│   │   │           └── button.test.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   └── __tests__/
│   │   │       └── api.test.ts
│   │   └── hooks/
│   │       └── __tests__/
│   │           └── use-mobile.test.ts
│   └── vitest.config.ts
│
└── .github/workflows/                         # CI/CD
    ├── backend-tests.yml
    ├── frontend-tests.yml
    └── sdlc-gates.yml
```

### 3.2 Running Tests Locally (Act)

**Authoritative Standard**:

```bash
cd /home/manitcor/dev/hotm

# Backend validation (Rust: tests, clippy, format, security)
gh act -j backend-tests

# Frontend validation (React: tests, TypeScript, coverage, security)
gh act -j frontend-tests

# Both must exit code 0 before push
echo $?  # Check exit code (should be 0)
```

**Quick Local Iteration** (not comprehensive):

```bash
# Backend quick test
cd server && cargo test

# Frontend quick test
cd ui && npm test -- --run

# Check formatting
cargo fmt --check
npm run lint
```

**Note**: Act tests are authoritative; quick local tests are convenience only.

### 3.3 CI/CD Workflows

**Backend Tests** (`backend-tests.yml`):

```yaml
Triggers:
  - Push to main/develop (server/** paths)
  - PRs to main (server/** paths)

Steps:
  1. Checkout code
  2. Install Rust (stable, rustfmt, clippy)
  3. Cache cargo
  4. Install PostgreSQL client, SQLx CLI
  5. Setup test database (pgvector extension)
  6. Run clippy (warnings → errors)
  7. Run cargo test (with USE_MOCK_AI=true)
  8. Check formatting (cargo fmt)
  9. Security audit (cargo audit)

Environment:
  - DATABASE_URL: postgres://postgres:postgres@localhost:5434/hotm_test
  - TEST_DATABASE_URL: Same as above
  - USE_MOCK_AI: true
  - RUST_LOG: debug
  - RUST_BACKTRACE: 1
```

**Frontend Tests** (`frontend-tests.yml`):

```yaml
Triggers:
  - Push to main/develop (ui/** paths)
  - PRs to main (ui/** paths)

Steps:
  1. Checkout code
  2. Setup Node.js 20 with npm cache
  3. Install dependencies (npm ci)
  4. Type check (npm run build)
  5. Run tests (npm test -- --run)
  6. Generate coverage (npm run test:coverage -- --run)
  7. Security audit (npm audit --audit-level high)

Coverage Report:
  - Frontend line coverage: target ≥ 60%
  - Generate HTML report for review
```

---

## 4. Coverage Roadmap to 60% Target

### Phase 1: Frontend Coverage (2-3 weeks)

**Goal**: 33.48% → 60%

**Week 1: Critical Services & Main Component**

- [ ] `websocket.ts` tests (0% → 80%)
  - Connection/disconnection lifecycle
  - Message sending/receiving
  - Reconnection logic
  - Error handling (network down, timeout)
  - Target: 50+ lines of test code

- [ ] Complete `api.ts` tests (64.34% → 90%)
  - All public methods covered
  - Error scenarios (4xx, 5xx responses)
  - Edge cases (empty responses, timeouts)
  - Target: 100+ lines of additional test code

- [ ] `HallOfMind.tsx` tests (30% → 80%)
  - Component render and state management
  - User interactions (click, type)
  - WebSocket integration
  - Loading/error states
  - Target: 200+ lines of test code

**Week 2: Editor & Preview Components**

- [ ] `MarkdownEditor.tsx` tests (0% → 70%)
  - Content editing and updates
  - Toolbar actions
  - Auto-save functionality
  - Target: 150+ lines of test code

- [ ] `MarkdownPreview.tsx` tests (0% → 70%)
  - Markdown rendering (headings, lists, code blocks)
  - Code syntax highlighting
  - Image/link handling
  - Target: 150+ lines of test code

**Week 3: Feature Components**

- [ ] `SearchDropdown.tsx` tests (0% → 60%)
  - Search input and filtering
  - Result display
  - Navigation

- [ ] `JobQueueMonitor.tsx` tests (0% → 60%)
  - Job status display
  - Progress updates

- [ ] `NoteContextMenu.tsx` tests (0% → 60%)
  - Menu actions and handlers

**Expected Outcome**: ~60% line coverage

---

### Phase 2: Backend Coverage (3-4 weeks)

**Goal**: ~17.5% → 60%

**Week 1: Database Layer**

- [ ] `db_enhanced.rs` unit tests
  - Query building and execution
  - Transaction handling
  - Error scenarios
  - Target: 200+ lines of test code

- [ ] `db_enhanced_v2.rs` unit tests
  - Complex operations (batch, joins)
  - Edge cases
  - Target: 200+ lines of test code

**Week 2: Job Queue & Services**

- [ ] `job_queue.rs` tests
  - Queue operations (enqueue, dequeue)
  - Job lifecycle (pending → running → complete)
  - Retry logic and error handling
  - Target: 150+ lines of test code

- [ ] `ollama.rs` tests
  - Embedding generation (deterministic mocking)
  - Text generation
  - Error handling (unavailable service)
  - Target: 100+ lines of test code

**Week 3: WebSocket & Routes**

- [ ] `websocket.rs` integration tests
  - Client connection/disconnection
  - Message broadcasting
  - Error handling
  - Target: 150+ lines of test code

- [ ] `routes/provenance.rs` API tests
  - Revision history retrieval
  - Lineage tracking
  - Target: 100+ lines of test code

- [ ] `routes/taxonomy.rs` API tests
  - Tag CRUD operations
  - Collection management
  - Note-tag associations
  - Target: 100+ lines of test code

**Week 4: Complete Route Coverage**

- [ ] `routes/jobs.rs` API tests
  - Job status endpoints
  - Job history retrieval

- [ ] `routes/notes.rs` edge cases
  - Validation errors
  - Soft delete behavior
  - Concurrent operations

- [ ] Error handling across all routes
  - Invalid input responses
  - Database errors
  - External service failures

**Expected Outcome**: ~60% line coverage

---

### Phase 3: Refinement & Edge Cases (1-2 weeks)

**Goal**: 60% → 70%+ (stretch)

- [ ] Error handling paths (all modules)
- [ ] Concurrent operation testing (race conditions)
- [ ] Edge cases (empty data, malformed inputs)
- [ ] Performance benchmarking (establish baseline)
- [ ] E2E test scenarios (manual or Playwright)

---

## 5. Test Data Management

### 5.1 Database Test Isolation

**Strategy**: Transaction rollback for per-test isolation

```rust
#[tokio::test]
async fn test_with_isolation() {
    let pool = setup_test_pool().await;
    let mut tx = pool.begin().await.unwrap();

    // Create test data
    let note_id = sqlx::query_scalar!(
        "INSERT INTO note (title) VALUES ($1) RETURNING id",
        "Test Note"
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap();

    // Test operations
    assert_eq!(note_id, /* expected value */);

    // Automatic rollback when tx drops
    // No cleanup needed, test data never committed
}
```

**Guarantees**:
- No test pollution (each test starts clean)
- Parallel test execution safe
- No test database reset needed between tests

### 5.2 Mock Data Fixtures

**Purpose**: Consistent, deterministic test data

```rust
// server/tests/common/fixtures.rs

pub fn create_test_note(content: &str) -> Note {
    Note {
        id: Uuid::new_v4(),
        title: "Test Note".to_string(),
        content: content.to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_deleted: false,
    }
}

pub fn create_test_embedding(dimensions: usize) -> Vec<f32> {
    // Deterministic embedding based on seed
    (0..dimensions)
        .map(|i| ((i as f32) / (dimensions as f32)).sin())
        .collect()
}
```

### 5.3 Mock Ollama Responses

**Strategy**: Use environment variable to enable mock mode

```bash
# Test environment
export USE_MOCK_AI=true
cargo test
```

**Mock Behavior**:

```rust
pub struct MockOllama {
    generate_responses: HashMap<String, String>,
    embed_responses: HashMap<String, Vec<f32>>,
    available: bool,
}

impl MockOllama {
    // Deterministic responses based on input
    pub async fn generate(&self, model: &str, prompt: &str) -> Result<String> {
        Ok(format!("Mock response for: {}", &prompt[..20.min(prompt.len())]))
    }

    pub async fn embed(&self, model: &str, text: &str) -> Result<Vec<f32>> {
        // Generate seeded 768-dim vector
        Ok((0..768).map(|i| {
            ((text.bytes().fold(0u64, |a,b| a+b as u64) + i as u64) % 1000) as f32 / 1000.0
        }).collect())
    }
}
```

---

## 6. Defect Management

### 6.1 Severity Levels

| Level | Definition | Fix Timeframe | Blocks MVP? |
|-------|------------|---------------|------------|
| **P0 (Blocker)** | Prevents core functionality | Immediate (same day) | YES |
| **P1 (Critical)** | Major friction in workflow | Within 1 iteration (2 weeks) | YES |
| **P2 (Major)** | Annoying but has workaround | Within 2 iterations (4 weeks) | NO |
| **P3 (Minor)** | Quality-of-life improvement | Backlog (post-MVP) | NO |

### 6.2 Test Failure Protocol

When a test fails:

1. **Identify Severity**: Is this a blocker (P0/P1) or lower priority?
2. **Diagnose Root Cause**: Unit test? Integration? Environment?
3. **Fix and Verify**: Commit fix, re-run Act tests
4. **Add Regression Test**: Ensure failure doesn't recur
5. **Document Pattern**: Update test strategy if systematic issue

### 6.3 Flaky Test Management

Flaky tests (intermittent failures) must be fixed before MVP:

```rust
// AVOID: Time-dependent tests
#[tokio::test]
async fn test_job_processing() {
    create_job().await;
    sleep(Duration::from_secs(5)).await;  // FLAKY!
    assert_job_complete().await;
}

// BETTER: Polling with timeout
#[tokio::test]
async fn test_job_processing() {
    create_job().await;

    let mut retries = 0;
    while !is_job_complete().await && retries < 100 {
        tokio::time::sleep(Duration::from_millis(50)).await;
        retries += 1;
    }
    assert!(is_job_complete().await);
}

// BEST: Use proper async synchronization
#[tokio::test]
async fn test_job_processing() {
    let (tx, rx) = tokio::sync::mpsc::channel(1);

    create_job_with_notifier(tx).await;

    let completed = tokio::time::timeout(
        Duration::from_secs(10),
        rx.recv()
    ).await;

    assert!(completed.is_ok());
}
```

---

## 7. Test Schedule

### Timeline: 8 Weeks to 60% Coverage

```
Week 1-2: Frontend Critical Services (websocket, api)
  ├─ Estimate: 300 lines of test code
  ├─ Focus: High-impact, unblocks rest of frontend
  └─ Gate: Must reach 45% frontend coverage

Week 2-3: Frontend Main Component (HallOfMind)
  ├─ Estimate: 200 lines of test code
  ├─ Focus: Component logic, state management
  └─ Gate: Must reach 50% frontend coverage

Week 3-4: Frontend Editor Components
  ├─ Estimate: 300 lines of test code
  ├─ Focus: MarkdownEditor, MarkdownPreview
  └─ Gate: Must reach 55-60% frontend coverage

Week 5: Backend Database Layer
  ├─ Estimate: 400 lines of test code
  ├─ Focus: Query building, transactions
  └─ Gate: Must reach 25% backend coverage

Week 6: Backend Job Queue & Services
  ├─ Estimate: 250 lines of test code
  ├─ Focus: Queue operations, Ollama client
  └─ Gate: Must reach 35% backend coverage

Week 7: Backend WebSocket & Routes
  ├─ Estimate: 250 lines of test code
  ├─ Focus: provenance, taxonomy, jobs APIs
  └─ Gate: Must reach 50% backend coverage

Week 8: Refinement & Edge Cases
  ├─ Estimate: 200 lines of test code
  ├─ Focus: Error handling, concurrent ops
  └─ Gate: Must reach 60% coverage, all Act tests passing

Parallel: Weekly Act Test Runs
  ├─ Every commit: gh act -j backend-tests && gh act -j frontend-tests
  ├─ Fix failures immediately
  └─ Track trend of passing tests
```

### Iteration Cadence

**Bi-weekly iterations with testing integration**:

```
Day 1: Iteration Planning
  └─ Select test items for iteration

Days 2-8: Development + Testing
  ├─ Write tests in parallel with features
  ├─ Run Act tests after each major change
  └─ Fix test failures immediately

Days 9-10: Testing & Review
  ├─ Full Act test run (backend + frontend)
  ├─ Coverage report generation
  ├─ Code review focused on test quality
  └─ Go/No-go decision for release

Day 11: Retrospective
  └─ What testing patterns worked? What didn't?
```

---

## 8. Quality Metrics & Monitoring

### 8.1 Coverage Metrics

| Metric | Baseline | Target | Dashboard |
|--------|----------|--------|-----------|
| Frontend line coverage | 33.48% | 60% | Vitest HTML report |
| Backend line coverage | ~17.5% | 60% | Tarpaulin (future) |
| Branch coverage | 60.88% | 70% | Vitest report |
| Function coverage | 25% | 60% | Vitest report |

### 8.2 Test Execution Metrics

| Metric | Target | Check Frequency |
|--------|--------|-----------------|
| Act backend-tests duration | <5 min | Per push |
| Act frontend-tests duration | <3 min | Per push |
| Test pass rate | 100% | Per push |
| Flaky test rate | 0% | Weekly |
| Defect escape rate | <5% | Monthly |

### 8.3 Code Quality Metrics

| Check | Target | Enforced By |
|-------|--------|------------|
| Clippy warnings | 0 | Act backend-tests |
| ESLint warnings | 0 | Act frontend-tests |
| TypeScript errors | 0 | npm run typecheck |
| Formatting violations | 0 | Act checks (cargo fmt, prettier) |
| Security vulnerabilities | 0 | cargo audit, npm audit |

### 8.4 Monitoring Dashboard (Future)

When transitioning to production:

```
Coverage Trend (daily)
  ├─ Frontend: [graph] 33% → 45% → 52% → 60%
  └─ Backend: [graph] 17.5% → 30% → 45% → 60%

Test Execution Health
  ├─ Duration trend (watch for slowdown)
  ├─ Pass rate (should be ~100%)
  └─ Flaky tests (should be zero)

Defect Metrics
  ├─ P0 issues (should be zero)
  ├─ P1 issues (fix within iteration)
  └─ Escape rate (monitor for patterns)
```

---

## 9. Test Environment Configuration

### 9.1 Development Environment

**Machine Specs**:
- Windows 11 (primary) or Linux/WSL2 (secondary)
- 8+ GB RAM
- SSD recommended
- Network access not required (local-only)

**Required Software**:
- Rust 1.70+ (stable)
- Node.js 20+ (LTS)
- PostgreSQL 14+ with pgvector
- Ollama 0.1+ (for manual testing only; tests use mocks)
- Docker & Docker Compose (recommended for database/Ollama)

**Setup**:

```bash
# Clone and initialize
git clone <repo>
cd hotm

# Backend setup
cd server
cargo build --release
rustup toolchain install stable
rustup component add clippy rustfmt

# Frontend setup
cd ../ui
npm install
npm run typecheck

# Database setup
docker-compose -f docker-compose.dev.yml up -d postgres
./scripts/schema/rebuild-schema.sh

# Verify Act
gh act --list  # Should show backend-tests, frontend-tests jobs
```

### 9.2 CI/CD Environment (GitHub Actions)

**Provided by GitHub Actions**:
- Ubuntu 22.04 Linux runner
- PostgreSQL 16 with pgvector (service container)
- Rust stable toolchain
- Node.js 20

**Environment Variables** (set in workflow):
```yaml
DATABASE_URL: postgres://postgres:postgres@localhost:5434/hotm_test
TEST_DATABASE_URL: same
USE_MOCK_AI: true
RUST_LOG: debug
RUST_BACKTRACE: 1
```

### 9.3 Test Database

**Configuration**:

```sql
-- Create test database
CREATE DATABASE hotm_test OWNER postgres;

-- Enable pgvector extension
\c hotm_test
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- Run migrations
-- (via sqlx migrate run or clean-schema.sql rebuild)
```

**Isolation**:
- Each test uses separate transaction
- Transactions rolled back after test completes
- Parallel test execution safe

---

## 10. Automation & Tooling

### 10.1 Test Execution Commands

```bash
# Frontend (Vitest)
cd ui

# Run all tests once
npm test -- --run

# Run tests in watch mode (development)
npm test

# Generate coverage report
npm run test:coverage -- --run

# View coverage HTML
open coverage/index.html


# Backend (Cargo)
cd server

# Run all tests
cargo test

# Run specific test
cargo test test_create_note

# Run tests in release mode (faster)
cargo test --release

# Run with logging
RUST_LOG=debug cargo test -- --nocapture

# Install tarpaulin for coverage
cargo install cargo-tarpaulin

# Generate coverage HTML
cargo tarpaulin --out Html --output-dir coverage
```

### 10.2 CI/CD via Act

```bash
# Before any push, run local CI validation
cd /home/manitcor/dev/hotm

# Backend tests (authoritative)
gh act -j backend-tests

# Frontend tests (authoritative)
gh act -j frontend-tests

# Run both in sequence
gh act -j backend-tests && gh act -j frontend-tests && echo "✓ Ready to push"

# If any fail, fix and repeat
```

### 10.3 Pre-Commit Hooks (Future)

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running pre-commit checks..."

# Prevent commits with secrets
if git diff --cached | grep -E 'DATABASE_URL|API_KEY|SECRET'; then
    echo "ERROR: Found sensitive data in commit"
    exit 1
fi

# Ensure Act tests pass
gh act -j backend-tests || exit 1
gh act -j frontend-tests || exit 1

echo "✓ All checks passed, committing..."
```

---

## 11. Risk Mitigation in Testing

### 11.1 Common Testing Pitfalls

| Pitfall | Symptom | Mitigation |
|---------|---------|-----------|
| **Insufficient Mocking** | Tests call real Ollama/database | Mock external services, use test database |
| **Flaky Tests** | Tests pass/fail randomly | Avoid sleep, use proper async sync |
| **Low Coverage Indicators** | 60% coverage but untested paths | Focus on critical paths, not coverage number |
| **No Test Isolation** | Tests interfere with each other | Use transactions, fixtures, mock state |
| **Slow Test Suite** | Tests take >10 minutes to run | Parallel execution, mock external calls |
| **Outdated Test Data** | Tests fail with new schema | Keep test fixtures in sync with schema |

### 11.2 Test Failure Scenarios

**Scenario: Database Migration Breaks Tests**

```rust
// PROBLEM: Tests hardcoded with old schema
#[tokio::test]
async fn test_create_note() {
    // INSERT expects old column layout
    // Migration adds/removes columns → test fails
}

// SOLUTION: Use proper fixtures that create schema
#[tokio::test]
async fn test_create_note() {
    let pool = setup_test_db().await;  // Runs migrations
    // Now schema is up-to-date
}
```

**Scenario: Ollama Unavailable During Testing**

```rust
// PROBLEM: Tests fail if Ollama not running
#[tokio::test]
async fn test_embedding() {
    let ollama = OllamaClient::new("http://localhost:11434");
    let vec = ollama.embed("text").await?;  // Fails if Ollama down
}

// SOLUTION: Mock Ollama for tests
#[tokio::test]
async fn test_embedding() {
    let mock = MockOllama::new();
    let vec = mock.embed("text").await?;  // Always succeeds
}
```

---

## 12. Sign-Off & Acceptance Criteria

### 12.1 Test Plan Acceptance

**By Test Architect** (this document):
- [x] Coverage targets are realistic (60% by MVP gate)
- [x] Test levels aligned with architecture (unit/integration/E2E)
- [x] Act integration properly defined as authoritative standard
- [x] Critical paths identified and testable
- [x] Resource and timeline estimates reasonable

**By Architecture Designer**:
- [ ] Architecture supports test isolation (mocking, transactions)
- [ ] API design is testable (clear contracts, error cases)
- [ ] Database schema supports test reset/rollback

**By Requirements Analyst**:
- [ ] Test plan covers all MVP acceptance criteria
- [ ] Performance targets include test scenarios
- [ ] Quality metrics map to business requirements

### 12.2 Test Plan Execution

**Weekly Status** (during Elaboration):
- Coverage trend (should trend upward)
- Act test pass rate (should be >95%)
- P0 issues resolved (should be zero)
- Test execution time (monitor for slowdown)

**MVP Gate Validation**:
- [ ] Frontend coverage ≥ 60%
- [ ] Backend coverage ≥ 60%
- [ ] `gh act -j backend-tests` exit code 0
- [ ] `gh act -j frontend-tests` exit code 0
- [ ] Zero P0 issues
- [ ] All critical path E2E scenarios passing

---

## 13. Appendices

### Appendix A: Test Command Quick Reference

```bash
# Frontend
cd ui && npm test -- --run              # Run tests once
cd ui && npm run test:coverage -- --run # Generate coverage
cd ui && npm test                       # Watch mode

# Backend
cd server && cargo test                 # Run tests
cd server && cargo test -- --nocapture  # See println output
cd server && cargo clippy               # Style check
cd server && cargo fmt --check          # Format check

# CI/CD (Act - AUTHORITATIVE)
gh act -j backend-tests                 # Full backend validation
gh act -j frontend-tests                # Full frontend validation

# Before any push
gh act -j backend-tests && gh act -j frontend-tests && git push
```

### Appendix B: Test Coverage Checklist

**Frontend (33.48% → 60%)**:
- [ ] websocket.ts (0% → 80%)
- [ ] api.ts (64.34% → 90%)
- [ ] HallOfMind.tsx (30% → 80%)
- [ ] MarkdownEditor.tsx (0% → 70%)
- [ ] MarkdownPreview.tsx (0% → 70%)
- [ ] SearchDropdown.tsx (0% → 60%)
- [ ] JobQueueMonitor.tsx (0% → 60%)
- [ ] NoteContextMenu.tsx (0% → 60%)

**Backend (~17.5% → 60%)**:
- [ ] db_enhanced.rs unit tests (200+ lines)
- [ ] db_enhanced_v2.rs unit tests (200+ lines)
- [ ] job_queue.rs tests (150+ lines)
- [ ] ollama.rs tests (100+ lines)
- [ ] websocket.rs integration tests (150+ lines)
- [ ] routes/provenance.rs tests (100+ lines)
- [ ] routes/taxonomy.rs tests (100+ lines)
- [ ] routes/jobs.rs tests (50+ lines)
- [ ] routes/notes.rs edge cases (100+ lines)

### Appendix C: References

**Project Documentation**:
- Software Architecture Document (SAD): `.aiwg/architecture/software-architecture-doc.md`
- Coverage Baseline: `.aiwg/testing/coverage-baseline.md`
- MVP Acceptance Criteria: `.aiwg/requirements/mvp-acceptance-criteria.md`
- CLAUDE.md: Testing discipline and Act standard

**External Resources**:
- Vitest: https://vitest.dev
- Tokio Testing: https://tokio.rs
- PostgreSQL Testing: https://www.postgresql.org/docs/current/sql-createdb.html
- Act (GitHub Actions locally): https://github.com/nektos/act

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2025-12-04 |
| **Version** | 1.0 BASELINE |
| **Status** | APPROVED |
| **Primary Author** | Test Architect |
| **Reviewers** | Architecture Designer, Security Architect |
| **Next Review** | After Phase 1 coverage completion (3 weeks) |

**Change Log**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Test Architect | Initial baseline, 8-week roadmap, Act integration |

---

**End of Master Test Plan - HotM v0.1 MVP**
