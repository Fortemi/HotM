# Testability Review - SAD v0.1

**Reviewer**: Test Architect
**Date**: 2025-12-04
**Status**: CONDITIONAL

---

## Executive Summary

The HotM Software Architecture Document v0.1 demonstrates **strong foundational testability** with clear component boundaries, well-defined external interfaces, and established CI/CD discipline via Act. However, several critical gaps exist around mocking strategies, test isolation patterns, and WebSocket/concurrent operation testing approaches.

**Verdict**: **CONDITIONAL APPROVAL** - Architecture is testable with recommended refinements in 5 key areas.

---

## Strengths

### 1. Strong Component Isolation
- **Client-Server Separation** (ADR-001): Tauri UI completely separated from Axum API server enables independent testing of frontend/backend
- **Process Isolation**: PostgreSQL, Ollama, and Axum run as separate processes → enables parallel testing without conflicts
- **Clear Boundaries**: Each service has explicit responsibility, making unit test scope obvious

**Impact**: CRUD operation testing, database operations, and API endpoint testing can proceed independently at 100% isolation.

### 2. Mockable External Interfaces
- **Ollama Client** (Section 4.5.3): Well-encapsulated with interface pattern (`is_available()`, `generate()`, `embed()`)
- **SQLx Database Layer** (Section 4.4.4): Compile-time query verification supports parameterized testing
- **HTTP Client**: Axum server uses standard Rust HTTP patterns compatible with wiremock/httptest mocking

**Impact**: Ollama can be mocked deterministically via HTTP interceptors; database can be tested with transaction rollback; API responses are predictable.

### 3. Database-Backed Job Queue
- **PostgreSQL Job Queue** (Section 4.5.2): Jobs persisted in `job_queue` table enable test setup/teardown via DELETE statements
- **No Volatile External State**: Unlike Redis-backed queues, test state remains queryable and reset-friendly
- **Transaction Support**: SQLx async transactions with ROLLBACK support for test isolation

**Impact**: Job system can be tested deterministically; background jobs can be inspected mid-execution for state validation.

### 4. Graceful Degradation Architecture
- **Optional Ollama** (Section 4.5.4): Core CRUD works without NLP service → enables testing basic paths offline
- **Clear Fallback Matrix** (Section 9.4): Explicit failure mode descriptions enable negative test case design

**Impact**: Critical paths can be tested without Ollama setup; error handling paths are well-defined for failure injection.

### 5. Act-Based CI/CD Standard
- **Local Parity** (CLAUDE.md): `gh act` enforces local/CI consistency; all developers validate before push
- **Comprehensive Workflows**: Backend and frontend tests include security audits, formatting checks, type checking
- **Deterministic Environment**: Docker Compose defines PostgreSQL version, pgvector extension, Ollama models

**Impact**: Tests run identically locally and in CI; test environment drift eliminated; validation happens before code reaches repository.

### 6. Clear API Contract
- **OpenAPI-Compatible** (Section 4.2.2): REST endpoints are stateless and independently testable
- **JSON Error Responses** (Section 4.2.4): Consistent error format enables assertion on error codes and messages
- **WebSocket Protocol** (Section 4.6.2): Message types explicitly documented with JSON payloads

**Impact**: API integration testing uses standard tools; mock servers can be built predictably; client error handling can be validated.

### 7. Test Infrastructure Already in Place
- **Vitest + v8 Frontend** (Coverage Baseline): 33.48% measured coverage; infrastructure operational
- **Tokio + Tower Backend** (Coverage Baseline): Integration tests exist for notes, search, links, tags
- **Mock AI Framework**: `USE_MOCK_AI=true` environment variable enables offline testing
- **Test Database**: `TEST_DATABASE_URL` separate from production; migrations tested

**Impact**: Test foundation exists; gaps are in coverage expansion, not infrastructure replacement.

---

## Gaps

### 1. Ollama Mocking Strategy (CRITICAL)

**Issue**: Section 4.5.3 provides the OllamaClient interface, but the SAD lacks concrete mocking guidance for deterministic testing.

**Current State**:
- `ollama.rs` has async methods but no defined mock behavior
- Coverage Baseline notes `USE_MOCK_AI=true` but doesn't specify implementation
- No examples of stubbed responses for `generate()` and `embed()`

