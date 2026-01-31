# HotM Risk Register v2.0 (SPA Migration)

**Project**: HotM - Frontend Migration to matric-memory Web Client
**Phase**: Migration Planning (v0.1.2 → v0.2.0 SPA)
**Last Updated**: 2026-01-30
**Document Version**: 2.0
**Previous Version**: 1.0 (Desktop application risks)

## Executive Summary

This risk register tracks risks for HotM's migration from a Tauri desktop application to a React SPA web client consuming the matric-memory API. The migration eliminates architectural redundancy and scales to 100+ external users.

**Critical Path Risks** (blocking migration):
- Risk #MIG-001: matric-memory API incompatibility or missing endpoints
- Risk #MIG-002: Feature parity gaps between desktop and web
- Risk #MIG-005: Browser compatibility issues
- Risk #TECH-001: Test coverage insufficient for safe migration

**Key Changes from v1.0**:
- **Retired**: 8 desktop-specific risks (Windows UX, MSI installer, Ollama setup, global hotkeys)
- **Added**: 5 migration-specific risks (API dependency, auth complexity, performance regression)
- **Updated**: 3 existing risks reframed for web SPA context

---

## Migration-Specific Risks (High Priority)

### Risk #MIG-001: matric-memory API Incompatibility or Missing Endpoints

**Category**: Integration
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Frontend migration assumes matric-memory API provides all necessary endpoints for HotM features (notes CRUD, search, tags, collections, semantic search, provenance). If critical endpoints are missing, undocumented, or incompatible with HotM's data models, the migration stalls or requires significant backend API development.

**Triggers**:
- API endpoints missing for core features (e.g., bulk tag updates, note linking, provenance retrieval)
- API response schemas don't match HotM's expected data models
- Undocumented API behavior causes integration failures
- API versioning not stable (`/api/v1/` subject to breaking changes)
- Rate limiting or pagination not well-documented

**Mitigation Strategies**:
1. **API Discovery Phase** (Week 1-2): Review matric-memory OpenAPI/Swagger spec, test all endpoints
2. **Gap Analysis**: Document missing endpoints, coordinate with matric-memory team on API additions
3. **Contract Testing**: Integration tests validate API contracts match frontend expectations
4. **Fallback Plan**: If critical endpoints missing, defer features to post-MVP or implement client-side workarounds
5. **Version Pinning**: Use stable API version (`/api/v1/`), monitor for breaking changes
6. **Early Validation**: Test end-to-end integration in dev environment before major refactoring

**Owner**: Frontend Lead + matric-memory API Team
**Due Date**: Week 2 (API discovery complete), ongoing during migration
**Last Updated**: 2026-01-30

---

### Risk #MIG-002: Feature Parity Gaps Between Desktop and Web

**Category**: Migration
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Desktop app features may not translate directly to web SPA (e.g., global hotkeys, system tray, native file system access, offline-first storage). Users migrating from desktop app may experience UX friction or perceive feature regressions if web version lacks expected capabilities.

**Triggers**:
- Users expect global hotkey (Ctrl+Alt+H) but web apps can't register global hotkeys
- Desktop app has local database with instant access, web SPA has network latency
- Desktop file attachments stored locally, web version needs upload/download flow
- Offline mode in desktop app, web SPA requires online connection (unless PWA implemented)

**Mitigation Strategies**:
1. **Feature Audit**: Document all desktop features, categorize as "preserve," "adapt," or "defer"
2. **UX Adaptation**: Replace desktop-specific features with web equivalents:
   - Global hotkey → Browser bookmark or PWA install
   - System tray → Browser tab with notification badge
   - Instant local access → Optimistic UI updates + aggressive caching (React Query)
3. **User Communication**: Clear migration guide explaining feature changes and web benefits
4. **Progressive Enhancement**: Implement PWA features post-MVP (offline mode, install prompt)
5. **Fallback Option**: Keep desktop app available temporarily for users needing desktop features

**Owner**: Product Owner (prioritization) + UX Designer (adaptation)
**Due Date**: Week 3 (feature audit), ongoing during Construction
**Last Updated**: 2026-01-30

---

### Risk #MIG-003: Authentication Complexity (OIDC Integration)

