# Elaboration Phase Plan - HotM

**Project**: HotM (Hall Of The Mind)
**Phase**: Elaboration
**Version**: 1.0
**Date**: 2025-12-04
**Status**: APPROVED
**Duration**: 6-8 weeks
**Entry Criteria**: LOM (Lifecycle Objective Milestone) passed - 2025-12-04
**Exit Criteria**: ABM (Architecture Baseline Milestone) validated

---

## Executive Summary

The Elaboration phase focuses on validating the HotM architecture through steel thread implementations, retiring critical technical risks, and establishing the test coverage baseline required for sustainable Construction phase development. By the end of Elaboration, the architecture must be proven stable and capable of delivering on MVP requirements.

**Primary Goal**: Prove architecture works end-to-end through 3 steel thread implementations.

**Success Criteria**:
- All 3 steel threads passing
- Risk retirement >= 70% (11 of 15 risks retired or mitigated)
- Test coverage >= 60%
- Architecture stable (< 10% changes expected after ABM)

---

## Phase Objectives

### 1. Validate Architecture Through Steel Thread Implementation

Implement 3 architecturally significant use cases that exercise all system layers:

| Steel Thread | Primary Components | Key Validation |
|--------------|-------------------|----------------|
| **#1: Note + AI Enhancement** | UI -> API -> DB -> Job Queue -> Ollama | Core value proposition, async processing, NLP integration |
| **#2: Hybrid Search** | FTS + pgvector + RRF fusion | Search quality, performance at scale, index optimization |
| **#3: WebSocket Real-Time** | Event broadcasting, state sync | Real-time updates, future multi-device foundation |

### 2. Retire 70%+ of Technical Risks

Address high-priority risks from the risk register:

| Risk | Priority | Validation Method | Target Status |
|------|----------|-------------------|---------------|
| #3: Test Coverage | P0 | Analysis + Perf Test | RETIRED |
| #8: Ollama Dependency | P1 | POC + Spike | MITIGATED |
| #12: Coverage Target | P1 | Analysis + Spike | RETIRED |
| #6: Performance | P1 | Perf Test + Analysis | MITIGATED |
| #9: Setup Complexity | P1 | POC | MITIGATED |

### 3. Establish Test Coverage Baseline (60% Target)

| Layer | Current | Target | Gap |
|-------|---------|--------|-----|
| Frontend | 33.48% | 60% | -26.52% |
| Backend | ~17.5% | 60% | -42.5% |

**Coverage Strategy**:
- Critical paths (note CRUD, search, linking): >= 80%
- Core business logic: >= 70%
- Infrastructure/utilities: >= 50%

### 4. Baseline Requirements for Construction

- MVP acceptance criteria validated against steel threads
- Performance targets proven achievable
- Architecture decisions documented in ADRs (3-5 total)
- API contracts finalized

---

## Week-by-Week Schedule

### Week 1-2: Foundation

**Focus**: Test infrastructure, CI/CD validation, begin Steel Thread #1

**Activities**:
- [ ] **Day 1-2**: Install and configure cargo-tarpaulin for backend coverage
- [ ] **Day 2-3**: Run coverage baseline measurement (backend + frontend)
- [ ] **Day 3-4**: Validate CI/CD pipeline with coverage reporting
- [ ] **Day 4-5**: Address Risk #3 - document coverage gaps, create test templates
- [ ] **Week 2**: Begin Steel Thread #1 - Note CRUD (UI -> API -> DB flow)
- [ ] **Week 2**: Implement basic note creation E2E test
- [ ] **Week 2**: Add job queue table and insertion logic

**Deliverables**:
- [ ] Coverage baseline report (exact % per module)
- [ ] Test templates documented (API, model, component patterns)
- [ ] CI enforcing coverage thresholds (starting at 50%)
- [ ] Note CRUD endpoints working end-to-end

**Risk Focus**: Risk #3 (Test Coverage), Risk #9 (Setup Complexity)

**Success Metrics**:
- Backend coverage measured precisely
- CI pipeline green with coverage reporting
- Note creation -> retrieval working

### Week 3-4: Core Architecture Validation

**Focus**: Complete Steel Thread #1, begin Steel Thread #2, Ollama integration

**Activities**:
- [ ] **Week 3**: Implement background job worker skeleton
- [ ] **Week 3**: Integrate Ollama client for embedding generation
- [ ] **Week 3**: Address Risk #8 - implement graceful degradation
- [ ] **Week 3-4**: Test Ollama model alternatives (7b, mistral, phi-3)
- [ ] **Week 4**: Complete Steel Thread #1 - full NLP pipeline
- [ ] **Week 4**: Begin Steel Thread #2 - FTS with tsvector/GIN indexes
- [ ] **Week 4**: Performance baseline testing at 100 notes

