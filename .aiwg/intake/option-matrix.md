# Option Matrix (Project Context & Intent)

**Purpose**: Capture what this project IS - its nature, audience, constraints, and intent - to determine appropriate SDLC framework application (templates, commands, agents, rigor levels).

**Generated**: 2026-01-30 (updated for matric-memory frontend migration)
**Project**: HotM Frontend (matric-memory Web Client)

---

## Step 1: Project Reality

### What IS This Project?

**Project Description** (in natural language):

```
MIGRATION PROJECT: HotM is transitioning from a full-stack Tauri desktop application to a
lightweight React/TypeScript SPA that serves as a frontend client for the mature matric-memory
API server. The original HotM started as a memory tooling test system that evolved into the
comprehensive matric-memory server (separate repo). Now we're refactoring HotM to be a focused,
production-ready web UI for matric-memory's REST API.

Key changes:
- REMOVE: Rust API server (server/ directory), Tauri desktop wrapper, direct PostgreSQL access
- KEEP: React 19 UI components, TailwindCSS styling, Radix UI, markdown editor
- ADD: matric-memory API client layer, React Router, React Query
- DEFER: OAuth/OIDC authentication (add post-MVP when multi-user needed)

Target: 100+ external users, web-based access via static SPA deployed to Nginx
```

### Audience & Scale

**Who uses this?** (checked based on migration requirements)
- [ ] Just me (personal project)
- [ ] Small team (2-10 people, known individuals)
- [ ] Department (10-100 people, organization-internal)
- [x] **External customers (100-10k users, paying or free)** - Web-based access via SPA
- [ ] Large scale (10k-100k+ users, public-facing)

**Audience Characteristics**:
- **Technical sophistication**: Mixed (knowledge management users, not necessarily developers)
- **User risk tolerance**: Expects stability (production-quality SPA)
- **Support expectations**: Best-effort (documentation, error handling, bug fixes)

**Usage Scale** (target post-migration):
- **Active users**: 100+ initially → 500-1,000 in 6 months → 5,000+ in 2 years
- **Request volume**: Moderate (depends on matric-memory API, frontend is lightweight)
- **Data volume**: N/A (data stored in matric-memory server, not frontend)
- **Geographic distribution**: Web-based (accessible from anywhere with browser)

### Deployment & Infrastructure

**Expected Deployment Model** (post-migration):
- [x] **Static SPA (Single-Page Application)**:
  - **Primary**: Web browser (any modern browser, responsive design)
  - **Components**: React SPA → matric-memory REST API (separate infrastructure)
  - **Rationale**: Lightweight deployment, existing Nginx pipeline, web-accessible
- [ ] Full-stack application (NO - backend is matric-memory, separate repo)
- [ ] Desktop (NO - migrating away from Tauri desktop)
- [ ] Mobile (future consideration, responsive web first)

**Where does this run?**:
- [x] **Static hosting (Nginx)** - Existing pipeline for static sites
- [x] **Browser (any modern browser)** - Web-based SPA, no local installation
- [ ] Desktop (migrating AWAY from Tauri desktop)
- [ ] Local hosting (NO - matric-memory API handles backend)
- [ ] Cloud platform (Nginx is self-hosted, could move to CDN later)

**Infrastructure Complexity**:
- **Deployment type**: Static SPA (simple, just HTML/CSS/JS files)
- **Data persistence**: None (frontend is stateless, data in matric-memory API)
- **External dependencies**: 1 (matric-memory API - production server)
- **Network topology**: Simple (Browser → Nginx → matric-memory API)

### Technical Complexity

**Codebase Characteristics** (post-migration):
- **Size**: 5k-10k LoC (React frontend only, removing ~8k LoC of Rust backend)
- **Languages**: TypeScript/React only (removing Rust, SQL migrations)
- **Architecture**: Simple SPA (React → API client → matric-memory REST API)
- **Team familiarity**: Brownfield migration (preserving existing React UI components)

**Technical Risk Factors** (checked for migration):
- [x] **API Integration** (matric-memory API dependency, CORS, error handling)
- [ ] Performance-sensitive (frontend is lightweight, API handles heavy lifting)
- [ ] Security-sensitive (auth deferred, direct API access initially)
- [ ] Data integrity-critical (data in matric-memory, not frontend responsibility)
- [ ] High concurrency (N/A for static SPA)
- [ ] Complex business logic (NLP pipeline now in matric-memory server)

