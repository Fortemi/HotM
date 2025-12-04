# HotM Risk Register

**Project**: HotM - Personal Knowledge Management Tool
**Phase**: Alpha (Prototype to MVP Transition)
**Last Updated**: 2025-12-04
**Document Version**: 1.0

## Executive Summary

This risk register tracks identified risks across the HotM project lifecycle, with current focus on:
1. **Architecture cleanup** from failed single-exe integration rollback
2. **MVP validation** readiness for daily personal use
3. **Technical sustainability** for long-term development
4. **Validation success** criteria and alternatives

**Critical Path Risks** (blocking MVP):
- Risk #1: Incomplete rollback leaves broken integration
- Risk #3: Test coverage insufficient for safe iteration
- Risk #5: Core features inadequate for daily use

---

## Architecture Cleanup Risks (Immediate)

### Risk #1: Incomplete Rollback Leaves Dead Code or Broken Integration Paths

**Category**: Architecture
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Rolling back the failed single-exe integration may leave orphaned code, broken imports, or misconfigured build paths. This creates technical debt, confusion for future development, and potential runtime failures that are hard to diagnose.

**Triggers**:
- Partial git revert without full dependency cleanup
- Build scripts still referencing removed components
- Environment variables or configs pointing to non-existent paths
- Unused dependencies in Cargo.toml or package.json

**Mitigation Strategies**:
1. **Pre-rollback audit**: Document all files/configs changed during integration attempt
2. **Systematic cleanup**: Use `git diff` against last known good commit (6bc5cbc) to identify all changes
3. **Dependency verification**: Run `cargo tree` and `npm list` to check for orphaned dependencies
4. **Dead code detection**: Use `cargo-udeps` and ESLint's no-unused-vars to find unused imports
5. **Documentation update**: Update CLAUDE.md and architecture docs to reflect restored state

**Owner**: Requirements Analyst (this phase) → Code Architect (implementation)
**Due Date**: Before any new feature work begins
**Last Updated**: 2025-12-04

---

### Risk #2: Rollback Breaks Working Features

**Category**: Architecture
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Restoring client-server architecture might inadvertently break currently working features like note CRUD operations, search functionality, or linking mechanisms if integration changes touched shared code paths.

**Triggers**:
- Reverting commits that included bug fixes alongside integration work
- Database schema changes that were beneficial but bundled with integration
- Shared utilities modified during integration that other features depend on
- Configuration changes required by both architectures

**Mitigation Strategies**:
1. **Regression test suite**: Run `gh act -j backend-tests` and `gh act -j frontend-tests` before and after rollback
2. **Feature checklist validation**: Test critical user journeys manually:
   - Create note → Save → Retrieve
   - Search by text and semantic similarity
   - Create links between notes
   - Tag management and filtering
3. **Incremental rollback**: Revert in small commits, testing after each
4. **Cherry-pick good changes**: Identify bug fixes or improvements to preserve
5. **Database migration review**: Ensure schema rollbacks don't lose data or break existing queries

**Owner**: QA Specialist (test execution) + Code Architect (rollback strategy)
**Due Date**: Completion of architecture cleanup phase
**Last Updated**: 2025-12-04

---

### Risk #3: Test Coverage Insufficient to Catch Rollback Regressions

**Category**: Technical
**Impact**: HIGH
**Probability**: HIGH
**Status**: Identified

**Description**:
Current test coverage may be below the 60% target, leaving critical paths untested. Without comprehensive tests, rollback regressions won't be caught until manual testing or production use, delaying MVP validation.

**Triggers**:
- Test suite exists but has low coverage percentage
- Integration tests missing for key API endpoints
- E2E tests not covering primary user workflows
- No test coverage reporting in CI/CD pipeline

**Mitigation Strategies**:
1. **Coverage baseline**: Run `cargo tarpaulin` (Rust) and `npm test -- --coverage` (React) to establish current metrics
2. **Prioritized test writing**: Focus on critical paths first:
   - Note CRUD operations (API + DB layer)
   - Search hybrid algorithm (FTS + vector)
   - Link creation and traversal
   - Tag and collection management
3. **Add coverage to CI**: Integrate coverage reports in `gh act` workflows
4. **Test-before-rollback**: Write missing tests BEFORE reverting code to establish safety net
5. **Manual test protocol**: Document manual test checklist for areas without automated coverage

**Owner**: QA Specialist (test creation) + Development Lead (CI integration)
**Due Date**: Before rollback begins (high priority)
**Last Updated**: 2025-12-04

---

