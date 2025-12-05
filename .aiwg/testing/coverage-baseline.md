# HotM Test Coverage Baseline Report

**Date**: 2025-12-04
**Phase**: Inception
**Target Coverage**: 60% for MVP Gate Check
**Project Version**: 0.1.2

---

## Executive Summary

HotM currently has **partial test coverage** with a functional test infrastructure in place for both backend (Rust) and frontend (React/TypeScript). Both now have measured coverage baselines.

**Key Findings:**
- Frontend: 33.48% line coverage (measured via Vitest + v8)
- Backend: **9.91% line coverage** (measured via cargo-tarpaulin 2025-12-04)
- CI/CD: Fully integrated with GitHub Actions (act-compatible)
- Test frameworks: Properly configured and operational
- Test database infrastructure: Docker-based with greenfield schema support

**Gap to 60% Target:**
- Frontend needs: +26.52% coverage
- Backend needs: **+50.09% coverage**
- Priority areas identified below

---

## 1. Current Test Infrastructure

### Test Frameworks

**Backend (Rust/Axum)**
- Framework: Native Rust `#[tokio::test]` with `tower` utilities
- Test Dependencies:
  - `tokio-test` v0.4 - Async runtime testing
  - `tower` v0.4 - Service testing utilities
  - `hyper` v1.0 - HTTP testing
  - `wiremock` v0.6 - HTTP mocking
  - `fake` v2.9 - Test data generation
  - `rstest` v0.18 - Parameterized tests
  - `reqwest` v0.12 - HTTP client testing

**Frontend (React/TypeScript)**
- Framework: Vitest v1.0 with Testing Library
- Test Dependencies:
  - `vitest` v1.0 - Test runner and assertions
  - `@vitest/coverage-v8` v1.6.1 - Coverage reporting
  - `@vitest/ui` v1.0 - Visual test UI
  - `@testing-library/react` v16.1.0 - Component testing
  - `@testing-library/jest-dom` v6.0 - Custom matchers
  - `@testing-library/user-event` v14.0 - User interaction simulation
  - `jsdom` v23.0 - DOM environment

### CI/CD Configuration

**GitHub Actions Workflows:**
1. `/home/manitcor/dev/hotm/.github/workflows/backend-tests.yml`
   - Triggers: Push to main/develop, PRs to main
   - Services: PostgreSQL with pgvector (pg16)
   - Steps: Clippy, Tests, Formatting, Security Audit
   - Environment: Uses `TEST_DATABASE_URL`, `USE_MOCK_AI=true`

2. `/home/manitcor/dev/hotm/.github/workflows/frontend-tests.yml`
   - Triggers: Push to main/develop, PRs to main
   - Steps: Type check, Tests, Coverage, Security Audit
   - Coverage: Generated and reported via Vitest

**Local Testing (Act):**
- `gh act -j backend-tests` - Full backend validation
- `gh act -j frontend-tests` - Full frontend validation
- SQLX offline mode: `SQLX_OFFLINE=true` for compile-time checks

---

## 2. Backend Test Analysis

### Test Files (10 files, 922 lines)

**Integration Tests:**
1. `/home/manitcor/dev/hotm/server/tests/integration.rs` - Core DB operations
2. `/home/manitcor/dev/hotm/server/tests/search_hybrid.rs` - Hybrid search functionality
3. `/home/manitcor/dev/hotm/server/tests/search_tests.rs` - Search endpoint tests
4. `/home/manitcor/dev/hotm/server/tests/taxonomy_links.rs` - Tags and links
5. `/home/manitcor/dev/hotm/server/tests/test_ai_pipeline.rs` - AI pipeline testing

**API Tests:**
1. `/home/manitcor/dev/hotm/server/tests/api/notes_test.rs` (221 lines)
   - Tests: create, get, update status, delete, list, regenerate AI
   - Coverage: Full CRUD operations for notes

2. `/home/manitcor/dev/hotm/server/tests/api/search_test.rs`
   - Tests: Search endpoint validation

3. `/home/manitcor/dev/hotm/server/tests/api/links_test.rs`
   - Tests: Note linking functionality

**Test Utilities:**
1. `/home/manitcor/dev/hotm/server/tests/common/mod.rs` - Test helpers
2. `/home/manitcor/dev/hotm/server/tests/common/fixtures.rs` - Test data