**Risk Impact**:
- AI pipeline tests may be non-deterministic (model outputs vary)
- Embedding tests depend on model behavior, reducing reproducibility
- Revision tests cannot validate specific text output

**Recommendation**:
1. Document Ollama mock adapter pattern in architecture (Section 4.5.3)
2. Define standard test fixtures:
   - `mock_generate_response(prompt: &str) -> String` - deterministic text output
   - `mock_embed_response(text: &str) -> Vec<f32>` - seeded vector with known dimensions
3. Example implementation:
   ```rust
   #[cfg(test)]
   mod tests {
       use crate::ollama::{OllamaClient, OllamaResponse};

       struct MockOllama;

       #[async_trait]
       impl OllamaInterface for MockOllama {
           async fn generate(&self, model: &str, prompt: &str) -> Result<String> {
               // Return deterministic output based on prompt hash
               Ok(format!("Generated: {}", md5(prompt)))
           }
       }
   }
   ```

### 2. WebSocket Testing Approach (CRITICAL)

**Issue**: Section 4.6 defines WebSocket protocol but provides NO integration test strategy.

**Current State**:
- Message types documented (Section 4.6.2) but no test examples
- Coverage Baseline: `websocket.ts` frontend service has 0% coverage
- No mention of WebSocket test libraries (tokio-tungstenite, tungstenite-rs)
- Broadcast pattern undefined for testing multi-connection scenarios

**Risk Impact**:
- Real-time updates untestable until runtime
- Race conditions in broadcast logic undetectable
- Client reconnection logic cannot be validated before production

**Recommendation**:
1. Add WebSocket Testing Section (4.6.3) with patterns:
   ```rust
   #[tokio::test]
   async fn test_websocket_job_progress() {
       let (tx, rx) = broadcast::channel(100);
       let ws = create_test_websocket(rx);

       // Simulate job progress event
       tx.send(JobProgressMessage {
           job_id: "test-id",
           status: "processing",
           progress: 50
       }).unwrap();

       // Assert client receives message
       let received = ws.recv().await.unwrap();
       assert_eq!(received.type, "job_progress");
   }
   ```

2. Define integration test setup:
   - Use `tokio-tungstenite` for client simulation
   - Test multi-client broadcast (2+ connections)
   - Validate reconnection behavior (disconnect → reconnect → resume)

3. Frontend test strategy:
   - Mock WebSocket via test double in `services/websocket.ts`
   - Test message handlers in isolation
   - Integration test: React component + WebSocket mock

### 3. Database Test Isolation (HIGH)

**Issue**: Section 5 describes schema but lacks transaction rollback/cleanup strategy for test isolation.

**Current State**:
- Coverage Baseline: Integration tests exist but cleanup pattern unclear
- `db_enhanced.rs` and `db_enhanced_v2.rs` have no unit tests
- Foreign key constraints not mentioned in test context

**Risk Impact**:
- Test data may leak between runs (soft deletes not cleaned up)
- Concurrent tests may conflict on IDs
- Schema changes may break tests without notification

**Recommendation**:
1. Add Section 4.4.5: "Test Isolation Pattern":
   ```rust
   async fn setup_test_db() -> PgPool {
       let pool = create_pool().await;
       pool.execute("BEGIN TRANSACTION").await.unwrap();
       pool
   }

   async fn teardown_test_db(pool: PgPool) {
       pool.execute("ROLLBACK").await.unwrap();
   }
   ```

2. Document per-test isolation:
   - Each test gets transaction
   - ROLLBACK on cleanup
   - Guarantees test data isolation
   - No manual DELETE statements needed

3. Handle soft deletes:
   - Define test constants: `IS_DELETED = true` should be cleaned
   - Or: disable soft delete in test database mode

### 4. Mocking Axum Routes (MEDIUM)

**Issue**: Section 4.2 defines route structure but no guidance on unit testing routes with dependency injection.

**Current State**:
- Coverage Baseline: `routes/provenance.rs`, `routes/taxonomy.rs` untested
- No examples of mocking AppState dependencies
- Error path testing unclear (how to inject database errors?)

**Risk Impact**:
- Route logic validated only via integration tests (slow)
- Database error handling paths untested
- Middleware behavior (CORS, logging) verification unclear