**Deliverables**:
- [ ] Steel Thread #1 complete (note create -> enhance -> view working)
- [ ] Ollama health checks and graceful degradation
- [ ] Model alternatives documented with tradeoffs
- [ ] FTS search working with < 500ms latency
- [ ] Job queue with retry logic implemented

**Risk Focus**: Risk #8 (Ollama Dependency), Risk #6 (Performance)

**Success Metrics**:
- Background processing < 30s per note
- Note retrieval < 100ms P95
- FTS search < 500ms P95 at 100 notes
- Job success rate > 95%

### Week 5-6: Integration and Polish

**Focus**: Complete Steel Thread #2, begin Steel Thread #3, documentation

**Activities**:
- [ ] **Week 5**: Implement vector search with pgvector/HNSW
- [ ] **Week 5**: Add real-time query embedding generation
- [ ] **Week 5**: Implement RRF (Reciprocal Rank Fusion) algorithm
- [ ] **Week 5-6**: Complete Steel Thread #2 - hybrid search E2E
- [ ] **Week 6**: Begin Steel Thread #3 - WebSocket endpoint in Axum
- [ ] **Week 6**: Create WebSocket client in Tauri UI
- [ ] **Week 6**: Address remaining P1 risks
- [ ] **Week 6**: Update documentation (quick-start guide, API docs)

**Deliverables**:
- [ ] Steel Thread #2 complete (hybrid search < 1s at 1000 notes)
- [ ] Semantic search finds related notes
- [ ] Search filters working (tags, date range)
- [ ] WebSocket connection established
- [ ] Event broadcasting for note changes
- [ ] Quick-start documentation updated

**Risk Focus**: Risk #6 (Performance), Risk #9 (Setup Complexity)

**Success Metrics**:
- Hybrid search < 1s P95 at 1000 notes
- Search precision > 80% (manual assessment)
- WebSocket connection < 500ms
- Docker Compose one-command setup validated

### Week 7-8: ABM Preparation

**Focus**: Complete Steel Thread #3, final test coverage push, ABM validation

**Activities**:
- [ ] **Week 7**: Complete Steel Thread #3 - multi-window sync
- [ ] **Week 7**: Implement optimistic updates in UI
- [ ] **Week 7**: Add state reconciliation logic
- [ ] **Week 7**: Final test coverage push (target 60%+)
- [ ] **Week 8**: Run full benchmark suite (100/500/1000 notes)
- [ ] **Week 8**: Architecture documentation review (ADRs, SAD)
- [ ] **Week 8**: ABM gate validation preparation
- [ ] **Week 8**: Conduct retrospective and lessons learned

**Deliverables**:
- [ ] Steel Thread #3 complete (real-time sync validated)
- [ ] Test coverage >= 60% overall
- [ ] Performance benchmarks documented
- [ ] Software Architecture Document (SAD) updated
- [ ] ABM gate validation checklist complete
- [ ] Lessons learned documented

**Risk Focus**: Risk #12 (Coverage Target), Risk #5 (Core Features)

**Success Metrics**:
- All 3 steel threads passing
- Test coverage >= 60%
- Event broadcast latency < 100ms
- UI update latency < 200ms
- All P0/P1 risks retired or mitigated

---

## Deliverables

### Architecture Deliverables

| Deliverable | Owner | Target Week | Status |
|-------------|-------|-------------|--------|
| Software Architecture Document (SAD) | Architecture Designer | Week 7-8 | [ ] BASELINED |
| ADR-003: Background Job Queue | Code Architect | Week 2-3 | [ ] Documented |
| ADR-004: Hybrid Search with RRF | Code Architect | Week 4-5 | [ ] Documented |
| ADR-005: WebSocket for Real-Time | Code Architect | Week 6-7 | [ ] Documented |

### Testing Deliverables

| Deliverable | Owner | Target Week | Status |
|-------------|-------|-------------|--------|
| Coverage Baseline Report | QA Specialist | Week 1 | [ ] Measured |
| Test Templates | QA Specialist | Week 1-2 | [ ] Documented |
| Master Test Plan | Test Architect | Week 3-4 | [ ] BASELINED |
| Performance Benchmark Suite | Performance Engineer | Week 4 | [ ] Created |

### Risk Deliverables

| Deliverable | Owner | Target Week | Status |
|-------------|-------|-------------|--------|
| Risk Retirement Report | Project Manager | Week 7-8 | [ ] >= 70% |
| Ollama Model Comparison | Code Architect | Week 3-4 | [ ] Documented |
| Setup Validation Report | DevOps Engineer | Week 5-6 | [ ] Documented |

### Documentation Deliverables

