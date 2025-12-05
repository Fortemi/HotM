# Iteration Plan 002 - Feature Completion and Test Coverage

**Project**: HotM (Handbook of the Moment)
**Version**: 0.1.2 (targeting 0.2.0)
**Iteration**: 2
**Phase**: Construction
**Status**: PLANNED
**Planning Date**: 2025-12-04

---

## Executive Summary

Iteration 2 focuses on achieving MVP feature completion while aggressively closing the test coverage gap. Building on the infrastructure foundation established in Iteration 0, this iteration prioritizes frontend/backend integration, search refinements, and systematic test coverage improvement toward the 60% target.

**Key Objectives**:
1. Increase backend coverage from 9.91% to 30%+ (20% improvement)
2. Increase frontend coverage from 33.48% to 50%+ (17% improvement)
3. Complete UI integration for core workflows
4. Implement search filters and refinements
5. Address technical debt from rapid prototyping

**Team Velocity**: Full capacity (100%) - solo developer with AI agent collaboration

---

## 1. Iteration Configuration

### 1.1 Timeline

| Milestone | Date | Description |
|-----------|------|-------------|
| **Start Date** | 2025-12-09 (Monday) | Iteration kickoff |
| **Mid-Point Review** | 2025-12-16 (Monday) | Progress assessment, scope adjustment |
| **Code Freeze** | 2025-12-20 (Friday) | Final testing and Act validation |
| **End Date** | 2025-12-22 (Sunday) | Iteration review and retrospective |

**Duration**: 2 weeks (14 calendar days, 10 working days)

### 1.2 Capacity Allocation

**Available Capacity**: 10 days (100%)
**Planned Work**: 8.5 days
**Buffer**: 1.5 days (15% reserve for unknowns)

**Capacity Distribution**:
- Backend Test Coverage: 3.0 days (35%)
- Frontend Test Coverage: 2.0 days (24%)
- UI Integration: 2.0 days (24%)
- Search Refinements: 1.0 days (12%)
- Technical Debt: 0.5 days (5%)

### 1.3 Iteration Goal

> **"Achieve MVP feature completeness with 45%+ overall test coverage, enabling confident demo to early adopters."**

### 1.4 Success Criteria

**Must Have (P0)**:
- [ ] Backend line coverage ≥ 30% (20% improvement from 9.91%)
- [ ] Frontend line coverage ≥ 50% (17% improvement from 33.48%)
- [ ] All `gh act` jobs pass with zero P0 issues
- [ ] Core workflows (create, search, view) fully integrated in UI
- [ ] Search filters functional (tags, collections, date ranges)

**Should Have (P1)**:
- [ ] Combined coverage ≥ 40% (target 45%)
- [ ] WebSocket job notifications working end-to-end
- [ ] Tag management UI complete
- [ ] No commented-out code or TODO markers in main branch

**Nice to Have (P2)**:
- [ ] Backend coverage ≥ 35%
- [ ] Frontend coverage ≥ 55%
- [ ] Provenance view implemented
- [ ] Performance baseline measurements documented

---

## 2. Dependencies and Prerequisites

### 2.1 Completed in Iteration 0

✅ **Infrastructure Foundation**:
- CI/CD pipeline operational (5 workflows)
- Docker development environment configured
- Test infrastructure with Act integration
- Version management automation
- Test database manager operational

✅ **Baseline Measurements**:
- Backend coverage: 9.91% (measured via cargo-tarpaulin)
- Frontend coverage: 33.48% (measured via Vitest)
- Act validation workflows validated

### 2.2 External Dependencies

**No Blockers**:
- All required services available (PostgreSQL, Ollama)
- Development environment stable
- No pending architectural decisions

### 2.3 Assumptions

1. **Velocity Stability**: Iteration 0 completion suggests reliable development pace
2. **Test Infrastructure**: Cargo-tarpaulin and Vitest produce accurate metrics
3. **No Scope Creep**: Focus on coverage and integration, defer new features
4. **AI Agent Availability**: Claude Code available for test generation assistance

---

## 3. Work Items and Story Points

### 3.1 Backend Test Coverage (Priority: CRITICAL)

**Goal**: 9.91% → 30% (20% improvement, ~353 new lines covered)

#### Work Item 3.1.1: Database Layer Tests
**Priority**: P0 | **Estimate**: 1.5 days | **Owner**: Backend Developer