---

## Step 2: Constraints & Context

### Resources

**Team**:
- **Size**: 1-3 developers (small team, frontend/full-stack focused)
- **Experience**: Senior (React, TypeScript, API integration)
- **Availability**: Flexible (quality over speed, no hard deadline)

**Budget**:
- **Development**: Moderate (team time for migration work)
- **Infrastructure**: Low (Nginx hosting only, matric-memory API is separate budget)
- **Timeline**: Flexible (no hard deadline, quality over speed)

### Regulatory & Compliance

**Data Sensitivity**:
- [x] **User-provided content** (notes, thoughts, documents from external users)
- [x] **Potentially PII** (user notes may contain personal information)
- [ ] Payment information (not applicable)
- [ ] Protected Health Information (not applicable)
- [ ] Sensitive business data (possible - user notes may contain work content)

**Regulatory Requirements**:
- [ ] None - some best-effort compliance expected
- [x] **GDPR** (best-effort, matric-memory API handles data privacy)
- [ ] HIPAA (not applicable - not healthcare)
- [ ] PCI-DSS (not applicable - no payments)

**Contractual Obligations**:
- [x] **None** (no contracts, no SLAs, best-effort uptime)

### Technical Context

**Current State** (pre-migration):
- **Current stage**: Migration planning (v0.1.2 Tauri app → v0.2.0 SPA)
- **Test coverage**: Target 60%+ post-migration
- **Documentation**: Comprehensive (README, API spec, architecture docs)
- **Deployment automation**: GitHub Actions CI/CD (updating for frontend-only)

**Technical Debt** (migration context):
- **Severity**: Significant (architectural change required - remove Rust backend, Tauri wrapper)
- **Type**: Migration (remove redundant code, adapt to matric-memory API)
- **Priority**: Complete migration before adding new features

---

## Step 3: Priorities & Trade-offs

### What Matters Most?

**Rank these priorities** (from migration requirements):
1. **Preserve UI / Adapt to API** - TOP PRIORITY (minimize UI changes, rewire to matric-memory)
2. **Feature parity** - All existing HotM features work via matric-memory API
3. **Quality / Testing** - 60% coverage target, stable production deployment
4. **Speed to delivery** - Flexible timeline (quality over speed)

**Priority Weights** (derived from migration scope):

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| **Delivery speed** | **0.20** | Flexible timeline, but migration should complete before adding new features. |
| **Cost efficiency** | **0.10** | Low infrastructure cost (static SPA + existing Nginx). |
| **Quality/security** | **0.40** | 60% test coverage, stable deployment, secure API integration. Auth deferred. |
| **Reliability/scale** | **0.30** | 100+ external users, production matric-memory API dependency. |
| **TOTAL** | **1.00** | ← Must sum to 1.0 |

### Trade-off Context

**What are you optimizing for?** (migration priorities):

```
MIGRATION FOCUS: Remove architectural redundancy, leverage mature matric-memory API.

1. Preserve existing React UI (users know the UX, minimize disruption)
2. Eliminate Rust backend code (matric-memory provides all needed endpoints)
3. Simple deployment (static SPA via existing Nginx pipeline)
4. Defer authentication (add OAuth/OIDC post-MVP when multi-user needed)

The matric-memory server has a comprehensive, production-ready API. HotM should focus
on being an excellent frontend client, not duplicate backend functionality.
```

**What are you willing to sacrifice?** (migration trade-offs):

```
- **Desktop app features**: Remove Tauri, system tray, global hotkeys (migrate to web-only)

- **Authentication (initially)**: Defer OAuth/OIDC to post-MVP (direct API access for now)

- **Speed to launch**: Take time to do migration properly (quality over speed, flexible timeline)

- **Some UI polish**: Focus on feature parity first, UX refinements later
```

**What is non-negotiable?** (migration requirements):

```
- **Preserve existing React UI**: Users know the current UX, minimize disruption during migration

- **Complete backend removal**: All Rust server code must be removed (server/ directory)

- **Feature parity via API**: All existing HotM features must work via matric-memory API endpoints

- **Simple deployment**: Static SPA via existing Nginx pipeline (no complex infrastructure)

- **60% test coverage**: Maintain quality bar during migration
```