### Risk #4: Database Schema Changes Need Careful Handling

**Category**: Architecture
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
If single-exe integration included database schema changes (new tables, columns, indexes), rolling back requires careful migration management to avoid data loss or broken queries in the restored client-server architecture.

**Triggers**:
- Integration added new tables/columns that rollback removes
- Existing data would become orphaned after schema rollback
- SQLx compile-time query verification fails after schema changes
- Migration history becomes inconsistent

**Mitigation Strategies**:
1. **Schema change audit**: Review all migrations created during integration period
2. **Data preservation check**: Ensure no production data exists that depends on new schema
3. **Migration rollback**: Create explicit down migrations for any schema changes
4. **SQLx verification**: Run `cargo sqlx prepare` after schema changes to regenerate query metadata
5. **Test database validation**: Apply and rollback migrations on test DB before production

**Owner**: Database Specialist + Code Architect
**Due Date**: During rollback execution
**Last Updated**: 2025-12-04

---

## MVP Validation Risks (Short-term)

### Risk #5: Core Features Don't Work Well Enough for Daily Use

**Category**: Validation
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
The MVP must be "good enough" to replace current note-taking workflow (e.g., Notion, Obsidian, plain text files). If search is too slow, linking is clunky, or the UI is frustrating, daily adoption fails and validation data becomes meaningless.

**Triggers**:
- Search takes >2 seconds for small corpus (<100 notes)
- UI requires too many clicks for common operations
- Note revisions don't preserve formatting or context
- Linking requires manual IDs instead of natural selection
- Global hotkey (Ctrl+Alt+H) unreliable or conflicts

**Mitigation Strategies**:
1. **Define "good enough" criteria**: Document minimum acceptable performance/UX before building
   - Search response: <500ms for 100 notes
   - Note creation: <3 clicks from hotkey
   - Link creation: Point-and-click, no copy/paste IDs
2. **Early dogfooding**: Use HotM for actual note-taking starting in Elaboration phase
3. **UX friction log**: Track every moment of frustration during daily use
4. **Rapid iteration budget**: Reserve 20% of Construction time for UX polish based on dogfooding
5. **Fallback plan**: Keep existing note system in parallel for first 2 weeks

**Owner**: Product Owner (validation) + UX Designer (iteration)
**Due Date**: End of Elaboration phase (validation criteria), ongoing during Construction
**Last Updated**: 2025-12-04

---

### Risk #6: Performance Degrades with Growing Note Corpus

**Category**: Technical
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Hybrid search (FTS + vector similarity) may perform acceptably with 10-50 notes but degrade significantly at 100+ notes, especially if vector indexing or reciprocal rank fusion becomes bottleneck. This would block long-term validation.

**Triggers**:
- No performance benchmarks established for target corpus size
- Vector index (HNSW) not properly tuned for data size
- N+1 query problems in note retrieval with tags/links
- Full table scans instead of index usage
- In-memory fusion algorithm scales poorly

**Mitigation Strategies**:
1. **Performance benchmarks**: Create test suite with 100/500/1000 note datasets
2. **Index optimization**: Ensure GIN indexes on tsvector and HNSW on vector embeddings
3. **Query profiling**: Use `EXPLAIN ANALYZE` on slow queries, optimize based on results
4. **Pagination**: Implement cursor-based pagination for search results
5. **Caching layer**: Add Redis/in-memory cache for frequently accessed notes
6. **Monitoring**: Log query times in development, alert on >500ms responses

**Owner**: Performance Engineer + Database Specialist
**Due Date**: End of Elaboration (benchmarks), Transition (optimization)
**Last Updated**: 2025-12-04

---

### Risk #7: Windows 11 UX Friction Prevents Habitual Use

**Category**: Validation
**Impact**: HIGH
**Probability**: LOW
**Status**: Identified

**Description**:
Despite targeting Windows 11 visual style (Mica/Acrylic), poor UX integration with OS could prevent HotM from becoming a habitual tool. Examples: hotkey conflicts, slow window activation, no taskbar quick actions, poor multi-monitor support.

**Triggers**:
- Global hotkey conflicts with other apps
- Window appears on wrong monitor
- Slow window focus/activation (>300ms lag)
- No Windows 11 context menu integration
- Tray icon unreliable or hard to find

**Mitigation Strategies**:
1. **Windows integration checklist**: Document all integration points (hotkey, tray, taskbar, context menu)
2. **Conflict detection**: Test hotkey on clean Windows 11 install and with common apps (VS Code, Slack, Discord)
3. **Performance profiling**: Measure window activation time, optimize Tauri initialization
4. **Multi-monitor testing**: Test on 1/2/3 monitor setups with different DPI scaling
5. **Native Windows features**: Consider Windows 11 Quick Actions, Jump Lists, share targets