**Scope**:
- Unit tests for `db_enhanced.rs` (191 lines, currently 0% coverage)
- Unit tests for `db_enhanced_v2.rs` (338 lines, currently 0% coverage)
- Integration tests for complex queries (hybrid search, taxonomy)

**Acceptance Criteria**:
- [ ] `db_enhanced.rs` coverage ≥ 50%
- [ ] `db_enhanced_v2.rs` coverage ≥ 50%
- [ ] All database error paths tested (connection failures, constraint violations)
- [ ] Transaction rollback scenarios covered
- [ ] Act backend-tests passes

**Test Scenarios**:
- CRUD operations for notes, revisions, links, tags, collections
- Edge cases: empty results, duplicate entries, null handling
- Concurrency: simultaneous updates, optimistic locking
- Error conditions: invalid UUIDs, foreign key violations

**Deliverables**:
- `server/tests/db_enhanced_test.rs` (new file)
- `server/tests/db_enhanced_v2_test.rs` (new file)
- Updated coverage report showing module-level improvements

---

#### Work Item 3.1.2: Job Queue Tests
**Priority**: P0 | **Estimate**: 0.75 days | **Owner**: Backend Developer

**Scope**:
- Unit tests for `job_queue.rs` (273 lines, currently 4.4% coverage)
- Integration tests for background job processing
- WebSocket notification testing

**Acceptance Criteria**:
- [ ] `job_queue.rs` coverage ≥ 40%
- [ ] Job enqueue/dequeue logic tested
- [ ] Job failure retry mechanisms validated
- [ ] WebSocket integration functional

**Test Scenarios**:
- Job lifecycle: enqueue → process → complete
- Job failures: retries, max attempts, error handling
- Concurrent job processing
- WebSocket message delivery verification

**Deliverables**:
- `server/tests/job_queue_test.rs` (new file)
- `server/tests/websocket_integration_test.rs` (new file)

---

#### Work Item 3.1.3: Route Handler Tests
**Priority**: P1 | **Estimate**: 0.75 days | **Owner**: Backend Developer

**Scope**:
- Integration tests for untested routes: provenance, taxonomy, jobs, debug
- Error response validation (4xx, 5xx status codes)
- Request validation and input sanitization

**Acceptance Criteria**:
- [ ] `routes/provenance.rs` covered with integration tests
- [ ] `routes/taxonomy.rs` coverage ≥ 60%
- [ ] `routes/jobs.rs` covered with integration tests
- [ ] All routes return correct HTTP status codes for errors

**Test Scenarios**:
- Provenance API: revision history retrieval, version comparisons
- Taxonomy API: tag/collection CRUD, validation
- Jobs API: queue status, job cancellation
- Error cases: malformed JSON, missing required fields, invalid UUIDs

**Deliverables**:
- Updated `server/tests/api/` files with new test cases
- Coverage report showing route-level improvements

---

### 3.2 Frontend Test Coverage (Priority: HIGH)

**Goal**: 33.48% → 50% (17% improvement)

#### Work Item 3.2.1: Component Test Expansion
**Priority**: P0 | **Estimate**: 1.0 days | **Owner**: Frontend Developer

**Scope**:
- Test coverage for untested components (NoteEditor, SearchResults, TagManager)
- User interaction testing with Testing Library
- Edge case handling (empty states, loading states, errors)

**Acceptance Criteria**:
- [ ] `NoteEditor.tsx` coverage ≥ 70%
- [ ] `SearchResults.tsx` coverage ≥ 60%
- [ ] `TagManager.tsx` coverage ≥ 60%
- [ ] User event simulations for all interactive elements

**Test Scenarios**:
- NoteEditor: save, cancel, autosave, keyboard shortcuts
- SearchResults: empty results, pagination, result selection
- TagManager: add tag, remove tag, tag autocomplete

**Deliverables**:
- `ui/src/components/__tests__/NoteEditor.test.tsx` (new file)
- `ui/src/components/__tests__/SearchResults.test.tsx` (new file)
- `ui/src/components/__tests__/TagManager.test.tsx` (new file)

---

#### Work Item 3.2.2: Hook and Service Tests
**Priority**: P1 | **Estimate**: 0.75 days | **Owner**: Frontend Developer

