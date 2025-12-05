# Risk Validation Strategy

**Project**: HotM - Personal Knowledge Management Tool
**Phase**: Elaboration
**Document Version**: 1.0
**Date**: 2025-12-04

---

## Overview

This document defines validation approaches for the top 5 architectural/technical risks identified in the risk register. Validation focuses on proving technical feasibility and retiring risks before Construction phase investment.

**Validation Priority**: Risks that directly impact MVP stability, testing discipline, and core NLP functionality.

---

## Risk #3: Test Coverage Insufficient to Catch Rollback Regressions

**Priority**: P0 (Critical Path)
**Current State**: 33% frontend, ~17% backend (estimated), Target: 60%
**Impact**: HIGH | Probability: HIGH

### Validation Method
**Architecture Analysis + Performance Test**

### Acceptance Criteria
1. Coverage baseline established for all components:
   - Backend: cargo tarpaulin report with line/branch coverage
   - Frontend: Vitest coverage report with line/branch/function coverage
   - Breakdown by module (API routes, models, services, UI components)
2. Coverage gaps identified and categorized:
   - Critical paths (note CRUD, search, linking) - must be >80%
   - Core business logic - must be >70%
   - Infrastructure/utilities - must be >50%
3. Test execution time measured:
   - Backend unit tests: <30 seconds
   - Frontend unit tests: <20 seconds
   - Full CI pipeline (gh act): <10 minutes
4. Coverage enforcement configured:
   - CI fails on coverage regression >5%
   - Coverage reports generated on every PR
   - Minimum thresholds enforced per component

### Scope
**Standard**

**Activities**:
1. Run coverage tools on current codebase
   - Backend: `cd server && cargo tarpaulin --out Html --out Json`
   - Frontend: `cd ui && npm test -- --coverage --reporter=json --reporter=html`
2. Generate coverage reports and analyze gaps
3. Document critical uncovered paths (manual analysis)
4. Create test templates for common patterns:
   - API endpoint test (request/response/error cases)
   - Database model test (CRUD operations)
   - React component test (render/interaction/state)
   - Service layer test (business logic)
5. Add coverage thresholds to CI configuration
6. Write missing tests for top 10 critical gaps

### Effort Estimate
**2-3 days**
- Day 1: Coverage baseline, gap analysis, documentation
- Day 2: Test template creation, CI configuration
- Day 3: Critical path test writing (top 10 gaps)

### Owner
**QA Specialist** (test strategy, templates)
**Code Architect** (CI configuration, tooling)

### Implementation Notes
- Use cargo-tarpaulin for Rust (already supports line/branch coverage)
- Use Vitest built-in coverage (c8/istanbul) for React/TypeScript
- Focus on integration tests for API endpoints (higher value than unit tests)
- Document "acceptable gaps" (error handling edge cases, UI polish code)
- Create coverage dashboard in CI output for visibility

### Risk Retirement Criteria
- Coverage baseline documented
- CI enforces minimum thresholds
- Critical paths >80% covered
- Regression tests prevent coverage drops

---

## Risk #8: Ollama Dependency Creates Barrier to Entry

**Priority**: P1 (High Priority)
**Current State**: Hard dependency on Ollama with gpt-oss:20b model
**Impact**: MEDIUM | Probability: MEDIUM

### Validation Method
**POC (Proof of Concept) + Spike**

### Acceptance Criteria
1. Graceful degradation implemented:
   - Notes can be created/stored without Ollama running
   - NLP jobs queued for later processing when Ollama unavailable
   - Clear user feedback when NLP features disabled
   - System remains functional without AI features
2. Model alternatives tested:
   - Performance comparison: gpt-oss:20b vs 7b vs mistral:7b
   - Quality assessment: revision coherence, summary accuracy
   - Resource usage: VRAM, inference time, model size
   - CPU-only fallback: inference time acceptable (<30s per note)
3. Integration stability validated:
   - Ollama connection pooling/retry logic
   - Timeout handling (5s connect, 30s inference)
   - Error propagation to user layer
   - Health check endpoint (/health reports Ollama status)
4. Setup automation improved:
   - dev_server.sh validates Ollama + models
   - Clear error messages with resolution steps
   - Documentation: quick-start with model recommendations

