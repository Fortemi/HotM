# Inception Phase Plan

**Project**: HotM (Hall Of The Mind)
**Phase**: Inception
**Start Date**: 2025-12-04
**Target Duration**: 1-2 weeks (lightweight for solo dev)
**Status**: Active
**Document Version**: 1.0

## Executive Summary

HotM is transitioning from alpha prototype to MVP-ready foundation. The Inception phase focuses on:
1. Documenting architecture cleanup decisions (post-rollback from single-exe attempt)
2. Establishing risk management baseline (15 identified risks)
3. Defining MVP scope for personal validation (3-6 months daily use)
4. Setting up development workflow for rapid iteration

**Key Principle**: Lightweight process for solo developer - document critical decisions, establish baseline, get to feature work quickly.

---

## Phase Objectives

### 1. Architecture Baseline
Document key architectural decisions and cleanup strategy:
- **Client-Server Rationale**: Why separate Tauri + Axum vs single executable
- **Database Schema Rebuild**: Greenfield approach for fast iteration
- **Rollback Analysis**: What went wrong with single-exe integration, cleanup plan
- **Deployment Options**: Docker vs native for PostgreSQL + Ollama

### 2. Risk Management Baseline
Identify and track critical risks for MVP validation:
- **Architecture Risks**: Incomplete rollback, broken features, schema handling
- **Technical Risks**: Test coverage, performance, setup complexity
- **Validation Risks**: Core features inadequate, daily use friction, Ollama dependency
- **External Risks**: Better alternatives emerge

### 3. MVP Scope Definition
Define must-have features for personal validation:
- **Core Features**: Note CRUD, hybrid search, auto-linking, auto-tagging
- **Windows UX**: Desktop app, tray integration, global hotkey
- **Quality Targets**: Search <500ms, test coverage 60%+, daily use viable
- **Deferred Features**: MCP integration, advanced UX polish, multi-device sync

### 4. Development Setup
Ensure clean rebuild workflow for rapid iteration:
- **Database Rebuild**: Scripts for Linux/Windows (clean-schema.sql approach)
- **Testing Infrastructure**: CI validation with gh act, coverage tracking
- **Documentation**: CLAUDE.md updated with current architecture state
- **Install Scripts**: dev_server.sh improvements, one-command setup

---

## Activities and Deliverables

### Architecture (Status: Completed)

**Deliverables**:
- [x] **ADR-001: Client-Server Architecture** (.aiwg/architecture/ADR-001-client-server-architecture.md)
  - Rationale for Tauri + Axum separation vs single executable
  - Deployment scenarios (local, Docker, native, network)
  - Consequences, mitigation strategies, future considerations
  - Related: Failed single-exe integration (commits fcebdd2, 1b900c0, b47bd08, 40907e6)

- [x] **ADR-002: Database Schema Rebuild Strategy** (.aiwg/architecture/ADR-002-database-schema-rebuild.md)
  - Greenfield "clean schema rebuild" approach for development
  - Migration files preserved for historical reference and CI validation
  - Developer workflows: fast iteration vs migration-based evolution
  - Phase evolution: Development (greenfield) → Pre-production (migrations) → Production (strict controls)

- [x] **Rollback Analysis** (.aiwg/working/rollback-analysis.md)
  - Documentation of single-exe integration removal
  - Lessons learned, cleanup checklist
  - Validation that client-server architecture is restored

- [x] **Clean Schema Files**:
  - scripts/schema/clean-schema.sql (consolidated schema from all migrations)
  - scripts/schema/rebuild-schema.sh (Linux/WSL)
  - scripts/schema/rebuild-schema.ps1 (Windows PowerShell)

**Owner**: Architecture Designer
**Completion Date**: 2025-12-04

### Risk Management (Status: Completed)

**Deliverables**:
- [x] **Risk Register** (.aiwg/risks/risk-list.md)
  - 15 identified risks across architecture, technical, validation, external categories
  - Impact/probability prioritization matrix
  - Mitigation strategies assigned to roles/agents
  - Critical path risks identified (blocking MVP):
    - Risk #1: Incomplete rollback leaves broken integration
    - Risk #3: Test coverage insufficient for safe iteration
    - Risk #5: Core features inadequate for daily use

**Owner**: Requirements Analyst
**Completion Date**: 2025-12-04

### Requirements (Status: In Progress)

**Deliverables**:
- [x] **Option Matrix** (.aiwg/intake/option-matrix.md)
  - Project context, audience, deployment model
  - Priority weights, trade-offs, non-negotiables
  - SDLC framework sizing (what to use, skip, defer)
  - MVP scope checklist (must-have vs nice-to-have)