### Source Files (19 files, 5,273 lines)

**Core Modules:**
1. `/home/manitcor/dev/hotm/server/src/main.rs` - Server entry point
2. `/home/manitcor/dev/hotm/server/src/lib.rs` - Library exports
3. `/home/manitcor/dev/hotm/server/src/models.rs` - Data models
4. `/home/manitcor/dev/hotm/server/src/db.rs` - Database layer
5. `/home/manitcor/dev/hotm/server/src/db_enhanced.rs` - Enhanced DB operations
6. `/home/manitcor/dev/hotm/server/src/db_enhanced_v2.rs` - DB v2 operations
7. `/home/manitcor/dev/hotm/server/src/job_queue.rs` - Background job queue
8. `/home/manitcor/dev/hotm/server/src/ollama.rs` - Ollama client
9. `/home/manitcor/dev/hotm/server/src/websocket.rs` - WebSocket server

**Route Handlers (10 files):**
1. `/home/manitcor/dev/hotm/server/src/routes/mod.rs` - Route module
2. `/home/manitcor/dev/hotm/server/src/routes/notes.rs` - Notes API
3. `/home/manitcor/dev/hotm/server/src/routes/search.rs` - Search API
4. `/home/manitcor/dev/hotm/server/src/routes/links.rs` - Links API
5. `/home/manitcor/dev/hotm/server/src/routes/taxonomy.rs` - Tags/collections API
6. `/home/manitcor/dev/hotm/server/src/routes/provenance.rs` - Revision history API
7. `/home/manitcor/dev/hotm/server/src/routes/health.rs` - Health check
8. `/home/manitcor/dev/hotm/server/src/routes/jobs.rs` - Job queue API
9. `/home/manitcor/dev/hotm/server/src/routes/debug.rs` - Debug endpoints
10. `/home/manitcor/dev/hotm/server/src/routes/tests.rs` - Test routes

### Measured Backend Coverage: 9.91%

**Coverage Measurement (cargo-tarpaulin, 2025-12-04):**
- Lines covered: 175 / 1,766
- Coverage: **9.91%**
- Tool: cargo-tarpaulin with `--all-features`

**Detailed Breakdown by Module:**
| Module | Lines Covered | Total Lines | Coverage |
|--------|--------------|-------------|----------|
| `src/db.rs` | 120 | 320 | 37.5% |
| `src/routes/search.rs` | 23 | 210 | 10.9% |
| `src/ollama.rs` | 17 | 48 | 35.4% |
| `src/job_queue.rs` | 12 | 273 | 4.4% |
| `src/websocket.rs` | 3 | 31 | 9.7% |
| `src/db_enhanced.rs` | 0 | 191 | 0% |
| `src/db_enhanced_v2.rs` | 0 | 338 | 0% |
| `src/main.rs` | 0 | 59 | 0% |
| All routes | 0-23 | ~506 | ~4.5% |

**Tested Areas (Good Coverage):**
- Notes CRUD operations (create, read, update, delete, list)
- Search endpoints (hybrid, FTS, semantic)
- Basic integration tests (roundtrip operations)
- AI pipeline triggers

**Untested/Under-tested Areas (Gaps):**
- `db_enhanced.rs` - No specific unit tests
- `db_enhanced_v2.rs` - No specific unit tests
- `job_queue.rs` - No unit tests for queue logic
- `ollama.rs` - No unit tests for Ollama client
- `websocket.rs` - No WebSocket integration tests
- `routes/provenance.rs` - No provenance API tests
- `routes/taxonomy.rs` - Minimal taxonomy tests
- `routes/jobs.rs` - No job queue API tests
- `routes/debug.rs` - No debug endpoint tests
- Error handling paths across all modules
- Edge cases (empty data, malformed inputs, concurrent operations)

---

## 3. Frontend Test Analysis

### Test Files (8 files)

**Component Tests:**
1. `/home/manitcor/dev/hotm/ui/src/components/__tests__/HallOfMind.title.test.tsx` (360 lines)
   - Tests: Title display logic, animation, workflow consistency
   - Coverage: Title generation, edge cases, error handling

2. `/home/manitcor/dev/hotm/ui/src/components/__tests__/HallOfMind.websocket.test.tsx`
   - Tests: WebSocket integration with main component