### Scope
**Comprehensive**

**POC Activities**:
1. Implement job queue for NLP tasks:
   - Create background job table in PostgreSQL
   - Add retry logic with exponential backoff
   - Graceful handling of Ollama unavailability
2. Add Ollama health checks:
   - Connection validation on startup
   - Periodic health checks (30s interval)
   - Circuit breaker pattern for repeated failures
3. Test model alternatives:
   - Pull gpt-oss:7b, mistral:7b, phi-3:mini
   - Run test corpus (20 notes, varied content)
   - Measure inference time, quality score (manual assessment)
   - Document resource requirements per model

**Spike Activities**:
1. Research WebSocket stability for job status:
   - Evaluate ws vs polling for job queue updates
   - Test reconnection logic under network issues
   - Prototype real-time job progress UI
2. Investigate embedding model alternatives:
   - Current: nomic-embed-text
   - Alternatives: all-minilm, bge-small
   - Tradeoff analysis: size vs quality vs speed

### Effort Estimate
**4-5 days**
- Day 1: Job queue implementation (database schema, API endpoints)
- Day 2: Ollama health checks, graceful degradation logic
- Day 3: Model testing (pull, benchmark, quality assessment)
- Day 4: WebSocket spike, reconnection logic
- Day 5: Documentation, error message improvements

### Owner
**Code Architect** (implementation)
**DevOps Engineer** (setup automation)
**Product Owner** (quality assessment)

### Implementation Notes
- Use PostgreSQL LISTEN/NOTIFY for job queue events
- Consider BullMQ or similar if job complexity grows
- Document "good enough" quality criteria for model selection
- CPU fallback acceptable if <30s per note (user expectation setting)
- Test on second machine without GPU (validation VM)

### Risk Retirement Criteria
- System functional without Ollama (notes persist, NLP queued)
- Health checks provide clear diagnostics
- Model alternatives documented with tradeoffs
- Setup automation detects/resolves common issues

---

## Risk #12: Test Coverage Remains Below 60% Target

**Priority**: P1 (High Priority)
**Current State**: No coverage enforcement, ad-hoc test writing
**Impact**: MEDIUM | Probability: MEDIUM

### Validation Method
**Architecture Analysis + Spike**

### Acceptance Criteria
1. Coverage enforcement active in CI:
   - gh act workflows fail on coverage drop >5%
   - Minimum thresholds: 60% overall, 80% critical paths
   - Coverage reports visible in CI output
   - Trend tracking (coverage delta per commit)
2. Test-first workflow validated:
   - Test templates documented for common patterns
   - Time allocation: 30% development time to testing
   - Pre-commit hooks run relevant tests
   - Developer friction assessed (too slow? too complex?)
3. Coverage debt plan created:
   - Current gaps categorized by priority
   - Construction Phase 3 budget allocated (test debt paydown)
   - Weekly coverage review in progress tracking
4. Sustainable velocity proven:
   - Feature development continues at acceptable pace
   - Test writing doesn't block critical work
   - Refactoring confidence increases with coverage

### Scope
**Standard**

**Analysis Activities**:
1. Survey current test practices:
   - What patterns exist? (integration tests, unit tests, E2E)
   - What's missing? (edge cases, error paths, integration points)
   - What's tested well? (learn from good examples)
2. Define coverage strategy per layer:
   - API routes: 80% (request/response/error handling)
   - Business logic: 80% (core algorithms, validation)
   - Database layer: 70% (CRUD, queries, migrations)
   - UI components: 60% (critical user flows, state management)
   - Infrastructure: 50% (utilities, helpers, configs)
3. Create test writing guide:
   - Template for API endpoint test
   - Template for database model test
   - Template for React component test
   - Example: hybrid search algorithm test (FTS + vector)
   - Example: link creation integration test

**Spike Activities**:
1. Test velocity experiment (1-week trial):
   - Week 1: Test-first for all new features
   - Measure: time to write test vs implementation
   - Measure: bugs caught by tests vs manual testing
   - Assess: developer satisfaction, code confidence
