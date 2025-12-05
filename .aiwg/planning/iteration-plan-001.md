# Iteration Plan #1 - HotM Construction Phase

**Document Type**: SDLC Artifact - Planning
**Phase**: Construction
**Iteration**: 1 of N
**Version**: 1.0
**Date**: 2025-12-04
**Status**: PLANNED
**Primary Author**: Project Manager

---

## Executive Summary

This is the first Construction phase iteration for HotM, establishing the baseline development velocity and prioritizing test coverage improvement. This iteration uses a conservative capacity model (80% of full) to account for process ramp-up and unknown friction.

**Primary Focus**: Test coverage improvement and validation of development process
**Duration**: 2 weeks (December 5-18, 2025)
**Risk Level**: Low (simple, well-defined work items)
**Success Criteria**: Achieve 35-40% backend coverage, maintain 33%+ frontend coverage, validate DoR/DoD workflow

---

## Table of Contents

1. [Iteration Configuration](#1-iteration-configuration)
2. [Work Items and Estimates](#2-work-items-and-estimates)
3. [Success Criteria](#3-success-criteria)
4. [Risk Management](#4-risk-management)
5. [Daily Tracking](#5-daily-tracking)
6. [Iteration Review](#6-iteration-review)

---

## 1. Iteration Configuration

### 1.1 Iteration Timeline

| Milestone | Date | Description |
|-----------|------|-------------|
| **Iteration Start** | December 5, 2025 | Kickoff, capacity confirmation |
| **Mid-Iteration Review** | December 11, 2025 | Progress check, scope adjustment if needed |
| **Code Freeze** | December 17, 2025 | Final Act validation, no new features |
| **Iteration Review** | December 18, 2025 | Demo, acceptance validation, retrospective |

### 1.2 Capacity Planning

**Available Days**: 10 working days (2 weeks)
**Planned Capacity**: 8 days (80% of full capacity)
**Buffer**: 2 days (20% for unknowns, process learning)

**Rationale for Conservative Capacity**:
- First iteration with new Development Process Guide
- Learning curve for DoR/DoD workflow
- Unknown friction in Act validation cycle
- Test writing may take longer than estimated

**Velocity Baseline**: Will establish actual velocity for future planning

### 1.3 Iteration Goal

**Primary Objective**: Validate development process and establish baseline velocity while closing the critical test coverage gap.

**Focus Areas** (Ranked by Priority):
1. **Test Coverage Improvement** (P0 - Critical): Increase backend coverage from 9.91% to 35-40%
2. **Development Process Validation** (P0 - Critical): Validate DoR/DoD workflow, Act gates
3. **Core CRUD Completion** (P1 - High): Finalize note management features
4. **Technical Debt Reduction** (P2 - Medium): Address unused code warnings

---

## 2. Work Items and Estimates

### 2.1 Work Item Selection Criteria

Items selected for this iteration meet the following criteria:
- ✅ Clear, well-defined scope
- ✅ Low technical risk
- ✅ Testable acceptance criteria
- ✅ No external dependencies
- ✅ Support coverage improvement goal

**Deferred to Later Iterations**:
- High-risk items (NLP pipeline, semantic search)
- Items requiring ADR decisions (authentication, network mode)
- Complex refactoring (unified runtime)

### 2.2 Work Items Backlog

#### WI-001: Database Layer Unit Tests (Priority: P0 - CRITICAL)

**Description**: Add comprehensive unit tests for `db_enhanced.rs` and `db_enhanced_v2.rs` modules

**Acceptance Criteria**:
- [ ] Test `create_note()` with valid and invalid inputs
- [ ] Test `get_note()` for existing and non-existent notes
- [ ] Test `update_note_revised()` revision logic
- [ ] Test `search_notes()` with various query types
- [ ] Test error handling for database failures
- [ ] Coverage for db_enhanced modules: >60%

**Dependencies**: None (standalone unit tests)

**Test Approach**:
- Unit tests with mock PgPool
- Integration tests with test database
- Fixtures for common test data

**Estimate**: 2.5 days (implementation: 1.5 days, testing: 1 day)

**Story Points**: 5

**Risk Level**: Low (well-understood domain)

---

#### WI-002: Models Module Unit Tests (Priority: P0 - CRITICAL)

**Description**: Expand test coverage for `models.rs` beyond current 5 tests

**Acceptance Criteria**:
- [ ] Test all serde serialization/deserialization paths
- [ ] Test validation logic for CreateNoteRequest
- [ ] Test edge cases (empty strings, null values, oversized inputs)
- [ ] Test error responses in ResponseError
- [ ] Coverage for models.rs: >80%

**Dependencies**: None

**Test Approach**:
- Unit tests for serialization/deserialization
- Property-based tests for validation (using quickcheck)
- Edge case coverage

**Estimate**: 1.5 days

**Story Points**: 3

**Risk Level**: Low (pure data structures)

---

#### WI-003: Ollama Client Unit Tests (Priority: P1 - HIGH)

**Description**: Add unit tests for `ollama.rs` module with mock HTTP responses

**Acceptance Criteria**:
- [ ] Test `generate()` with successful responses
- [ ] Test `embed()` with successful responses
- [ ] Test error handling for network failures
- [ ] Test timeout scenarios
- [ ] Test invalid JSON response handling
- [ ] Coverage for ollama.rs: >70%

**Dependencies**: None (mock HTTP client)

**Test Approach**:
- Mock HTTP responses using wiremock or similar
- Unit tests for request/response handling
- Timeout and error simulation

**Estimate**: 2 days

**Story Points**: 4

**Risk Level**: Medium (requires HTTP mocking setup)

---

#### WI-004: API Route Handler Tests (Priority: P1 - HIGH)

**Description**: Add integration tests for `/api/v1/notes` route handlers

**Acceptance Criteria**:
- [ ] Test POST /notes (create note)
- [ ] Test GET /notes/{id} (retrieve note)
- [ ] Test PUT /notes/{id}/revised (update revision)
- [ ] Test DELETE /notes/{id} (soft delete)
- [ ] Test error responses (404, 400, 500)
- [ ] Coverage for routes/ modules: >60%

**Dependencies**: Test database setup

**Test Approach**:
- Integration tests using Axum test utilities
- Test database with clean slate per test
- HTTP request/response validation

**Estimate**: 2 days

**Story Points**: 4

**Risk Level**: Low (existing patterns to follow)

---

#### WI-005: Remove Unused Code Warning (Priority: P2 - MEDIUM)

**Description**: Address `generate_enhanced_content()` dead code warning in `db_enhanced_v2.rs`

**Acceptance Criteria**:
- [ ] Either implement usage or remove function
- [ ] Zero dead code warnings in `cargo clippy`
- [ ] Document decision in code comments

**Dependencies**: None

**Test Approach**: N/A (cleanup task)

**Estimate**: 0.5 days

**Story Points**: 1

**Risk Level**: Low (simple cleanup)

---

#### WI-006: Update Note Soft Delete Implementation (Priority: P2 - MEDIUM)

**Description**: Ensure soft delete is fully implemented and tested in note management

**Acceptance Criteria**:
- [ ] Verify `is_deleted` flag behavior
- [ ] Test DELETE endpoint sets flag correctly
- [ ] Test queries exclude deleted notes by default
- [ ] Test admin view includes deleted notes
- [ ] Coverage for delete logic: 100%

**Dependencies**: WI-004 (route tests)

**Test Approach**:
- Unit tests for delete logic
- Integration tests for DELETE endpoint
- Query filtering validation

**Estimate**: 1 day

**Story Points**: 2

**Risk Level**: Low

---

### 2.3 Capacity Allocation Summary

| Work Item | Priority | Story Points | Estimate (Days) | Status |
|-----------|----------|--------------|-----------------|--------|
| WI-001: Database Layer Tests | P0 | 5 | 2.5 | PLANNED |
| WI-002: Models Module Tests | P0 | 3 | 1.5 | PLANNED |
| WI-003: Ollama Client Tests | P1 | 4 | 2.0 | PLANNED |
| WI-004: API Route Tests | P1 | 4 | 2.0 | PLANNED |
| WI-005: Remove Dead Code | P2 | 1 | 0.5 | PLANNED |
| WI-006: Soft Delete Implementation | P2 | 2 | 1.0 | PLANNED |
| **TOTAL** | - | **19** | **9.5 days** | - |

**Planned vs. Available**: 9.5 days planned / 8 days capacity = **119% utilization**

**Adjustment Strategy**:
- WI-006 is stretch goal (can defer to Iteration 2)
- WI-003 can be reduced in scope (mock only critical paths)
- If velocity is lower than expected, defer P2 items first

---

## 3. Success Criteria

### 3.1 Coverage Metrics

| Metric | Current Baseline | Iteration 1 Target | Status |
|--------|------------------|-------------------|--------|
| **Backend Line Coverage** | 9.91% | 35-40% | 🔴 Critical Gap |
| **Frontend Line Coverage** | 33.48% | 33%+ (maintain) | 🟡 On Track |
| **Overall Coverage** | ~21% | 30-35% | 🔴 Critical Gap |

**Coverage Tracking**: Update weekly (Wednesday) using:
```bash
# Backend (future - tarpaulin setup needed)
cd server && cargo tarpaulin --out Html

# Frontend
cd ui && npm run test:coverage -- --run
```

### 3.2 Quality Gates

**Mandatory Gates** (All must pass):
- [ ] `gh act -j backend-tests` exits with code 0
- [ ] `gh act -j frontend-tests` exits with code 0
- [ ] Zero P0 (blocker) issues introduced
- [ ] Zero clippy warnings (`cargo clippy -- -D warnings`)
- [ ] Zero TypeScript errors (`npm run build`)
- [ ] Zero high/critical security vulnerabilities

**Soft Gates** (Desirable):
- [ ] All P1 issues resolved or documented for next iteration
- [ ] Code review completed (self or AI-assisted)
- [ ] Documentation updated (CLAUDE.md, README if needed)

### 3.3 Functional Acceptance

**Core CRUD Features** (Must remain functional):
- [ ] Create note via POST /api/v1/notes
- [ ] Retrieve note via GET /api/v1/notes/{id}
- [ ] Update revision via PUT /api/v1/notes/{id}/revised
- [ ] Search notes via GET /api/v1/search

**Regression Prevention**:
- [ ] All 63 existing frontend tests continue to pass
- [ ] All 5 existing backend tests continue to pass
- [ ] No performance degradation >10% on note creation/retrieval

### 3.4 Process Validation

**Development Process Goals**:
- [ ] DoR checklist validated for all work items
- [ ] DoD checklist used before considering items complete
- [ ] Act validation run before every push (100% compliance)
- [ ] Friction log maintained with daily updates
- [ ] Iteration tracking updated daily

**Measurement**:
- Track time spent on test writing vs. implementation
- Track Act validation cycle time (target: <10 minutes)
- Document process friction for retrospective

---

## 4. Risk Management

### 4.1 Identified Risks

#### RISK-IT1-001: Test Writing Velocity Unknown
**Description**: First iteration with heavy test focus; unclear how long test development takes
**Probability**: High (80%)
**Impact**: Medium (schedule slip)
**Mitigation**:
- Start with simplest tests (models.rs) to establish baseline
- Use AI-assisted test generation to accelerate
- Defer P2 items if velocity is slower than expected
**Contingency**: Reduce WI-003 scope, defer WI-006 to Iteration 2

---

#### RISK-IT1-002: Act Validation Cycle Time
**Description**: Act tests currently take ~8 minutes; may slow iteration cycle
**Probability**: Medium (60%)
**Impact**: Medium (developer friction)
**Mitigation**:
- Run local `cargo test` for rapid feedback
- Only run full Act validation before push (not after every change)
- Investigate test parallelization options
**Contingency**: Document in friction log for process improvement in Iteration 2

---

#### RISK-IT1-003: Database Test Setup Complexity
**Description**: Integration tests require test database setup; may introduce flakiness
**Probability**: Medium (50%)
**Impact**: Medium (test reliability)
**Mitigation**:
- Use transaction rollback for test isolation
- Document test database setup in README
- Use helper functions for common setup/teardown
**Contingency**: Fall back to more unit tests with mocks if integration tests prove unreliable

---

#### RISK-IT1-004: Scope Creep During Testing
**Description**: Finding bugs during test development may lead to unplanned fixes
**Probability**: Medium (50%)
**Impact**: Low (minor schedule slip)
**Mitigation**:
- Document bugs in issue log
- Fix only P0 (blocker) bugs in this iteration
- Defer P1/P2 bugs to backlog
**Contingency**: Accept minor schedule slip (within 20% buffer)

---

### 4.2 Risk Mitigation Plan

**Pre-Iteration Actions**:
- [ ] Set up backend coverage tooling (tarpaulin or llvm-cov)
- [ ] Create test database setup script
- [ ] Document test writing guidelines in CLAUDE.md

**Mid-Iteration Review Actions**:
- [ ] Reassess velocity based on first 5 days
- [ ] Adjust scope if needed (defer P2 items)
- [ ] Update risk register with new findings

**Post-Iteration Actions**:
- [ ] Document actual velocity for future planning
- [ ] Update risk probabilities based on experience
- [ ] Add lessons learned to retrospective

---

## 5. Daily Tracking

### 5.1 Daily Check-In Template

```markdown
### Day N (YYYY-MM-DD)

**Completed**:
- [Work item or task completed]

**In Progress**:
- [Current focus area]

**Blocked**:
- [Any blockers with mitigation plan]

**Coverage**:
- Backend: X.X%
- Frontend: X.X%

**Velocity**:
- Planned: Y days
- Actual: Z days (running total)

**Friction Log**:
- [Any new friction points discovered]
```

### 5.2 Tracking Cadence

**Daily** (5-10 minutes):
- Update daily progress section
- Review velocity vs. plan
- Identify blockers

**Wednesday** (Mid-Iteration, 30 minutes):
- Run coverage reports
- Update metrics dashboard
- Decide on scope adjustments

**Friday** (End of Week, 15 minutes):
- Review friction log
- Update risk register if new risks identified
- Plan next week's focus

---

## 6. Iteration Review

### 6.1 Review Agenda

**Duration**: 1 hour
**Date**: December 18, 2025

**Agenda**:
1. **Demo** (20 minutes)
   - Show coverage improvement (before/after)
   - Show passing test suite
   - Show Act validation results

2. **Acceptance Validation** (15 minutes)
   - Review success criteria checklist
   - Verify all mandatory gates passed
   - Document any deviations

3. **Metrics Review** (10 minutes)
   - Actual velocity vs. planned
   - Coverage delta
   - Test pass rate

4. **Issue Review** (10 minutes)
   - P0/P1 issues status
   - Known bugs for next iteration
   - Technical debt identified

5. **Retrospective** (15 minutes)
   - What went well
   - What didn't go well
   - Action items for Iteration 2

### 6.2 Retrospective Template

**What Went Well**:
- [Positive outcomes, successful practices]

**What Didn't Go Well**:
- [Friction points, challenges, failures]

**What Should We Change**:
- [Concrete action items with owners]

**Friction Log Summary**:
- [Top 3 friction points from iteration]

**Action Items**:
- [ ] Action 1: [Description] - Owner: [Name] - Due: [Date]
- [ ] Action 2: [Description] - Owner: [Name] - Due: [Date]

---

## Appendices

### Appendix A: Definition of Ready Validation

All work items in this iteration have been validated against DoR criteria:

| Work Item | Acceptance Criteria | Dependencies | Test Approach | Estimate | Risks | Blockers |
|-----------|-------------------|--------------|---------------|----------|-------|----------|
| WI-001 | ✅ | ✅ None | ✅ | ✅ 2.5d | ✅ Low | ✅ None |
| WI-002 | ✅ | ✅ None | ✅ | ✅ 1.5d | ✅ Low | ✅ None |
| WI-003 | ✅ | ✅ None | ✅ | ✅ 2.0d | ⚠️ Med | ✅ None |
| WI-004 | ✅ | ✅ Test DB | ✅ | ✅ 2.0d | ✅ Low | ✅ None |
| WI-005 | ✅ | ✅ None | N/A | ✅ 0.5d | ✅ Low | ✅ None |
| WI-006 | ✅ | ⚠️ WI-004 | ✅ | ✅ 1.0d | ✅ Low | ✅ None |

### Appendix B: Test Coverage Analysis

**Current Backend Coverage** (9.91%):
```
File                     Lines    Covered    Uncovered    %
-------------------------------------------------------
models.rs                 450        45         405      10%
db_enhanced.rs            380         5         375       1.3%
db_enhanced_v2.rs         420         0         420       0%
ollama.rs                 180         0         180       0%
routes/notes.rs           240        30         210      12.5%
routes/search.rs          160         0         160       0%
-------------------------------------------------------
TOTAL                    1830       180        1650      9.91%
```

**Iteration 1 Target Distribution** (35-40%):
```
File                     Target Coverage    Priority
-------------------------------------------------------
models.rs                      80%            P0
db_enhanced.rs                 60%            P0
db_enhanced_v2.rs              60%            P0
ollama.rs                      70%            P1
routes/notes.rs                60%            P1
routes/search.rs               40%            P2 (defer)
-------------------------------------------------------
PROJECTED TOTAL               ~38%            -
```

### Appendix C: Quick Reference Commands

**Start Iteration**:
```bash
# Update iteration plan status
vim .aiwg/planning/iteration-plan-001.md

# Create daily tracking section
# Add: "### Day 1 (2025-12-05)"
```

**Daily Check-In**:
```bash
# Run local tests for quick feedback
cd server && cargo test
cd ui && npm test -- --run

# Update daily progress
vim .aiwg/planning/iteration-plan-001.md
```

**Before Each Push**:
```bash
# MANDATORY: Run full validation
gh act -j backend-tests
gh act -j frontend-tests

# Commit and push
git add .
git commit -m "test: add unit tests for database layer"
git push origin main
```

**Mid-Iteration Review (Day 5)**:
```bash
# Generate coverage reports
cd ui && npm run test:coverage -- --run
cd server && cargo tarpaulin --out Html  # (if configured)

# Review metrics
cat .aiwg/planning/iteration-plan-001.md | grep "Coverage:"
```

**End of Iteration**:
```bash
# Final validation
gh act -j backend-tests && gh act -j frontend-tests

# Update iteration status to COMPLETE
vim .aiwg/planning/iteration-plan-001.md

# Create iteration status report
vim .aiwg/planning/iteration-status-001.md
```

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2025-12-04 |
| **Version** | 1.0 (PLANNED) |
| **Status** | PLANNED |
| **Primary Author** | Project Manager |
| **Iteration Start** | 2025-12-05 |
| **Iteration End** | 2025-12-18 |
| **Next Review** | Mid-iteration (2025-12-11) |

**Change Log**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Project Manager | Initial iteration plan for Construction phase |

---

**End of Iteration Plan #1 v1.0 (PLANNED)**