3. `/home/manitcor/dev/hotm/ui/src/components/__tests__/JobQueueIndicator.test.tsx`
   - Tests: Job queue indicator component

**UI Component Tests:**
1. `/home/manitcor/dev/hotm/ui/src/components/ui/__tests__/badge.test.tsx`
   - Coverage: 100% (badge component)

2. `/home/manitcor/dev/hotm/ui/src/components/ui/__tests__/button.test.tsx`
   - Coverage: 100% (button component)

**Service Tests:**
1. `/home/manitcor/dev/hotm/ui/src/services/__tests__/api.test.ts` (283 lines)
   - Tests: API client methods (health, create, search, error handling)
   - Coverage: 64.34% of api.ts

**Hook Tests:**
1. `/home/manitcor/dev/hotm/ui/src/hooks/__tests__/use-mobile.test.ts`
   - Coverage: 100% (use-mobile hook)

**Test Utilities:**
1. `/home/manitcor/dev/hotm/ui/src/components/__tests__/setup.ts`
   - Test environment configuration

### Source Files (43 files)

**Core Application:**
1. `/home/manitcor/dev/hotm/ui/src/main.tsx` - Entry point
2. `/home/manitcor/dev/hotm/ui/src/App.tsx` - App component

**Feature Components (17 files):**
1. `/home/manitcor/dev/hotm/ui/src/components/HallOfMind.tsx` - Main component
2. `/home/manitcor/dev/hotm/ui/src/components/MarkdownEditor.tsx` - Editor
3. `/home/manitcor/dev/hotm/ui/src/components/MarkdownPreview.tsx` - Preview
4. `/home/manitcor/dev/hotm/ui/src/components/MermaidRenderer.tsx` - Mermaid diagrams
5. `/home/manitcor/dev/hotm/ui/src/components/PlantUMLRenderer.tsx` - PlantUML diagrams
6. `/home/manitcor/dev/hotm/ui/src/components/JobQueueIndicator.tsx` - Job status
7. `/home/manitcor/dev/hotm/ui/src/components/JobQueueMonitor.tsx` - Job monitoring
8. `/home/manitcor/dev/hotm/ui/src/components/SearchDropdown.tsx` - Search UI
9. `/home/manitcor/dev/hotm/ui/src/components/EnhancedSearch.tsx` - Advanced search
10. `/home/manitcor/dev/hotm/ui/src/components/RelatedNotes.tsx` - Related notes
11. `/home/manitcor/dev/hotm/ui/src/components/NoteMetadata.tsx` - Note metadata
12. `/home/manitcor/dev/hotm/ui/src/components/NoteContextMenu.tsx` - Context menu
13. `/home/manitcor/dev/hotm/ui/src/components/DeleteNoteDialog.tsx` - Delete dialog
14. `/home/manitcor/dev/hotm/ui/src/components/LabelAutocomplete.tsx` - Label input
15. `/home/manitcor/dev/hotm/ui/src/components/TypingAnimation.tsx` - Typing effect (0% coverage)
16. `/home/manitcor/dev/hotm/ui/src/components/TestSidebar.tsx` - Test sidebar

**UI Components (18 files - Radix UI wrappers):**
- badge.tsx (100%), button.tsx (100%), card.tsx (67.39%)
- alert-dialog.tsx (58.99%), popover.tsx (100%), separator.tsx (100%)
- scroll-area.tsx (98.21%), textarea.tsx (100%), tooltip.tsx (100%)
- command.tsx (0%), context-menu.tsx (52.52%), dialog.tsx (0%)
- dropdown-menu.tsx (54.27%), input.tsx (28.57%), progress.tsx (46.15%)
- select.tsx (0%), sheet.tsx (18.97%), sidebar.tsx (57.32%)
- skeleton.tsx (30.76%), tabs.tsx (18.18%)

**Services (2 files):**
1. `/home/manitcor/dev/hotm/ui/src/services/api.ts` - API client (64.34% coverage)
2. `/home/manitcor/dev/hotm/ui/src/services/websocket.ts` - WebSocket client (0% coverage)

**Utilities (2 files):**
1. `/home/manitcor/dev/hotm/ui/src/lib/utils.ts` - Utility functions (100% coverage)
2. `/home/manitcor/dev/hotm/ui/src/hooks/use-mobile.ts` - Mobile detection hook (100% coverage)