**Scope**:
- Custom hooks testing (useNotes, useSearch, useWebSocket)
- API service test expansion (increase from 64.34% to 80%+)
- Error boundary testing

**Acceptance Criteria**:
- [ ] `useNotes` hook coverage ≥ 80%
- [ ] `useSearch` hook coverage ≥ 80%
- [ ] `useWebSocket` hook coverage ≥ 70%
- [ ] `api.ts` coverage ≥ 80% (up from 64.34%)

**Test Scenarios**:
- Hooks: state management, side effects, cleanup
- API service: all endpoints, error handling, retry logic
- Error boundaries: error display, recovery

**Deliverables**:
- `ui/src/hooks/__tests__/useNotes.test.ts` (new file)
- `ui/src/hooks/__tests__/useSearch.test.ts` (new file)
- `ui/src/hooks/__tests__/useWebSocket.test.ts` (new file)
- Updated `ui/src/services/__tests__/api.test.ts`

---

#### Work Item 3.2.3: Integration Test Foundation
**Priority**: P2 | **Estimate**: 0.25 days | **Owner**: Frontend Developer

**Scope**:
- Setup Playwright E2E test infrastructure (defer full tests to Iteration 3)
- Document critical user journeys for future E2E coverage
- Smoke test for basic app launch

**Acceptance Criteria**:
- [ ] Playwright installed and configured
- [ ] One smoke test passing (app launches, health check succeeds)
- [ ] E2E test plan documented for Iteration 3

**Test Scenarios**:
- Smoke test: App launches → Health check → Search input visible

**Deliverables**:
- `ui/tests/e2e/smoke.spec.ts` (new file)
- `ui/playwright.config.ts` (configuration)
- `.aiwg/testing/e2e-test-plan.md` (planning doc)

---

### 3.3 UI Integration (Priority: HIGH)

#### Work Item 3.3.1: Core Workflow Integration
**Priority**: P0 | **Estimate**: 1.5 days | **Owner**: Full Stack Developer

**Scope**:
- Complete note creation → display → edit cycle
- Search integration with filters and facets
- Tag assignment and display
- Collection organization

**Acceptance Criteria**:
- [ ] User can create note via UI, see it saved to backend
- [ ] User can search notes with filters (tags, collections, date)
- [ ] User can assign tags to notes via UI
- [ ] User can organize notes into collections

**User Stories**:
1. **As a user**, I can create a note with markdown content and see it appear in my notes list
2. **As a user**, I can search my notes and filter by tags
3. **As a user**, I can tag a note and see the tag displayed
4. **As a user**, I can group notes into collections

**Deliverables**:
- Updated `NoteEditor` component with save integration
- Updated `SearchBar` component with filter controls
- Updated `TagManager` component with backend sync
- Integration validated via manual testing and Act workflows

---

#### Work Item 3.3.2: WebSocket Job Notifications
**Priority**: P1 | **Estimate**: 0.5 days | **Owner**: Full Stack Developer

**Scope**:
- Connect frontend WebSocket client to backend job queue
- Display job progress notifications in UI
- Handle job completion and failure states

**Acceptance Criteria**:
- [ ] WebSocket connection established on app load
- [ ] Job progress displayed in `JobQueueIndicator` component
- [ ] User sees notification when AI processing completes
- [ ] Connection errors handled gracefully (reconnect logic)

**Test Scenarios**:
- Manual: Create note → AI processing starts → Progress shown → Completion notification
- Integration: WebSocket message parsing validated in tests

**Deliverables**:
- Updated `useWebSocket` hook with job queue integration
- Updated `JobQueueIndicator` component with progress display
- WebSocket integration test passing

---

### 3.4 Search Refinements (Priority: MEDIUM)

#### Work Item 3.4.1: Search Filters Implementation
**Priority**: P0 | **Estimate**: 0.75 days | **Owner**: Full Stack Developer

**Scope**:
- Backend: Add filter parameters to search endpoint (tags, collections, date ranges)
- Frontend: UI controls for filter selection
- Faceted search results with filter counts

**Acceptance Criteria**:
- [ ] Search API accepts `tags[]`, `collection_id`, `start_date`, `end_date` parameters
- [ ] UI displays filter controls in sidebar
- [ ] Search results update dynamically as filters change
- [ ] Filter counts displayed (e.g., "10 results with tag 'ai'")