- [ ] **MVP Scope Document** (Detailed)
  - Feature checklist with priority (must-have, should-have, defer)
  - Acceptance criteria per feature (what makes it "good enough")
  - Performance targets (search latency, embedding generation time)
  - Validation metrics (daily use tracking, friction log)

**Next Actions**:
1. Extract MVP feature checklist from option-matrix.md
2. Define acceptance criteria for core features
3. Set performance targets for search and NLP pipeline
4. Document validation metrics (how to track daily use success)

**Owner**: Requirements Analyst
**Due Date**: End of week 1 (2025-12-11)

### Testing (Status: To Do)

**Deliverables**:
- [ ] **Test Coverage Baseline**
  - Measure current coverage (cargo tarpaulin for Rust, npm test --coverage for React)
  - Document coverage by module/component
  - Identify critical paths without tests
  - Gap analysis: What needs testing to reach 60% target?

- [ ] **Test Strategy (Lightweight)**
  - Coverage targets: 60% overall, 80%+ for core paths (note CRUD, search, linking)
  - Test organization: Unit tests colocated, integration in /tests, E2E for critical journeys
  - CI enforcement: gh act -j backend-tests and frontend-tests as authoritative standard
  - Manual test protocol: Checklist for areas without automated coverage

**Next Actions**:
1. Run `cd server && cargo tarpaulin --out Stdout` to measure Rust coverage
2. Run `cd ui && npm test -- --coverage` to measure React coverage
3. Document coverage baseline (current %, gaps, priorities)
4. Create test strategy document (targets, organization, CI enforcement)
5. Identify critical user journeys for E2E tests

**Owner**: Test Engineer
**Due Date**: End of week 1 (2025-12-11)

### Development Setup (Status: Partially Complete)

**Deliverables**:
- [x] **Database Rebuild Scripts**
  - scripts/schema/clean-schema.sql (consolidated schema)
  - scripts/schema/rebuild-schema.sh (Linux/WSL)
  - scripts/schema/rebuild-schema.ps1 (Windows PowerShell)
  - Testing: Validated on development machine

- [x] **Documentation Updates**
  - CLAUDE.md updated with database setup instructions
  - Architecture decisions documented in ADRs
  - Risk register baselined

- [ ] **Install Scripts Improvements**
  - dev_server.sh: Enhance with health checks, model pulling, pgvector verification
  - One-command setup: `./scripts/dev_server.sh` should handle all dependencies
  - Error messages: Clear guidance when dependencies missing
  - Windows equivalent: dev-server.ps1 for PowerShell users

- [ ] **CI Verification**
  - Run `gh act -j backend-tests` locally to validate CI passes
  - Run `gh act -j frontend-tests` locally to validate CI passes
  - Document CI workflow for developers (required before all pushes)
  - Add coverage reporting to CI (tarpaulin + vitest coverage)

**Next Actions**:
1. Improve dev_server.sh with comprehensive health checks
2. Test install workflow on clean machine (if possible)
3. Run gh act locally to validate CI passes
4. Add coverage reporting to GitHub Actions workflows

**Owner**: DevOps Engineer
**Due Date**: End of week 2 (2025-12-18)

---

## Gate Criteria

**Lifecycle Objective (LO) Milestone** - Ready for Elaboration when:

### 1. Architecture Direction Clear (Status: PASS)
- [x] Key decisions documented (ADR-001: Client-Server, ADR-002: Schema Rebuild)
- [x] Clean separation validated (Tauri client + Axum server working independently)
- [x] Deployment options documented (Docker Compose vs native PostgreSQL/Ollama)
- [x] Rollback cleanup plan established (architecture stable enough to build on)

**Evidence**: ADR-001 and ADR-002 completed, clean-schema.sql working, client-server separation validated