### Measured Frontend Coverage: 33.48%

**Detailed Coverage Breakdown:**

| Category | Line Coverage | Branch Coverage | Function Coverage | Statement Coverage |
|----------|--------------|-----------------|-------------------|-------------------|
| **Overall** | **33.48%** | **60.88%** | **25%** | **33.48%** |
| Components | 27.02% | 57.51% | 23.07% | 27.02% |
| UI Components | 47.94% | 68% | 40.9% | 47.94% |
| Services | 39.4% | 88.88% | 13.79% | 39.4% |
| Hooks | 100% | 100% | 100% | 100% |
| Utils | 100% | 100% | 100% | 100% |

**High Coverage Components (>80%):**
- `badge.tsx` - 100%
- `button.tsx` - 100%
- `popover.tsx` - 100%
- `separator.tsx` - 100%
- `scroll-area.tsx` - 98.21%
- `textarea.tsx` - 100%
- `tooltip.tsx` - 100%
- `use-mobile.ts` - 100%
- `utils.ts` - 100%

**Medium Coverage (40-79%):**
- `api.ts` - 64.34%
- `card.tsx` - 67.39%
- `sidebar.tsx` - 57.32%
- `alert-dialog.tsx` - 58.99%
- `dropdown-menu.tsx` - 54.27%
- `context-menu.tsx` - 52.52%
- `progress.tsx` - 46.15%

**Low Coverage (<40%):**
- **Major Components:**
  - `HallOfMind.tsx` - ~30% (estimated from tests)
  - `TypingAnimation.tsx` - 0%
  - `MarkdownEditor.tsx` - 0%
  - `MarkdownPreview.tsx` - 0%
  - `MermaidRenderer.tsx` - 0%
  - `PlantUMLRenderer.tsx` - 0%
  - `JobQueueMonitor.tsx` - 0%
  - `SearchDropdown.tsx` - 0%
  - `EnhancedSearch.tsx` - 0%
  - `RelatedNotes.tsx` - 0%
  - `NoteMetadata.tsx` - 0%
  - `NoteContextMenu.tsx` - 0%
  - `DeleteNoteDialog.tsx` - 0%
  - `LabelAutocomplete.tsx` - 0%

- **Services:**
  - `websocket.ts` - 0%

- **UI Components:**
  - `command.tsx` - 0%
  - `dialog.tsx` - 0%
  - `select.tsx` - 0%
  - `input.tsx` - 28.57%
  - `skeleton.tsx` - 30.76%
  - `tabs.tsx` - 18.18%
  - `sheet.tsx` - 18.97%

---

## 4. CI/CD Integration

### GitHub Actions Workflows

**Backend Tests (backend-tests.yml):**
```yaml
Triggers:
  - Push to main/develop (server/** paths)
  - Pull requests to main (server/** paths)

Services:
  - PostgreSQL 16 with pgvector extension (port 5434)

Steps:
  1. Checkout code
  2. Install Rust (stable, rustfmt, clippy)
  3. Cache cargo registry, index, and build artifacts
  4. Install PostgreSQL client and SQLx CLI
  5. Setup test database with migrations
  6. Run clippy (warnings as errors)
  7. Run tests (with USE_MOCK_AI=true)
  8. Check formatting
  9. Security audit (cargo-audit)

Environment:
  - DATABASE_URL: postgres://postgres:postgres@localhost:5434/hotm_test
  - TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5434
  - USE_MOCK_AI: true
  - RUST_LOG: debug
  - RUST_BACKTRACE: 1
```

**Frontend Tests (frontend-tests.yml):**
```yaml
Triggers:
  - Push to main/develop (ui/** paths)
  - Pull requests to main (ui/** paths)

Steps:
  1. Checkout code
  2. Setup Node.js 20 with npm cache
  3. Install dependencies (npm ci)
  4. Type check (npm run build)
  5. Run tests (npm test -- --run)
  6. Generate coverage (npm run test:coverage -- --run)
  7. Security audit (npm audit --audit-level high)
```

### Act Compatibility