**API Changes**:
```rust
// POST /api/v1/search
{
  "query": "machine learning",
  "filters": {
    "tags": ["ai", "research"],
    "collection_id": "uuid",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31"
  },
  "limit": 20
}
```

**Deliverables**:
- Updated `routes/search.rs` with filter logic
- Updated `SearchBar` component with filter UI
- Integration tests for filtered search
- Coverage: search filter paths tested

---

#### Work Item 3.4.2: Search Performance Baseline
**Priority**: P2 | **Estimate**: 0.25 days | **Owner**: Backend Developer

**Scope**:
- Measure search performance with 100-note corpus
- Document baseline metrics for future optimization
- Identify slow queries with EXPLAIN ANALYZE

**Acceptance Criteria**:
- [ ] Hybrid search P95 latency measured and documented
- [ ] FTS search P95 latency measured and documented
- [ ] Semantic search P95 latency measured and documented
- [ ] Slow queries identified and documented for Iteration 3

**Deliverables**:
- `.aiwg/testing/search-performance-baseline.md` (new document)
- Scripts for performance measurement

---

### 3.5 Technical Debt (Priority: LOW)

#### Work Item 3.5.1: Code Cleanup
**Priority**: P1 | **Estimate**: 0.5 days | **Owner**: Full Stack Developer

**Scope**:
- Remove commented-out code from rapid prototyping
- Remove TODO markers or convert to GitHub issues
- Update inline documentation for complex logic
- Clean up unused imports and dead code

**Acceptance Criteria**:
- [ ] Zero commented-out code blocks in `server/src/`
- [ ] Zero TODO comments in `server/src/` and `ui/src/`
- [ ] Clippy warnings = 0 (already enforced in CI)
- [ ] ESLint warnings = 0 (already enforced in CI)

**Tools**:
- Manual review + global search for `// TODO`, `/* TODO */`, `// FIXME`
- Clippy for Rust dead code detection
- ESLint for TypeScript unused imports

**Deliverables**:
- Cleaned codebase with zero technical debt markers
- GitHub issues created for deferred work (tagged `tech-debt`)

---

## 4. Risk Register

### 4.1 High-Priority Risks

#### Risk 001: Coverage Target Not Achievable
**Probability**: Medium | **Impact**: High | **Status**: OPEN

**Description**: Backend coverage gap (9.91% → 30%) requires 20% improvement in 3 days, which may be overly aggressive.

**Mitigation**:
- Prioritize high-value modules (db_enhanced, job_queue) for maximum coverage impact
- Use AI agent (Claude Code) for test generation assistance
- Accept 25% backend coverage if 30% proves unrealistic (re-evaluate at mid-point)

**Fallback**:
- If 30% unreachable, adjust target to 25% backend, 45% frontend (40% combined)

---

#### Risk 002: UI Integration Complexity
**Probability**: Medium | **Impact**: Medium | **Status**: OPEN

**Description**: Frontend/backend integration may reveal API design issues requiring refactoring.

**Mitigation**:
- Start UI integration early in iteration (Day 1-2) to identify issues quickly
- Allocate buffer time (0.5 days) for unexpected API adjustments
- Defer complex UI features (provenance view) to Iteration 3 if needed

**Owner**: Project Manager

---

#### Risk 003: WebSocket Integration Issues
**Probability**: Low | **Impact**: Medium | **Status**: OPEN

**Description**: WebSocket connection stability may require additional debugging time.

**Mitigation**:
- Use existing WebSocket test infrastructure from Iteration 0
- Implement robust reconnection logic with exponential backoff
- Downgrade to P2 if blocking other work (defer to Iteration 3)

**Owner**: Backend Developer

---

### 4.2 Medium-Priority Risks

#### Risk 004: Test Flakiness
**Probability**: Low | **Impact**: Medium | **Status**: MONITORING

**Description**: Async tests may exhibit non-deterministic failures.

**Mitigation**:
- Use proper async test utilities (tokio-test, Testing Library waitFor)
- Avoid fixed timeouts in tests (use event-driven waits)
- Isolate database state between tests (transactions or cleanup)

**Owner**: Test Architect

---

#### Risk 005: Scope Creep
**Probability**: Medium | **Impact**: Low | **Status**: MONITORING