**Category**: Security
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Monitoring (Deferred to Post-MVP)

**Description**:
Keycloak OIDC integration introduces complexity: authorization code flow, token refresh, silent renewal failures, logout edge cases, PKCE flow security. Poor auth UX (frequent re-logins, confusing error messages) or security gaps (token leakage, XSS vulnerabilities) could block user adoption.

**Triggers**:
- OIDC token expiration without proper refresh → Users logged out unexpectedly
- Silent token refresh fails → Users see auth errors mid-session
- Logout doesn't clear tokens → Security risk (lingering sessions)
- PKCE flow misconfigured → Insecure token exchange
- Keycloak configuration errors → Users can't log in at all

**Mitigation Strategies**:
1. **Use Proven Libraries**: `oidc-client-ts` or `react-oidc-context` (don't implement OIDC from scratch)
2. **Comprehensive Auth Testing**: Test happy path + error cases (token expiration, network failures, logout)
3. **Clear Error Messages**: "Session expired, please log in again" (not technical error codes)
4. **Token Storage**: Store tokens securely (in-memory or sessionStorage, NEVER localStorage for refresh tokens)
5. **PKCE Flow**: Use PKCE (Proof Key for Code Exchange) for public client security
6. **Graceful Degradation**: If auth fails, show clear error state (don't leave user in broken state)
7. **Phased Approach**: MVP uses direct API access, add OIDC in later phase when multi-user auth required

**Owner**: Security Architect (auth design) + Frontend Lead (implementation)
**Due Date**: Post-MVP (deferred initially), Week 7-8 if prioritized
**Last Updated**: 2026-01-30

---

### Risk #MIG-004: Performance Regression (Network Latency vs Local Calls)

**Category**: Technical
**Impact**: MEDIUM
**Probability**: LOW
**Status**: Identified

**Description**:
Desktop app with local Rust server had near-zero latency for API calls. Web SPA with remote matric-memory API introduces network latency (50-200ms per request). Users may perceive app as slower, especially for search or frequent CRUD operations.

**Triggers**:
- Search results take >2s to display (vs <500ms in desktop app)
- Note creation feels sluggish due to round-trip latency
- Frequent API calls (typing debounce failures, redundant requests)
- Large API payloads (1000+ note list downloads)
- No loading states → Users perceive app as "frozen"

**Mitigation Strategies**:
1. **Optimistic UI Updates**: Update UI immediately, sync with API asynchronously (React Query optimistic mutations)
2. **Aggressive Caching**: Cache API responses (5-minute TTL for note lists, 1-minute for search)
3. **Request Deduplication**: Prevent duplicate concurrent API calls (React Query automatic)
4. **Debounced Search**: Wait 300ms after user stops typing before sending search query
5. **Pagination**: Fetch notes in batches (20-50 per page) to reduce payload size
6. **Loading States**: Skeleton screens instead of spinners (show placeholders for content)
7. **Performance Benchmarks**: Measure p95 latency, alert if >500ms

**Owner**: Frontend Lead (implementation) + Performance Engineer (monitoring)
**Due Date**: Week 4-6 (implement optimizations), ongoing monitoring
**Last Updated**: 2026-01-30

---

### Risk #MIG-005: Browser Compatibility Issues

**Category**: Technical
**Impact**: MEDIUM
**Probability**: LOW
**Status**: Identified

**Description**:
Desktop app ran on controlled environment (Windows 11, Tauri WebView). Web SPA must support multiple browsers (Chrome, Firefox, Safari, Edge) and browser versions. Browser-specific bugs (CSS rendering, JavaScript API support, WebSocket compatibility) could fragment user experience.

**Triggers**:
- CSS Grid or Flexbox rendering differently in Safari
- Modern JavaScript features not supported in older browsers
- React 19 features break in older browser versions
- Local storage or IndexedDB APIs inconsistent across browsers
- PWA features (service workers) not supported in all browsers

**Mitigation Strategies**:
1. **Target Browser Matrix**: Define supported browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
2. **Transpilation**: Babel/Vite transpile modern JavaScript to ES2020 (broad compatibility)
3. **Polyfills**: Add polyfills for missing APIs (Intl, fetch, Promise) via Vite plugins
4. **Cross-Browser Testing**: Test in all target browsers during development
5. **Progressive Enhancement**: Core functionality works without modern APIs (no JavaScript fallback if feasible)
6. **Browser Feature Detection**: Use feature detection (not browser sniffing) for conditional features
7. **Monitoring**: Track browser usage in analytics, prioritize fixes for common browsers

**Owner**: Frontend Lead (browser testing) + QA Specialist (compatibility validation)
**Due Date**: Week 5-6 (browser testing), ongoing monitoring
**Last Updated**: 2026-01-30

---

## Updated Existing Risks (Reframed for Web SPA)

### Risk #TECH-001: Test Coverage Insufficient for Safe Migration

**Category**: Technical
**Impact**: HIGH
**Probability**: HIGH
**Status**: Identified

**Description**:
Migration from desktop to web requires comprehensive testing to catch regressions. Without 60%+ test coverage (component tests, API integration mocks, E2E smoke tests), migration bugs won't be caught until production, delaying launch or causing user-facing issues.

**Triggers**:
- Component tests missing for updated UI components (NoteEditor, SearchBar)
- API integration layer not tested (mock API responses, error handling)
- E2E tests don't cover critical user journeys (login, create note, search, logout)
- No test coverage reporting in CI/CD pipeline
- Migration changes break existing tests, but coverage gaps hide new bugs

**Mitigation Strategies**:
1. **Test-Before-Migrate**: Write tests for current features BEFORE refactoring to web SPA
2. **Component Tests**: React Testing Library for all updated components (NoteEditor, SearchBar, TagManager)
3. **API Mocks**: Mock matric-memory API responses in integration tests (test error handling)
4. **E2E Smoke Tests**: Playwright or Cypress for critical paths (login, CRUD, search)
5. **Coverage Gates**: CI fails if coverage drops below 60% (enforce in GitHub Actions)
6. **Coverage Reporting**: Add coverage reports to CI, track trends over time

**Owner**: QA Specialist (test creation) + Frontend Lead (enforcement)
**Due Date**: Week 3-4 (write tests before major refactoring), ongoing
**Last Updated**: 2026-01-30 (Updated from Risk #3 in v1.0)

---

### Risk #TECH-002: Core Features Don't Work Well Enough for Daily Use

**Category**: Validation
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Web SPA must match or exceed desktop app UX for daily adoption. If search is slow, note creation clunky, or UI frustrating (too many clicks, confusing navigation), 100+ users won't migrate or will churn back to desktop app or alternatives.

**Triggers**:
- Search takes >2s for small corpus (<100 notes)
- Note creation requires too many clicks (>3 from navigation)
- Link creation requires manual IDs instead of natural selection
- UI feels sluggish (no optimistic updates, frequent loading spinners)
- Browser-specific bugs disrupt workflow

**Mitigation Strategies**:
1. **UX Baseline**: Document minimum acceptable performance before migration:
   - Search response: <1s total (API call + rendering)
   - Note creation: <3 clicks from navigation
   - Link creation: Point-and-click, no copy/paste IDs
2. **Early Dogfooding**: Use web SPA for actual note-taking during development
3. **UX Friction Log**: Track every moment of frustration during daily use
4. **Rapid Iteration Budget**: Reserve 20% of migration time for UX polish
5. **Parallel Systems**: Keep desktop app available temporarily for comparison

**Owner**: Product Owner (validation) + UX Designer (iteration)
**Due Date**: Week 6 (UX baseline), ongoing during Construction
**Last Updated**: 2026-01-30 (Updated from Risk #5 in v1.0)

---

### Risk #TECH-003: Performance Degrades with Growing Note Corpus

**Category**: Technical
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Web SPA performance acceptable with 10-50 notes but degrades at 100+ notes, especially if virtual scrolling not implemented or API pagination missing. Large dataset users (1,000+ notes) may experience slow list rendering, search latency, or browser memory issues.

**Triggers**:
- Note list rendering slows with 100+ notes (no virtualization)
- Search results take >2s for large corpus
- Browser memory usage grows unbounded (no list cleanup)
- API fetches entire note corpus instead of paginated batches
- Frequent re-renders on large lists (React performance issues)

**Mitigation Strategies**:
1. **Virtual Scrolling**: Use react-window or react-virtualized for note lists (render only visible items)
2. **Pagination**: Fetch notes in batches (20-50 per page) from matric-memory API
3. **Lazy Loading**: Load more notes on scroll (infinite scroll pattern)
4. **Search Optimization**: Server-side filtering (matric-memory limits results to 50-100)
5. **Performance Benchmarks**: Create test datasets (100/500/1000 notes), measure render times
6. **React Profiling**: Use React DevTools Profiler to identify slow components, optimize re-renders

**Owner**: Frontend Lead (optimization) + Performance Engineer (monitoring)
**Due Date**: Week 7-8 (implement optimizations), ongoing monitoring
**Last Updated**: 2026-01-30 (Updated from Risk #6 in v1.0)

---

## Integration Risks

### Risk #INT-001: CORS Configuration Blocks API Calls

**Category**: Integration
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Web SPA makes cross-origin requests to matric-memory API. If CORS headers not configured correctly (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`), all API calls fail with CORS errors, rendering application completely unusable.

**Triggers**:
- matric-memory API doesn't allow frontend origin (CORS blocked)
- Pre-flight OPTIONS requests fail
- Credentials (cookies, auth tokens) blocked by CORS policy
- Different origins for dev/staging/prod environments not configured

**Mitigation Strategies**:
1. **Early CORS Testing**: Test CORS in dev environment before major frontend work
2. **Coordinate with API Team**: matric-memory team configures CORS headers:
   - `Access-Control-Allow-Origin: https://hotm-frontend.example.com` (or wildcard for dev)
   - `Access-Control-Allow-Credentials: true` (if using cookies/auth)
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
   - `Access-Control-Allow-Headers: Authorization, Content-Type`
3. **Multiple Environments**: Configure CORS for dev, staging, prod origins
4. **Proxy in Dev**: Use Vite proxy to avoid CORS in local development (`vite.config.ts` proxy)
5. **Clear Error Messages**: If CORS fails, show helpful error ("API unavailable, check CORS configuration")

**Owner**: Frontend Lead (dev proxy) + matric-memory API Team (CORS headers)
**Due Date**: Week 1-2 (CORS setup), before major API integration
**Last Updated**: 2026-01-30

---

### Risk #INT-002: API Contract Changes Break Frontend

**Category**: Integration
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
matric-memory API under active development may introduce breaking changes (schema changes, deprecated endpoints, renamed fields). Frontend assumes stable API contracts; breaking changes cause failed API calls, data mapping errors, or broken features.

**Triggers**:
- API endpoint renamed or removed without versioning
- Response schema changes (new required fields, removed fields, type changes)
- API deprecates old endpoints before frontend migrates
- No API changelog or breaking change notifications

**Mitigation Strategies**:
1. **API Versioning**: Use stable API version (`/api/v1/`), don't consume unversioned endpoints
2. **Contract Testing**: Integration tests validate API contracts match frontend expectations
3. **API Spec Review**: Review OpenAPI/Swagger spec before each sprint, check for changes
4. **Version Compatibility Checks**: Frontend warns if API version doesn't match expected version
5. **Coordination with API Team**: Subscribe to API changelog, get notified of breaking changes
6. **Graceful Degradation**: Handle missing or unexpected API fields (don't crash, log warnings)

**Owner**: Frontend Lead (contract tests) + matric-memory API Team (versioning)
**Due Date**: Ongoing coordination throughout migration
**Last Updated**: 2026-01-30

---

## Timeline and Scope Risks

### Risk #SCOPE-001: Scope Creep (UI Redesign During Migration)

**Category**: Project Management
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Temptation to redesign UI, add new features, or refactor components during migration extends timeline indefinitely. Migration goal is "preserve UI, adapt API only," but feature requests or design improvements distract from core migration work.

**Triggers**:
- "While we're migrating, let's also redesign the note editor"
- "This is a good time to add dark mode"
- "We should refactor all components to use new state management"
- Feature requests from users during migration phase

**Mitigation Strategies**:
1. **Strict Scope Definition**: "Preserve UI, adapt API only" (defer redesign to post-migration)
2. **Feature Freeze**: No new features until migration complete and stable
3. **Backlog Management**: Track improvement ideas in backlog, prioritize post-migration
4. **MVP Mindset**: Ship functional migration first, iterate improvements later
5. **Time-Boxing**: Set hard deadline for migration (e.g., 12 weeks), defer anything blocking deadline

**Owner**: Product Owner (scope management) + Project Manager (timeline enforcement)
**Due Date**: Ongoing throughout migration
**Last Updated**: 2026-01-30

---

### Risk #SCOPE-002: User Data Migration Complexity

**Category**: Migration
**Impact**: HIGH
**Probability**: HIGH (if existing users)
**Status**: Identified

**Description**:
Existing HotM desktop users have local data (notes, tags, collections, revisions) that must migrate to matric-memory server. Data loss, migration failures, or poor migration UX would be catastrophic for user trust and adoption.

**Triggers**:
- No export tool for desktop app data
- matric-memory import API missing or incomplete
- Export format doesn't match matric-memory import schema
- Users don't follow migration guide (skip steps, lose data)
- Migration validation missing (no check for data integrity)

**Mitigation Strategies**:
1. **Export Tool**: Create desktop app export command (JSON export of all user data)
2. **Import API**: Coordinate with matric-memory team on bulk import endpoint
3. **Migration Guide**: Step-by-step user guide with screenshots ("Export from desktop → Import to web")
4. **Data Validation**: Verify all data migrated successfully (note counts, tag counts, check hash)
5. **Test Migration**: Migrate sample user data in staging environment before production
6. **Rollback Plan**: Keep desktop app available as fallback if migration fails

**Owner**: Frontend Lead (export tool) + matric-memory API Team (import API) + Technical Writer (migration guide)
**Due Date**: Week 9-10 (user migration plan), before production launch
**Last Updated**: 2026-01-30

---

## Operational Risks

### Risk #OPS-001: matric-memory API Downtime Blocks Frontend

**Category**: Operational
**Impact**: HIGH
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Frontend completely dependent on matric-memory API uptime. If API experiences outages (server crashes, database issues, network failures), web SPA becomes completely unusable (can't create notes, search, or retrieve data).

**Triggers**:
- matric-memory server crashes or restarts
- Database connection failures (PostgreSQL downtime)
- Network issues between frontend and API server
- API rate limiting blocks all requests
- Deployment issues (API unavailable during updates)

**Mitigation Strategies**:
1. **Graceful Error Handling**: Show offline message, retry logic (exponential backoff)
2. **Cached Data**: Display cached data when API unavailable (React Query stale-while-revalidate)
3. **Health Check Endpoint**: `/api/v1/health` endpoint shows API status in UI
4. **Monitoring**: API uptime monitoring (Pingdom, UptimeRobot, or CloudWatch)
5. **SLA Coordination**: matric-memory team commits to uptime SLA (e.g., 99.5%)
6. **Fallback Mode**: Read-only mode with cached data if API down (can't create/edit, but can view)

**Owner**: Frontend Lead (error handling) + matric-memory API Team (uptime SLA)
**Due Date**: Week 5-6 (implement error handling), ongoing monitoring
**Last Updated**: 2026-01-30

---

### Risk #OPS-002: Monitoring Gaps Hide Production Issues

**Category**: Operational
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Identified

**Description**:
Without frontend error tracking, API call metrics, and user analytics, production issues (unhandled exceptions, failed API calls, user frustration) go unnoticed until users report bugs. Slow debugging cycle hurts user trust.

**Triggers**:
- Unhandled JavaScript exceptions crash user sessions (no error tracking)
- API errors not logged (can't diagnose integration failures)
- Performance regressions undetected (no latency monitoring)
- User complaints lack context ("search is slow" without metrics)

**Mitigation Strategies**:
1. **Error Tracking**: Sentry or similar (capture unhandled exceptions, API errors)
2. **API Metrics**: Log API call latency, success/failure rates (React Query dev tools or custom logging)
3. **User Analytics**: Privacy-friendly analytics (Plausible, Matomo) to track usage patterns
4. **Structured Logging**: Log critical user actions (note created, search performed, link created)
5. **Alerting**: Email or Slack alerts for critical errors (auth failures, API unavailability)
6. **Performance Monitoring**: Track page load times, API latency (Web Vitals, Lighthouse CI)

**Owner**: DevOps Engineer (monitoring setup) + Frontend Lead (logging integration)
**Due Date**: Week 8-9 (production monitoring setup), before production launch
**Last Updated**: 2026-01-30

---

## Team and Process Risks

### Risk #TEAM-001: OIDC Expertise Gap

**Category**: Team
**Impact**: MEDIUM
**Probability**: MEDIUM
**Status**: Monitoring (Deferred with Auth)

**Description**:
Team may be unfamiliar with OIDC flows (authorization code, token refresh, PKCE), security best practices (token storage, XSS prevention), or Keycloak configuration. Auth bugs or security vulnerabilities could block launch or expose user data.

**Triggers**:
- Tokens stored insecurely (localStorage for refresh tokens → XSS vulnerability)
- Silent token refresh fails due to misconfiguration
- PKCE flow not implemented (insecure public client)
- Poor error handling (users stuck in broken auth state)
- Keycloak misconfigured (redirect URIs, client settings)

**Mitigation Strategies**:
1. **Use Proven Libraries**: `oidc-client-ts` or `react-oidc-context` (don't implement OIDC from scratch)
2. **Security Review**: External consultant or experienced developer reviews auth implementation
3. **Follow Best Practices**: OWASP auth guidelines, PKCE for public clients, secure token storage
4. **Training**: Team reviews OIDC documentation, Keycloak tutorials before implementation
5. **Incremental Testing**: Test auth flow in dev environment before staging/prod
6. **Phased Rollout**: MVP without auth, add OIDC in later phase when confident

**Owner**: Security Architect (review) + Frontend Lead (implementation)
**Due Date**: Post-MVP (if auth deferred), Week 7-8 if prioritized
**Last Updated**: 2026-01-30

---

## Retired Risks (Desktop-Specific, No Longer Applicable)

The following risks from v1.0 are **retired** as they applied to the desktop Tauri application and are no longer relevant to the web SPA:

### Retired Risk #1: Incomplete Rollback Leaves Dead Code
**Status**: RETIRED
**Reason**: Desktop architecture fully removed in migration (no rollback scenario)
**Original Impact**: HIGH
**Original Category**: Architecture

### Retired Risk #2: Rollback Breaks Working Features
**Status**: RETIRED
**Reason**: Migration is forward-only (no rollback to desktop architecture)
**Original Impact**: HIGH
**Original Category**: Architecture

### Retired Risk #4: Database Schema Changes Need Careful Handling
**Status**: RETIRED
**Reason**: Frontend no longer manages database (matric-memory server responsibility)
**Original Impact**: MEDIUM
**Original Category**: Architecture

### Retired Risk #7: Windows 11 UX Friction Prevents Habitual Use
**Status**: RETIRED
**Reason**: Web SPA not desktop-specific (multi-platform browser access)
**Original Impact**: HIGH
**Original Category**: Validation

### Retired Risk #8: Ollama Dependency Creates Barrier to Entry
**Status**: RETIRED
**Reason**: Ollama runs server-side in matric-memory (not user-facing dependency)
**Original Impact**: MEDIUM
**Original Category**: Validation

### Retired Risk #9: PostgreSQL + Ollama Setup Complexity Deters Users
**Status**: RETIRED
**Reason**: Server infrastructure managed centrally (users access web SPA only)
**Original Impact**: MEDIUM
**Original Category**: Technical

### Retired Risk #10: Local-First Sync Design Unproven
**Status**: RETIRED
**Reason**: Server-backed SPA (no local-first sync in web architecture)
**Original Impact**: LOW
**Original Category**: Technical

### Retired Risk #11: Rust + React + Tauri Stack Limited Community
**Status**: RETIRED
**Reason**: Rust backend removed (React + TypeScript only, well-supported stack)
**Original Impact**: MEDIUM
**Original Category**: Technical

---

## Risk Prioritization Matrix

### Critical Path (Blocks Migration)
1. **Risk #MIG-001**: matric-memory API incompatibility (HIGH impact, MEDIUM probability)
2. **Risk #TECH-001**: Insufficient test coverage (HIGH impact, HIGH probability)
3. **Risk #INT-001**: CORS configuration blocks API (HIGH impact, MEDIUM probability)
4. **Risk #SCOPE-002**: User data migration complexity (HIGH impact, HIGH probability if existing users)

### High Priority (Significant Impact)
5. **Risk #OPS-001**: API downtime blocks frontend (HIGH impact, MEDIUM probability)
6. **Risk #TECH-002**: Core features inadequate for daily use (HIGH impact, MEDIUM probability)
7. **Risk #SCOPE-001**: Scope creep extends timeline (HIGH impact, MEDIUM probability)

### Monitor Closely
8. **Risk #MIG-002**: Feature parity gaps (MEDIUM impact, MEDIUM probability)
9. **Risk #MIG-004**: Performance regression (MEDIUM impact, LOW probability)
10. **Risk #MIG-005**: Browser compatibility (MEDIUM impact, LOW probability)
11. **Risk #TECH-003**: Performance with large datasets (MEDIUM impact, MEDIUM probability)
12. **Risk #INT-002**: API contract changes (MEDIUM impact, MEDIUM probability)
13. **Risk #OPS-002**: Monitoring gaps (MEDIUM impact, MEDIUM probability)

### Watch List (Lower Priority or Deferred)
14. **Risk #MIG-003**: Auth complexity (MEDIUM impact, MEDIUM probability, deferred to post-MVP)
15. **Risk #TEAM-001**: OIDC expertise gap (MEDIUM impact, MEDIUM probability, deferred with auth)

---

## Risk Review Schedule

**Weekly** (during migration phases):
- Review Critical Path risks
- Update mitigation status
- Add new risks as discovered

**Phase Gates**:
- **Migration Planning Exit** (Week 2): All Critical Path risks have mitigation plans
- **API Integration Milestone** (Week 4): Risk #MIG-001, #INT-001 resolved or mitigated
- **Testing Milestone** (Week 6): Risk #TECH-001 coverage targets met
- **User Migration Milestone** (Week 10): Risk #SCOPE-002 migration plan complete
- **Production Launch** (Week 12+): All HIGH impact risks retired or actively managed

**Owner**: Project Manager (risk tracking) + Frontend Lead (technical mitigation)

---

## Risk Escalation

**Solo Developer to Small Team Context**:
1. **Acknowledge**: Risk materialized or probability increased
2. **Decide**: Fix immediately, defer, pivot, or accept
3. **Document**: Update risk status, capture lessons learned
4. **Adjust**: Update project plan, scope, or timeline

**Decision Criteria**:
- **Critical Path Risk Materializes**: Stop other work, address immediately (blocks migration)
- **High Priority Risk Materializes**: Assess impact, reprioritize sprint
- **Medium Risk Materializes**: Add to backlog, address in next phase
- **Low Risk Materializes**: Document, revisit at phase gate

---

## Appendix: Risk Status Definitions

- **Identified**: Risk documented, not yet analyzed
- **Analyzing**: Gathering data, assessing mitigation options
- **Mitigating**: Active work to reduce probability or impact
- **Monitoring**: Mitigation in place, watching for triggers
- **Retired**: Risk no longer applicable (desktop-specific risks in this version)

---

## Change Log

**v2.0 (2026-01-30)**: Migration to SPA architecture
- **Added**: 5 migration-specific risks (MIG-001 to MIG-005)
- **Added**: 4 integration/operational risks (INT-001, INT-002, OPS-001, OPS-002)
- **Added**: 2 scope/team risks (SCOPE-001, SCOPE-002, TEAM-001)
- **Updated**: 3 existing risks reframed for web SPA (TECH-001, TECH-002, TECH-003)
- **Retired**: 8 desktop-specific risks (architecture rollback, Windows UX, Ollama, PostgreSQL setup, Tauri stack)

**v1.0 (2025-12-04)**: Initial risk register for desktop Tauri application
- 15 risks identified across architecture cleanup, MVP validation, technical, and validation categories

---

**Document Control**
**Created**: 2025-12-04 (v1.0)
**Revised**: 2026-01-30 (v2.0 - SPA Migration)
**Author**: Project Manager (Risk Tracking)
**Review Cycle**: Weekly during migration, bi-weekly post-launch
**Next Review**: 2026-02-06