**Local Execution:**
```bash
# Backend tests (authoritative standard)
gh act -j backend-tests

# Frontend tests (authoritative standard)
gh act -j frontend-tests

# Quick local iteration (not comprehensive)
cd server && cargo test
cd ui && npm test -- --run
```

**Test Discipline:**
- Act tests are the SINGLE SOURCE OF TRUTH
- No exceptions - even for "simple" fixes
- All tests must pass before pushing to GitHub
- Exit code 0 and all tests passing required

---

## 5. Gap Analysis and Recommendations

### Overall Coverage Gap

| Area | Current | Target | Gap | Priority |
|------|---------|--------|-----|----------|
| **Frontend** | 33.48% | 60% | +26.52% | HIGH |
| **Backend** | **9.91%** | 60% | **+50.09%** | CRITICAL |

### Frontend Priority Areas (26.52% needed)

**CRITICAL (Focus for 60% target):**
1. **Core Services** (+35% impact):
   - `websocket.ts` (0% → 80%): WebSocket connection, message handling, reconnection logic
   - Complete `api.ts` (64.34% → 90%): Missing edge cases, error scenarios

2. **Major Components** (+30% impact):
   - `HallOfMind.tsx` (30% → 80%): Main component logic, state management
   - `MarkdownEditor.tsx` (0% → 70%): Editor functionality, content handling
   - `MarkdownPreview.tsx` (0% → 70%): Rendering, code highlighting

3. **Feature Components** (+15% impact):
   - `SearchDropdown.tsx` (0% → 60%): Search UI interactions
   - `JobQueueMonitor.tsx` (0% → 60%): Queue status display
   - `NoteContextMenu.tsx` (0% → 60%): Context menu actions

**MEDIUM (Post-60% target):**
4. **Rendering Components**:
   - `MermaidRenderer.tsx` (0% → 60%)
   - `PlantUMLRenderer.tsx` (0% → 60%)
   - `TypingAnimation.tsx` (0% → 60%)

5. **UI Components**:
   - `command.tsx` (0% → 60%)
   - `dialog.tsx` (0% → 60%)
   - `select.tsx` (0% → 60%)

### Backend Priority Areas (42.5% needed)

**CRITICAL (Focus for 60% target):**
1. **Database Layer** (+15% impact):
   - `db_enhanced.rs`: Query building, transaction handling
   - `db_enhanced_v2.rs`: Enhanced operations, complex queries
   - Unit tests for database operations (mocked SQLx)

2. **Job Queue** (+10% impact):
   - `job_queue.rs`: Queue operations, job lifecycle, error handling
   - Integration tests for background processing

3. **External Services** (+8% impact):
   - `ollama.rs`: Ollama client methods, error handling, retries
   - Mock Ollama responses for deterministic testing

4. **WebSocket** (+7% impact):
   - `websocket.rs`: Connection management, broadcasting, message handling
   - WebSocket integration tests

5. **Route Coverage** (+12% impact):
   - `routes/provenance.rs`: Revision history API tests
   - `routes/taxonomy.rs`: Tags and collections API tests
   - `routes/jobs.rs`: Job queue API tests
   - Complete `routes/notes.rs` edge cases

**MEDIUM (Post-60% target):**
6. **Error Handling**:
   - Error paths across all modules
   - Invalid input handling
   - Database constraint violations

7. **Edge Cases**:
   - Concurrent operations
   - Race conditions
   - Resource exhaustion
   - Empty/null data scenarios

---

## 6. 60% Coverage Roadmap

### Phase 1: Frontend Critical Path (2-3 weeks)
**Goal: 33.48% → 60%**

**Week 1: Core Services & Main Component**
- [ ] `websocket.ts` tests (0% → 80%)
  - Connection/disconnection
  - Message sending/receiving
  - Reconnection logic
  - Error scenarios
- [ ] Complete `api.ts` tests (64.34% → 90%)
  - All API methods
  - Error handling
  - Edge cases
- [ ] `HallOfMind.tsx` tests (30% → 80%)
  - Component lifecycle
  - State management
  - User interactions
  - WebSocket integration

**Week 2: Editor & Preview**
- [ ] `MarkdownEditor.tsx` tests (0% → 70%)
  - Content editing
  - Toolbar actions
  - Auto-save logic
- [ ] `MarkdownPreview.tsx` tests (0% → 70%)
  - Markdown rendering
  - Code highlighting
  - Image handling