**Owner**: UX Designer + Windows Platform Specialist
**Due Date**: Elaboration phase (design), Construction (implementation)
**Last Updated**: 2025-12-04

---

### Risk #8: Ollama Dependency Creates Barrier to Entry

**Category**: Validation
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Requiring Ollama with `gpt-oss:20b` (large model) and GPU for acceptable performance may prevent MVP validation if setup is complex or hardware insufficient. Solo developer testing on single machine may miss these issues.

**Triggers**:
- Model requires GPU with >8GB VRAM
- Ollama installation fails on target system
- Model download times out or fails (20B model is large)
- Inference too slow without GPU (>10s per revision)
- No clear error messages when Ollama unavailable

**Mitigation Strategies**:
1. **Graceful degradation**: Allow note creation/storage without Ollama, queue NLP for later
2. **Model alternatives**: Test smaller models (`gpt-oss:7b`, `mistral:7b`) for acceptable quality
3. **CPU fallback**: Document CPU-only performance, set expectations
4. **Setup automation**: `./scripts/dev_server.sh` already checks Ollama, extend to pull models
5. **Error handling**: Clear user messages when Ollama missing/failed, link to setup docs
6. **Test on second machine**: Validate on different hardware (laptop vs desktop, different GPU)

**Owner**: DevOps Engineer (setup) + Product Owner (requirements)
**Due Date**: Elaboration phase (requirements), Construction (implementation)
**Last Updated**: 2025-12-04

---

## Technical Risks (Ongoing)

### Risk #9: PostgreSQL + Ollama Setup Complexity Deters Future Users

**Category**: Technical
**Impact**: MEDIUM
**Probability**: HIGH
**Status**: Identified

**Description**:
Even for MVP validation, setting up PostgreSQL (with pgvector extension), Ollama, and models is complex compared to "install and run" apps. This creates friction for future users if project is shared/open-sourced.

**Triggers**:
- No automated installer or setup script
- Manual PostgreSQL + pgvector compilation required
- Database migrations require manual execution
- Environment variables not well documented
- No Docker Compose for easy local setup

**Mitigation Strategies**:
1. **Docker Compose**: Create `docker-compose.dev.yml` for PostgreSQL + pgvector + Ollama (already exists, validate)
2. **MSI installer improvements**: Include PostgreSQL embedded option in installer
3. **Setup wizard**: First-run wizard in Tauri app to configure database connection
4. **Documentation**: Quick-start guide with copy/paste commands for Windows/Linux
5. **Health checks**: Built-in system check to diagnose missing dependencies
6. **Future**: Consider SQLite + vector plugin as simpler alternative for single-user mode

**Owner**: DevOps Engineer (Docker/installer) + Technical Writer (docs)
**Due Date**: Elaboration (Docker validation), Transition (installer improvements)
**Last Updated**: 2025-12-04

---

### Risk #10: Local-First Sync Design Unproven

**Category**: Technical
**Impact**: LOW (not in MVP scope)
**Probability**: HIGH
**Status**: Monitoring

**Description**:
Future cloud sync with novel encryption + P2P design is architecturally complex and unproven. This could become a major risk if prioritized before MVP validation, but is low risk for current phase since it's explicitly deferred.

**Triggers**:
- Feature creep: attempting sync before MVP validation complete
- User expectations: assuming multi-device sync in alpha
- Technical curiosity: "solving" sync before proving core value

**Mitigation Strategies**:
1. **Scope discipline**: Keep sync out of scope until post-MVP validation (6+ months)
2. **Architecture preparation**: Design database schema to support eventual sync (immutability helps)
3. **Research**: Document sync approaches during low-priority time, don't implement
4. **User communication**: Clear documentation that v0.1-v0.2 are single-device only
5. **Alternative**: Consider simpler sync (Dropbox folder, Git-based) before custom solution

**Owner**: Product Owner (scope management)
**Due Date**: No action required until post-MVP
**Last Updated**: 2025-12-04

---

### Risk #11: Rust + React + Tauri Stack Has Limited Community

**Category**: Technical
**Impact**: MEDIUM
**Probability**: LOW
**Status**: Monitoring

**Description**:
Technology stack (Rust + Axum + SQLx + Tauri + React) is modern but less common than LAMP/MEAN/Rails, making it harder to find examples, troubleshoot issues, or onboard future contributors.