2. Coverage tooling evaluation:
   - Current: cargo tarpaulin + Vitest coverage
   - Alternatives: cargo-llvm-cov, codecov.io integration
   - CI reporting: inline comments on PRs, badges, trends

### Effort Estimate
**2 days**
- Day 1: Survey, strategy definition, test guide creation
- Day 2: CI enforcement setup, spike planning

**Ongoing**: 30% time allocation during Construction

### Owner
**QA Specialist** (strategy, templates, velocity tracking)
**Development Lead** (enforcement, culture)

### Implementation Notes
- Start enforcement at 50% threshold, increase to 60% incrementally
- Allow "acceptable gap" exceptions with documentation (UI polish, etc)
- Focus on integration tests (higher ROI than unit tests)
- Use snapshot tests for complex output (embeddings, search results)
- Celebrate coverage milestones (team of one, but still motivating)

### Risk Retirement Criteria
- CI enforces coverage thresholds
- Test-first workflow proven sustainable
- Coverage trend positive (increasing over time)
- Refactoring confidence measurably improved

---

## Risk #6: Performance Degrades with Growing Note Corpus

**Priority**: P1 (Monitor Closely)
**Current State**: No performance benchmarks, unknown scaling characteristics
**Impact**: MEDIUM | Probability: MEDIUM

### Validation Method
**Performance Test + Architecture Analysis**

### Acceptance Criteria
1. Performance benchmarks established:
   - Test datasets: 100/500/1000 notes (varied content, realistic corpus)
   - Baseline metrics: search latency, indexing time, storage size
   - Target: search <500ms @ 100 notes, <1s @ 1000 notes
   - Hardware: document test environment (CPU, RAM, disk type)
2. Index optimization validated:
   - GIN index on tsvector (full-text search)
   - HNSW index on vector embeddings (pgvector)
   - Query plans analyzed (EXPLAIN ANALYZE)
   - No full table scans on critical paths
3. Bottlenecks identified and addressed:
   - N+1 query problems (use JOIN or batch loading)
   - Reciprocal rank fusion performance (in-memory vs CTE)
   - Vector similarity threshold tuning (recall vs latency)
4. Monitoring/alerting implemented:
   - Log query times in development (RUST_LOG=sqlx=debug)
   - Alert on slow queries (>500ms warning, >2s error)
   - Dashboard: avg/p95/p99 latency per endpoint

### Scope
**Standard**

**Activities**:
1. Generate test datasets:
   - Script to create realistic notes (varied length, tags, links)
   - Use faker/lorem ipsum + AI-generated content
   - Corpus sizes: 10/50/100/500/1000 notes
2. Benchmark search performance:
   - Full-text search only
   - Semantic search only
   - Hybrid search (FTS + vector + RRF)
   - Measure: latency, throughput, resource usage
3. Analyze query plans:
   - Run EXPLAIN ANALYZE on slow queries
   - Identify missing indexes, inefficient joins
   - Optimize query structure (CTE vs subquery vs JOIN)
4. Index tuning:
   - GIN index parameters (fastupdate, gin_pending_list_limit)
   - HNSW index parameters (m, ef_construction, ef_search)
   - Document tuning rationale and tradeoffs
5. Pagination implementation:
   - Cursor-based pagination (more efficient than OFFSET)
   - API changes: return cursor token, page size
   - UI integration: infinite scroll or load more

### Effort Estimate
**3 days**
- Day 1: Test dataset generation, initial benchmarks
- Day 2: Query analysis, index tuning, optimization
- Day 3: Pagination, monitoring, documentation

### Owner
**Performance Engineer** (benchmarking, optimization)
**Database Specialist** (index tuning, query analysis)
**Code Architect** (pagination API design)