**Week 3: Feature Components**
- [ ] `SearchDropdown.tsx` tests (0% → 60%)
- [ ] `JobQueueMonitor.tsx` tests (0% → 60%)
- [ ] `NoteContextMenu.tsx` tests (0% → 60%)

**Expected Result: ~60-65% coverage**

### Phase 2: Backend Critical Path (3-4 weeks)
**Goal: 17.5% → 60%**

**Week 1: Database Layer**
- [ ] `db_enhanced.rs` unit tests
  - Query building
  - Transaction handling
  - Error scenarios
- [ ] `db_enhanced_v2.rs` unit tests
  - Complex operations
  - Edge cases

**Week 2: Job Queue & Services**
- [ ] `job_queue.rs` tests
  - Queue operations
  - Job lifecycle
  - Error handling
- [ ] `ollama.rs` tests
  - Client methods
  - Mock responses
  - Retry logic

**Week 3: WebSocket & Routes**
- [ ] `websocket.rs` integration tests
  - Connection management
  - Broadcasting
  - Message handling
- [ ] `routes/provenance.rs` API tests
- [ ] `routes/taxonomy.rs` API tests

**Week 4: Complete Route Coverage**
- [ ] `routes/jobs.rs` API tests
- [ ] `routes/notes.rs` edge cases
- [ ] Error handling across all routes

**Expected Result: ~60-65% coverage**

### Phase 3: Refinement & Edge Cases (1-2 weeks)
**Goal: 60% → 70%+ (stretch goal)**

- [ ] Error handling paths
- [ ] Concurrent operations
- [ ] Edge cases (empty data, malformed inputs)
- [ ] Performance tests
- [ ] Integration tests (E2E)

---

## 7. Testing Best Practices

### Backend Testing Patterns

**Unit Tests:**
```rust
#[tokio::test]
async fn test_function_name() {
    // Arrange
    let input = setup_test_data();

    // Act
    let result = function_under_test(input).await;

    // Assert
    assert_eq!(result.unwrap(), expected);
}
```

**Integration Tests with Database:**
```rust
#[tokio::test]
async fn test_api_endpoint() {
    let db_url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set");
    let (broadcaster, _) = create_broadcaster();
    let state = AppState::connect(&db_url, broadcaster).await.unwrap();

    // Test endpoint with real database
    let app = create_test_app(state);
    let response = app.oneshot(request).await.unwrap();

    assert!(response.status().is_success());
}
```

**Mocking External Services:**
```rust
#[tokio::test]
async fn test_ollama_client() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/generate"))
        .respond_with(ResponseTemplate::new(200)
            .set_body_json(json!({ "response": "test" })))
        .mount(&mock_server)
        .await;

    // Test with mocked Ollama
}
```

### Frontend Testing Patterns

**Component Tests:**
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<ComponentName />);

    await user.click(screen.getByRole('button'));

    expect(mockFunction).toHaveBeenCalled();
  });
});
```

**API Service Tests:**
```typescript
describe('api.methodName', () => {
  it('calls endpoint with correct parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await api.methodName(params);

    expect(mockFetch).toHaveBeenCalledWith(
      'expected-url',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual(mockResponse);
  });

  it('handles errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(api.methodName(params)).rejects.toThrow('Network error');
  });
});
```

---

## 8. Coverage Monitoring

### Commands

**Frontend Coverage:**
```bash
cd ui

# Run tests with coverage
npm run test:coverage -- --run

# View coverage report
open coverage/index.html

# Watch mode for development
npm run test:coverage
```

**Backend Coverage (Future):**
```bash
cd server

# Install tarpaulin (code coverage tool)
cargo install cargo-tarpaulin

# Run tests with coverage
cargo tarpaulin --out Html --output-dir coverage

