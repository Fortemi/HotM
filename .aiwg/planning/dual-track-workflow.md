# Dual-Track Workflow - HotM Construction Phase

**Document Type**: SDLC Artifact - Process
**Phase**: Construction
**Version**: 1.0
**Date**: 2025-12-04
**Status**: BASELINE
**Primary Author**: Project Manager

---

## Executive Summary

This Dual-Track Workflow establishes a disciplined approach to balancing discovery (future iteration preparation) with delivery (current iteration execution) for the HotM project. As a solo developer project, this workflow is simplified from traditional Agile dual-track approaches while preserving the core benefit: reducing mid-iteration surprises by preparing work 1 iteration ahead.

**Key Principles**:
- **Discovery Track**: Prepare backlog items for next iteration (20% time allocation)
- **Delivery Track**: Execute current iteration work items (80% time allocation)
- **1-Iteration Look-Ahead**: Always have next iteration's work ready to start
- **Definition of Ready (DoR)**: Gate for Discovery → Delivery handoff
- **Time-Slicing**: Discovery happens during context switches and end-of-day planning

**Benefits**:
- Reduced iteration planning overhead (backlog pre-refined)
- Lower risk of mid-iteration scope creep or pivots
- Better estimates (unknowns discovered during discovery phase)
- Clear separation of concerns (thinking vs. executing)

---

## Table of Contents