### Implementation Notes
- Use realistic data (don't just test with "Lorem ipsum")
- Test on target hardware (Windows 11 desktop, not server specs)
- Document performance characteristics per corpus size
- Consider Redis caching for frequently accessed notes (future)
- Monitor during dogfooding (real-world validation)

### Risk Retirement Criteria
- Benchmarks show acceptable performance at target scale
- Indexes optimized, no full table scans
- Monitoring alerts on performance degradation
- Pagination prevents unbounded result sets

---

## Risk #9: PostgreSQL + Ollama Setup Complexity Deters Future Users

**Priority**: P1 (Monitor Closely)
**Current State**: Manual setup, docker-compose.dev.yml exists but not validated
**Impact**: MEDIUM | Probability: HIGH

### Validation Method
**POC (Proof of Concept)**

### Acceptance Criteria
1. Docker Compose validated:
   - docker-compose.dev.yml starts PostgreSQL + pgvector + Ollama
   - Migrations run automatically on first start
   - Health checks confirm services ready
   - Persistent volumes for data (notes survive container restart)
   - One-command setup: `docker-compose up -d`
2. Setup documentation complete:
   - Quick-start guide for Windows 11 (target platform)
   - Quick-start guide for Linux/WSL (development)
   - Troubleshooting section (common errors, solutions)
   - Video walkthrough (optional, but helpful)
3. Health check system implemented:
   - /health endpoint reports all dependencies:
     - PostgreSQL connection status
     - pgvector extension available
     - Ollama reachable
     - Models downloaded
   - Diagnostic CLI command: `hotm doctor`
   - Clear error messages with resolution steps
4. MSI installer improvements scoped:
   - Research: embedded PostgreSQL options (pgx, PostgreSQL Portable)
   - Design: first-run wizard for database connection
   - Plan: Construction phase timeline for installer work

### Scope
**Standard**

**POC Activities**:
1. Validate docker-compose.dev.yml:
   - Test on clean Windows 11 machine (Docker Desktop)
   - Test on Linux/WSL
   - Verify: PostgreSQL starts, pgvector extension installed
   - Verify: Ollama starts, can pull models
   - Verify: API server connects, migrations run
2. Implement health check system:
   - Add /health endpoint to API server
   - Check PostgreSQL: connection, pgvector extension
   - Check Ollama: reachable, models available
   - Return JSON: service status, versions, diagnostics
3. Document setup process:
   - Write quick-start.md with step-by-step instructions
   - Include screenshots for clarity
   - Add troubleshooting section (collected from dev experience)
   - Link from README.md
4. Improve dev_server.sh:
   - Add more diagnostic output
   - Check Docker Compose availability
   - Offer to start docker-compose if services missing
   - Validate environment variables

### Effort Estimate
**2-3 days**
- Day 1: Docker Compose validation, testing on clean machine
- Day 2: Health check system implementation
- Day 3: Documentation writing, dev_server.sh improvements

### Owner
**DevOps Engineer** (Docker, health checks)
**Technical Writer** (documentation)
**Code Architect** (API health endpoint)

### Implementation Notes
- Test on Windows 11 with Docker Desktop (not just WSL)
- Document resource requirements (RAM, disk space)
- Consider alternative: SQLite + vector plugin (future, simpler)
- MSI installer work deferred to Construction (out of Elaboration scope)
- Prioritize Docker Compose as "easy path" for now

### Risk Retirement Criteria
- Docker Compose provides one-command setup
- Health checks diagnose common setup issues
- Documentation clear enough for non-developer to follow
- Setup complexity acceptable for MVP validation (personal use)

---

## Additional Technical Concerns

### SQLx Compilation with Database
**Status**: Monitoring (not in top 5, but worth tracking)

**Concern**: SQLx compile-time query verification requires DATABASE_URL at build time, which can fail in CI or clean environments.

**Validation Approach**:
- Use `sqlx prepare` to generate query metadata offline
- Commit `.sqlx/` directory to version control
- CI uses offline mode (no database connection needed)
- Document workflow in CLAUDE.md

**Effort**: <1 day (already partially implemented)

### Job Queue Reliability
**Status**: Covered by Risk #8 POC (Ollama integration)

**Concern**: Background jobs for NLP processing need reliable queueing and retry logic.

**Validation Approach**:
- Implement PostgreSQL-based job queue (part of Risk #8 POC)
- Test: job creation, processing, retry on failure
- Monitor: job queue depth, failed job rate
- Document: acceptable failure modes (eventual consistency ok)

**Effort**: Included in Risk #8 POC (Day 1-2)

### WebSocket Connection Stability
**Status**: Covered by Risk #8 Spike (real-time job updates)

**Concern**: WebSocket connections for real-time updates may be unreliable, need fallback to polling.

**Validation Approach**:
- Spike: WebSocket vs polling for job status updates (part of Risk #8)
- Test: reconnection logic, network interruption handling
- Fallback: polling API if WebSocket unavailable
- Document: WebSocket optional, not required for core functionality

**Effort**: Included in Risk #8 Spike (Day 4)

---

## Summary

### Risks to Validate
**Total**: 5 primary risks + 3 additional concerns

### Validation Methods

**POCs Planned**: 2
- Risk #8: Ollama graceful degradation + model alternatives
- Risk #9: Docker Compose setup validation

**Spikes Planned**: 2
- Risk #8: WebSocket stability for job updates
- Risk #12: Test-first workflow velocity experiment

**Performance Tests**: 2
- Risk #3: Test execution time benchmarking
- Risk #6: Search performance at scale

**Architecture Analysis**: 3
- Risk #3: Coverage gap analysis
- Risk #6: Query optimization analysis
- Risk #12: Test strategy definition

### Effort Summary

| Risk | Priority | Method | Effort | Owner |
|------|----------|--------|--------|-------|
| Risk #3: Test Coverage | P0 | Analysis + Perf Test | 2-3 days | QA Specialist |
| Risk #8: Ollama Dependency | P1 | POC + Spike | 4-5 days | Code Architect |
| Risk #12: Coverage Target | P1 | Analysis + Spike | 2 days + ongoing | QA Specialist |
| Risk #6: Performance | P1 | Perf Test + Analysis | 3 days | Performance Engineer |
| Risk #9: Setup Complexity | P1 | POC | 2-3 days | DevOps Engineer |
| **Total** | | | **13-16 days** | |

### Phase Gate Criteria

**Elaboration Exit Requirements**:
1. Risk #3: Coverage baseline established, CI enforcement active
2. Risk #8: Graceful degradation implemented, model alternatives tested
3. Risk #12: Coverage strategy defined, enforcement configured
4. Risk #6: Performance benchmarks established, bottlenecks identified
5. Risk #9: Docker Compose validated, health checks implemented

**Risk Retirement**: All P0 risks retired or mitigated to acceptable level before Construction phase.

---

## Validation Schedule

**Week 1** (Elaboration Phase 1):
- Risk #3: Coverage baseline (Day 1-2)
- Risk #9: Docker Compose validation (Day 3-4)
- Risk #12: Test strategy definition (Day 5)

**Week 2** (Elaboration Phase 2):
- Risk #8: Ollama POC (Day 1-4)
- Risk #6: Performance benchmarks (Day 1-3, parallel with Risk #8)
- Risk #3: Critical path test writing (Day 5, after coverage analysis)

**Week 3** (Elaboration Phase 3):
- Risk #8: WebSocket spike completion (Day 1)
- Risk #6: Query optimization (Day 2-3)
- Risk #9: Documentation + health checks (Day 4-5)

**Ongoing** (Construction Phase):
- Risk #12: Test-first discipline (30% time allocation)
- Risk #6: Performance monitoring during dogfooding
- All risks: Weekly review, adjust mitigation strategies

---

## Automation Outputs

**Created during validation**:
1. Coverage reports (HTML + JSON) - `/server/target/tarpaulin/`, `/ui/coverage/`
2. Performance benchmark results - `/docs/performance/benchmarks.md`
3. Test datasets - `/tests/fixtures/corpus-{size}.sql`
4. Health check API endpoint - `GET /health`
5. Quick-start guide - `/docs/quick-start.md`
6. Test templates - `/docs/implementation/test-templates.md`
7. Docker Compose validation report - `/docs/deployment/docker-validation.md`

**CI/CD Integration**:
1. Coverage enforcement in `.github/workflows/test.yml`
2. Performance regression tests in CI (future)
3. Health check integration tests
4. Docker Compose CI validation (services start correctly)

---

**Document Control**
**Created**: 2025-12-04
**Author**: System Analyst
**Phase**: Elaboration Planning
**Next Review**: After Week 1 validation activities
**Status**: Draft - Awaiting Requirements Analyst approval