**Recommendation**:
1. Add Section 4.2.5: "Unit Testing Routes"
   ```rust
   // Example: test notes route with mock DB
   #[tokio::test]
   async fn test_create_note_route() {
       let mock_db = MockDatabase {
           create_note_response: Ok(Note { id: "123", ... })
       };
       let state = AppState { db: Arc::new(mock_db), ... };

       let request = Request::builder()
           .method("POST")
           .uri("/api/v1/notes")
           .body(Body::from(r#"{"content":"test"}"#))
           .build()
           .unwrap();

       let response = handle_create_note(request, state).await;
       assert_eq!(response.status(), StatusCode::CREATED);
   }
   ```

2. Define error injection pattern:
   - MockDatabase returns configurable errors
   - Test 500, 404, 409 response codes
   - Validate error JSON format (Section 4.2.4)

### 5. Concurrent Operation Testing (MEDIUM)

**Issue**: Architecture mentions async/await extensively but provides no guidance on testing concurrent scenarios.

**Current State**:
- 19 concurrent tasks mentioned (job queue) but no race condition tests
- Multiple job types (embedding, revision, linking) may conflict
- No mention of tokio::task::spawn_blocking scenarios

**Risk Impact**:
- Race conditions discoverable only in production under load
- Job queue concurrency bugs (duplicate processing, lost jobs)
- Database constraint violations under concurrent load

**Recommendation**:
1. Add Section 9.5: "Concurrent Operation Testing"
   ```rust
   #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
   async fn test_concurrent_note_creation() {
       let handles: Vec<_> = (0..10)
           .map(|i| {
               let db = db.clone();
               tokio::spawn(async move {
                   db.create_note(format!("Note {}", i)).await
               })
           })
           .collect();

       let results = futures::future::join_all(handles).await;
       assert_eq!(results.len(), 10);

       // Verify all notes exist in database
       let count = db.count_notes().await.unwrap();
       assert_eq!(count, 10);
   }
   ```

2. Define job concurrency tests:
   - 10 simultaneous notes created → verify 10 embedding jobs queued
   - 2 jobs update same note → verify no data corruption
   - Job 1 fails mid-process → verify job 2 can still complete

---

## Recommendations

### Immediate Actions (Before Elaboration Complete)

1. **Ollama Mock Documentation** (1-2 hours)
   - Add Section 4.5.3 "Testing" subsection
   - Provide 2-3 code examples of mock implementations
   - Link to test fixtures in Coverage Baseline

2. **WebSocket Test Strategy** (2-3 hours)
   - Create Section 4.6.3 with testing patterns
   - Define multi-client broadcast test scenario
   - Add frontend + backend WebSocket integration example

3. **Database Isolation Pattern** (1-2 hours)
   - Document transaction rollback approach in Section 4.4.5
   - Provide test helper function signatures
   - Address soft delete cleanup

**Effort**: 4-7 hours total | **Impact**: Unblocks 40% of remaining test coverage gap

### Short-term (Week 1 of Construction)

4. **Route Unit Testing Guide** (1-2 hours)
   - Add Section 4.2.5 with dependency injection examples
   - Define MockDatabase trait for unit tests
   - Provide error injection patterns

5. **Concurrent Testing Framework** (2-3 hours)
   - Add Section 9.5 with tokio multi-threaded test examples
   - Define job concurrency test suite template
   - Document race condition verification approach

**Effort**: 3-5 hours | **Impact**: Enables unit test acceleration, reduces integration test load

### Ongoing (Throughout Construction)

6. **Coverage Monitoring**
   - Measure backend coverage with `cargo-tarpaulin` (see Coverage Baseline recommendation)
   - Gate PR merges at 60%+ line coverage for modified files
   - Track trends weekly

7. **Test Isolation Validation**
   - Run test suite with `--test-threads=1` (sequential) and `--test-threads=NUM_CPU` (parallel)
   - Verify results identical (indicates no shared state)
   - Add CI job to catch isolation regressions

---

## Detailed Validation Against Checklist

### 1. Component Boundaries Enable Unit Testing

**Status**: PASS (with notes)

- **Ollama Integration**: Encapsulated in `ollama.rs` with async methods ✓
- **Database Layer**: SQLx abstraction in `db.rs`, `db_enhanced.rs` ✓
- **Route Handlers**: Stateless functions accepting `AppState` ✓
- **React Components**: Each component importable and testable in isolation ✓

**Qualification**: Boundaries are well-defined but testing patterns underdocumented. Recommend adding Section 4.4.5 (database test isolation) and 4.5.3 (Ollama mocking) with concrete examples.

