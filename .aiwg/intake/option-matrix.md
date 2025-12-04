# Option Matrix (Project Context & Intent)

**Purpose**: Capture what this project IS - its nature, audience, constraints, and intent - to determine appropriate SDLC framework application (templates, commands, agents, rigor levels).

**Generated**: 2025-12-04 (from codebase analysis + interactive questions)
**Project**: HotM (Hall Of The Mind)

---

## Step 1: Project Reality

### What IS This Project?

**Project Description** (in natural language):

```
Personal knowledge management tool (local-first "memory map") that captures quick thoughts
and automatically integrates them into a larger web of connected notes using AI-powered
embedding generation and hybrid search. Built with Rust (Axum API) + React (Tauri desktop)
for Windows 11. Currently in alpha (v0.1.2) with ~15k lines of code, solo developer (30+ years
experience), undergoing architectural reset after failed single-executable integration attempt.
Expects multiple refactors as concept evolves. Personal use first (3-6 months validation),
potential open source release later. Privacy-first (all data and processing stays local, Ollama
for AI). May become "more profound" than initially envisioned - currently solving personal
note-taking frustration, but concept could resonate with others who struggle to maintain
context across scattered notes.
```

### Audience & Scale

**Who uses this?** (checked based on analysis + user input)
- [x] **Just me (personal project)** - Solo developer building for own knowledge management
- [ ] Small team (2-10 people, known individuals)
- [ ] Department (10-100 people, organization-internal)
- [ ] External customers (100-10k users, paying or free)
- [ ] Large scale (10k-100k+ users, public-facing)

**Audience Characteristics**:
- **Technical sophistication**: Mixed (personal use first, then technical early adopters if shared)
- **User risk tolerance**: Experimental OK (alpha quality acceptable for personal validation)
- **Support expectations**: Self-service (solo dev, no formal support)

**Usage Scale** (current or projected):
- **Active users**: 1 (solo developer) → 5-10 (if shared with technical users) → unknown (if open sourced)
- **Request volume**: Low (<100 API calls/day, single-user workstation)
- **Data volume**: Small initially (<1GB, hundreds of notes) → Medium (10GB+, thousands of notes over time)
- **Geographic distribution**: Single location (local workstation only)

### Deployment & Infrastructure

**Expected Deployment Model**:
- [x] **Hybrid (multiple deployment patterns)**:
  - **Primary**: Desktop app (Tauri client) + Local server (Axum API on localhost:53211)
  - **Components**: Client-server (thick client + local API + local database + local AI)
  - **Rationale**: Tauri provides native Windows 11 UX, Axum handles async API/NLP processing
- [x] **Full-stack application** (frontend + backend + database + supporting services):
  - Tauri React frontend
  - Axum Rust backend (API server)
  - PostgreSQL database (with pgvector extension)
  - Ollama (local AI inference)

**Where does this run?**:
- [x] **Desktop (Windows, native executables)** - Tauri app (primary target: Windows 11)
- [x] **Local hosting (home server)** - PostgreSQL + Ollama run locally (Docker or native)
- [ ] Cloud platform (not applicable - privacy-first, local-only)
- [ ] Mobile (not currently planned)
- [ ] Browser (not applicable - needs local AI processing)

**Infrastructure Complexity**:
- **Deployment type**: Multi-tier (Tauri client ↔ Axum server ↔ PostgreSQL ↔ Ollama)
- **Data persistence**: Multiple data stores (PostgreSQL for notes/embeddings, file system for logs/cache)
- **External dependencies**: 1 major (Ollama for local AI), 0 cloud services (privacy-first)
- **Network topology**: Multi-tier (client → API server → database + AI service), all local (localhost)

### Technical Complexity

**Codebase Characteristics**:
- **Size**: 10k-100k LoC (~15k total: Rust backend + React frontend)
- **Languages**: Rust (primary backend), TypeScript/React (frontend), SQL (migrations)
- **Architecture**: Modular (clean separation: UI ↔ API ↔ DB ↔ NLP)
- **Team familiarity**: Brownfield with instability (alpha codebase, recent integration attempts caused issues)