**Triggers**:
- Stuck on obscure Tauri issue with no Stack Overflow answers
- Axum breaking changes between versions
- SQLx compile-time verification fails in mysterious ways
- Difficulty finding developers familiar with full stack

**Mitigation Strategies**:
1. **Documentation first**: Over-document architectural decisions and patterns
2. **Community engagement**: Active in Tauri Discord, Axum discussions, Rust forums
3. **Dependency pinning**: Lock major versions to avoid breaking changes
4. **Fallback skills**: Solo dev has enough full-stack experience to work through issues
5. **Architecture simplicity**: Keep abstractions simple to reduce learning curve
6. **Future**: If project grows, provide comprehensive onboarding guide

**Owner**: Code Architect (documentation) + Community Manager (if needed)
**Due Date**: Ongoing
**Last Updated**: 2025-12-04

---

### Risk #12: Test Coverage Remains Below 60% Target

**Category**: Technical
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Solo developer velocity pressure may deprioritize test writing, leading to sustained low coverage (<60% target). This creates technical debt and makes refactoring risky, slowing long-term development.

**Triggers**:
- "Just ship it" mindset during Construction
- Test writing perceived as slower than feature development
- No coverage metrics tracked in CI
- Regressions occur but aren't caught by tests

**Mitigation Strategies**:
1. **Test-first discipline**: Write tests before features for critical paths
2. **Coverage gates**: CI fails if coverage drops below 60% (enforce in `gh act`)
3. **Test templates**: Create reusable test patterns for common scenarios (API tests, component tests)
4. **Time boxing**: Allocate 30% of development time to testing (not afterthought)
5. **Refactoring budget**: Reserve Construction Phase 3 for test debt paydown
6. **Visibility**: Add coverage badge to README, review in weekly progress

**Owner**: QA Specialist (strategy) + Development Lead (enforcement)
**Due Date**: Set up coverage gates in Elaboration, maintain through Construction
**Last Updated**: 2025-12-04

---

## Validation Risks (Medium-term)

### Risk #13: Personal Validation Fails (Don't Use Daily After 3-6 Months)

**Category**: Validation
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
The ultimate MVP failure: building HotM but reverting to previous note-taking system after initial novelty wears off. This indicates core concept or UX issues that would prevent broader adoption.

**Triggers**:
- Friction points never get fixed (UX debt accumulates)
- Core value proposition (immutable originals + AI revision) doesn't prove useful
- Search quality insufficient compared to alternatives
- Too slow/buggy for daily workflow
- Ollama dependency too annoying to maintain

**Mitigation Strategies**:
1. **Validation metrics**: Track daily usage stats (notes created, searches run, links made)
2. **Friction log**: Document every time returning to old system, analyze why
3. **Weekly retrospectives**: Every Friday, review what worked/didn't in daily use
4. **Minimum usage commitment**: Force use for 30 days before judging (break old habits)
5. **Pivot criteria**: Define clear signals for "fix vs pivot vs abandon" decisions:
   - Fix: Using daily but with friction (UX polish needed)
   - Pivot: Not using daily, concept unclear (rethink core value)
   - Abandon: Not using, better alternatives exist (cut losses)
6. **Validation gate**: 3-month checkpoint to decide continue/pivot/abandon

**Owner**: Product Owner (validation tracking)
**Due Date**: 3-month validation checkpoint after Construction complete
**Last Updated**: 2025-12-04

---

### Risk #14: Concept Doesn't Resonate with Others

**Category**: Validation
**Impact**: LOW (solo project)
**Probability**: MEDIUM
**Status**: Monitoring

**Description**:
If project is open-sourced or shared, the core concept (immutable originals + AI revision) may not resonate with other users' workflows. However, this is LOW impact since primary goal is personal validation, not product-market fit.

**Triggers**:
- Early users don't understand the value proposition
- "Just use Notion/Obsidian" feedback
- Feature requests pull toward generic note app
- No organic interest if posted on Reddit/HN

**Mitigation Strategies**:
1. **Personal validation first**: Don't worry about others until MVP proves value personally
2. **Clear positioning**: If sharing, articulate problem solved (not just features)
3. **Use cases**: Document specific scenarios where HotM shines vs alternatives
4. **Niche targeting**: Focus on specific user type (e.g., researchers, writers) not general market
5. **Low expectations**: Open source for learning/portfolio, not adoption metrics
6. **No premature marketing**: Don't promote until confident in value proposition