### 2. API Endpoints Are Mockable

**Status**: PASS

- **REST Endpoints**: Standard HTTP methods and JSON, compatible with wiremock ✓
- **Error Format**: Consistent JSON structure (Section 4.2.4) ✓
- **CORS Middleware**: Defined for localhost (Section 4.2.3) ✓
- **WebSocket**: Protocol documented (Section 4.6.2) but testing guidance missing

**Qualification**: REST mockability is strong. WebSocket mockability requires test library selection and integration test examples (see Recommendation #2).

### 3. Database Layer Supports Test Isolation

**Status**: CONDITIONAL

- **Transaction Support**: SQLx supports async transactions ✓
- **Foreign Keys**: Schema defined but constraint testing not addressed ⚠
- **Soft Deletes**: `is_deleted` column present, but test cleanup approach absent ⚠
- **Test Database**: Separate `TEST_DATABASE_URL` environment variable ✓

**Qualification**: Foundation exists (transactions, separate test DB) but explicit isolation pattern missing. Needs Section 4.4.5 with transaction rollback examples and soft delete handling guidance.

### 4. Ollama Can Be Mocked for Testing

**Status**: CONDITIONAL

- **Interface Design**: `OllamaClient` with testable async methods ✓
- **Mocking Strategy**: `USE_MOCK_AI=true` environment variable exists but implementation unspecified ⚠
- **Deterministic Output**: No guidance on seeding mock responses ⚠
- **Error Handling**: Graceful degradation documented (Section 4.5.4) but error injection approach absent ⚠

**Qualification**: Architecture allows mocking, but mocking pattern not formalized. Needs Section 4.5.3 with mock implementations and fixtures.

### 5. WebSocket Testing Approach Defined

**Status**: FAIL (architecture needs refinement)

- **Protocol Definition**: Message types documented (Section 4.6.2) ✓
- **Client Library**: No test client library specified ✗
- **Integration Tests**: No WebSocket integration test examples ✗
- **Broadcast Testing**: Multi-client broadcast scenario not addressed ✗
- **Reconnection Testing**: No guidance on simulating disconnect/reconnect ✗

**Qualification**: Protocol is defined but testing strategy is absent. Needs new Section 4.6.3 with test framework selection, multi-client examples, and reconnection scenarios.

### 6. CI/CD Integration (Act-Based Testing)

**Status**: PASS

- **Act Compatibility**: Workflows designed for `gh act` execution ✓
- **Test Discipline**: CLAUDE.md enforces pre-push validation ✓
- **Environment Consistency**: Docker Compose and environment variables documented ✓
- **Coverage Reporting**: Vitest coverage integrated in frontend; backend coverage tooling deferred ✓
- **Coverage Gates**: No PR merge gates documented ⚠

**Qualification**: CI/CD foundation is strong. Recommend adding coverage gates (60% minimum for new code) to prevent regression. See Coverage Baseline Section 8 for implementation.

---

## Risk Assessment

### Testing-Specific Risks

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|-----------|--------|
| **WebSocket race conditions unrevealed until production** | HIGH | HIGH | Add multi-client concurrent tests, tokio stress testing | SEE REC #2 |
| **Ollama mocking non-deterministic, tests flaky** | MEDIUM | HIGH | Define mock fixtures and seeding strategy | SEE REC #1 |
| **Database test isolation breaks under parallel execution** | MEDIUM | MEDIUM | Document transaction rollback pattern, add --test-threads validation | SEE REC #3 |
| **Route error paths untested, 500 errors propagate** | MEDIUM | MEDIUM | Add error injection patterns for unit tests | SEE REC #4 |
| **Concurrent job processing creates data corruption** | MEDIUM | HIGH | Add job concurrency test suite | SEE REC #5 |

### Testability Gaps by Severity

**CRITICAL** (Blocking Coverage Target):
1. WebSocket testing undefined (blocks real-time feature validation)
2. Ollama mock strategy undocumented (blocks AI pipeline testing)

**HIGH** (Slowing Test Development):
3. Database test isolation pattern missing (requires workarounds)
4. Route unit testing guidance absent (forces integration test dependency)

**MEDIUM** (Edge Cases Uncovered):
5. Concurrent operation testing framework missing (race conditions possible)

---

## Coverage Baseline Alignment

The Testability Review validates coverage targets in the baseline report:

| Area | Baseline Status | Testability Assessment |
|------|-----------------|------------------------|
| **Frontend 33.48%** | MEASURED | Gaps are component tests (MarkdownEditor, SearchDropdown), WebSocket service, not architecture |
| **Backend 17.5%** | ESTIMATED | Gaps are route coverage (provenance, taxonomy, jobs), job_queue unit tests, ollama client tests |
| **Critical Paths** | IDENTIFIED | Architecture well-positioned for critical path testing; barriers are mocking/isolation patterns |

**Conclusion**: Architecture is NOT the bottleneck for 60% coverage. The barrier is test pattern documentation and WebSocket/concurrency testing approach. Recommend proceeding with Coverage Baseline Phase 1 & 2 roadmaps while implementing Recommendations #1-2 in parallel.

---

## Architecture Decision Implications

### ADR-001: Client-Server Architecture
**Testability Implication**: POSITIVE

- Enables independent testing of Tauri UI (React) and Axum API
- Database and Ollama tested separately from both frontend and backend
- Clear contract (HTTP + WebSocket) enables mock implementation

### ADR-002: Greenfield Database Schema Rebuild
**Testability Implication**: POSITIVE

- Fast database reset (< 2 seconds) enables test iterations
- Allows clean state for each test without cleanup burden
- Conflicts with transaction rollback pattern (see Recommendation #3)

**Recommendation**: Support both approaches:
1. Integration tests: Use transaction rollback per test (no cleanup, parallel safe)
2. Manual testing: Use clean schema rebuild (developer convenience)

---

## Approval Conditions

This architecture is **CONDITIONALLY APPROVED** for construction with the following requirements:

### Pre-Construction (Next 1 Week)
- [ ] Implement Recommendations #1-2 (Ollama mocking, WebSocket testing)
- [ ] Add Section 4.4.5 (Database test isolation) and 4.5.3 (Ollama testing) to SAD
- [ ] Obtain architecture designer sign-off on testing sections

### During Construction (Ongoing)
- [ ] Measure backend coverage with `cargo-tarpaulin` before week 2
- [ ] Ensure WebSocket integration tests written before WebSocket feature merged
- [ ] Validate database isolation with parallel test runs weekly

### Pre-MVP Gate (Before 60% coverage achieved)
- [ ] All CRITICAL gaps (WebSocket, Ollama mocking) resolved
- [ ] Route unit testing guide implemented
- [ ] Job concurrency test suite defined

---

## Conclusion

**Overall Assessment**: The HotM architecture provides a **strong foundation for testing** with clear component isolation, mockable external interfaces, and established CI/CD discipline. The five identified gaps are **resolvable through documentation and pattern definition** rather than architectural changes.

**Key Strengths**:
- Component isolation enables independent testing
- Graceful degradation supports negative test cases
- Act-based CI/CD ensures test consistency
- Job queue persistence enables deterministic testing

**Key Gaps**:
- WebSocket testing strategy undefined
- Ollama mocking approach undocumented
- Database test isolation pattern missing
- Route unit testing guidance absent
- Concurrent operation testing framework missing

**Recommendation**: **PROCEED WITH CONSTRUCTION** using conditional approval, implementing Recommendations #1-2 (Critical) immediately and #3-5 (High) during first week of construction.

**Test Architect Sign-Off**: Approved for elaboration phase with mandatory refinement of Sections 4.4.5, 4.5.3, and 4.6.3 before construction begins.

---

## Next Steps

1. **Architecture Designer**: Review testability gaps and implement Recommendations #1-2
2. **Test Engineer**: Design WebSocket test framework using tokio-tungstenite or similar
3. **Backend Developer**: Prototype Ollama mock fixtures with deterministic seeding
4. **QA Lead**: Establish coverage gate configuration (60% minimum for main branch)
5. **All**: Execute Coverage Baseline Phase 1 & 2 per documented roadmap

---

**Review Document**: `/home/manitcor/dev/hotm/.aiwg/working/architecture/sad/reviews/test-architect-review.md`
**Related Documents**:
- SAD Draft: `/home/manitcor/dev/hotm/.aiwg/working/architecture/sad/drafts/v0.1-primary-draft.md`
- Coverage Baseline: `/home/manitcor/dev/hotm/.aiwg/testing/coverage-baseline.md`
- CLAUDE.md: `/home/manitcor/dev/hotm/CLAUDE.md`