**Technical Risk Factors** (checked based on analysis + user input):
- [x] **Performance-sensitive** (hybrid search with vector similarity must be <1s)
- [ ] Security-sensitive (local-only, no PII of others, personal data only)
- [ ] Data integrity-critical (personal notes, but not financial/medical/legal)
- [ ] High concurrency (single-user, low concurrent load)
- [x] **Complex business logic** (NLP pipeline: chunking, embedding, linking, tagging)
- [x] **Integration-heavy** (PostgreSQL + pgvector + Ollama + Tauri, all must work together)

---

## Step 2: Constraints & Context

### Resources

**Team**:
- **Size**: 1 developer (solo)
- **Experience**: Senior (30+ years system engineering, based on git contributor insights)
- **Availability**: Part-time/hobby (190 commits in 6 months = ~1.3/day, consistent but not full-time)

**Budget**:
- **Development**: Zero (volunteer/personal project)
- **Infrastructure**: Free (local-only, no cloud costs, Docker/native PostgreSQL + Ollama)
- **Timeline**: Flexible (no hard deadline, but personal urgency to solve note-taking problem)

### Regulatory & Compliance

**Data Sensitivity**:
- [x] **User-provided content** (personal notes, thoughts, documents)
- [ ] Personally Identifiable Information (no PII of others, only user's own data)
- [ ] Payment information (not applicable)
- [ ] Protected Health Information (not applicable)
- [ ] Sensitive business data (personal project, no business data)

**Regulatory Requirements**:
- [x] **None** (no specific regulations apply to personal local-only tool)
- [ ] GDPR (not applicable - personal data only, no data of others)
- [ ] HIPAA (not applicable - not healthcare)
- [ ] PCI-DSS (not applicable - no payments)

**Contractual Obligations**:
- [x] **None** (no contracts, no SLAs, no compliance certifications needed)

### Technical Context

**Current State** (existing project):
- **Current stage**: Early users (alpha, personal use)
- **Test coverage**: Unknown (CI present, but coverage % not reported)
- **Documentation**: Comprehensive (README, API spec, architecture docs, MCP tools spec)
- **Deployment automation**: Scripted (Docker Compose, GitHub Actions CI/CD)

**Technical Debt** (from user input):
- **Severity**: Significant (project instability from single-exe integration attempt)
- **Type**: Architecture (client-server vs embedded), code quality (likely dead code from failed integration)
- **Priority**: Must address (blocking personal validation) - "need to undo that work, clean things up"

---

## Step 3: Priorities & Trade-offs

### What Matters Most?

**Rank these priorities** (from user responses):
1. **Privacy/local-first principles** - NON-NEGOTIABLE (#1 priority)
2. **User experience excellence** - Important (Windows-native feel, smooth interactions)
3. **Build robust foundation** - Moderate (willing to iterate, but avoid major rework)
4. **Speed to delivery** - Lower (personal validation timeline is flexible)

**Priority Weights** (derived from user responses):

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| **Delivery speed** | **0.15** | Personal project, flexible timeline. More important to get architecture right than ship fast. |
| **Cost efficiency** | **0.10** | Not a concern (solo dev, local-only, no infrastructure costs). |
| **Quality/security** | **0.35** | Privacy-first is non-negotiable (0.20). UX quality matters for daily use (0.15). |
| **Reliability/scale** | **0.40** | Personal validation requires daily use (0.25). Must handle growing note corpus (0.15). |
| **TOTAL** | **1.00** | ← Must sum to 1.0 |

### Trade-off Context

**What are you optimizing for?** (from user responses):

```
"Privacy/local-first principles → trust" is #1 priority (non-negotiable). All data and AI
processing must stay local. Future sync solutions will be "novel" (strong encryption, direct
peer-to-peer, no trusted cloud providers).

"This is a classic 'solve my problem' scenario" - personal need to capture quick thoughts
and maintain context across notes. Currently solving personal frustration, but concept may
have broader appeal if it works well.

Deploy as server first (client-server architecture), defer single-executable packaging.
Integration challenges with embedding Axum server into Tauri caused project instability -
need to "undo that work, clean things up" and return to proven client-server design.

Personal use first (3-6 months validation), then consider open source release if valuable.
```

**What are you willing to sacrifice?** (from user responses):

```
- **Deployment simplicity** (initially): Accept Docker Compose or native PostgreSQL + Ollama
  setup for early users. Single-exe packaging is "nice-to-have" but caused too much complexity.

- **Speed to launch**: Willing to take time to stabilize architecture properly. Personal
  validation timeline is flexible (3-6 months), no hard deadline.

- **Feature completeness** (MVP): Can defer MCP integration, advanced UX polish, MSI installer
  until after personal validation confirms concept works.

- **Multi-user support** (initially): Focus on single-user local-first. Multi-device sync
  deferred until core concept validated.
```

**What is non-negotiable?** (from user responses):

```
- **Privacy/local-first forever**: "Never" consider traditional cloud services. All data and
  processing stays local. Future sync will use novel encryption + direct peer-to-peer, not
  cloud providers. "Focus on local first, sync solutions will be novel... We get that working,
  cloud is a simple add-on."

- **Architecture stability**: Must return to client-server design (Tauri client + Axum server
  + external PostgreSQL/Ollama). Single-exe integration caused instability - can't validate
  concept with broken architecture.

- **Daily use quality**: For personal validation to work, tool must be usable daily without
  major friction. Search, linking, and core workflows must work reliably.

- **Flexible deployment options**: Users should be able to choose Docker vs native for
  PostgreSQL and Ollama. "Support services aside from postgres should also have native and
  docker options."
```

---

## Step 4: Intent & Decision Context

### Why This Intake Now?

**What triggered this intake?**:
- [x] **Documenting existing project** (alpha codebase, no formal intake)
- [x] **Technical pivot** (rolling back single-exe integration, return to client-server)
- [x] **Preparing for personal validation** (need stable architecture to use daily)
- [ ] Starting new project
- [ ] Compliance requirement
- [ ] Team expansion
- [ ] Handoff/transition
- [ ] Funding/business milestone

**What decisions need making?** (from user responses):

```
1. **MVP Scope Definition**: "What features MUST work for v0.1? What can wait? Help me cut
   scope to ship." - Need clear feature checklist for personal validation phase.

2. **Architecture Stabilization**: Confirmed decision to deploy as server (client-server),
   defer single-executable. Need to roll back integration work and return to clean separation.

3. **SDLC Framework Sizing**: "Solo dev, local-first tool, pre-launch. Which templates/agents
   are relevant?" - Don't want heavyweight process for personal project.

4. **Deployment Options**: Both Docker Compose (easiest) and native PostgreSQL/Ollama (user
   preference) should be supported. Document setup for both.
```

**What's uncertain or controversial?** (from user responses):

```
- **Single-exe feasibility**: "Integration blockers more than the project is in a bad state
  due to the attempt to make it into a single exe." - Decision made to abandon single-exe for
  now, but may revisit after MVP validation if user demand exists.

- **Future evolution**: "May become more profound in its use in the future" - Concept started
  as personal note-taking tool, but may resonate with broader audience. Uncertain how/when
  to transition from personal tool to open source project.

- **Sync architecture**: Privacy-first sync is non-negotiable, but specific implementation
  ("novel encryption + direct peer-to-peer") is unproven. Will need to validate feasibility
  if/when multi-device becomes priority.
```

**Success criteria for this intake process** (from user responses):

```
1. **MVP Scope Definition**: Clear checklist of must-have features for personal validation
   (3-6 months). Know what to build first, what to defer.

2. **SDLC Framework Sizing**: Understand which AIWG templates/commands/agents are relevant
   for solo dev, local-first, pre-launch project. Avoid overkill, but have structure for
   tracking progress.

3. **Architecture Roadmap**: Plan for cleanup (undo single-exe work), stabilization (restore
   client-server), and evolution (how/when to add features based on personal validation).

4. **Deployment Clarity**: Document setup options (Docker Compose vs native) so future users
   (if shared) can choose based on preference.
```

---

## Step 5: Framework Application

### Relevant SDLC Components

Based on project reality (solo dev, personal tool, alpha → MVP transition) and priorities (privacy-first, architecture cleanup, personal validation):

**Templates** (checked applicable):
- [x] **Intake** (project-intake, solution-profile, option-matrix) - **Current activity**
- [x] **Architecture** (ADRs only, not full SAD) - Document key decisions (client-server vs single-exe, sync design)
- [ ] Requirements (skip formal use cases/NFRs - personal project, solo dev)
- [x] **Test** (test-strategy lightweight, test coverage tracking) - Target 60%+ for MVP
- [ ] Security (skip threat model - local-only, no PII of others)
- [ ] Deployment (skip formal deployment plan - Docker Compose + README sufficient)
- [ ] Governance (skip - solo dev, no multi-stakeholder coordination)

**Commands** (checked applicable):
- [x] **Intake commands** (intake-from-codebase, project-status) - **Currently using**
- [x] **Flow commands** (flow-iteration-dual-track for bi-weekly/monthly iterations) - Lightweight iteration workflow
- [ ] Quality gates (skip for MVP - no formal gate criteria needed)
- [x] **Specialized** (build-poc if testing sync designs, pr-review when self-reviewing major changes)

**Agents** (checked applicable):
- [ ] Core SDLC agents (skip formal multi-agent reviews - solo dev, self-review)
- [x] **Architecture Designer** (when documenting ADRs for key decisions)
- [x] **Code Reviewer** (self-review on major changes, like cleanup branch)
- [x] **Test Engineer** (when increasing coverage to 60%+)
- [ ] Security specialists (not needed for local-only personal tool)
- [ ] Operations specialists (not needed for single-user local app)
- [ ] Enterprise specialists (not applicable)

**Process Rigor Level**:
- [x] **Moderate** (ADRs, lightweight iteration, test coverage tracking, MVP scope doc)
- [ ] Minimal (too lightweight - need structure for 3-6 month validation)
- [ ] Full (too heavy - solo dev, no formal requirements/traceability needed)
- [ ] Enterprise (not applicable - no compliance, no multi-stakeholder coordination)

### Rationale for Framework Choices

**Why this subset of framework?** (based on analysis + user responses):

```
HotM is a **solo-developer, local-first personal tool in alpha → MVP transition**. Appropriate
SDLC framework sizing:

**Use (relevant for this project)**:
- **Intake documents** (current activity) - Understand baseline, plan evolution
- **ADRs** (Architecture Decision Records) - Document key decisions (client-server vs single-exe,
  sync design, deployment options) for future reference and potential contributors
- **MVP scope document** - Feature checklist for personal validation (must-have vs defer)
- **Lightweight iteration workflow** - `/flow-iteration-dual-track` for bi-weekly or monthly
  milestones during validation phase
- **Test strategy** (lightweight) - Target 60%+ coverage on core paths (note CRUD, search,
  linking), track in CI
- **Project status tracking** - `/project-status` to monitor progress against MVP scope

**Skip (not relevant for solo dev, personal tool, pre-launch)**:
- Formal requirements (use cases, user stories) - Personal project, requirements in developer's
  head. Can capture as issues or ADRs when needed.
- Comprehensive architecture docs (SAD, component diagrams) - README + ADRs sufficient for solo
  dev. Can expand if open sourcing.
- Multi-agent artifact reviews - Solo dev, self-review. No need for parallel review cycles.
- Security templates (threat model, security requirements) - Local-only, no PII of others, no
  regulatory requirements. Privacy principles documented in README.
- Deployment templates (deployment plan, runbook, ORR checklist) - Docker Compose + README
  sufficient. No SLA/uptime requirements.
- Governance templates (RACI, CCB, decision log) - Solo dev, no multi-stakeholder coordination
  needed.

**Defer (may become relevant post-MVP)**:
- Formal requirements - If transitioning to multi-user or open source, document feature requests
  as issues or user stories
- Comprehensive architecture docs - If open sourcing, expand README to full SAD for contributor
  onboarding
- Security compliance - If adding multi-user server mode, add basic auth and threat model
- Deployment automation - If offering hosted demo instance, create deployment pipeline
- Governance - If team expands (2+ developers), add PR review process and decision tracking
```

**What we're skipping and why** (be explicit):

```
**Skipping enterprise/multi-stakeholder templates**:
- No formal requirements management (no product manager, no customers to negotiate with)
- No multi-agent reviews (solo dev, self-review faster and sufficient)
- No comprehensive traceability (code → requirements → tests → releases) - overkill for personal
  tool, can add if open sourcing
- No security compliance (no regulatory requirements, no contracts, no customer data)
- No governance (no coordination overhead with solo dev, no decision tracking needed)

**When to revisit**:
- **Multi-user** (5+ active users): Add authentication, basic monitoring, increase test coverage
  to 80%+
- **Open source release**: Add CONTRIBUTING.md, issue templates, PR review process, expand
  architecture docs
- **Team expansion** (2+ developers): Add formal requirements (ADRs/design docs), code review
  process, AIWG iteration workflow
- **Commercial/hosted version**: Add SLA monitoring, security compliance (SOC2), customer support
  infrastructure
```

---

## Step 6: Evolution & Adaptation

### Expected Changes

**How might this project evolve?** (from user responses):

- [x] **User base growth**:
  - **When**: After 3-6 months personal validation, if concept proves valuable
  - **Trigger**: "Would I recommend it to others?" → Yes → Open source release

- [x] **Feature expansion**:
  - **When**: Throughout validation phase (3-6 months)
  - **Trigger**: Personal use friction points, missing workflows, search quality improvements

- [ ] **Team expansion**: Not planned (solo dev, may stay solo even if open sourced)

- [ ] **Commercial/monetization**: Not planned (personal tool, open source if shared)

- [ ] **Compliance requirements**: Not applicable (local-only, no regulatory requirements)

- [x] **Technical pivot**:
  - **When**: Ongoing (currently rolling back single-exe integration)
  - **Trigger**: Architecture instability, integration complexity, validation blockers

**Adaptation Triggers** (when to revisit framework application - from user responses):

```
**Increase SDLC rigor when**:

1. **Open Source Release** (after personal validation, if valuable):
   - Add CONTRIBUTING.md, issue templates, PR review process
   - Expand architecture docs (README → SAD, ADRs for major decisions)
   - Increase test coverage to 80%+ (currently targeting 60%)
   - Add security policy (SECURITY.md) to prevent malicious contributions

2. **Multi-Device Sync** (if personal validation shows need):
   - Design novel sync architecture (strong encryption, peer-to-peer)
   - Add threat model (data in motion, key management)
   - Increase security rigor (audit encryption implementation)

3. **Multi-User Support** (if users request collaboration features):
   - Add authentication/authorization
   - Implement basic monitoring (uptime, error rates)
   - Add deployment automation (CI/CD to staging/prod)
   - Formalize requirements (feature requests as issues or user stories)

4. **Team Expansion** (if 2+ developers join):
   - Add formal code review (PR approvals required)
   - Use AIWG iteration workflow (Discovery + Delivery tracks)
   - Increase architecture documentation (component diagrams, API contracts)
   - Add traceability (link features → code → tests)

**Keep lightweight when**:
- Solo developer only (current state)
- Personal use only (validation phase)
- Pre-launch (alpha → MVP → validation)
- Privacy-first, local-only (no external dependencies, no compliance requirements)
```

**Planned Framework Evolution** (from user responses + recommendations):

- **Current (Cleanup Phase - 1-2 weeks)**:
  - Intake documents (project-intake, solution-profile, option-matrix) ✅
  - Rollback plan for single-exe integration work
  - End-to-end architecture verification (Tauri + Axum + PostgreSQL + Ollama)

- **3 months (MVP Stabilization)**:
  - MVP scope document (feature checklist)
  - ADRs for key decisions (client-server rationale, sync design when ready)
  - Test strategy (60%+ coverage target)
  - Lightweight iteration workflow (`/flow-iteration-dual-track` for monthly milestones)

- **6 months (Personal Validation Complete)**:
  - Decision point: Keep private, open source, or pivot?
  - If open sourcing: Add CONTRIBUTING.md, issue templates, expand architecture docs
  - If keeping private: Minimal maintenance, continue lightweight process

- **12 months (Post-Validation)**:
  - If multi-user: Add authentication, monitoring, increase test coverage to 80%+
  - If team expansion: Formalize code review, use full AIWG iteration workflow
  - If staying solo: Continue lightweight process, iterate based on personal needs

---

## MVP Scope Definition

**Purpose**: Define minimal feature set for personal validation (3-6 months)

### Must-Have Features (MVP v0.1)

**Core Note Management**:
- [x] Create note (quick capture with markdown editor)
- [x] Read note (retrieve with metadata, tags, links)
- [x] Update note (create new revision, preserve immutable original)
- [x] Delete note (soft delete, maintain provenance)

**Hybrid Search** (critical for daily use):
- [x] Full-text search (PostgreSQL tsvector/GIN indexes)
- [x] Semantic search (pgvector with HNSW indexes)
- [x] Hybrid search (combine FTS + vector, reciprocal rank fusion)
- [ ] Search filters (by date, tags, collections) - **Nice-to-have**

**Auto-Linking** (core value proposition):
- [x] Background job queue (process notes asynchronously)
- [x] Embedding generation (Ollama nomic-embed-text)
- [x] Link discovery (semantic similarity threshold)
- [ ] Link quality scoring (precision/recall metrics) - **Nice-to-have**

**Auto-Tagging** (organization):
- [x] AI-generated tags (Ollama gpt-oss:20b)
- [ ] Tag refinement (user can accept/reject suggestions) - **Nice-to-have**
- [ ] Entity extraction (people, places, concepts) - **Nice-to-have**

**Windows 11 UX** (daily use requires smooth interactions):
- [x] Desktop app (Tauri native window)
- [x] System tray integration (minimize to tray, quick access)
- [x] Global hotkey (Ctrl+Alt+H to show/hide)
- [x] Markdown editor (with preview)
- [ ] KaTeX math rendering - **Nice-to-have**
- [ ] Mermaid diagram rendering - **Nice-to-have**
- [ ] Mica/Acrylic effects (Windows 11 native styling) - **Nice-to-have**

### Nice-to-Have Features (Defer Post-MVP)

**UX Polish**:
- [ ] Advanced markdown features (KaTeX, Mermaid, syntax highlighting)
- [ ] Dark mode / theme customization
- [ ] Keyboard shortcuts beyond global hotkey
- [ ] Note templates (daily notes, meeting notes, project notes)
- [ ] Bulk operations (tag multiple notes, delete multiple)

**Advanced Features**:
- [ ] Collections (organize notes into groups)
- [ ] Note provenance UI (visualize revision history)
- [ ] Link graph visualization (interactive web of connections)
- [ ] Export (markdown, JSON, HTML)
- [ ] Import (from other note apps, markdown files)

**MCP Integration** (AI assistant compatibility):
- [ ] MCP server implementation (Model Context Protocol)
- [ ] MCP tools (create_note, search_notes, find_similar, etc.)
- [ ] AI assistant integration (Claude, ChatGPT, etc.)

**Deployment**:
- [ ] MSI installer (Windows 11 installer package)
- [ ] Single-executable packaging (Tauri + embedded Axum + embedded PostgreSQL)
- [ ] Docker Compose one-liner (already exists, but needs testing)
- [ ] Install scripts (setup_dev.sh, setup_prod.sh)

**Multi-Device** (defer until post-validation):
- [ ] Sync architecture design (novel encryption + peer-to-peer)
- [ ] Conflict resolution (CRDT or operational transform)
- [ ] Multi-device UI (mobile, web, other desktop platforms)

### Validation Metrics (3-6 Months)

**Adoption** (do I use it daily?):
- Daily use: Yes/No tracking
- Notes created per week: Track growth
- Search queries per day: Track engagement

**Quality** (does it work well?):
- Search success rate: High/Medium/Low (subjective)
- Link discovery quality: Precision/recall (false positives, missed connections)
- UX friction points: List (what's annoying? what blocks workflow?)

**Value** (does it solve the problem?):
- Context recovery: Can I find related notes easily?
- Workflow integration: Has it become habit?
- Insight generation: Do I discover connections I'd otherwise miss?
- Recommendation: Would I recommend it to others?

### Success Criteria (MVP → Open Source Decision)

**Keep Private** (minimal maintenance):
- Using daily, but not exceptional (solves personal need, not revolutionary)
- No enthusiasm to share (works for me, but may not resonate with others)
- Maintenance burden acceptable (continue iterating for personal use)

**Open Source Release** (expand to community):
- Using daily AND enthusiastic (solves personal need exceptionally well)
- High confidence others would value it (concept resonates, UX polished)
- Willing to support community (answer issues, review PRs, maintain project)

**Pivot** (archive or change direction):
- Not using daily (too much friction, doesn't solve problem effectively)
- Concept doesn't work (auto-linking unreliable, search quality poor)
- Better alternatives exist (discovered other tools that solve problem better)

---

## Summary

**Project Type**: Solo-developer, local-first personal knowledge management tool (alpha → MVP)

**Current State**: Alpha v0.1.2, undergoing architectural cleanup (rolling back single-exe integration)

**Primary Goal**: Personal validation (3-6 months daily use) to prove concept works

**Non-Negotiable Principles**:
- Privacy/local-first forever (all data and processing stays local)
- Architecture stability (client-server, not single-exe for now)
- Daily use quality (must be usable without major friction)

**SDLC Framework Sizing**:
- **Use**: Intake docs, ADRs, MVP scope doc, lightweight iteration workflow, test strategy (60%+)
- **Skip**: Formal requirements, multi-agent reviews, comprehensive architecture, security compliance, governance
- **Defer**: Expand framework if multi-user, open source, team expansion, or commercial

**Next Steps**:
1. **Cleanup** (1-2 weeks): Roll back single-exe integration, restore client-server architecture
2. **MVP Stabilization** (2-4 weeks): Core features working, 60%+ test coverage, daily use started
3. **Personal Validation** (3-6 months): Use daily, track friction, iterate on quality
4. **Decision Point**: Keep private, open source, or pivot?

**Framework Evolution Triggers**:
- Open source → Add contributor docs, expand architecture, PR review process
- Multi-device sync → Add threat model, audit encryption, increase security rigor
- Multi-user → Add auth, monitoring, deployment automation, formalize requirements
- Team expansion → Code review, iteration workflow, architecture docs, traceability

**Success Metrics**:
- Adoption: Daily use sustained for 3-6 months
- Quality: Search works, linking accurate, UX smooth
- Value: Solves personal problem, would recommend to others
- Decision: Clear next step (private, open source, or pivot)
