# Development Process Guide - HotM Construction Phase

**Document Type**: SDLC Artifact - Planning
**Phase**: Construction
**Version**: 1.0
**Date**: 2025-12-04
**Status**: BASELINE
**Primary Author**: Project Manager
**Reviewers**: Architecture Designer, Test Architect

---

## Executive Summary

This Development Process Guide establishes the workflows, standards, and quality gates for the HotM Construction phase. It is optimized for a solo developer / small team environment with AI agent collaboration, prioritizing rapid iteration while maintaining quality through automated validation.

**Key Principles**:
- **Test-First Discipline**: `gh act` validation is mandatory before any push
- **Iteration Cadence**: 2-week cycles with clear DoR/DoD criteria
- **Automation**: CI/CD quality gates prevent regression
- **Documentation**: Lightweight but sufficient for continuity
- **Pragmatic Quality**: 60% coverage target, focus on critical paths

---

## Table of Contents

1. [Iteration Configuration](#1-iteration-configuration)
2. [Workflow](#2-workflow)
3. [Development Standards](#3-development-standards)
4. [Quality Gates](#4-quality-gates)
5. [Communication](#5-communication)
6. [Appendices](#6-appendices)

---

## 1. Iteration Configuration

### 1.1 Iteration Length

**Duration**: 2 weeks (10 working days)

**Rationale**:
- Solo/small team velocity allows tight feedback loops
- Long enough to complete meaningful features
- Short enough to pivot without significant sunk cost
- Aligns with personal validation timeline (3-6 months)

### 1.2 Iteration Ceremonies

| Ceremony | Duration | Frequency | Purpose |
|----------|----------|-----------|---------|
| **Iteration Planning** | 1-2 hours | Start of iteration | Define scope, acceptance criteria, estimate effort |
| **Daily Check-In** | 5-10 minutes | Daily (self or AI pair) | Progress review, blocker identification |
| **Mid-Iteration Review** | 30 minutes | Day 5 | Course correction, scope adjustment |
| **Iteration Review** | 1 hour | End of iteration | Demo, acceptance validation |
| **Retrospective** | 30 minutes | End of iteration | Process improvements, friction log |

### 1.3 Iteration Planning Template

```markdown
# Iteration N - [Start Date] to [End Date]

## Iteration Goal
[One sentence describing the focus area for this iteration]

## Scope
- [ ] Feature 1: [Brief description] (Priority: HIGH)
- [ ] Feature 2: [Brief description] (Priority: MEDIUM)
- [ ] Technical Debt: [Brief description] (Priority: LOW)

## Acceptance Criteria
- [ ] Criterion 1: Specific, measurable outcome
- [ ] Criterion 2: Specific, measurable outcome

## Capacity
- Available Days: 10 (2 weeks)
- Planned Days: 8 (buffer for unknowns)
- Coverage Goal: [X%] → [Y%] improvement

## Risk Factors
- Risk 1: [Description] - Mitigation: [Strategy]
- Risk 2: [Description] - Mitigation: [Strategy]

## Success Metrics
- Feature: [X] notes created without friction
- Performance: [Metric] meets [target]
- Quality: [Coverage/Tests] pass with zero P0 issues
```

### 1.4 Iteration Tracking

**Location**: `.aiwg/planning/iterations/iteration-N.md`

**Update Frequency**: Daily (during daily check-in)

**Tracking Format**:
```markdown
## Daily Progress

### Day 1 (YYYY-MM-DD)
- Completed: [Task description]
- In Progress: [Task description]
- Blocked: [Blocker description + mitigation]
- Coverage: [Current %]

### Day 2 (YYYY-MM-DD)
[...]
```

---

## 2. Workflow

### 2.1 Definition of Ready (DoR)

**A work item is ready to be worked on when**:

- [ ] **Acceptance Criteria Defined**: Clear, testable success criteria documented
- [ ] **Dependencies Identified**: All required services, libraries, schemas known
- [ ] **Testability Considered**: Testing approach outlined (unit/integration/E2E)
- [ ] **Estimated**: Rough effort estimate (hours or days)
- [ ] **Risk Assessment**: Known risks and mitigations documented
- [ ] **No Blockers**: All prerequisites completed or available

**Example - Ready Work Item**:
```markdown
### Feature: Auto-Linking Between Related Notes

**Acceptance Criteria**:
- [ ] When note is created, background job detects similar notes via embeddings
- [ ] Links created automatically with similarity score > 0.7
- [ ] User can view related notes in sidebar
- [ ] Performance: Link discovery completes within 5s for 100-note corpus

**Dependencies**:
- Embedding generation working (already implemented)
- Link table schema (already exists)
- WebSocket for job progress notification (already implemented)

**Test Approach**:
- Unit: Job queue, similarity calculation
- Integration: End-to-end link discovery with real database
- E2E: Manual verification of UI display

**Estimate**: 2 days (implementation) + 1 day (testing)

**Risks**:
- Similarity threshold may need tuning (mitigate: configurable parameter)
```

### 2.2 Definition of Done (DoD)

**A work item is complete when**:

#### Code Quality
- [ ] **Functionality**: All acceptance criteria met and verified
- [ ] **Code Review**: Self-review completed (or AI pair review for complex changes)
- [ ] **Documentation**: Code comments for complex logic, README updated if needed

#### Testing
- [ ] **Unit Tests**: Critical paths covered, tests pass locally
- [ ] **Integration Tests**: Component interactions verified
- [ ] **Act Validation**: `gh act -j backend-tests` AND `gh act -j frontend-tests` pass (MANDATORY)
- [ ] **Coverage**: Coverage did not decrease (ideally increased toward 60% target)

#### Quality Gates
- [ ] **Zero P0 Issues**: No blocker bugs introduced
- [ ] **Clippy Clean**: Rust code passes clippy with zero warnings
- [ ] **TypeScript Clean**: Frontend passes TypeScript type checking
- [ ] **Security**: No new vulnerabilities (`cargo audit`, `npm audit`)

#### Integration
- [ ] **Main Branch**: Changes merged to main (after Act validation)
- [ ] **Commit Convention**: Commit message follows format (see Section 3.4)
- [ ] **No Secrets**: No sensitive data committed (pre-commit check)

**DoD Checklist Script** (recommended):
```bash
#!/bin/bash
# scripts/check-dod.sh - Run before considering work complete

echo "=== Definition of Done Checklist ==="

echo "1. Running backend tests..."
gh act -j backend-tests || { echo "FAIL: Backend tests failed"; exit 1; }

echo "2. Running frontend tests..."
gh act -j frontend-tests || { echo "FAIL: Frontend tests failed"; exit 1; }

echo "3. Checking code formatting..."
cd server && cargo fmt --check || { echo "FAIL: Rust formatting"; exit 1; }
cd ../ui && npm run lint || { echo "FAIL: Frontend linting"; exit 1; }

echo "4. Security audit..."
cd ../server && cargo audit || { echo "WARN: Rust vulnerabilities found"; }
cd ../ui && npm audit --audit-level=high || { echo "WARN: NPM vulnerabilities found"; }

echo "5. Coverage check..."
cd ../ui && npm run test:coverage -- --run
# Parse coverage report to ensure no decrease

echo "=== ALL CHECKS PASSED ==="
echo "Ready to commit and push!"
```

### 2.3 Code Review Process

**Solo Developer Mode** (MVP):
1. **Self-Review**: Use AI agent for second-pass review
2. **Review Checklist**:
   - [ ] Code follows SOLID principles
   - [ ] Error handling covers edge cases
   - [ ] No hardcoded values (use config/env vars)
   - [ ] Tests cover new functionality
   - [ ] No commented-out code left behind
   - [ ] Documentation updated if APIs changed

**AI-Assisted Review**:
```markdown
Prompt for AI Code Review:

"Review this code for:
1. Security vulnerabilities (SQL injection, XSS, input validation)
2. Error handling completeness
3. Test coverage gaps
4. Performance concerns (N+1 queries, excessive allocations)
5. SOLID principle violations

[Paste code diff here]"
```

**Small Team Mode** (Future):
- Require 1 approval for PR merge
- Use GitHub PR review features
- Enforce DoD checklist via GitHub Actions

### 2.4 Deployment Process

**Local Development Deployment**:
```bash
# 1. Ensure database is up-to-date
./scripts/schema/rebuild-schema.sh

# 2. Pull latest Ollama models (if needed)
ollama pull gpt-oss:20b
ollama pull nomic-embed-text

# 3. Start server
cd server && cargo run

# 4. Start client (in separate terminal)
cd ui && npm run tauri dev
```

**Production Deployment** (Future - Post-MVP):
1. Tag release in git: `git tag v0.2.0`
2. Run release workflow (GitHub Actions): builds MSI installer
3. Test MSI installation on clean Windows 11 VM
4. Publish release artifacts to GitHub Releases
5. Update documentation with release notes

**Network Deployment** (Post-MVP):
- See ADR-006 for security requirements before network mode
- TLS certificate setup required
- API key authentication enabled
- Firewall configuration documented

---

## 3. Development Standards

### 3.1 Coding Standards - Rust

#### 3.1.1 Style Guide

**Enforced by**: `rustfmt` (automatic formatting), `clippy` (linting)

**Configuration**: Project root `.rustfmt.toml` and `Cargo.toml`

**Key Conventions**:
- Use `snake_case` for functions, variables, modules
- Use `CamelCase` for types, traits
- Use `SCREAMING_SNAKE_CASE` for constants
- Maximum line length: 100 characters
- Prefer explicit error types over `unwrap()`
- Document public APIs with `///` doc comments

**Example - Well-Formatted Rust**:
```rust
/// Creates a new note with the given content.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `content` - Note content (markdown)
///
/// # Returns
/// * `Result<Note, DbError>` - Created note or database error
///
/// # Example
/// ```
/// let note = create_note(&pool, "My note content").await?;
/// ```
pub async fn create_note(
    pool: &PgPool,
    content: &str,
) -> Result<Note, DbError> {
    // Validate input
    if content.is_empty() {
        return Err(DbError::ValidationError("Content cannot be empty".to_string()));
    }

    // Insert note in transaction
    let mut tx = pool.begin().await?;

    let note_id = sqlx::query_scalar!(
        r#"INSERT INTO note (title) VALUES ($1) RETURNING id"#,
        generate_title(content)
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        r#"INSERT INTO note_original (id, content) VALUES ($1, $2)"#,
        note_id,
        content
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Note {
        id: note_id,
        title: generate_title(content),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_deleted: false,
    })
}
```

#### 3.1.2 Error Handling

**Pattern**: Use `Result<T, E>` with custom error types

**Example**:
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database connection failed: {0}")]
    ConnectionFailed(#[from] sqlx::Error),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Not found: {0}")]
    NotFound(String),
}
```

**Anti-Pattern (Avoid)**:
```rust
// DON'T: unwrap() in production code
let note = get_note(&pool, id).await.unwrap(); // Will panic on error!

// DO: Propagate error with ?
let note = get_note(&pool, id).await?;
```

#### 3.1.3 Clippy Configuration

**Enforcement Level**: Warnings treated as errors in CI

**Disabled Lints** (rare, document justification):
```toml
# Cargo.toml
[lints.clippy]
# Example: Allow large enum variants if performance-justified
large_enum_variant = "allow"
```

**Run Locally**:
```bash
cargo clippy -- -D warnings  # Fail on any warnings
```

### 3.2 Coding Standards - React/TypeScript

#### 3.2.1 Style Guide

**Enforced by**: ESLint, Prettier

**Configuration**: `.eslintrc.json`, `.prettierrc.json`

**Key Conventions**:
- Use functional components with hooks (no class components)
- Use `camelCase` for variables, functions
- Use `PascalCase` for components, types
- Prefer `const` over `let`, never use `var`
- Use explicit types, avoid `any`
- Maximum line length: 100 characters

**Example - Well-Formatted Component**:
```typescript
import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';

interface NoteEditorProps {
  noteId: string;
  onSave?: (content: string) => void;
}

/**
 * NoteEditor component for editing markdown notes.
 *
 * @param noteId - ID of the note to edit
 * @param onSave - Callback when note is saved
 */
export const NoteEditor: React.FC<NoteEditorProps> = ({ noteId, onSave }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const note = await api.getNote(noteId);
        setContent(note.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [noteId]);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Content cannot be empty');
      return;
    }

    try {
      await api.updateNote(noteId, content);
      onSave?.(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="note-editor">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Enter note content..."
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
};
```

#### 3.2.2 TypeScript Best Practices

**Strict Mode**: Enabled in `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Type Definitions**:
```typescript
// services/api.types.ts

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface CreateNoteRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchParams {
  query: string;
  filters?: {
    tags?: string[];
    collection_id?: string;
  };
  limit?: number;
}
```

#### 3.2.3 ESLint Configuration

**Run Locally**:
```bash
npm run lint       # Check for issues
npm run lint:fix   # Auto-fix where possible
```

**Key Rules**:
- `no-console`: Warn (use logging library in production)
- `no-unused-vars`: Error (cleanup unused imports)
- `@typescript-eslint/no-explicit-any`: Error (avoid `any` type)

### 3.3 Testing Requirements

#### 3.3.1 Coverage Targets

| Component | Current | Target (MVP) | Priority |
|-----------|---------|--------------|----------|
| **Backend** | ~17.5% | 60% | CRITICAL |
| **Frontend** | 33.48% | 60% | HIGH |
| **Overall** | ~25% | 60% | CRITICAL |

**Coverage Philosophy**: Focus on critical paths (note CRUD, search, linking) rather than 100% coverage of all code.

#### 3.3.2 Test Pyramid

```
        /\
       /  \      E2E Tests
      /    \     - Critical user journeys
     /------\    - Manual + Playwright (future)
    /        \   - 5 core workflows
   /----------\
  /            \  Integration Tests
 /              \ - API endpoints
/                \- Database operations
/------------------\
/                    \ Unit Tests
/                      \- Business logic
/                        \- Components
/                          \- Services
```

**Target Distribution**:
- **Unit Tests**: 70% of total test effort
- **Integration Tests**: 25% of total test effort
- **E2E Tests**: 5% of total test effort (manual initially)

#### 3.3.3 Test Naming Convention

**Rust Tests**:
```rust
#[tokio::test]
async fn test_create_note_with_valid_content() {
    // Arrange, Act, Assert pattern
}

#[tokio::test]
async fn test_create_note_with_empty_content_returns_error() {
    // Arrange, Act, Assert pattern
}
```

**React/TypeScript Tests**:
```typescript
describe('NoteEditor', () => {
  describe('rendering', () => {
    it('displays loading state initially', () => {
      // Test implementation
    });

    it('displays error message when fetch fails', () => {
      // Test implementation
    });
  });

  describe('user interactions', () => {
    it('calls onSave when save button clicked', () => {
      // Test implementation
    });

    it('validates content before saving', () => {
      // Test implementation
    });
  });
});
```

**Naming Pattern**: `test_[function]_[scenario]_[expected_result]`

### 3.4 Documentation Requirements

#### 3.4.1 Code Documentation

**Rust**: Use `///` for public APIs
**TypeScript**: Use JSDoc for exported functions/components

**Example - Rust Doc**:
```rust
/// Searches notes using hybrid full-text + semantic search.
///
/// # Arguments
/// * `query` - Search query string
/// * `limit` - Maximum number of results (default: 10)
/// * `threshold` - Semantic similarity threshold (0.0-1.0)
///
/// # Returns
/// Vector of notes ranked by relevance score
///
/// # Errors
/// Returns `DbError` if database query fails or embeddings unavailable.
pub async fn search_notes(
    pool: &PgPool,
    query: &str,
    limit: usize,
    threshold: f32,
) -> Result<Vec<Note>, DbError> {
    // Implementation
}
```

**Example - TypeScript Doc**:
```typescript
/**
 * Fetches a note by ID from the API.
 *
 * @param noteId - UUID of the note to fetch
 * @returns Promise resolving to Note object
 * @throws {ApiError} If note not found or network error
 *
 * @example
 * ```typescript
 * const note = await api.getNote('123e4567-e89b-12d3-a456-426614174000');
 * console.log(note.title);
 * ```
 */
export async function getNote(noteId: string): Promise<Note> {
  // Implementation
}
```

#### 3.4.2 Inline Comments

**When to Comment**:
- Complex algorithms (explain "why", not "what")
- Non-obvious optimizations
- Temporary workarounds (include TODO or FIXME)
- Regex patterns or magic numbers

**Anti-Pattern (Avoid)**:
```rust
// Increment counter by one
counter += 1;  // This comment is obvious and adds no value
```

**Good Pattern**:
```rust
// Use cosine distance (1 - similarity) for HNSW index ordering
// because pgvector sorts ascending, so smaller = more similar
ORDER BY e.vector <=> $1::vector
```

#### 3.4.3 README Updates

**When to Update**:
- New environment variable added
- New dependency required (Ollama model, PostgreSQL extension)
- Development setup changed
- New script added to `/scripts/`

**Sections to Maintain**:
- Prerequisites
- Installation
- Development Commands
- Environment Variables
- Troubleshooting

### 3.5 Git Commit Conventions

#### 3.5.1 Commit Message Format

**Structure**:
```
<type>: <subject>

[optional body]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring without feature change
- `test`: Adding or updating tests
- `docs`: Documentation updates
- `chore`: Build/tooling changes
- `perf`: Performance improvement
- `style`: Code formatting (no logic change)

**Examples**:
```
feat: add auto-linking job for semantic note discovery

Implements background job that queries embeddings to find
related notes and creates links automatically when similarity
score exceeds 0.7 threshold.

Related: #15
```

```
fix: prevent duplicate tags on note creation

Tag validation was not checking for existing tags before
insert, causing unique constraint violations. Added check
to query existing tags first.

Fixes: #42
```

```
test: add integration tests for hybrid search

Coverage improvement for search.rs module. Tests verify
FTS + vector search combining via RRF algorithm.

Coverage: search.rs 45% -> 78%
```

#### 3.5.2 Commit Frequency

**Guideline**: Commit frequently, push after Act validation

**Pattern**:
```
[Work locally with frequent commits]
git add .
git commit -m "feat: implement link discovery logic"

[Continue development]
git commit -m "test: add unit tests for link scoring"

[Before pushing]
gh act -j backend-tests && gh act -j frontend-tests
git push origin main
```

**Anti-Pattern**: Large commits mixing multiple features or fixes (hard to review, hard to revert).

---

## 4. Quality Gates

### 4.1 Pre-Push Quality Gate (MANDATORY)

**Enforced By**: Developer discipline + pre-commit hook (future)

**Requirements**:
```bash
# 1. Backend validation
gh act -j backend-tests
# Exit code MUST be 0

# 2. Frontend validation
gh act -j frontend-tests
# Exit code MUST be 0

# 3. No uncommitted changes
git status
# Working tree must be clean

# 4. Push
git push origin main
```

**No Exceptions**: Even for "simple" fixes, documentation updates, or urgent hotfixes.

**Rationale**: Act tests are the single source of truth for CI/CD parity. Local-only tests may pass while CI fails, causing broken builds.

### 4.2 Coverage Thresholds

**MVP Gate Criteria**:
- Frontend line coverage: ≥ 60%
- Backend line coverage: ≥ 60%

**Iteration Goal**: Increase coverage by 5-10% per iteration until target reached.

**Tracking**:
```bash
# Frontend coverage report
cd ui && npm run test:coverage -- --run
# View: ui/coverage/index.html

# Backend coverage (future - using tarpaulin)
cd server && cargo tarpaulin --out Html
# View: server/coverage/index.html
```

**Coverage Ratcheting**: Once a module reaches a coverage threshold, it should not decrease in future iterations.

### 4.3 Security Audit Requirements

**Frequency**: Every push (automated in Act workflows)

**Backend Security**:
```bash
cargo audit  # Check for known vulnerabilities in dependencies
```

**Frontend Security**:
```bash
npm audit --audit-level high  # Check for high/critical vulnerabilities
```

**Action on Findings**:
- **Critical/High**: Fix immediately or document mitigation plan
- **Medium**: Fix within current iteration
- **Low**: Add to backlog for future iteration

**Allowed Exceptions**: Document in `.aiwg/security/audit-exceptions.md` with justification.

### 4.4 Code Quality Gates

#### 4.4.1 Rust Clippy

**Enforcement**: Zero warnings in CI

```bash
cargo clippy -- -D warnings
```

**Common Clippy Violations to Avoid**:
- `clippy::unwrap_used`: Prefer `?` or `unwrap_or`
- `clippy::expect_used`: Same as above
- `clippy::panic`: Never panic in production code
- `clippy::todo`: Remove before commit
- `clippy::dbg_macro`: Use proper logging

#### 4.4.2 TypeScript Type Checking

**Enforcement**: Zero type errors in CI

```bash
npm run build  # TypeScript compilation must succeed
```

**Common Type Errors to Avoid**:
- Using `any` type (use explicit types or `unknown`)
- Missing null checks (`strictNullChecks` enabled)
- Incorrect prop types in React components

#### 4.4.3 Formatting

**Backend**:
```bash
cargo fmt --check  # Verify formatting (CI)
cargo fmt          # Auto-format (local)
```

**Frontend**:
```bash
npm run lint       # Check formatting (CI)
npm run lint:fix   # Auto-fix (local)
```

### 4.5 Performance Baselines

**Tracked Metrics** (from Master Test Plan):

| Operation | Target (P95) | Measured By |
|-----------|--------------|-------------|
| Note creation | <200ms | Manual timing (curl) |
| Note retrieval | <100ms | Manual timing (curl) |
| Full-text search | <500ms | Manual timing (curl) |
| Semantic search | <1s | Manual timing (curl) |
| Hybrid search | <1s | Manual timing (curl) |

**Measurement Frequency**: After performance-sensitive changes (database queries, indexing)

**Regression Threshold**: Performance degradation >20% requires investigation and fix.

---

## 5. Communication

### 5.1 Progress Tracking

#### 5.1.1 Iteration Todo Lists

**Location**: `.aiwg/planning/iterations/iteration-N.md`

**Format**:
```markdown
## Iteration N Backlog

### In Progress
- [ ] Feature: Auto-linking (Est: 3 days, Actual: 2.5 days so far)
  - [x] Job queue implementation
  - [x] Similarity calculation
  - [ ] WebSocket notification
  - [ ] UI display

### Blocked
- [ ] Feature: Network authentication (Blocked by: ADR-006 not complete)

### Completed
- [x] Test: Coverage baseline established (Completed: Day 2)
- [x] Refactor: Database connection pooling (Completed: Day 4)
```

**Update Frequency**: Daily during check-in

#### 5.1.2 Friction Log

**Purpose**: Document pain points, setup issues, workflow friction

**Location**: `.aiwg/quality/friction-log.md`

**Format**:
```markdown
## Friction Log - 2025-12

### 2025-12-04
- **Issue**: Act tests take 8 minutes to run, slowing iteration
- **Impact**: Medium - delays commit cycle
- **Resolution**: Investigate test parallelization, consider caching

### 2025-12-03
- **Issue**: Ollama model pull times out on slow connection
- **Impact**: High - blocks development environment setup
- **Resolution**: Document alternative: pre-download models via torrent
```

### 5.2 Decision Documentation

#### 5.2.1 Architecture Decision Records (ADRs)

**When to Create ADR**:
- Technology choice (framework, database, library)
- Significant design pattern change
- Non-obvious trade-off decision
- Security/privacy policy

**Template**: Use AIWG template at `.aiwg/architecture/ADR-XXX-title.md`

**Required Sections**:
1. **Status**: Proposed, Accepted, Deprecated, Superseded
2. **Context**: What problem are we solving?
3. **Decision**: What did we decide to do?
4. **Consequences**: Positive and negative outcomes
5. **Alternatives Considered**: What other options did we evaluate?

**Example**:
```markdown
# ADR-003: Local-First Privacy

**Status**: Accepted (2025-12-04)

**Context**:
Users want personal knowledge management without cloud vendor lock-in
or privacy concerns. Many alternatives (Notion, Obsidian Sync) require
cloud storage or third-party services.

**Decision**:
All data processing and storage stays on the local machine. No telemetry,
no cloud AI calls, no analytics. Future sync (if implemented) will use
direct peer-to-peer encryption, not cloud intermediaries.

**Consequences**:
- Positive: Complete user control, no ongoing costs, no data breaches
- Negative: No built-in sync, user responsible for backups
- Trade-off: Accept complexity of local setup for privacy guarantee

**Alternatives Considered**:
1. Cloud-first with E2E encryption (rejected: still requires trust)
2. Self-hosted server option (deferred: adds complexity)
3. Hybrid local + optional cloud (rejected: violates privacy principle)
```

#### 5.2.2 Lightweight Decision Log

**For Minor Decisions** (don't warrant full ADR):

**Location**: `.aiwg/working/decision-log.md`

**Format**:
```markdown
## 2025-12-04: Database Schema Management
- **Decision**: Use clean-schema.sql rebuild for development iteration
- **Rationale**: Faster than migrations (2s vs 30s), no production data yet
- **Trade-off**: Must keep migrations in sync manually
- **Review Before**: Beta release (will switch to migration-based)
```

### 5.3 Status Reporting

#### 5.3.1 Iteration Status Report

**Frequency**: End of each iteration

**Template**:
```markdown
# Iteration N Status Report - [End Date]

## Summary
[One paragraph describing what was accomplished this iteration]

## Completed Work
- Feature 1: Auto-linking between related notes (3 days)
- Feature 2: WebSocket job notifications (2 days)
- Test Coverage: Backend 17.5% → 25% (+7.5%)

## Metrics
- Velocity: 8 days (planned) / 7.5 days (actual)
- Coverage: Frontend 33.48%, Backend 25%
- P0 Issues: 0
- P1 Issues: 2 (carry over to next iteration)

## Risks & Issues
- **Risk #6**: Performance degradation with 500+ notes (no mitigation yet)
- **Issue #42**: Duplicate tags causing constraint violations (RESOLVED)

## Next Iteration Focus
- Goal: Achieve 60% backend coverage
- Top priority: Database layer tests (db_enhanced.rs)

## Retrospective Highlights
- What went well: Act tests caught 3 bugs before push
- What to improve: Test writing taking longer than development
- Action item: Pair with AI agent for test generation
```

#### 5.3.2 Project Health Dashboard

**Tracked Metrics**:

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Coverage (Backend) | 25% | 60% | RED |
| Coverage (Frontend) | 33.48% | 60% | YELLOW |
| P0 Issues | 0 | 0 | GREEN |
| P1 Issues | 2 | <3 | GREEN |
| Test Pass Rate | 100% | 100% | GREEN |
| Build Time (Act) | 8 min | <5 min | YELLOW |

**Status Colors**:
- GREEN: On track or exceeding target
- YELLOW: Progressing but needs attention
- RED: Below target, action required

**Update Frequency**: Weekly (Monday)

---

## 6. Appendices

### Appendix A: Quick Reference Commands

#### Development Workflow
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d
./scripts/dev_server.sh

# Run tests locally (quick iteration)
cd server && cargo test
cd ui && npm test -- --run

# Run full validation (before push)
gh act -j backend-tests
gh act -j frontend-tests

# Check coverage
cd ui && npm run test:coverage -- --run
# View: ui/coverage/index.html

# Format code
cd server && cargo fmt
cd ui && npm run lint:fix

# Check for issues
cd server && cargo clippy -- -D warnings
cd ui && npm run lint
```

#### Database Management
```bash
# Rebuild schema (development)
./scripts/schema/rebuild-schema.sh

# Run migrations (CI/CD)
cd server && sqlx migrate run

# Update SQLx offline mode
cd server && cargo sqlx prepare
```

#### Git Workflow
```bash
# Check status
git status

# Commit changes
git add .
git commit -m "feat: description"

# Validate before push
gh act -j backend-tests && gh act -j frontend-tests

# Push
git push origin main
```

### Appendix B: Troubleshooting Guide

#### Act Tests Failing Locally

**Symptom**: `gh act -j backend-tests` fails but local `cargo test` passes

**Diagnosis**:
1. Check environment variables in `.github/workflows/backend-tests.yml`
2. Verify PostgreSQL service is running with pgvector
3. Check database schema is up-to-date

**Fix**:
```bash
# Ensure test database exists
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/hotm_test
psql $TEST_DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Rebuild schema
./scripts/schema/rebuild-schema.sh

# Re-run Act
gh act -j backend-tests
```

#### Coverage Not Updating

**Symptom**: Tests passing but coverage report shows 0% or stale data

**Diagnosis**: Coverage report not regenerated after test run

**Fix**:
```bash
# Frontend
cd ui
rm -rf coverage/  # Clear old reports
npm run test:coverage -- --run

# Backend (future)
cd server
cargo tarpaulin --out Html --output-dir coverage
```

#### Clippy Warnings in CI

**Symptom**: Local `cargo clippy` passes but CI fails

**Diagnosis**: CI uses `-D warnings` flag (warnings as errors)

**Fix**:
```bash
# Run with same strictness as CI
cargo clippy -- -D warnings

# Fix all warnings
# Re-run until zero warnings
```

### Appendix C: Ceremony Checklists

#### Iteration Planning Checklist
- [ ] Review previous iteration retrospective
- [ ] Identify carry-over items from last iteration
- [ ] Define iteration goal (one sentence)
- [ ] Select work items from backlog
- [ ] Verify all items meet Definition of Ready
- [ ] Estimate effort for each item
- [ ] Identify risks and mitigation strategies
- [ ] Set coverage improvement goal
- [ ] Document iteration plan in `.aiwg/planning/iterations/`

#### Daily Check-In Checklist
- [ ] Review yesterday's progress
- [ ] Update iteration todo list
- [ ] Identify any blockers
- [ ] Plan today's focus area
- [ ] Check coverage trend (weekly)
- [ ] Review friction log (add new entries if needed)

#### Iteration Review Checklist
- [ ] Demo completed features
- [ ] Verify all acceptance criteria met
- [ ] Run full Act validation
- [ ] Check coverage improvement vs. goal
- [ ] Review P0/P1 issue status
- [ ] Document known issues for next iteration
- [ ] Create iteration status report

#### Retrospective Checklist
- [ ] What went well this iteration?
- [ ] What didn't go well?
- [ ] What should we change for next iteration?
- [ ] Review friction log entries
- [ ] Document action items with owners
- [ ] Update process guide if patterns emerged

### Appendix D: Related Documents

| Document | Location |
|----------|----------|
| Master Test Plan | `.aiwg/testing/master-test-plan.md` |
| Software Architecture Document | `.aiwg/architecture/software-architecture-doc.md` |
| Coverage Baseline | `.aiwg/testing/coverage-baseline.md` |
| Elaboration Phase Plan | `.aiwg/planning/phase-plan-elaboration.md` |
| Risk Register | `.aiwg/risks/risk-list.md` |
| CLAUDE.md | `/home/manitcor/dev/hotm/CLAUDE.md` |

### Appendix E: Metrics Definitions

#### Coverage Metrics
- **Line Coverage**: Percentage of code lines executed during tests
- **Branch Coverage**: Percentage of conditional branches tested
- **Function Coverage**: Percentage of functions called during tests

**Tool**: Vitest (frontend), Tarpaulin (backend future)

#### Quality Metrics
- **P0 (Blocker)**: Prevents core functionality, fix immediately
- **P1 (Critical)**: Major friction in workflow, fix within 1 iteration
- **P2 (Major)**: Annoying but has workaround, fix within 2 iterations
- **P3 (Minor)**: Quality-of-life improvement, backlog

#### Velocity Metrics
- **Planned Days**: Work estimated at iteration start
- **Actual Days**: Work completed at iteration end
- **Velocity**: Ratio of actual/planned (target: 80-100%)

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2025-12-04 |
| **Version** | 1.0 (BASELINE) |
| **Status** | APPROVED |
| **Primary Author** | Project Manager |
| **Reviewers** | Architecture Designer, Test Architect |
| **Next Review** | After first Construction iteration (2 weeks) |

**Change Log**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Project Manager | Initial baseline for Construction phase |

---

**End of Development Process Guide v1.0 (BASELINE)**