---

## Step 4: Intent & Decision Context

### Why This Intake Now?

**What triggered this intake?**:
- [x] **Architecture evolution** (migrate from full-stack to frontend-only SPA)
- [x] **Leverage mature API** (matric-memory server now production-ready)
- [x] **Eliminate redundancy** (HotM duplicates logic that belongs in matric-memory)
- [x] **Scale to external users** (100+ users need web access, not desktop app)
- [ ] Compliance requirement
- [ ] Funding/business milestone

**What decisions need making?** (migration scope):

```
1. **API Integration**: Which matric-memory endpoints cover existing HotM features?
   Need to verify all endpoints exist and work as expected.

2. **Code Removal**: What Rust/Tauri code can be safely deleted vs. preserved for reference?
   Goal is clean removal of server/ and ui/src-tauri/ directories.

3. **Auth Strategy**: Defer OAuth/OIDC to post-MVP. Direct API access initially.
   Add Keycloak integration when multi-user management becomes priority.

4. **Deployment**: Use existing Nginx static site pipeline. What configuration needed?
```

**What's uncertain or controversial?** (migration risks):

```
- **API Endpoint Coverage**: Assumption that matric-memory has all needed endpoints.
  Need early API discovery phase to verify no gaps.

- **CORS Configuration**: matric-memory API must allow frontend origin.
  Coordinate with matric-memory team on CORS policy.

- **User Data Migration**: Existing HotM users need path to migrate data to matric-memory.
  Export/import tooling may be needed.
```

**Success criteria for this intake process** (migration goals):

```
1. **Complete Backend Removal**: Zero Rust code remaining (server/, ui/src-tauri/)

2. **Feature Parity**: All existing HotM UI features work via matric-memory API

3. **Simple Deployment**: Static SPA deploys via existing Nginx pipeline

4. **Quality Maintained**: 60% test coverage, stable production deployment

5. **Auth Deferred**: OAuth/OIDC integration planned for post-MVP phase
```

---

## Step 5: Framework Application

### Relevant SDLC Components

Based on project reality (frontend migration to matric-memory API, 100+ external users, small team):

**Templates** (checked applicable):
- [x] **Intake** (project-intake, solution-profile, option-matrix) - **Current activity**
- [x] **Architecture** (ADRs for key decisions: SPA migration, API-only architecture)
- [ ] Requirements (skip formal use cases - migration scope defined in intake)
- [x] **Test** (60% coverage target, E2E tests for critical paths)
- [ ] Security (baseline, auth deferred to post-MVP)
- [x] **Deployment** (Nginx configuration, API client setup, environment config)
- [ ] Governance (skip - small team, lightweight process)

**Commands** (checked applicable):
- [x] **Intake commands** (intake-wizard, project-status) - **Currently using**
- [x] **Flow commands** (flow-iteration-dual-track for migration iterations)
- [ ] Quality gates (lightweight - test coverage + CI passing)
- [x] **Specialized** (pr-review for migration changes)

**Agents** (checked applicable):
- [x] **Architecture Designer** (ADRs for SPA migration decisions)
- [x] **Code Reviewer** (PR review for migration changes)
- [x] **Test Engineer** (60% coverage, E2E tests for critical paths)
- [ ] Security specialists (deferred - auth added post-MVP)
- [ ] Operations specialists (lightweight - static SPA is simple)
- [ ] Enterprise specialists (not applicable)

**Process Rigor Level**:
- [x] **Moderate** (Production SPA with small team)
  - ADRs for key migration decisions
  - 60% test coverage target
  - Code review for PRs
  - CI/CD for deployment
- [ ] Minimal (too lightweight for production deployment)
- [ ] Full (too heavy for small team migration project)
- [ ] Enterprise (not applicable - no compliance requirements yet)

### Rationale for Framework Choices

**Why this subset of framework?** (migration context):