**Description**: Temptation to add new features during UI integration.

**Mitigation**:
- Strict adherence to iteration plan (no unplanned features)
- Defer new ideas to backlog for Iteration 3+
- Daily check-in to review scope adherence

**Owner**: Project Manager

---

## 5. Testing Strategy

### 5.1 Coverage Measurement

**Backend**:
- Tool: `cargo tarpaulin --all-features --out Html --output-dir coverage`
- Baseline: 9.91% (175/1,766 lines)
- Target: 30% (530/1,766 lines)
- Measurement frequency: Daily during iteration

**Frontend**:
- Tool: `npm run test:coverage -- --run` (Vitest + v8)
- Baseline: 33.48%
- Target: 50%
- Measurement frequency: Daily during iteration

**Tracking**:
- Daily coverage reports committed to `.aiwg/testing/coverage-daily/YYYY-MM-DD.md`
- Mid-point review compares progress to plan

### 5.2 Test Quality Gates

**All work items must pass**:
1. Local tests: `cd server && cargo test` AND `cd ui && npm test -- --run`
2. Act validation: `gh act -j backend-tests` AND `gh act -j frontend-tests`
3. Coverage non-regression: New code does not decrease overall coverage
4. Code quality: Clippy clean, ESLint clean, no TODOs

**Pre-commit checklist** (enforced via developer discipline):
```bash
# 1. Local test validation
cd server && cargo test
cd ui && npm test -- --run

# 2. Full Act validation
gh act -j backend-tests
gh act -j frontend-tests

# 3. Coverage check
cd ui && npm run test:coverage -- --run
# Verify no decrease from previous run

# 4. Code quality
cd server && cargo clippy -- -D warnings
cd ui && npm run lint
```

### 5.3 Test Organization

**Backend Test Structure** (after iteration):
```
server/tests/
├── api/
│   ├── notes_test.rs         # Existing (enhanced)
│   ├── search_test.rs         # Existing (enhanced)
│   ├── links_test.rs          # Existing (enhanced)
│   ├── provenance_test.rs     # NEW
│   ├── taxonomy_test.rs       # NEW
│   └── jobs_test.rs           # NEW
├── db_enhanced_test.rs        # NEW
├── db_enhanced_v2_test.rs     # NEW
├── job_queue_test.rs          # NEW
├── websocket_integration_test.rs # NEW
└── common/                    # Existing
```

**Frontend Test Structure** (after iteration):
```
ui/src/
├── components/__tests__/
│   ├── NoteEditor.test.tsx         # NEW
│   ├── SearchResults.test.tsx      # NEW
│   ├── TagManager.test.tsx         # NEW
│   ├── HallOfMind.title.test.tsx   # Existing
│   ├── HallOfMind.websocket.test.tsx # Existing
│   └── ...
├── hooks/__tests__/
│   ├── useNotes.test.ts            # NEW
│   ├── useSearch.test.ts           # NEW
│   ├── useWebSocket.test.ts        # NEW
│   └── use-mobile.test.ts          # Existing
├── services/__tests__/
│   └── api.test.ts                 # Existing (enhanced)
└── tests/e2e/
    └── smoke.spec.ts               # NEW
```

---

## 6. Definition of Done (Iteration 2)

### 6.1 Work Item Level DoD

**Each work item is complete when**:

1. **Functionality**:
   - [ ] All acceptance criteria met and verified
   - [ ] Manual testing completed (where applicable)
   - [ ] Integration validated with dependent components

2. **Testing**:
   - [ ] Unit tests written and passing
   - [ ] Integration tests written and passing (where applicable)
   - [ ] Coverage target met for module/component
   - [ ] Act validation passes: `gh act -j backend-tests` AND `gh act -j frontend-tests`

3. **Code Quality**:
   - [ ] No clippy warnings (backend)
   - [ ] No ESLint warnings (frontend)
   - [ ] No commented-out code
   - [ ] No TODO markers (converted to GitHub issues)
   - [ ] Code reviewed (self-review or AI pair review)

4. **Documentation**:
   - [ ] Inline comments for complex logic
   - [ ] API changes documented in `docs/specifications/api-specification.md`
   - [ ] CLAUDE.md updated if development process changed

5. **Integration**:
   - [ ] Changes merged to main branch
   - [ ] Commit message follows convention (feat/fix/test/refactor)
   - [ ] No secrets committed (pre-commit check)