1. [Track Definitions](#1-track-definitions)
2. [Solo Developer Adaptation](#2-solo-developer-adaptation)
3. [Synchronization Points](#3-synchronization-points)
4. [Handoff Criteria](#4-handoff-criteria-definition-of-ready)
5. [Time Allocation Guidelines](#5-time-allocation-guidelines)
6. [Tools and Tracking](#6-tools-and-tracking)
7. [Workflow Examples](#7-workflow-examples)
8. [Appendices](#8-appendices)

---

## 1. Track Definitions

### 1.1 Discovery Track

**Purpose**: Prepare backlog items for future iterations by refining requirements, assessing risks, and validating assumptions.

**Scope**: Work items planned for Iteration N+1 (next iteration)

**Key Activities**:
1. **Requirements Refinement**
   - Clarify acceptance criteria with concrete examples
   - Identify edge cases and validation rules
   - Document API contracts or data models

2. **Design Exploration**
   - Sketch solution approaches (diagrams, pseudocode)
   - Identify reusable patterns or libraries
   - Decide on test strategy (unit/integration/E2E mix)

3. **Risk Assessment**
   - Identify technical unknowns (proof-of-concept needed?)
   - Discover dependencies (external libraries, API changes)
   - Estimate complexity and effort

4. **Proof-of-Concept (if needed)**
   - Quick spike to validate approach (timebox: 2-4 hours)
   - Throw-away code to answer a specific question
   - Document findings in work item notes

5. **Backlog Ordering**
   - Prioritize items by risk, value, dependencies
   - Sequence work to unblock parallel development

**Outputs**:
- Work items meeting Definition of Ready (DoR)
- Risk mitigation plans for high-risk items
- Effort estimates with confidence levels
- Technical design notes or ADRs (if needed)

**Success Criteria**:
- At least 8 days of work (one iteration's capacity) is DoR-ready before iteration planning

---

### 1.2 Delivery Track

**Purpose**: Execute current iteration work items to produce working software increments that meet Definition of Done (DoD).

**Scope**: Work items committed to Iteration N (current iteration)

**Key Activities**:
1. **Implementation**
   - Write production code following coding standards
   - Integrate with existing components
   - Follow TDD or test-after discipline

2. **Testing**
   - Write unit tests for new logic
   - Add integration tests for component interactions
   - Verify coverage meets targets (60%)

3. **Quality Gates**
   - Run Act validation before every push
   - Fix clippy/lint warnings
   - Perform self-review or AI-assisted review

4. **Documentation**
   - Update code comments and API docs
   - Update README if setup changes
   - Document decisions in lightweight log

5. **Integration**
   - Merge to main branch after validation
   - Update iteration tracking with progress
   - Identify new friction points in friction log

**Outputs**:
- Working software increments (features, tests, refactoring)
- Updated documentation (code, README, ADRs)
- Daily progress updates in iteration tracking
- Friction log entries for retrospective

**Success Criteria**:
- All work items meet DoD before iteration review
- Zero P0 issues introduced
- Coverage targets met or exceeded

---

## 2. Solo Developer Adaptation

### 2.1 Traditional vs. Solo Dual-Track

**Traditional Dual-Track** (Team Environment):
- Discovery and Delivery run in parallel with different people
- Product Owner/Designer owns Discovery track
- Engineers own Delivery track
- Formal handoffs via refinement sessions

**Solo Dual-Track** (HotM Approach):
- Same person does both tracks, time-sliced
- Discovery happens during lower-energy periods (end of day, context switches)
- Delivery happens during focused work blocks (morning, deep work time)
- Handoff is self-service (move item from Discovery backlog to Iteration backlog)

### 2.2 Time-Slicing Strategy

**Daily Schedule Template**:

```
08:00 - 12:00 [DELIVERY TRACK] Deep work - Implementation focus
              - No interruptions, no context switching
              - 4 hours focused on current iteration work

12:00 - 13:00 [BREAK] Lunch, walk, mental reset

13:00 - 16:00 [DELIVERY TRACK] Continued implementation
              - Testing, integration, code review
              - 3 hours focused execution

16:00 - 16:30 [DISCOVERY TRACK] Next iteration prep
              - Refine 1-2 backlog items
              - Review requirements, sketch design
              - 30 minutes planning time

16:30 - 17:00 [ADMIN] Daily check-in, progress tracking
              - Update iteration tracking
              - Review friction log
              - Plan tomorrow's focus
```

**Weekly Pattern**:

| Day | Delivery Focus | Discovery Focus |
|-----|----------------|-----------------|
| **Monday** | 7 hours | 1 hour (backlog review) |
| **Tuesday** | 7.5 hours | 0.5 hours (quick refinement) |
| **Wednesday** | 6.5 hours | 1.5 hours (mid-iteration review + discovery) |
| **Thursday** | 7.5 hours | 0.5 hours (design sketching) |
| **Friday** | 6 hours | 2 hours (next iteration planning) |
| **TOTAL** | ~34.5 hours (~82%) | ~5.5 hours (~18%) |

**Adjustment Guidelines**:
- Early in iteration: 90% delivery, 10% discovery (focus on execution)
- Late in iteration: 70% delivery, 30% discovery (prepare for transition)
- High-risk items ahead: Increase discovery time for proof-of-concept

### 2.3 Context Switching Optimization

**When to Switch to Discovery Track**:
- Waiting for tests to run (Act validation: 8 minutes)
- Blocked on external dependency (library download, build)
- Mental fatigue after deep implementation session
- End of day (lower cognitive load)

**When to Avoid Discovery**:
- During peak focus hours (morning deep work)
- When implementation flow is strong ("in the zone")
- If context switching will break focus on complex problem

**Mental Shift Techniques**:
- **Delivery → Discovery**: Take 5-minute walk, switch to whiteboard or paper
- **Discovery → Delivery**: Review current code context, check recent commits
- Use separate editor tabs or workspaces for each track

---

## 3. Synchronization Points

### 3.1 Daily Check-In (5-10 minutes)

**Timing**: End of day (16:30)

**Purpose**: Align progress on both tracks

**Checklist**:
- [ ] **Delivery Track Review**:
  - What was completed today?
  - What's in progress (status)?
  - Any blockers discovered?

- [ ] **Discovery Track Review**:
  - Which backlog item(s) were refined today?
  - Any new risks or dependencies identified?
  - Estimated progress toward DoR (% ready)

- [ ] **Tomorrow's Plan**:
  - Primary delivery focus (which work item?)
  - Discovery task for end of day (which backlog item?)

**Tracking**: Update `.aiwg/planning/iteration-plan-00N.md` daily progress section

---

### 3.2 Mid-Iteration Review (30 minutes)

**Timing**: Day 5 of 10 (Wednesday of iteration)

**Purpose**: Course-correct delivery track, finalize discovery track for next iteration

**Agenda**:

1. **Delivery Track Health Check** (15 minutes):
   - Coverage: On track to meet iteration goal?
   - Velocity: Actual vs. planned days (trending to finish on time?)
   - Risks: Any new blockers requiring scope adjustment?
   - Decision: Keep scope or defer P2 items?

2. **Discovery Track Readiness** (15 minutes):
   - Next iteration backlog: How many items are DoR-ready?
   - Target: 8+ days of work ready for iteration planning
   - Action: If <8 days ready, increase discovery time allocation
   - Prioritization: Confirm next iteration goal aligns with strategy

**Outputs**:
- Updated iteration tracking with scope decisions
- Next iteration backlog status (DoR-ready count)
- Adjusted time allocation for remainder of iteration

---

### 3.3 Iteration Review (1 hour)

**Timing**: Day 10 of 10 (End of iteration)

**Purpose**: Accept/reject delivery track outputs, transition to next iteration

**Agenda**:

1. **Delivery Track Acceptance** (20 minutes):
   - Demo completed features
   - Verify DoD checklist (all items must pass)
   - Run final Act validation
   - Document known issues for next iteration

2. **Discovery Track Handoff** (15 minutes):
   - Review DoR-ready items for next iteration
   - Confirm estimates and priorities
   - Identify any last-minute refinements needed

3. **Metrics Review** (10 minutes):
   - Coverage delta (before/after iteration)
   - Velocity (planned vs. actual)
   - Discovery efficiency (how many items were DoR-ready?)

4. **Retrospective** (15 minutes):
   - What went well (both tracks)?
   - What didn't go well?
   - Action items for next iteration

**Transition**: Move DoR-ready items from discovery backlog to next iteration plan

---

### 3.4 Iteration Planning (1-2 hours)

**Timing**: Day 0 (Before iteration start, or first day of iteration)

**Purpose**: Commit to next iteration scope using DoR-ready items from discovery track

**Inputs** (from Discovery Track):
- Backlog items meeting DoR
- Risk assessments and mitigation plans
- Effort estimates with confidence levels

**Process**:

1. **Review Discovery Track Outputs** (30 minutes):
   - Validate all items meet DoR checklist
   - Review acceptance criteria with examples
   - Confirm dependencies are resolved or manageable

2. **Capacity Planning** (15 minutes):
   - Calculate available days (10 days * 80% = 8 days planned capacity)
   - Adjust for known time off or external commitments

3. **Scope Selection** (30 minutes):
   - Select highest-priority DoR-ready items
   - Total effort should match capacity (~8 days)
   - Include 20% buffer for unknowns (first few iterations)

4. **Acceptance Criteria Validation** (15 minutes):
   - Walk through each item's success criteria
   - Identify test approach (unit/integration/E2E)
   - Confirm coverage improvement goal

**Outputs**:
- Iteration plan document (`.aiwg/planning/iteration-plan-00N.md`)
- Updated DoD checklist if new standards emerged
- Iteration goal statement (one sentence)

---

## 4. Handoff Criteria (Definition of Ready)

### 4.1 DoR Checklist

**A work item is ready to move from Discovery to Delivery when**:

#### Requirements Clarity
- [ ] **Acceptance Criteria Defined**: Specific, testable success conditions
- [ ] **Examples Provided**: At least 2 concrete examples (happy path + edge case)
- [ ] **Validation Rules Documented**: Input constraints, error conditions
- [ ] **User Impact Described**: Why this work item matters (value proposition)

#### Technical Preparedness
- [ ] **Dependencies Identified**: All required libraries, APIs, schemas known
- [ ] **Existing Code Reviewed**: Relevant modules examined for reuse or impact
- [ ] **Test Strategy Defined**: Mix of unit/integration/E2E tests planned
- [ ] **Design Approach Sketched**: Pseudocode, diagram, or architectural notes

#### Risk Management
- [ ] **Effort Estimated**: Rough estimate (hours or days) with confidence level
- [ ] **Risks Assessed**: Known unknowns documented with mitigation plan
- [ ] **Proof-of-Concept Complete** (if high-risk): Spike confirms approach viable
- [ ] **No Blockers**: All prerequisites completed or workarounds identified

#### Planning Metadata
- [ ] **Priority Assigned**: P0 (critical), P1 (high), P2 (medium), P3 (low)
- [ ] **Story Points Estimated**: Relative sizing (1, 2, 3, 5, 8)
- [ ] **Sequencing Considered**: Dependencies on other work items noted

---

### 4.2 DoR Template

```markdown
### Work Item: [Concise Title]

**Priority**: [P0/P1/P2/P3]
**Story Points**: [1/2/3/5/8]
**Estimated Effort**: [X days]
**Risk Level**: [Low/Medium/High]

#### Description
[1-2 paragraphs describing what this work item accomplishes and why it's valuable]

#### Acceptance Criteria
- [ ] **AC1**: [Specific, testable criterion]
- [ ] **AC2**: [Specific, testable criterion]
- [ ] **AC3**: [Specific, testable criterion]

#### Examples
**Example 1 (Happy Path)**:
- Input: [Concrete example]
- Expected Output: [Concrete result]

**Example 2 (Edge Case)**:
- Input: [Concrete edge case]
- Expected Output: [Error handling or special behavior]

#### Dependencies
- [Dependency 1: library, API, schema]
- [Dependency 2: prerequisite work item]

#### Test Strategy
- **Unit Tests**: [Modules to test, coverage target]
- **Integration Tests**: [Component interactions to verify]
- **E2E Tests**: [Manual verification steps, if needed]

#### Design Notes
[Pseudocode, diagram, or architectural sketch]
[Link to ADR if design decision was documented]

#### Risks and Mitigation
- **Risk 1**: [Description] - Mitigation: [Strategy]
- **Risk 2**: [Description] - Mitigation: [Strategy]

#### Proof-of-Concept Results (if applicable)
- Spike completed: [Date]
- Findings: [Summary of what was learned]
- Confidence: [Low/Medium/High]

#### Definition of Done Considerations
- Coverage target: [X%] for this module
- Performance baseline: [If relevant]
- Documentation updates: [README, ADR, API docs]
```

---

### 4.3 DoR Validation Process

**Self-Review Checklist** (Solo Developer):

1. **Read Acceptance Criteria Aloud**: Do they make sense? Are they testable?
2. **Walk Through Examples**: Can you mentally execute the code path?
3. **Estimate Confidence Check**: How confident are you in the estimate? (50%? 80%?)
4. **Blocker Scan**: Is there anything that could prevent starting this work tomorrow?

**AI-Assisted Review** (Optional):

```markdown
Prompt for AI DoR Validation:

"Review this work item for Definition of Ready:

[Paste work item here]

Check for:
1. Are acceptance criteria specific and testable?
2. Are examples concrete enough to guide implementation?
3. Are risks and dependencies fully identified?
4. Is the estimate reasonable given the description?
5. Is the test strategy comprehensive?"
```

**DoR Rejection Criteria**:
- Missing acceptance criteria or vague ("should work well")
- No examples provided (abstract requirements only)
- Major dependencies unknown or unresolved
- Estimate is a wild guess (confidence <50%)
- High-risk item with no proof-of-concept completed

---

## 5. Time Allocation Guidelines

### 5.1 Overall Allocation

**Target Split**:
- **Delivery Track**: 80% of available time (~32 hours per week)
- **Discovery Track**: 20% of available time (~8 hours per week)

**Rationale**:
- Solo developer needs majority time for execution
- 20% discovery is sufficient to prepare 1 iteration ahead (8 days capacity)
- Ratio can adjust based on iteration phase and complexity

---

### 5.2 Discovery Track Time Breakdown

**Per Iteration** (10 working days = 40 hours total):

| Activity | Time Allocation | Frequency |
|----------|----------------|-----------|
| **Backlog Refinement** | 3 hours | Daily (30 min/day for 6 days) |
| **Design Exploration** | 2 hours | 2-3 sessions of 30-60 min |
| **Risk Assessment** | 1 hour | 1-2 sessions of 30 min |
| **Proof-of-Concept** | 2 hours | Only if high-risk item (timebox) |
| **Iteration Planning Prep** | 2 hours | End of iteration (Friday) |
| **TOTAL** | **~10 hours** | **~20-25% of iteration** |

**Adjustment Guidelines**:
- Simple iteration (low-risk items): 15% discovery, 85% delivery
- Complex iteration (new features): 25% discovery, 75% delivery
- First iteration of new phase: 30% discovery to build backlog

---

### 5.3 Delivery Track Time Breakdown

**Per Iteration** (10 working days = 40 hours total):

| Activity | Time Allocation | Frequency |
|----------|----------------|-----------|
| **Implementation** | 18 hours | 60% of delivery time |
| **Testing** | 9 hours | 30% of delivery time |
| **Integration/Review** | 3 hours | 10% of delivery time |
| **TOTAL** | **~30 hours** | **~75-80% of iteration** |

**Implementation Includes**:
- Writing production code
- Debugging and troubleshooting
- Local testing (quick iteration with `cargo test` or `npm test`)

**Testing Includes**:
- Writing unit tests
- Writing integration tests
- Running Act validation (full CI/CD simulation)
- Fixing test failures

**Integration/Review Includes**:
- Self-review of code changes
- Documentation updates (code comments, README)
- Git commit and push (after Act validation)
- Progress tracking updates

---

### 5.4 Time Tracking (Lightweight)

**No Formal Time Sheets**: Avoid overhead of precise time tracking

**Rough Tracking Method**:
```markdown
### Day N Progress

**Delivery Time**: ~6 hours (WI-001 implementation + testing)
**Discovery Time**: ~1 hour (refined WI-007, sketched design for WI-008)
**Admin Time**: ~0.5 hours (daily check-in, progress tracking)

**Focus Quality**: High (deep work morning, fewer context switches)
**Friction Points**: Act tests took 10 min instead of 8 min
```

**Purpose**: Inform future estimates, not to measure productivity

---

## 6. Tools and Tracking

### 6.1 Discovery Track Tools

#### 6.1.1 Backlog Management

**Location**: `.aiwg/planning/backlog-discovery.md`

**Format**:
```markdown
# Discovery Backlog - Iteration N+1

## DoR-Ready (Ready for Iteration Planning)
- [x] WI-007: Database Layer Unit Tests (Est: 2.5 days, DoR: 2025-12-03)
- [x] WI-008: Models Module Unit Tests (Est: 1.5 days, DoR: 2025-12-04)

## In Discovery (Being Refined)
- [ ] WI-009: Ollama Client Unit Tests (Est: TBD, Risk: Medium - HTTP mocking)
  - Status: Design sketch complete, need PoC for wiremock library
  - Next: 2-hour PoC spike on wiremock setup

- [ ] WI-010: API Route Handler Tests (Est: TBD, Dependency: test DB setup)
  - Status: Acceptance criteria defined, examples provided
  - Next: Review existing route tests for patterns

## Backlog (Not Yet Started)
- [ ] WI-011: Soft Delete Implementation
- [ ] WI-012: Tag Management Tests
```

**Update Frequency**: Daily during discovery time (end of day)

---

#### 6.1.2 Design Artifacts

**Location**: `.aiwg/working/design-sketches/`

**Artifacts**:
- **Pseudocode**: Text file with algorithm outline
- **Diagrams**: PlantUML or ASCII art for architecture
- **API Contracts**: JSON schema or OpenAPI snippet
- **Database Schema**: SQL DDL or ER diagram

**Example - Pseudocode Sketch**:
```
// File: .aiwg/working/design-sketches/wi-009-ollama-client-tests.md

# WI-009 Design Sketch: Ollama Client Unit Tests

## Approach: HTTP Mocking with Wiremock

### Test Setup
```rust
use wiremock::{MockServer, Mock, ResponseTemplate};

#[tokio::test]
async fn test_generate_with_successful_response() {
    // 1. Start mock server
    let mock_server = MockServer::start().await;

    // 2. Configure mock response
    Mock::given(method("POST"))
        .and(path("/api/generate"))
        .respond_with(ResponseTemplate::new(200)
            .set_body_json(json!({
                "response": "Generated text"
            })))
        .mount(&mock_server)
        .await;

    // 3. Create OllamaClient pointing to mock
    let client = OllamaClient::new(mock_server.uri());

    // 4. Call generate() and assert
    let response = client.generate("test prompt").await.unwrap();
    assert_eq!(response, "Generated text");
}
```

### Coverage Plan
- Happy path: 200 response with valid JSON
- Error path: 500 response with error message
- Timeout: Simulate network delay
- Invalid JSON: Return malformed response
```

---

#### 6.1.3 Proof-of-Concept Tracking

**Location**: `.aiwg/working/spikes/`

**Format**:
```markdown
# Spike: WI-009 - Wiremock HTTP Mocking

**Date**: 2025-12-05
**Timebox**: 2 hours
**Question**: Can we use wiremock to mock Ollama HTTP responses?

## Approach
1. Add wiremock to dev-dependencies
2. Create simple test with mock server
3. Verify request/response matching works

## Findings
- Wiremock works well for async Rust tests
- Easy to configure mock responses
- Can simulate timeouts with `.delay()` method
- Documentation is good: https://docs.rs/wiremock

## Recommendation
- ✅ Use wiremock for Ollama client tests
- Confidence: High (80%)

## Code Snippet
[See .aiwg/working/spikes/wi-009-spike.rs]
```

**Cleanup**: Spike code is throwaway (delete after findings documented)

---

### 6.2 Delivery Track Tools

#### 6.2.1 Iteration Tracking

**Location**: `.aiwg/planning/iteration-plan-00N.md`

**Daily Progress Section**:
```markdown
## Daily Progress

### Day 1 (2025-12-05)
**Completed**:
- WI-001: Database Layer Unit Tests - create_note() tests (3/10 ACs done)

**In Progress**:
- WI-001: Database Layer Unit Tests - get_note() tests

**Blocked**: None

**Coverage**:
- Backend: 12.5% (+2.6% from baseline)
- Frontend: 33.48% (no change)

**Velocity**:
- Planned: 0.3 days
- Actual: 0.4 days (slower than expected due to test DB setup)

**Friction Log**:
- Test DB setup took 30 min (undocumented process)
```

---

#### 6.2.2 Definition of Done Tracking

**Tool**: Checklist in iteration plan or separate file

**Format**:
```markdown
## WI-001: Database Layer Unit Tests - DoD Checklist

### Code Quality
- [x] Functionality: All ACs met (10/10)
- [x] Code Review: Self-review completed
- [x] Documentation: Added docstrings to test helpers

### Testing
- [x] Unit Tests: 15 new tests added
- [x] Integration Tests: 3 integration tests with real DB
- [x] Act Validation: `gh act -j backend-tests` passed
- [x] Coverage: db_enhanced.rs 1.3% → 62% (+60.7%)

### Quality Gates
- [x] Zero P0 Issues: No blocker bugs
- [x] Clippy Clean: Zero warnings
- [x] TypeScript Clean: N/A (backend only)
- [x] Security: No new vulnerabilities

### Integration
- [x] Main Branch: Merged to main
- [x] Commit Convention: "test: add database layer unit tests"
- [x] No Secrets: No sensitive data committed
```

---

#### 6.2.3 Friction Log

**Location**: `.aiwg/quality/friction-log.md`

**Purpose**: Capture pain points during delivery for retrospective

**Format**:
```markdown
## Friction Log - Iteration 1 (Dec 5-18, 2025)

### 2025-12-05
- **Issue**: Test database setup not documented in README
- **Impact**: Lost 30 minutes figuring out TEST_DATABASE_URL and pgvector extension
- **Resolution**: Added test DB setup to README, created helper script

### 2025-12-06
- **Issue**: Act validation taking 10 minutes instead of 8 minutes
- **Impact**: Slowing commit cycle, breaking flow
- **Resolution**: TBD - investigate caching options

### 2025-12-07
- **Issue**: Test fixtures duplicated across multiple test files
- **Impact**: Low - annoying but not blocking
- **Resolution**: Deferred to next iteration (create test utils module)
```

---

### 6.3 Cross-Track Tools

#### 6.3.1 Risk Register

**Location**: `.aiwg/risks/risk-list.md`

**Updated By**: Both tracks (discovery identifies, delivery confirms)

**Format**:
```markdown
## Active Risks - Iteration 1

### RISK-IT1-001: Test Writing Velocity Unknown
- **Identified By**: Discovery (during iteration planning)
- **Status**: ACTIVE
- **Probability**: High (80%)
- **Impact**: Medium (schedule slip)
- **Mitigation**: Start with simplest tests, use AI assistance
- **Owner**: Developer
- **Review Date**: Day 5 (mid-iteration)

### RISK-IT1-002: Act Validation Cycle Time
- **Identified By**: Delivery (during Day 2 development)
- **Status**: MONITORING
- **Probability**: Medium (60%)
- **Impact**: Medium (developer friction)
- **Mitigation**: Use local tests for rapid feedback
- **Owner**: Developer
- **Review Date**: Retrospective
```

---

#### 6.3.2 Decision Log

**Location**: `.aiwg/working/decision-log.md`

**Updated By**: Both tracks (discovery makes decisions, delivery executes)

**Format**:
```markdown
## Decision Log - Iteration 1

### 2025-12-04: Use Wiremock for HTTP Mocking
- **Track**: Discovery (during PoC spike)
- **Decision**: Use wiremock for Ollama client tests
- **Rationale**: Easy to set up, good async support, well-documented
- **Alternative Considered**: mockito (rejected: less flexible for async)
- **Impact**: WI-009 can proceed with high confidence estimate

### 2025-12-06: Defer Frontend Coverage for Iteration 1
- **Track**: Delivery (during mid-iteration review)
- **Decision**: Focus exclusively on backend coverage this iteration
- **Rationale**: Backend gap is more critical (9.91% vs 33.48%)
- **Impact**: Frontend tests deferred to Iteration 2
```

---

## 7. Workflow Examples

### 7.1 Example Week 1 (Early Iteration)

**Monday (Day 1)**:
```
08:00-12:00 [DELIVERY] Start WI-001 (Database Layer Tests)
            - Implement create_note() tests (3 hours)
            - Write get_note() tests (1 hour)

12:00-13:00 [BREAK]

13:00-16:00 [DELIVERY] Continue WI-001
            - Implement update_note_revised() tests (2 hours)
            - Run local tests, fix failures (1 hour)

16:00-16:30 [DISCOVERY] Refine WI-009 (Ollama Client Tests)
            - Review Ollama.rs code, identify test cases
            - Sketch HTTP mocking approach

16:30-17:00 [ADMIN] Daily check-in
            - Update iteration tracking (Day 1 progress)
            - Plan tomorrow: finish WI-001, start WI-002
```

**Tuesday (Day 2)**:
```
08:00-12:00 [DELIVERY] Finish WI-001
            - Complete search_notes() tests (2 hours)
            - Add integration tests with real DB (2 hours)

12:00-13:00 [BREAK]

13:00-16:00 [DELIVERY] WI-001 completion
            - Run Act validation (8 min wait → DISCOVERY context switch)
            - Fix clippy warnings, run Act again (passed!)
            - Commit and push to main (2 hours total)

16:00-16:30 [DISCOVERY] During Act validation wait time
            - Research wiremock library (read docs, examples)

16:30-17:00 [ADMIN] Daily check-in
            - WI-001 complete! Coverage: 9.91% → 12.5%
            - Plan tomorrow: Start WI-002 (Models Module Tests)
```

**Wednesday (Day 5 - Mid-Iteration)**:
```
08:00-12:00 [DELIVERY] WI-002 implementation

12:00-13:00 [BREAK]

13:00-14:00 [DELIVERY] Continue WI-002

14:00-15:30 [DISCOVERY] Mid-Iteration Review
            - Check coverage trend: 9.91% → 18% (on track!)
            - Velocity check: 3 days planned, 2.8 days actual (good)
            - Discovery backlog: 5 items DoR-ready (need 3 more)

15:30-17:00 [DISCOVERY] Intensive discovery session
            - Refine WI-010 (API Route Tests) - add examples
            - Refine WI-011 (Soft Delete) - clarify ACs
            - Now 7 items DoR-ready (close to 8-day target)
```

---

### 7.2 Example Week 2 (Late Iteration)

**Friday (Day 10 - End of Iteration)**:
```
08:00-10:00 [DELIVERY] Final WI-006 completion
            - Finish soft delete tests
            - Run Act validation (passed!)

10:00-12:00 [DELIVERY] Iteration wrap-up
            - Update all DoD checklists
            - Generate coverage reports
            - Document known issues

12:00-13:00 [BREAK]

13:00-14:00 [DELIVERY] Iteration Review
            - Demo: Show coverage improvement (9.91% → 38%)
            - Acceptance: All DoD checklists verified
            - Metrics: Velocity 8 days planned / 7.5 actual

14:00-15:00 [DISCOVERY] Retrospective + Planning Prep
            - Retrospective: What went well, what to improve
            - Review discovery backlog: 10 items DoR-ready
            - Prioritize top 8 items for Iteration 2

15:00-17:00 [DISCOVERY] Iteration 2 Planning
            - Select work items (total: 8 days capacity)
            - Create iteration-plan-002.md
            - Set iteration goal: "Reach 60% backend coverage"
```

---

### 7.3 Example Context Switch (Act Validation Wait)

**Scenario**: Waiting for `gh act -j backend-tests` (8 minutes)

**Instead of**:
- Sitting idle watching logs
- Context switching to email/social media (hard to return to flow)

**Do This**:
```
[Start Act validation]
$ gh act -j backend-tests
# Tests running... (8 min ETA)

[Switch to Discovery Track]
$ vim .aiwg/planning/backlog-discovery.md

# Spend 8 minutes refining next backlog item:
- Review WI-012 acceptance criteria
- Add concrete examples (happy path + edge case)
- Identify test strategy (unit tests for tag validation)

[Act validation completes]
# Tests passed! (green checkmark)

[Return to Delivery Track]
$ git add .
$ git commit -m "test: add models module unit tests"
$ git push origin main
```

**Benefits**:
- No idle time (productive during wait)
- Discovery work is low-stakes (easy to pause/resume)
- Maintains forward momentum on both tracks

---

## 8. Appendices

### Appendix A: Common Pitfalls and Solutions

#### Pitfall 1: Discovery Work Becomes Procrastination

**Symptom**: Spending too much time refining/designing to avoid implementation

**Root Cause**: Perfectionism, fear of writing wrong code, analysis paralysis

**Solution**:
- Timebox discovery activities (30 min max per item per day)
- Use "good enough" threshold for DoR (80% confidence is sufficient)
- Remember: Discovery is preparation, not final design

---

#### Pitfall 2: Delivery Work Expands to Fill All Time

**Symptom**: Constantly "too busy" to do discovery, next iteration unprepared

**Root Cause**: Urgent vs. important trade-off, delivery feels more tangible

**Solution**:
- Treat discovery time as non-negotiable (calendar block)
- Track DoR-ready count as a metric (must reach 8 items before iteration ends)
- Set alarm for 16:00 to remind context switch

---

#### Pitfall 3: Mid-Iteration Discovery for Current Work

**Symptom**: Discovering unknowns mid-iteration, causing scope creep or delays

**Root Cause**: Insufficient discovery work in prior iteration, DoR checklist skipped

**Solution**:
- Tighten DoR validation (reject items with vague ACs)
- Require proof-of-concept for high-risk items before DoR
- Accept scope reduction if unknowns discovered (defer item to next iteration)

---

#### Pitfall 4: Over-Engineering During Discovery

**Symptom**: Spending hours on detailed design that changes during implementation

**Root Cause**: Premature optimization, overthinking edge cases

**Solution**:
- Keep design sketches lightweight (pseudocode, not production code)
- Focus on "what" not "how" (implementation details emerge during delivery)
- Use "spike and decide" pattern for complex design questions

---

### Appendix B: Discovery Track Quick Reference

**30-Minute Discovery Session Template**:

```
[Select 1 backlog item to refine]

1. Read current description (5 min)
   - What's the goal? Why does this matter?
   - What's unclear or missing?

2. Clarify acceptance criteria (10 min)
   - Make each AC specific and testable
   - Add at least 2 concrete examples

3. Identify risks and dependencies (10 min)
   - What could go wrong?
   - What do I need to research or validate?

4. Estimate effort and confidence (5 min)
   - Rough estimate: X days
   - Confidence: Low/Medium/High
   - If low confidence: What PoC do I need?

[Update backlog-discovery.md with progress]
```

---

### Appendix C: Delivery Track Quick Reference

**Daily Delivery Workflow**:

```
[Start of day]
1. Review yesterday's progress in iteration tracking
2. Identify today's primary focus (1 work item)
3. Check DoD checklist for current item (what's left?)

[During implementation]
4. Write production code (TDD or test-after)
5. Run local tests frequently (cargo test, npm test)
6. Commit locally after each small completion

[Before push]
7. Self-review code changes (git diff)
8. Run Act validation (gh act -j backend-tests/frontend-tests)
9. Push to main after green checkmark

[End of day]
10. Update iteration tracking (daily progress section)
11. Switch to discovery track (30 min backlog refinement)
12. Update friction log if new issues discovered
```

---

### Appendix D: Metrics and Success Criteria

**Discovery Track Health**:
- **DoR-Ready Count**: Target 8+ days of work before iteration planning
- **Discovery Time %**: Target 20% (range: 15-25% acceptable)
- **PoC Success Rate**: If high-risk items have PoCs, did they validate approach?

**Delivery Track Health**:
- **Velocity**: Actual days / Planned days (target: 80-100%)
- **DoD Compliance**: % of items meeting all DoD criteria (target: 100%)
- **Coverage Delta**: Improvement over baseline (target: +5-10% per iteration)

**Cross-Track Health**:
- **Mid-Iteration Surprises**: # of items discovered to have unknown blockers (target: 0)
- **Scope Creep**: # of unplanned items added mid-iteration (target: 0)
- **Carry-Over Rate**: % of items not completed (target: <20%)

**Review Frequency**: End of each iteration during retrospective

---

### Appendix E: Iteration Transition Checklist

**End of Iteration N / Start of Iteration N+1**:

- [ ] **Delivery Track Closeout**:
  - [ ] All work items meet DoD
  - [ ] Final Act validation passed
  - [ ] Coverage reports generated
  - [ ] Iteration status report created
  - [ ] Known issues documented for next iteration

- [ ] **Discovery Track Handoff**:
  - [ ] At least 8 days of DoR-ready work available
  - [ ] All DoR checklists validated
  - [ ] Risk assessments complete
  - [ ] Effort estimates confirmed

- [ ] **Iteration Planning**:
  - [ ] Review DoR-ready items
  - [ ] Calculate capacity (available days * 80%)
  - [ ] Select scope (total effort matches capacity)
  - [ ] Create iteration-plan-00N.md
  - [ ] Set iteration goal (one sentence)

- [ ] **Retrospective**:
  - [ ] What went well (both tracks)?
  - [ ] What didn't go well?
  - [ ] Action items for next iteration
  - [ ] Update process guide if needed

**Transition Duration**: 2-3 hours (can span end of Day 10 and start of Day 1)

---

### Appendix F: Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| **Development Process Guide** | `.aiwg/planning/development-process-guide.md` | Overall Construction phase workflow |
| **Iteration Plan Template** | `.aiwg/planning/iteration-plan-00N.md` | Current iteration tracking |
| **Definition of Ready** | Section 4 of this document | Discovery → Delivery handoff |
| **Definition of Done** | Development Process Guide Section 2.2 | Delivery completion criteria |
| **Risk Register** | `.aiwg/risks/risk-list.md` | Active risks across both tracks |
| **Friction Log** | `.aiwg/quality/friction-log.md` | Pain points discovered during delivery |

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2025-12-04 |
| **Version** | 1.0 (BASELINE) |
| **Status** | APPROVED |
| **Primary Author** | Project Manager |
| **Next Review** | After Iteration 1 (2025-12-18) |

**Change Log**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Project Manager | Initial baseline for Construction phase dual-track workflow |

---

**End of Dual-Track Workflow v1.0 (BASELINE)**