| Deliverable | Owner | Target Week | Status |
|-------------|-------|-------------|--------|
| Quick-Start Guide (Windows 11) | Technical Writer | Week 5-6 | [ ] Complete |
| Quick-Start Guide (Linux/WSL) | Technical Writer | Week 5-6 | [ ] Complete |
| API Contract Documentation | Code Architect | Week 6-7 | [ ] Complete |

---

## Success Criteria

### Steel Thread Criteria

Each steel thread must meet:

| Criteria | Target | Validation |
|----------|--------|------------|
| Functionality | All acceptance criteria met | Manual testing checklist |
| Test Coverage | > 70% for steel thread code | Tarpaulin/Istanbul reports |
| Performance | All targets met per thread | Automated benchmarks |
| Reliability | Zero critical bugs | Issue tracker review |
| Documentation | ADR complete | Documentation review |

### Phase Exit Criteria (ABM Gate)

**Technical Success**:
- [ ] All 3 steel threads implemented and validated
- [ ] Architecture proves feasible for MVP scope
- [ ] No high-risk architectural unknowns remaining
- [ ] Test coverage >= 60% overall
- [ ] Performance targets validated at 100-note scale minimum
- [ ] CI/CD pipeline green (all tests passing via `gh act`)

**Risk Retirement**:
- [ ] Risk #3 (Test coverage insufficient): RETIRED
- [ ] Risk #5 (Core features inadequate): MITIGATED
- [ ] Risk #6 (Performance degradation): MITIGATED
- [ ] Risk #8 (Ollama dependency): MITIGATED
- [ ] Risk #12 (Coverage below 60%): RETIRED
- [ ] Overall risk retirement: >= 70%

**Architecture Stability**:
- [ ] Architecture patterns documented (3-5 ADRs)
- [ ] Integration patterns validated
- [ ] Testing strategy proven sustainable
- [ ] Performance bottlenecks identified and optimized

### Go/No-Go Decision

**Go to Construction** if:
- All steel threads meet success criteria
- No P0 (blocker) architectural issues
- Confidence that MVP can be built in Construction (8-12 weeks)
- Test coverage and performance foundations solid

**No-Go (Extend Elaboration)** if:
- Any steel thread fails validation
- Major architectural risk unresolved
- Performance targets not met with significant gap
- Test coverage infrastructure incomplete

**Pivot** if:
- Architecture fundamentally does not work
- Ollama integration proves infeasible
- Performance unacceptable even after optimization
- Complexity exceeds solo developer capacity

---

## Risk Management

### P0 Risks (Critical Path)

**Risk #3: Test Coverage Insufficient**
- **Mitigation**: Coverage baseline Week 1, CI enforcement, test templates
- **Owner**: QA Specialist
- **Target**: RETIRED by Week 8

### P1 Risks (High Priority)

**Risk #8: Ollama Dependency Creates Barrier**
- **Mitigation**: Graceful degradation, model alternatives, health checks
- **Owner**: Code Architect
- **Target**: MITIGATED by Week 4

**Risk #12: Test Coverage Remains Below 60%**
- **Mitigation**: CI enforcement, test-first workflow trial
- **Owner**: QA Specialist
- **Target**: RETIRED by Week 8

**Risk #6: Performance Degrades with Growing Corpus**
- **Mitigation**: Benchmark suite, index optimization, pagination
- **Owner**: Performance Engineer
- **Target**: MITIGATED by Week 6

**Risk #9: Setup Complexity Deters Users**
- **Mitigation**: Docker Compose validation, health checks, documentation
- **Owner**: DevOps Engineer
- **Target**: MITIGATED by Week 6

### Risk Tracking

Weekly risk review:
- Update risk status (Active, Mitigating, Retired)
- Adjust mitigation strategies as needed
- Escalate blockers immediately

---

## Performance Targets

### API Response Times

| Operation | Target (P95) | Measured At |
|-----------|--------------|-------------|
| Note creation | < 200ms | 100 notes |
| Note retrieval | < 100ms | 100 notes |
| FTS search | < 500ms | 1000 notes |
| Vector search | < 1s | 1000 notes |
| Hybrid search | < 1s | 1000 notes |

### Background Processing

| Operation | Target | Notes |
|-----------|--------|-------|
| Embedding generation | < 10s | Per note, Ollama |
| Full NLP pipeline | < 30s | Per note, non-blocking |
| Job success rate | > 95% | With retry logic |

### Real-Time Updates

| Operation | Target | Notes |
|-----------|--------|-------|
| WebSocket connection | < 500ms | Initial connect |
| Event broadcast | < 100ms | REST -> WebSocket |
| UI update | < 200ms | WebSocket -> re-render |

---