### 6.2 Iteration Level DoD

**Iteration 2 is complete when**:

1. **Coverage Targets**:
   - [ ] Backend coverage ≥ 30% (measured via cargo-tarpaulin)
   - [ ] Frontend coverage ≥ 50% (measured via Vitest)
   - [ ] Combined coverage ≥ 40%

2. **Feature Completion**:
   - [ ] All P0 work items completed and verified
   - [ ] Core workflows (create, search, tag) functional end-to-end
   - [ ] Search filters implemented and tested

3. **Quality Gates**:
   - [ ] All Act jobs pass: `gh act -j backend-tests` AND `gh act -j frontend-tests`
   - [ ] Zero P0 issues open
   - [ ] Zero technical debt markers in codebase

4. **Documentation**:
   - [ ] Iteration status report created (`.aiwg/reports/iteration-2-completion.md`)
   - [ ] Coverage report committed (`.aiwg/testing/coverage-baseline-iteration-2.md`)
   - [ ] Retrospective completed (`.aiwg/planning/iteration-2-retrospective.md`)

5. **Release Readiness**:
   - [ ] Version bumped to 0.2.0 (if appropriate)
   - [ ] Changelog updated with iteration changes
   - [ ] Demo prepared for early adopter feedback

---

## 7. Communication and Ceremonies

### 7.1 Daily Check-In (Solo Developer Mode)

**Frequency**: Daily (5-10 minutes)
**Purpose**: Track progress, identify blockers, adjust plan

**Checklist**:
- [ ] Review yesterday's progress
- [ ] Update iteration tracking document
- [ ] Check coverage trend (weekly)
- [ ] Identify blockers or risks
- [ ] Plan today's focus area

**Tracking Location**: `.aiwg/planning/iteration-2-daily-log.md`

**Daily Log Format**:
```markdown
### Day 1 (2025-12-09)
- Completed: Database layer test setup, fixtures created
- In Progress: db_enhanced.rs unit tests (50% complete)
- Coverage: Backend 12.5% (+2.59% from baseline)
- Blocked: None
- Plan: Continue db_enhanced.rs tests, target 50% module coverage

### Day 2 (2025-12-10)
[...]
```

### 7.2 Mid-Iteration Review (Day 5)

**Date**: 2025-12-16 (Monday)
**Duration**: 30 minutes
**Purpose**: Course correction, scope adjustment

**Agenda**:
1. Review coverage progress vs. targets
2. Assess P0/P1 work item completion
3. Identify at-risk deliverables
4. Adjust scope if needed (move P2 items to Iteration 3)
5. Update risk register

**Output**: Updated iteration plan with scope adjustments (if needed)

### 7.3 Iteration Review (Day 10)

**Date**: 2025-12-22 (Sunday)
**Duration**: 1 hour
**Purpose**: Demo completed work, validate acceptance criteria

**Agenda**:
1. Demo core workflows (create → search → tag → view)
2. Review coverage reports (backend, frontend, combined)
3. Verify all P0 acceptance criteria met
4. Document known issues for Iteration 3
5. Create iteration status report

**Output**: `.aiwg/reports/iteration-2-completion.md`

### 7.4 Retrospective (Day 10)

**Date**: 2025-12-22 (Sunday)
**Duration**: 30 minutes
**Purpose**: Process improvements, lessons learned

**Questions**:
1. What went well this iteration?
2. What didn't go well?
3. What should we change for Iteration 3?
4. Any process friction to document?

**Output**: `.aiwg/planning/iteration-2-retrospective.md`

---

## 8. Dependencies on Iteration 1

**Note**: This plan assumes Iteration 1 focused on establishing baseline velocity and validating steel threads. If Iteration 1 has not been completed, the following dependencies should be validated:

### 8.1 Expected from Iteration 1

1. **Velocity Baseline**: Estimated vs. actual time for similar work items
2. **Steel Thread Validation**: End-to-end workflow proven (create → store → retrieve → display)
3. **Test Infrastructure**: All test frameworks operational (validated in Iteration 0)
4. **Technical Debt**: No blocking issues carried over from Iteration 1

### 8.2 Adjustments if Iteration 1 Not Completed