# View coverage report
open coverage/index.html
```

### Baseline Metrics (2025-12-04)

**Frontend (Measured):**
- Line Coverage: 33.48%
- Branch Coverage: 60.88%
- Function Coverage: 25%
- Statement Coverage: 33.48%

**Backend (Measured 2025-12-04):**
- Line Coverage: **9.91%** (175/1766 lines)
- Integration Tests: 5 comprehensive tests
- Unit Tests: 5 model tests
- Total Tests: 13 passing

### Success Criteria

**MVP Gate Check (60% target):**
- [ ] Frontend line coverage ≥ 60%
- [ ] Backend line coverage ≥ 60%
- [ ] All critical paths tested
- [ ] CI/CD passing (act tests)
- [ ] No known high-severity bugs in tested code

**Production Ready (stretch goal):**
- [ ] Frontend line coverage ≥ 80%
- [ ] Backend line coverage ≥ 80%
- [ ] Branch coverage ≥ 70%
- [ ] Function coverage ≥ 75%
- [ ] E2E tests for critical workflows

---

## 9. Assumptions and Limitations

### Assumptions

1. **Backend Coverage Estimation**: Backend coverage (~17.5%) is estimated based on test file line count relative to source code. Actual coverage may vary once measured with tarpaulin or similar tools.

2. **Test Quality**: Coverage percentages assume tests are meaningful and test actual behavior, not just execute code paths.

3. **Database Tests**: Backend integration tests require a PostgreSQL database with pgvector extension. Tests use `TEST_DATABASE_URL` environment variable.

4. **Mock AI**: Backend tests use `USE_MOCK_AI=true` to avoid dependency on Ollama service during testing.

5. **Act Compatibility**: All CI workflows are designed to work with `act` for local execution, maintaining parity between local and CI environments.

### Limitations

1. **No E2E Tests**: Currently no end-to-end tests using Playwright or similar frameworks. Testing is limited to unit and integration tests.

2. **Visual Testing**: No visual regression testing for UI components. Tests focus on functionality, not appearance.

3. **Performance Testing**: No load or performance tests. Current tests focus on functional correctness.

4. **Security Testing**: Limited to dependency audits via `cargo audit` and `npm audit`. No penetration testing or security-focused test cases.

5. **Accessibility Testing**: No automated accessibility tests (e.g., axe-core integration).

6. **Browser Compatibility**: Frontend tests run in jsdom, which may not catch browser-specific issues.

7. **Mobile Testing**: No mobile-specific test scenarios, despite mobile responsiveness in the UI.

---

## 10. Next Steps

### Immediate Actions (This Week)

1. **Review this baseline** with stakeholders
2. **Prioritize test coverage** areas based on business criticality
3. **Set up tarpaulin** for backend coverage measurement
4. **Create test tasks** in project board

### Short-term (2-3 weeks)

1. **Execute Phase 1** of frontend coverage roadmap
2. **Establish coverage tracking** in CI/CD (coverage badges, trends)
3. **Document test patterns** in developer guide
4. **Add coverage gates** to pull requests (prevent coverage regression)

### Medium-term (4-6 weeks)

1. **Execute Phase 2** of backend coverage roadmap
2. **Implement E2E tests** for critical workflows
3. **Add performance tests** for search and AI pipeline
4. **Reach 60% coverage target** for MVP gate check

### Long-term (Post-MVP)

1. **Expand to 80% coverage** for production readiness
2. **Add visual regression tests**
3. **Implement accessibility testing**
4. **Add security-focused test cases**

---

## Appendix A: File Inventory

### Backend Source Files (19 files)

**Core (9 files):**
- `/home/manitcor/dev/hotm/server/src/main.rs`
- `/home/manitcor/dev/hotm/server/src/lib.rs`
- `/home/manitcor/dev/hotm/server/src/models.rs`
- `/home/manitcor/dev/hotm/server/src/db.rs`
- `/home/manitcor/dev/hotm/server/src/db_enhanced.rs`
- `/home/manitcor/dev/hotm/server/src/db_enhanced_v2.rs`
- `/home/manitcor/dev/hotm/server/src/job_queue.rs`
- `/home/manitcor/dev/hotm/server/src/ollama.rs`
- `/home/manitcor/dev/hotm/server/src/websocket.rs`

**Routes (10 files):**
- `/home/manitcor/dev/hotm/server/src/routes/mod.rs`
- `/home/manitcor/dev/hotm/server/src/routes/notes.rs`
- `/home/manitcor/dev/hotm/server/src/routes/search.rs`
- `/home/manitcor/dev/hotm/server/src/routes/links.rs`
- `/home/manitcor/dev/hotm/server/src/routes/taxonomy.rs`
- `/home/manitcor/dev/hotm/server/src/routes/provenance.rs`
- `/home/manitcor/dev/hotm/server/src/routes/health.rs`
- `/home/manitcor/dev/hotm/server/src/routes/jobs.rs`
- `/home/manitcor/dev/hotm/server/src/routes/debug.rs`
- `/home/manitcor/dev/hotm/server/src/routes/tests.rs`

### Backend Test Files (10 files)

**Integration Tests (5 files):**
- `/home/manitcor/dev/hotm/server/tests/integration.rs`
- `/home/manitcor/dev/hotm/server/tests/search_hybrid.rs`
- `/home/manitcor/dev/hotm/server/tests/search_tests.rs`
- `/home/manitcor/dev/hotm/server/tests/taxonomy_links.rs`
- `/home/manitcor/dev/hotm/server/tests/test_ai_pipeline.rs`

**API Tests (3 files):**
- `/home/manitcor/dev/hotm/server/tests/api/notes_test.rs`
- `/home/manitcor/dev/hotm/server/tests/api/search_test.rs`
- `/home/manitcor/dev/hotm/server/tests/api/links_test.rs`

**Utilities (2 files):**
- `/home/manitcor/dev/hotm/server/tests/common/mod.rs`
- `/home/manitcor/dev/hotm/server/tests/common/fixtures.rs`

### Frontend Source Files (43 files)

**Core (2 files):**
- `/home/manitcor/dev/hotm/ui/src/main.tsx`
- `/home/manitcor/dev/hotm/ui/src/App.tsx`

**Feature Components (17 files):**
- `/home/manitcor/dev/hotm/ui/src/components/HallOfMind.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/MarkdownEditor.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/MarkdownPreview.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/MermaidRenderer.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/PlantUMLRenderer.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/JobQueueIndicator.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/JobQueueMonitor.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/SearchDropdown.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/EnhancedSearch.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/RelatedNotes.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/NoteMetadata.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/NoteContextMenu.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/DeleteNoteDialog.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/LabelAutocomplete.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/TypingAnimation.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/TestSidebar.tsx`

**UI Components (18 files):**
- All files in `/home/manitcor/dev/hotm/ui/src/components/ui/`

**Services (2 files):**
- `/home/manitcor/dev/hotm/ui/src/services/api.ts`
- `/home/manitcor/dev/hotm/ui/src/services/websocket.ts`

**Utilities (2 files):**
- `/home/manitcor/dev/hotm/ui/src/lib/utils.ts`
- `/home/manitcor/dev/hotm/ui/src/hooks/use-mobile.ts`

### Frontend Test Files (8 files)

**Component Tests (3 files):**
- `/home/manitcor/dev/hotm/ui/src/components/__tests__/HallOfMind.title.test.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/__tests__/HallOfMind.websocket.test.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/__tests__/JobQueueIndicator.test.tsx`

**UI Component Tests (2 files):**
- `/home/manitcor/dev/hotm/ui/src/components/ui/__tests__/badge.test.tsx`
- `/home/manitcor/dev/hotm/ui/src/components/ui/__tests__/button.test.tsx`

**Service Tests (1 file):**
- `/home/manitcor/dev/hotm/ui/src/services/__tests__/api.test.ts`

**Hook Tests (1 file):**
- `/home/manitcor/dev/hotm/ui/src/hooks/__tests__/use-mobile.test.ts`

**Utilities (1 file):**
- `/home/manitcor/dev/hotm/ui/src/components/__tests__/setup.ts`

---

## Appendix B: CI/CD Workflow Files

1. `/home/manitcor/dev/hotm/.github/workflows/backend-tests.yml` - Backend testing workflow
2. `/home/manitcor/dev/hotm/.github/workflows/frontend-tests.yml` - Frontend testing workflow
3. `/home/manitcor/dev/hotm/.github/workflows/sdlc-gates.yml` - SDLC gate checks
4. `/home/manitcor/dev/hotm/.github/workflows/release.yml` - Release automation
5. `/home/manitcor/dev/hotm/.github/workflows/docs-link-check.yml` - Documentation validation

---

**Report Generated**: 2025-12-04
**Next Review**: After Phase 1 completion (3 weeks)
**Owner**: Development Team
**Stakeholders**: Project Lead, QA Lead, DevOps Team