## Team and Resources

### Roles (Solo Developer Context)

| Role | Responsibility | Workload |
|------|----------------|----------|
| **Architecture Designer** | ADRs, design decisions, architecture review | 10% |
| **Code Architect** | Implementation, integration, API design | 50% |
| **QA Specialist** | Test strategy, coverage, test templates | 20% |
| **Performance Engineer** | Benchmarking, optimization, profiling | 10% |
| **DevOps Engineer** | Docker, CI/CD, setup automation | 5% |
| **Technical Writer** | Documentation, quick-start guides | 5% |

### AI Agent Support

| Agent | Phase Support | Activation |
|-------|---------------|------------|
| Requirements Analyst | Validate steel thread criteria | As needed |
| Test Architect | Master Test Plan, coverage strategy | Week 3-4 |
| Security Architect | Review network mode plans | Week 6+ |
| Documentation Synthesizer | ABM deliverables | Week 7-8 |

### Dependencies

| Dependency | Required By | Status |
|------------|-------------|--------|
| PostgreSQL 14+ with pgvector | All steel threads | Available |
| Ollama with models | Steel Thread #1, #2 | Available |
| Rust 1.70+ | All backend work | Available |
| Node.js 20+ | All frontend work | Available |
| cargo-tarpaulin | Week 1 | To be installed |

---

## Schedule Summary

| Week | Focus | Key Deliverables | Risks Addressed |
|------|-------|------------------|-----------------|
| 1-2 | Foundation | Coverage baseline, test templates, note CRUD | #3, #9 |
| 3-4 | Core Validation | Steel Thread #1, Ollama integration, FTS | #8, #6 |
| 5-6 | Integration | Steel Thread #2, WebSocket, documentation | #6, #9 |
| 7-8 | ABM Preparation | Steel Thread #3, final coverage, gate validation | #12, #5 |

---

## Monitoring and Reporting

### Weekly Checkpoint

Every Friday:
- Steel thread progress (% complete)
- Test coverage delta (+/- since last week)
- Risk status updates
- Blockers and escalations

### Metrics Dashboard

Track in CI/CD output:
- Test coverage (backend/frontend)
- CI pass rate
- Performance benchmark results (when applicable)

### Communication

- Progress updates in commit messages
- Blockers documented in working notes
- Phase gate documentation prepared incrementally

---

## Appendix A: Steel Thread Mapping to MVP Features

| MVP Feature | Steel Thread | Validation |
|-------------|--------------|------------|
| Note creation | #1 | Create, store, queue NLP |
| Note viewing | #1 | Retrieve with revisions |
| AI enhancement | #1 | Background processing |
| Full-text search | #2 | FTS with ranking |
| Semantic search | #2 | Vector similarity |
| Hybrid search | #2 | RRF fusion |
| Real-time updates | #3 | WebSocket sync |
| Multi-window support | #3 | Event broadcasting |

## Appendix B: Validation Schedule Alignment

| Risk Validation | Week | Effort | Method |
|-----------------|------|--------|--------|
| Risk #3: Coverage | 1-2 | 2-3 days | Analysis + Perf Test |
| Risk #9: Setup | 1-2 | 2-3 days | POC |
| Risk #8: Ollama | 3-4 | 4-5 days | POC + Spike |
| Risk #6: Performance | 3-4 | 3 days | Perf Test + Analysis |
| Risk #12: Coverage Target | 7-8 | Ongoing | Analysis + Spike |

---

## Document Control

**Created**: 2025-12-04
**Author**: Documentation Synthesizer
**Primary Contributors**:
- Architecture Designer (architecture-objectives-draft.md)
- Requirements Analyst (steel-thread-use-cases-draft.md)
- System Analyst (risk-validation-strategy-draft.md)

**Source Documents**:
- `.aiwg/working/elaboration/planning/architecture-objectives-draft.md`
- `.aiwg/working/elaboration/planning/steel-thread-use-cases-draft.md`
- `.aiwg/working/elaboration/planning/risk-validation-strategy-draft.md`
- `.aiwg/planning/phase-plan-inception.md`
- `.aiwg/reports/gate-validation-inception-2025-12-04.md`

**Review Cycle**: Weekly during Elaboration
**Next Review**: End of Week 2 (first steel thread checkpoint)
**Gate Review**: End of Week 8 (ABM validation)

---

## Sign-Off

**Required Approvals**:
- [ ] Architecture Designer: PENDING
- [ ] Requirements Analyst: PENDING
- [ ] Test Architect: PENDING

**Conditions**: None

**Outstanding Concerns**: None

---

**Phase Status**: READY TO BEGIN
**Next Action**: `/flow-elaboration-kickoff` or begin Week 1 activities