```
HotM is a **frontend migration project** transitioning from full-stack Tauri app to SPA.
SDLC framework sizing for Production profile with small team:

**Use (relevant for migration)**:
- **Intake documents** (current activity) - Define migration scope, track progress
- **ADRs** - Document key decisions (SPA migration, API-only architecture, auth deferral)
- **API integration guide** - Document matric-memory endpoints, error handling
- **Deployment guide** - Nginx configuration, environment setup
- **Test strategy** - 60% coverage, E2E tests for critical paths
- **CI/CD** - Automated testing and deployment

**Skip (not relevant for migration)**:
- Formal requirements (migration scope defined in intake)
- Comprehensive architecture docs (SPA architecture is straightforward)
- Security templates (auth deferred, baseline security sufficient)
- Governance (small team, lightweight process)

**Defer (post-MVP)**:
- OAuth/OIDC authentication (add when multi-user needed)
- Security compliance (add when compliance requirements emerge)
- Comprehensive traceability (add if team grows)
```

**What we're skipping and why**:

```
**Authentication (DEFERRED)**:
- Direct API access initially (matric-memory handles any auth needs)
- Add Keycloak OIDC post-MVP when multi-user management required

**Heavy governance**:
- Small team (1-3 developers), lightweight process sufficient
- PR review for quality, but no formal change control

**Compliance**:
- Baseline security (HTTPS, XSS protection, dependency scanning)
- Full compliance (SOC2, penetration testing) when requirements emerge

**When to revisit**:
- **1,000+ users**: Upgrade monitoring, increase test coverage to 80%
- **Multi-user auth needed**: Add Keycloak OIDC integration
- **Team expansion (5+)**: Add formal code review, traceability
- **Compliance required**: Add security certifications, audit logging
```

---

## Step 6: Evolution & Adaptation

### Expected Changes

**How might this project evolve?** (migration context):

- [x] **User base growth**:
  - **When**: Post-migration, 100+ → 500 → 1,000+ users
  - **Trigger**: Production deployment, matric-memory API availability

- [x] **Feature expansion**:
  - **When**: Post-migration (after feature parity achieved)
  - **Trigger**: User feedback, matric-memory API new features

- [x] **Authentication**:
  - **When**: Post-MVP, when multi-user management needed
  - **Trigger**: Need for user sessions, access control, personalization

- [ ] **Team expansion**: Possible if user growth justifies

- [ ] **Commercial/monetization**: Not planned initially

- [ ] **Compliance requirements**: May emerge with user growth

**Adaptation Triggers** (when to increase SDLC rigor):

```
**Add Authentication (Post-MVP)**:
- When multi-user access management needed
- Implement Keycloak OIDC integration
- Add token management, session handling
- Update security posture to Strong

**Scale to 1,000+ users**:
- Upgrade monitoring (APM, distributed tracing)
- Increase test coverage to 80%+
- Add performance testing (load testing)
- Consider CDN for global distribution

**Team Expansion (5+ developers)**:
- Formalize code review (2+ reviewers)
- Add comprehensive traceability
- Use AIWG iteration workflow
- Increase documentation (API contracts, component diagrams)

**Compliance Requirements**:
- Add security certifications (SOC2)
- Implement audit logging
- Penetration testing
- Security incident response plan
```

**Planned Migration Evolution**:

- **Phase 1 (Week 1-2)**: Discovery & Preparation
  - ✅ Intake documents (project-intake, solution-profile, option-matrix)
  - API discovery (test matric-memory endpoints)
  - Verify CORS configuration

- **Phase 2 (Week 3-6)**: Frontend Code Migration
  - Remove Rust backend (server/ directory)
  - Remove Tauri desktop (ui/src-tauri/)
  - Add API client layer (ui/src/api/)
  - Add React Router, React Query
  - Update UI components to use matric-memory API

- **Phase 3 (Week 7-10)**: Testing & Quality
  - 60%+ test coverage
  - E2E tests for critical paths
  - Update CI/CD for frontend-only

- **Phase 4 (Week 11-12)**: Deployment
  - Deploy to staging (Nginx)
  - Validate with production matric-memory API
  - Set up monitoring (Sentry)

- **Phase 5 (Week 13+)**: Production & Post-MVP
  - Production deployment
  - User migration (if applicable)
  - Auth integration (Keycloak OIDC, when needed)

---

## Migration Scope Definition

**Purpose**: Define scope for migration from Tauri desktop app to matric-memory frontend SPA

### Must-Have (Migration MVP)