### 2. Risks Identified and Tracked (Status: PASS)
- [x] Risk register baselined (15 risks documented)
- [x] Critical risks have mitigation plans (Risks #1, #3, #5 with strategies)
- [x] Rollback risks documented and retired (single-exe integration failure analyzed)
- [x] Prioritization matrix established (Critical Path, High Priority, Monitor, Watch List)

**Evidence**: risk-list.md completed with mitigation strategies

### 3. MVP Scope Defined (Status: IN PROGRESS)
- [x] High-level feature checklist documented (in option-matrix.md)
- [ ] **Detailed acceptance criteria defined** (what makes each feature "good enough")
- [ ] **Performance targets set** (search <500ms, embedding generation, test coverage 60%+)
- [ ] **Validation metrics established** (how to track daily use success)

**Evidence**: Option matrix complete, detailed MVP scope document needed

**Blocker**: Need MVP scope document with acceptance criteria and performance targets

### 4. Stakeholder Agreement (Status: PASS)
- [x] Vision clear (personal memory map, AI-powered linking, privacy-first)
- [x] Priorities set (local-first forever, reliable daily use, quality over speed)
- [x] Timeline realistic (1-2 weeks Inception, 2-4 weeks Elaboration, 3-6 months validation)
- [x] Solo developer, self-approval (no multi-stakeholder coordination needed)

**Evidence**: Option matrix, ADRs, risk register align on vision and priorities

### 5. Development Workflow Proven (Status: IN PROGRESS)
- [x] Database rebuild scripts working (clean-schema.sql validated)
- [x] Documentation updated (CLAUDE.md reflects current architecture)
- [ ] **Test coverage baseline measured** (know current % for Rust and React)
- [ ] **CI validation passes** (gh act -j backend-tests and frontend-tests green)

**Evidence**: Rebuild scripts working, CI validation needed

**Blocker**: Need test coverage baseline and CI validation

---

## Gate Status Summary

**Overall Status**: 60% Complete (3 of 5 criteria PASS, 2 IN PROGRESS)

**Ready for Elaboration**: NO (2 blockers)

**Blockers**:
1. **MVP Scope Document**: Need detailed acceptance criteria and performance targets
2. **Testing Baseline**: Need coverage % measured and CI validation passing

**Timeline**:
- **Week 1 (Current)**: Complete MVP scope document, measure test coverage baseline
- **Week 2**: CI validation, install script improvements, gate check
- **Target Gate Pass**: 2025-12-18 (end of week 2)

---

## Next Phase: Elaboration

**Trigger**: When all 5 gate criteria pass (MVP scope + testing baseline complete)

**Elaboration Objectives**:
1. **Build architectural baseline**: Core features working end-to-end (note CRUD, search, linking)
2. **Retire HIGH risks**: Address test coverage, feature quality, rollback cleanup
3. **Iterate on quality**: Search quality, linking accuracy, Windows UX polish
4. **Establish performance benchmarks**: Search latency with 100/500/1000 note corpus

**Elaboration Duration**: 2-4 weeks

**Elaboration Deliverables**:
- Core features stabilized (note CRUD, hybrid search, auto-linking working)
- Test coverage to 60%+ (enforced in CI)
- Performance benchmarks established (search <500ms for 100 notes)
- Windows UX validated (hotkey, tray, multi-monitor)
- Ready for personal validation (daily use starting)

---

## Timeline

### Week 1 (Current - Inception Active)
**Dates**: 2025-12-04 to 2025-12-11

**Completed**:
- [x] Architecture cleanup (documentation removal, ADR-001, ADR-002)
- [x] Risk register baselined (15 risks, mitigation strategies)
- [x] Database rebuild scripts (clean-schema.sql, rebuild scripts)
- [x] Option matrix (project context, MVP scope high-level)

**In Progress**:
- [ ] MVP scope document (detailed acceptance criteria, performance targets)
- [ ] Test coverage baseline (measure current %, identify gaps)

**Target Completion**: Friday 2025-12-11
- MVP scope document with acceptance criteria
- Test coverage baseline measured and documented
- Critical path risks in "Mitigating" status

### Week 2 (Inception Wrap-Up)
**Dates**: 2025-12-11 to 2025-12-18

**Activities**:
- [ ] CI validation (gh act -j backend-tests and frontend-tests passing)
- [ ] Install script improvements (dev_server.sh enhancements)
- [ ] Documentation review (ensure CLAUDE.md, ADRs, risk register aligned)
- [ ] Gate check preparation (validate all 5 criteria met)
- [ ] Transition planning (Elaboration phase kickoff)

**Target Completion**: Wednesday 2025-12-18
- All gate criteria PASS
- Ready to transition to Elaboration
- Elaboration iteration plan drafted

### Weeks 3-6 (Elaboration Phase)
**Dates**: 2025-12-18 to 2026-01-15

**Focus**:
- Core features stabilized (note CRUD, search, linking)
- Test coverage to 60%+ (CI enforced)
- Performance benchmarks established
- Windows UX validated
- Ready for personal validation

**Deliverables**:
- Architectural baseline (end-to-end working)
- HIGH risks retired (test coverage, feature quality)
- Performance targets met (search <500ms)
- Elaboration exit gate passed

### Months 2-6 (Construction/Validation)
**Dates**: 2026-01-15 to 2026-06-15

**Focus**:
- Daily personal use (validation metrics tracked)
- Iterative improvements (based on friction log)
- Quality polish (UX, performance, reliability)
- Validation metrics review (adoption, quality, value)

**Milestone**: 3-month checkpoint (2026-04-15)
- Decision: Continue validation, pivot concept, or abandon

**End Gate**: 6-month validation complete (2026-06-15)
- Decision: Keep private, open source, or pivot

---

## Resources

### Team
**Size**: 1 developer (solo)
**Availability**: Part-time/hobby (~1.3 commits/day sustained over 6 months)
**Experience**: Senior (30+ years system engineering)
**Skills**: Rust, React, TypeScript, PostgreSQL, Docker, Tauri, Axum, NLP/AI

### Agents Available (AIWG Framework)
**Currently Active**:
- **Requirements Analyst**: MVP scope, acceptance criteria, validation metrics (current phase)
- **Architecture Designer**: ADRs, design decisions, rollback analysis (completed)
- **Test Engineer**: Coverage baseline, test strategy, CI enforcement (in progress)

**Available for Elaboration/Construction**:
- **Code Reviewer**: Cleanup review, quality checks, PR self-review
- **Database Optimizer**: Schema performance, query optimization, indexing strategy
- **Performance Engineer**: Benchmarking, profiling, optimization
- **UX Designer**: Windows integration, interaction design, accessibility
- **DevOps Engineer**: Install scripts, Docker Compose, CI/CD improvements

**Explicitly Skipped** (not needed for solo dev, local-first, pre-launch):
- Security Specialist (no compliance requirements, local-only)
- Operations Specialist (no SLA, no monitoring requirements)
- Enterprise Specialist (no governance, no multi-stakeholder coordination)

### Tools and Infrastructure

**Development**:
- **Languages**: Rust (server), TypeScript/React (UI), SQL (schema)
- **Frameworks**: Axum (API), Tauri (desktop), SQLx (database)
- **Database**: PostgreSQL 14+ with pgvector extension
- **AI Service**: Ollama (local inference, gpt-oss:20b, nomic-embed-text)

**Testing**:
- **CI/CD**: GitHub Actions (via gh act for local validation)
- **Rust Coverage**: cargo tarpaulin
- **React Coverage**: vitest with coverage plugin
- **E2E Testing**: Playwright (for critical user journeys)

**Deployment**:
- **Development**: Docker Compose (PostgreSQL + Ollama) or native installs
- **Production**: MSI installer (Tauri), Windows Service (Axum future)
- **Target Platform**: Windows 11 (primary), Linux (development)

**Documentation**:
- **Project Docs**: docs/ directory (requirements, specs, architecture, implementation)
- **AIWG Artifacts**: .aiwg/ directory (intake, architecture, risks, planning)
- **Developer Guide**: CLAUDE.md (comprehensive project context)

---

## Success Criteria

**Inception Phase Succeeds When**:

### Architecture Foundation
- [x] Architecture decisions documented and validated (ADR-001, ADR-002)
- [x] Client-server separation proven working (Tauri + Axum + PostgreSQL + Ollama)
- [x] Deployment options documented (Docker vs native, clear setup instructions)

### Risk Management
- [x] Risks identified and mitigation plans in place (15 risks, prioritization matrix)
- [x] Critical path risks in "Mitigating" status (Risks #1, #3, #5)
- [ ] Rollback cleanup validated (test suite passes, architecture stable)

### MVP Scope
- [x] High-level MVP scope defined (from option-matrix.md)
- [ ] **Detailed acceptance criteria documented** (what makes features "good enough")
- [ ] **Performance targets set** (search <500ms, coverage 60%+)
- [ ] **Validation metrics established** (daily use tracking plan)

### Development Workflow
- [x] Database rebuild workflow proven (clean-schema.sql, scripts working)
- [ ] **Test coverage baseline measured** (know current % for Rust and React)
- [ ] **CI validation passing** (gh act green for backend and frontend)
- [x] Documentation updated (CLAUDE.md reflects current state)

### Gate Readiness
- [ ] **All 5 gate criteria PASS** (2 blockers remaining: MVP scope detail, testing baseline)
- [ ] **Ready to start feature development** (Elaboration phase can begin)
- [ ] **Solo developer confident in plan** (clear vision, realistic timeline, proven workflow)

---

## Notes

### Lightweight Process Rationale

**Why Minimal Inception for HotM**:
- **Solo developer**: No multi-stakeholder alignment needed, self-approval sufficient
- **Personal tool**: Requirements in developer's head, formal use cases overkill
- **Pre-launch**: No customers, no contracts, no compliance requirements
- **Proven architecture**: Client-server design validated, not greenfield exploration

**Focus Areas**:
- **Document critical decisions**: ADRs for future reference (if open sourced, if team grows)
- **Track risks**: 15 risks identified, mitigation plans for critical path blockers
- **Define MVP**: Feature checklist for personal validation (must-have vs defer)
- **Prove workflow**: Database rebuild, CI validation, rapid iteration ready

**Avoid Heavyweight Process**:
- Skip formal requirements (no use cases, no user stories, no comprehensive traceability)
- Skip multi-agent reviews (solo dev, self-review faster and sufficient)
- Skip comprehensive architecture docs (README + ADRs sufficient for now)
- Skip governance (no coordination overhead with solo dev)

### Framework Evolution

**When to Increase Rigor** (future):
- **Multi-user** (5+ active users): Add authentication, monitoring, 80%+ test coverage
- **Open source release**: Add CONTRIBUTING.md, issue templates, PR review, expand architecture docs
- **Team expansion** (2+ developers): Formal requirements (ADRs/design docs), code review, AIWG iteration workflow
- **Commercial/hosted**: SLA monitoring, security compliance (SOC2), customer support

**Keep Lightweight While**:
- Solo developer only (current state)
- Personal use only (validation phase)
- Pre-launch (alpha → MVP → validation)
- Privacy-first, local-only (no external dependencies, no compliance)

### Next Command

When MVP scope and testing baseline complete, validate readiness:
```
/flow-gate-check inception
```

This will verify:
1. Architecture direction clear (PASS)
2. Risks identified and tracked (PASS)
3. MVP scope defined (check for detailed acceptance criteria)
4. Stakeholder agreement (PASS for solo dev)
5. Development workflow proven (check for test baseline + CI validation)

If all criteria pass, transition to Elaboration phase with confidence.

---

## Appendix: Definitions

### Phase Definitions (RUP-Inspired, Solo Dev Adapted)

**Inception** (Current):
- Understand problem space, establish vision
- Document critical decisions (ADRs)
- Identify and prioritize risks
- Define MVP scope for validation
- Prove development workflow
- **Duration**: 1-2 weeks (lightweight for solo dev)

**Elaboration** (Next):
- Build architectural baseline (core features working)
- Retire high-priority risks (test coverage, feature quality)
- Iterate on quality (search, linking, UX)
- Establish performance benchmarks
- **Duration**: 2-4 weeks

**Construction** (Future):
- Implement remaining MVP features
- Polish UX for daily use
- Achieve 60%+ test coverage
- Performance optimization
- **Duration**: 4-8 weeks

**Transition** (Future):
- Personal validation (3-6 months daily use)
- Track validation metrics (adoption, quality, value)
- Iterative improvements based on friction log
- Decision: Keep private, open source, or pivot

### Gate Criteria (Lifecycle Objectives)

**Inception Exit** (Lifecycle Objective Milestone):
- Architecture direction clear
- Risks identified and tracked
- MVP scope defined with acceptance criteria
- Stakeholder agreement (solo dev self-approval)
- Development workflow proven

**Elaboration Exit** (Lifecycle Architecture Milestone):
- Architectural baseline working (core features end-to-end)
- High-priority risks retired or mitigated
- Performance benchmarks met (search <500ms)
- Test coverage 60%+
- Ready for Construction (feature development)

**Construction Exit** (Initial Operational Capability):
- MVP features complete
- Test coverage 60%+ enforced in CI
- Windows UX polished
- Performance targets met
- Ready for personal validation

**Transition Exit** (Product Release):
- Personal validation complete (3-6 months daily use)
- Validation metrics positive (adoption, quality, value)
- Decision made (keep private, open source, pivot)
- If open sourcing: Documentation expanded, contributor guide ready

---

**Document Control**

**Created**: 2025-12-04
**Author**: Requirements Analyst
**Version**: 1.0
**Status**: Active (Inception Phase in progress)
**Review Cycle**: Weekly during Inception
**Next Review**: 2025-12-11 (end of week 1, gate criteria check)
**Related Documents**:
- .aiwg/intake/option-matrix.md (project context, MVP scope high-level)
- .aiwg/architecture/ADR-001-client-server-architecture.md
- .aiwg/architecture/ADR-002-database-schema-rebuild.md
- .aiwg/risks/risk-list.md (15 risks, mitigation strategies)
- CLAUDE.md (developer guide, current architecture state)