If this is actually the **first construction iteration** (Iteration 0 was infrastructure):
- Treat this as Iteration 1 with conservative estimates
- Reduce coverage targets to 25% backend, 45% frontend (35% combined)
- Increase buffer to 20% (2 days) to account for unknowns
- Defer P2 work items to Iteration 2

---

## 9. Metrics and KPIs

### 9.1 Coverage Metrics (Primary KPI)

**Measurement Frequency**: Daily

| Metric | Baseline | Target | Stretch Goal |
|--------|----------|--------|--------------|
| Backend Line Coverage | 9.91% | 30% | 35% |
| Frontend Line Coverage | 33.48% | 50% | 55% |
| Combined Coverage | ~25% | 40% | 45% |

**Tracking**:
- Daily coverage reports committed to `.aiwg/testing/coverage-daily/`
- Trend chart generated at mid-point and end of iteration

### 9.2 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| P0 Issues | 0 | Manual tracking in GitHub Issues |
| P1 Issues | ≤ 3 | Manual tracking in GitHub Issues |
| Act Test Pass Rate | 100% | Automated in CI/CD |
| Clippy Warnings | 0 | Automated in CI/CD |
| ESLint Warnings | 0 | Automated in CI/CD |

### 9.3 Velocity Metrics

**Planned vs. Actual**:
- Planned days: 8.5 days
- Actual days: TBD (measured at iteration end)
- Velocity ratio: Actual/Planned (target 80-100%)

**Work Item Completion**:
- P0 items completed: Target 100%
- P1 items completed: Target ≥ 80%
- P2 items completed: Best effort

### 9.4 Technical Debt Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| TODO comments | TBD (count via grep) | 0 |
| Commented-out code blocks | TBD (manual review) | 0 |
| GitHub issues tagged `tech-debt` | 0 | ≤ 5 (deferred work) |

---

## 10. Tools and Resources

### 10.1 Development Tools

**Backend**:
- Rust 1.70+ (rustup)
- cargo-tarpaulin (coverage)
- cargo-clippy (linting)
- PostgreSQL 16 + pgvector
- Ollama (local AI)

**Frontend**:
- Node.js 20+
- Vitest (testing + coverage)
- Testing Library (component testing)
- Playwright (E2E setup)

**CI/CD**:
- GitHub Actions (5 workflows)
- Act (local validation)
- Docker (development environment)

### 10.2 AI Agent Collaboration

**Claude Code (Project Manager Mode)**:
- Test generation assistance
- Code review and refactoring suggestions
- Documentation updates
- Coverage gap analysis

**Usage Pattern**:
```
Prompt: "Generate unit tests for db_enhanced.rs covering CRUD operations,
error handling, and edge cases. Target 50% coverage improvement."
```

### 10.3 Documentation Resources

**Reference**:
- `/home/manitcor/dev/hotm/CLAUDE.md` - Development guide
- `/home/manitcor/dev/hotm/docs/implementation/testing-strategy.md` - Testing approach
- `/home/manitcor/dev/hotm/.aiwg/planning/development-process-guide.md` - SDLC standards
- `/home/manitcor/dev/hotm/.aiwg/testing/master-test-plan.md` - Comprehensive test plan

**Iteration Artifacts** (to be created):
- `.aiwg/planning/iteration-2-daily-log.md` (daily tracking)
- `.aiwg/reports/iteration-2-completion.md` (final report)
- `.aiwg/planning/iteration-2-retrospective.md` (lessons learned)
- `.aiwg/testing/coverage-baseline-iteration-2.md` (final coverage)

---

## 11. Backlog for Iteration 3

**Deferred Work** (not in scope for Iteration 2):

### High Priority (Iteration 3 Candidates)
1. **Provenance View Implementation** (UI for revision history)
2. **E2E Test Suite Completion** (Playwright full coverage)
3. **Performance Optimization** (based on Iteration 2 baseline)
4. **Advanced Search Features** (saved searches, search history)

### Medium Priority (Iteration 3-4)
5. **Auto-Linking Between Related Notes** (semantic similarity)
6. **Batch Operations** (bulk tagging, bulk delete)
7. **Export Functionality** (notes to markdown, PDF)
8. **Keyboard Shortcuts** (power user features)

### Low Priority (Future Iterations)
9. **Theme Customization** (light/dark mode, color schemes)
10. **Multi-Language Support** (i18n framework)
11. **Plugin Architecture** (extensibility)