**Frontend Code Migration**:
- [x] Remove Rust backend (`server/` directory deleted)
- [x] Remove Tauri desktop (`ui/src-tauri/` directory deleted)
- [x] Remove desktop dependencies (`@tauri-apps/api`)
- [x] Add API client layer (`ui/src/api/` with matric-memory integration)
- [x] Add React Router for SPA navigation
- [x] Add React Query for API data caching

**UI Feature Parity** (preserve existing HotM features):
- [x] Note CRUD via matric-memory `/notes` API
- [x] Full-text search via matric-memory `/search` API
- [x] Hybrid search (FTS + vector) via matric-memory API
- [x] Tag management via matric-memory `/tags` API
- [x] Collection management via matric-memory `/collections` API
- [x] Markdown editor (preserve existing component)
- [x] Search results display with highlights

**Quality & Testing**:
- [x] 60%+ test coverage (unit, component, integration)
- [x] E2E tests for critical paths (login, create note, search)
- [x] CI/CD updated for frontend-only
- [x] Security scan (`npm audit`)

**Deployment**:
- [x] Static SPA deployed to Nginx
- [x] Environment-based API URLs (dev, staging, production)
- [x] Monitoring setup (Sentry or similar)

### Nice-to-Have (Post-Migration)

**UX Improvements**:
- [ ] KaTeX math rendering (preserve existing)
- [ ] Mermaid diagram rendering (preserve existing)
- [ ] Dark mode / theme customization
- [ ] Mobile-responsive design improvements
- [ ] Offline mode (service worker, PWA)

**Advanced Features**:
- [ ] Note provenance UI (revision history visualization)
- [ ] Semantic search UI (show similarity scores)
- [ ] Advanced search filters (date range, tags, collections)

### Deferred (Post-MVP)

**Authentication**:
- [ ] Keycloak OIDC integration
- [ ] User session management
- [ ] Token refresh and logout
- [ ] Multi-user access control

**Advanced Infrastructure**:
- [ ] CDN for global distribution
- [ ] Performance monitoring (APM)
- [ ] Advanced analytics

### Success Criteria (Migration Complete)

**Code Cleanup**:
- Zero Rust files remaining in repository
- Zero Tauri-specific code remaining
- All features work via matric-memory API

**Quality**:
- 60%+ test coverage
- E2E tests passing
- CI/CD pipeline green

**Deployment**:
- Production SPA deployed and accessible
- Monitoring capturing errors
- No critical production issues

---

## Summary

**Project Type**: Frontend migration project (Tauri desktop → matric-memory SPA)

**Current State**: Migration planning (v0.1.2 Tauri app → v0.2.0 SPA)

**Primary Goal**: Complete migration to leverage matric-memory API, deploy as web SPA

**Key Migration Decisions**:
- Remove Rust backend (delegate to matric-memory API)
- Remove Tauri desktop (web-only SPA)
- Preserve React UI (minimize code changes)
- Defer authentication (OAuth/OIDC post-MVP)
- Deploy via Nginx (existing static site pipeline)

**SDLC Framework Sizing**:
- **Use**: Intake docs, ADRs, API integration guide, test strategy (60%+), CI/CD
- **Skip**: Formal requirements, heavy governance, security compliance (for now)
- **Defer**: OAuth/OIDC auth, enterprise features, compliance certifications

**Migration Phases**:
1. **Discovery** (Week 1-2): API discovery, CORS verification, intake docs
2. **Code Migration** (Week 3-6): Remove backend, add API client, update components
3. **Testing** (Week 7-10): 60% coverage, E2E tests, CI/CD updates
4. **Deployment** (Week 11-12): Staging, production, monitoring
5. **Post-MVP** (Week 13+): Auth integration, user feedback, improvements

**Profile Evolution Triggers**:
- Multi-user needed → Add Keycloak OIDC authentication
- 1,000+ users → Upgrade monitoring, increase test coverage to 80%
- Team expansion → Formalize code review, add traceability
- Compliance required → Add security certifications, audit logging

**Success Metrics**:
- Code cleanup: Zero Rust files remaining
- Feature parity: All HotM features work via API
- Quality: 60%+ test coverage, E2E passing
- Deployment: Production SPA accessible and stable