**Owner**: Product Owner (if/when relevant)
**Due Date**: No action until post-MVP validation (6+ months)
**Last Updated**: 2025-12-04

---

### Risk #15: Better Alternatives Emerge

**Category**: External
**Impact**: MEDIUM
**Probability**: LOW
**Status**: Monitoring

**Description**:
Rapidly evolving AI + note-taking space may produce competing solutions that solve similar problems better (e.g., Mem.ai, Reflect, Notion AI improvements). This could reduce motivation to continue HotM development.

**Triggers**:
- Major note app adds similar AI revision features
- New startup launches with better UX/performance
- Open-source alternative emerges with active community
- Paradigm shift (e.g., voice-first notes, AR interfaces)

**Mitigation Strategies**:
1. **Unique positioning**: Focus on differentiators (local-first, immutability, full control)
2. **Learning value**: Even if alternatives emerge, HotM provides learning/portfolio value
3. **Rapid validation**: Get to MVP quickly to validate before market moves
4. **Flexibility**: Architecture allows pivoting features if needed
5. **Personal use case**: Even if not "best," if it works for personal workflow, still valuable
6. **Competitive monitoring**: Lightweight tracking of major players, don't obsess

**Owner**: Product Owner (strategic awareness)
**Due Date**: Ongoing monitoring (monthly check-ins)
**Last Updated**: 2025-12-04

---

## Risk Prioritization Matrix

### Critical Path (Blocks MVP)
1. **Risk #1**: Incomplete rollback (HIGH impact, MEDIUM probability)
2. **Risk #3**: Insufficient test coverage (HIGH impact, HIGH probability)
3. **Risk #5**: Core features inadequate (HIGH impact, MEDIUM probability)

### High Priority (Significant Impact)
4. **Risk #2**: Rollback breaks features (HIGH impact, MEDIUM probability)
5. **Risk #7**: Windows UX friction (HIGH impact, LOW probability)
6. **Risk #13**: Personal validation fails (HIGH impact, MEDIUM probability)

### Monitor Closely
7. **Risk #6**: Performance degradation (MEDIUM impact, MEDIUM probability)
8. **Risk #8**: Ollama barrier (MEDIUM impact, MEDIUM probability)
9. **Risk #9**: Setup complexity (MEDIUM impact, HIGH probability)
10. **Risk #12**: Test coverage target (MEDIUM impact, MEDIUM probability)

### Watch List
11. **Risk #4**: Database schema changes (MEDIUM impact, MEDIUM probability)
12. **Risk #11**: Stack community (MEDIUM impact, LOW probability)
13. **Risk #14**: Concept resonance (LOW impact, MEDIUM probability)
14. **Risk #15**: Better alternatives (MEDIUM impact, LOW probability)

### Deferred (Out of Scope)
15. **Risk #10**: Sync design unproven (LOW impact for MVP, HIGH probability if attempted)

---

## Risk Review Schedule

**Weekly** (during active development):
- Review Critical Path risks
- Update mitigation status
- Add new risks as discovered

**Phase Gates**:
- **Inception Exit**: All Critical Path risks in "Mitigating" status
- **Elaboration Exit**: High Priority risks addressed or accepted
- **Construction Phases**: Review Monitor Closely risks
- **Transition Entry**: Validate Low/Medium risks retired or managed

**Owner**: Requirements Analyst (Inception) → Project Manager (ongoing)

---

## Risk Escalation

**Solo Developer Context**: Since this is a solo project, "escalation" means:
1. **Acknowledge**: Risk materialized or probability increased
2. **Decide**: Fix immediately, defer, pivot, or accept
3. **Document**: Update risk status, capture lessons learned
4. **Adjust**: Update project plan, scope, or timeline

**Decision Criteria**:
- **Critical Path Risk Materializes**: Stop other work, address immediately
- **High Priority Risk Materializes**: Assess impact, reprioritize sprint
- **Medium Risk Materializes**: Add to backlog, address in next phase
- **Low Risk Materializes**: Document, revisit at phase gate

---

## Appendix: Risk Status Definitions

- **Identified**: Risk documented, not yet analyzed
- **Analyzing**: Gathering data, assessing mitigation options
- **Mitigating**: Active work to reduce probability or impact
- **Monitoring**: Mitigation in place, watching for triggers
- **Retired**: Risk no longer applicable or fully mitigated

---

**Document Control**
**Created**: 2025-12-04
**Author**: Requirements Analyst
**Review Cycle**: Weekly during Inception/Elaboration, bi-weekly during Construction
**Next Review**: 2025-12-11