---

## 12. Appendices

### Appendix A: Coverage Calculation Details

**Backend Coverage Target Calculation**:
- Baseline: 175 / 1,766 lines = 9.91%
- Target: 530 / 1,766 lines = 30%
- Delta: 355 additional lines covered
- Modules prioritized:
  - db_enhanced.rs: 96 lines (191 × 50%)
  - db_enhanced_v2.rs: 169 lines (338 × 50%)
  - job_queue.rs: 109 lines (273 × 40%)
  - routes (various): ~50 lines
  - Total: ~424 lines (exceeds target by 69 lines for buffer)

**Frontend Coverage Target Calculation**:
- Baseline: 33.48%
- Target: 50%
- Delta: 16.52% improvement needed
- Focus areas: NoteEditor, SearchResults, TagManager, hooks

### Appendix B: Quick Reference Commands

**Coverage Measurement**:
```bash
# Backend coverage (daily)
cd server
cargo tarpaulin --all-features --out Html --output-dir coverage
open coverage/index.html

# Frontend coverage (daily)
cd ui
npm run test:coverage -- --run
open coverage/index.html
```

**Act Validation** (mandatory before push):
```bash
gh act -j backend-tests
gh act -j frontend-tests
```

**Local Testing** (quick iteration):
```bash
cd server && cargo test
cd ui && npm test -- --run
```

**Daily Progress Update**:
```bash
# 1. Run coverage
cd server && cargo tarpaulin --all-features --out Html
cd ui && npm run test:coverage -- --run

# 2. Update daily log
echo "### Day N (YYYY-MM-DD)" >> .aiwg/planning/iteration-2-daily-log.md
echo "- Coverage: Backend X%, Frontend Y%" >> .aiwg/planning/iteration-2-daily-log.md

# 3. Commit progress
git add .aiwg/planning/iteration-2-daily-log.md
git commit -m "docs: update iteration 2 day N progress"
```

### Appendix C: Risk Mitigation Playbook

**If Coverage Target Unreachable** (detected at mid-point):
1. Assess actual progress vs. plan
2. Recalculate feasible target (e.g., 25% backend instead of 30%)
3. Prioritize high-impact modules (db_enhanced over routes)
4. Defer low-priority tests to Iteration 3
5. Document adjusted target in mid-point review notes

**If UI Integration Blocked by API Issues**:
1. Log issue in friction log (`.aiwg/quality/friction-log.md`)
2. Estimate API refactoring time
3. If < 0.5 days: fix immediately
4. If > 0.5 days: defer complex features, use workarounds
5. Create GitHub issue tagged `api-design` for future iteration

**If Act Tests Flaky**:
1. Identify flaky test (check Act logs)
2. Reproduce locally with verbose logging
3. Fix async timing issues (use `waitFor`, avoid fixed timeouts)
4. If unfixable quickly: temporarily mark test as ignored with comment
5. Create GitHub issue tagged `flaky-test` for investigation

### Appendix D: Iteration Success Scorecard

**At iteration end, evaluate**:

| Criterion | Weight | Target | Actual | Score |
|-----------|--------|--------|--------|-------|
| Backend Coverage | 25% | 30% | TBD | TBD |
| Frontend Coverage | 25% | 50% | TBD | TBD |
| P0 Work Items Completed | 30% | 100% | TBD | TBD |
| Act Tests Passing | 10% | 100% | TBD | TBD |
| Technical Debt Removed | 10% | 100% | TBD | TBD |

**Scoring**:
- 90-100%: Excellent iteration, exceeds expectations
- 75-89%: Good iteration, meets most objectives
- 60-74%: Acceptable iteration, some gaps to address
- <60%: Needs improvement, retrospective action items critical

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2025-12-04 |
| **Version** | 1.0 (PLANNED) |
| **Status** | APPROVED |
| **Primary Author** | Project Manager (Claude Code) |
| **Reviewers** | TBD (self-review or stakeholder) |
| **Next Review** | Mid-iteration (2025-12-16) |
| **Iteration Start** | 2025-12-09 |
| **Iteration End** | 2025-12-22 |

**Change Log**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Project Manager | Initial iteration plan created |

---

**End of Iteration Plan 002 - Feature Completion and Test Coverage**
