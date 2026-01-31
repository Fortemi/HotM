# Solution Profile (Migration Target)

**Document Type**: Production System Profile
**Generated**: 2026-01-30
**Project**: HotM Frontend (matric-memory Web Client)

## Target Profile (Post-Migration)

**Profile**: **Production**

**Selection Rationale**:
- **System Status**: Migration to production-ready SPA (v0.1.2 → v0.2.0)
- **Users**: External users (100+ active users), web-based access
- **Team Size**: Small team (1-3 developers, frontend/full-stack focused)
- **Process Maturity**: Moderate (appropriate for small team, production SPA)
- **Authentication Required**: Keycloak OIDC (multi-user, secure access)
- **API Integration**: matric-memory production API (comprehensive REST endpoints)
- **Deployment**: Static SPA via Nginx (existing pipeline, production-ready)

**Actual**: Production profile (external users, authenticated access, production API dependency)

## Target Profile Characteristics (Post-Migration)

### Security
**Posture**: Strong (appropriate for production SPA with external users)

**Controls Required**:
- **Authentication**: Keycloak OIDC (Authorization Code Flow with PKCE)
  - Short-lived access tokens (15-60 min TTL)
  - Long-lived refresh tokens (automatic renewal)
  - Secure token storage (in-memory or httpOnly cookies, NOT localStorage)
- **Authorization**: Bearer token-based API access (matric-memory API validates tokens)
- **Data Protection**:
  - HTTPS/TLS for all traffic (SPA served over HTTPS, API calls over TLS)
  - Token encryption in transit
  - matric-memory API handles data encryption at rest
- **Secrets Management**: Environment variables for API URLs and OIDC config (no secrets in frontend)
- **Frontend Security**:
  - XSS protection (React auto-escaping, CSP headers)
  - CSRF protection (SameSite cookies, CORS configuration)
  - Dependency security scanning (`npm audit`, Dependabot)

**Security Implementation**:
- Use proven OIDC libraries (`oidc-client-ts`, `react-oidc-context`)
- Regular security audits of dependencies
- Security headers in Nginx (CSP, X-Frame-Options, X-Content-Type-Options)
- HTTPS-only (redirect HTTP → HTTPS)

**Recommendation**: Strong security posture required for Production profile
- External users (100+) require proper authentication and authorization
- User-generated content (notes) may contain sensitive information
- Web-facing SPA requires XSS/CSRF protection

### Reliability
**Target SLOs** (Production profile):
- **Availability**: 99.5% uptime (depends on matric-memory API and Nginx availability)
- **Page Load**: <2s for initial SPA load (first contentful paint)
- **API Latency**: <500ms p95 for matric-memory API calls
- **Search Latency**: <1s total (API call + result rendering)
- **Error Rate**: <1% failed API calls (excluding network issues)

**Monitoring Strategy** (Production profile):
- **Frontend Error Tracking**: Sentry or similar (capture unhandled exceptions, API errors)
- **API Call Metrics**: Track latency, success/failure rates (React Query dev tools or custom logging)
- **User Analytics**: Optional privacy-friendly analytics (Plausible, self-hosted Matomo)
- **Logs**: Structured frontend logs (API errors, auth failures, critical actions)
- **Alerting**: Email or Slack alerts for critical errors (auth failures, API unavailability)

**Recommendation**: Production monitoring required
- Frontend is dependent on matric-memory API (monitor API health proactively)
- External users (100+) expect stable, responsive application
- Error tracking helps identify and fix issues quickly

### Testing & Quality
**Target Test Coverage**: 60%+ (Production profile, moderate coverage)

**Test Strategy** (Production profile):
- **Unit Tests**: Jest or Vitest (React components, utility functions, API client logic)
- **Component Tests**: React Testing Library (UI component behavior, user interactions)
- **Integration Tests**: Mock matric-memory API responses, test error handling (network failures, auth errors)
- **E2E Tests**: Playwright or Cypress (critical user journeys):
  - Login flow (Keycloak OIDC → token retrieval → API call)
  - Create note (form submission → API call → UI update)
  - Search notes (query → results → filtering)
  - Tag management (create, assign, remove tags)
  - Logout (clear tokens, redirect to login)

**Quality Gates** (enforced in CI/CD):
- ✅ TypeScript build passes (no type errors)
- ✅ Linting passes (ESLint, no errors)
- ✅ Unit tests pass (60%+ coverage)
- ✅ Component tests pass
- ✅ E2E smoke tests pass (staging environment)
- ✅ Security scan passes (`npm audit`, no high/critical vulnerabilities)
- ✅ Code review required (1+ reviewer approval before merge)

**Recommendation**: 60% coverage is appropriate for Production profile with small team
- Focus tests on critical paths (auth, note CRUD, search)
- E2E tests ensure end-to-end integration works (SPA → API → database)
- Monitor test suite for flakiness (flaky tests reduce trust)

### Process Rigor
**SDLC Adoption**: Moderate (appropriate for Production profile with small team)

**Process Implementation**:
- **Requirements**: Migration scope documented in intake (feature parity, API integration)
- **Architecture**: Updated documentation (README, API integration guide, deployment guide)
  - **ADD**: ADR for SPA migration ("Why remove Rust backend?")
  - **ADD**: ADR for Keycloak OIDC ("Why OIDC over basic auth?")
- **Code Review**: PR required, 1+ reviewer approval before merge
- **Testing**: 60%+ coverage target (unit, component, integration, E2E)
- **CI/CD**: GitHub Actions (frontend-tests.yml, e2e-tests.yml, deploy.yml)
  - **REMOVE**: backend-tests.yml (no more Rust backend)
  - **REMOVE**: release.yml (no more MSI builds)
- **Documentation**: Comprehensive (README, API integration, deployment, migration guide)

**Key Artifacts** (required for Production profile):
- ✅ Project Intake (completed: project-intake.md, solution-profile.md, option-matrix.md)
- ✅ Migration Plan (defined in intake documents)
- [ ] API Integration Guide (document matric-memory API endpoints, auth flow, error handling)
- [ ] Deployment Guide (Nginx configuration, environment setup, CI/CD pipeline)
- [ ] User Migration Guide (export from old HotM, import to matric-memory, SPA setup)
- [ ] ADRs (key decisions: SPA migration, Keycloak OIDC, API-only architecture)

**Recommendation**: Moderate process rigor is appropriate for Production SPA with small team
- Skip heavy governance (no change control board, no formal requirements templates)
- Focus on critical artifacts (API integration, deployment, migration guides)
- ADRs help document key decisions for future reference

## Migration Roadmap (Prototype → Production)

**Current State**: Tauri desktop app with embedded Rust API server (v0.1.2)
**Target State**: Production SPA with Keycloak auth and matric-memory API integration (v0.2.0+)

**Migration Timeline**: Flexible (quality over speed, no hard deadline)

### Phase 1: Discovery & Preparation (Week 1-2)
**Goal**: Validate matric-memory API and Keycloak readiness

**Actions**:
- ✅ Complete intake documentation (project-intake.md, solution-profile.md, option-matrix.md)
- Review matric-memory API specification (verify all needed endpoints exist)
- Test matric-memory API endpoints (notes CRUD, search, tags, collections, semantic)
- Configure Keycloak OIDC client (public client, PKCE flow, redirect URLs)
- Test authorization code flow (login → token → API call → logout)
- Verify CORS configuration (matric-memory allows frontend origin)

**Success Criteria**:
- ✅ All matric-memory API endpoints tested and working
- ✅ Keycloak OIDC flow working end-to-end
- ✅ No missing API endpoints or CORS issues
- ✅ Team aligned on migration plan

### Phase 2: Frontend Code Migration (Week 3-6)
**Goal**: Remove Rust backend, add OIDC auth, integrate matric-memory API

**Actions**:
- **Remove**:
  - Delete `server/` directory (all Rust backend code)
  - Delete `ui/src-tauri/` directory (Tauri desktop wrapper)
  - Remove desktop dependencies (`@tauri-apps/api`)
  - Remove backend CI/CD workflows (`backend-tests.yml`, `release.yml`)
- **Add**:
  - Install OIDC client library (`oidc-client-ts` or `react-oidc-context`)
  - Install React Router (`react-router-dom` v6)
  - Install React Query (`@tanstack/react-query`)
  - Create `ui/src/api/` (API client layer with token injection)
  - Create `ui/src/auth/` (OIDC authentication module)
- **Update**:
  - Update NoteEditor, SearchBar, TagManager components (use API client)
  - Preserve existing UI/UX patterns (minimal visual changes)
  - Update routing for SPA navigation

**Success Criteria**:
- ✅ All Rust server code removed (zero `*.rs` files in `server/`)
- ✅ All Tauri desktop code removed (zero `*.rs` files in `ui/src-tauri/`)
- ✅ OIDC authentication working (login, token refresh, logout)
- ✅ API client integrated (all components use matric-memory API)
- ✅ Frontend builds successfully (`npm run build` produces static assets)

### Phase 3: Testing & Quality (Week 7-10)
**Goal**: Achieve 60%+ test coverage, E2E tests passing

**Actions**:
- **Unit Tests**:
  - API client layer (mock API responses, test error handling)
  - Utility functions (date formatting, data transformations)
  - React hooks (custom hooks for auth, API data)
- **Component Tests**:
  - NoteEditor (form submission, validation)
  - SearchBar (query input, result display)
  - TagManager (create, assign, remove tags)
- **Integration Tests**:
  - Mock matric-memory API (test error cases: 401, 403, 404, 500)
  - Auth flow (token expiration, refresh, logout)
- **E2E Tests**:
  - Login flow (Keycloak → token → redirect)
  - Create note (form → API → UI update)
  - Search notes (query → results → filtering)
  - Logout (clear tokens, redirect)

**Success Criteria**:
- ✅ 60%+ test coverage (unit + component + integration)
- ✅ E2E smoke tests passing (critical user journeys)
- ✅ CI/CD passing (lint, tests, build)
- ✅ No high/critical security vulnerabilities (`npm audit`)

### Phase 4: Deployment & Staging (Week 11-12)
**Goal**: Deploy to staging environment, validate with real matric-memory API

**Actions**:
- Update CI/CD workflows:
  - `frontend-tests.yml` (lint, unit tests, component tests, coverage)
  - `e2e-tests.yml` (Playwright or Cypress E2E tests)
  - `deploy.yml` (build static assets, deploy to Nginx)
- Configure environments:
  - `.env.development` (local matric-memory API, local Keycloak)
  - `.env.staging` (staging matric-memory API, staging Keycloak)
  - `.env.production` (production matric-memory API, production Keycloak)
- Deploy to staging:
  - Build static assets (`npm run build`)
  - Copy to Nginx staging server
  - Test with staging matric-memory API and Keycloak
- Monitor for errors:
  - Frontend error tracking (Sentry or similar)
  - API call metrics (React Query dev tools)

**Success Criteria**:
- ✅ Staging deployment successful (SPA accessible via browser)
- ✅ Keycloak OIDC login working (staging realm)
- ✅ matric-memory API integration working (staging API)
- ✅ No critical errors in staging (error tracking confirms)

### Phase 5: User Migration & Production Launch (Week 13+)
**Goal**: Migrate existing users, launch production SPA

**Actions**:
- **User Migration**:
  - Create export tool for existing HotM users (export notes, tags, collections to JSON)
  - Coordinate with matric-memory team on bulk import API
  - Test migration with sample user data (verify zero data loss)
  - Write user migration guide (step-by-step instructions)
- **Production Deployment**:
  - Deploy SPA to production Nginx
  - Configure production Keycloak (production realm, client)
  - Point to production matric-memory API
  - Enable monitoring (Sentry, analytics)
- **User Onboarding**:
  - Communicate migration to existing users
  - Provide migration guide and support
  - Monitor user feedback (track issues, feature requests)

**Success Criteria**:
- ✅ Production SPA deployed and accessible
- ✅ Existing users migrated successfully (zero data loss)
- ✅ No critical production errors (error tracking confirms)
- ✅ User feedback positive (90%+ retention)

## Tailoring Notes (Migration-Specific)

**Strengths to Preserve from Current HotM**:
- ✅ Existing React 19 UI components (Radix UI, TailwindCSS)
- ✅ Markdown editor with KaTeX math and Mermaid diagrams
- ✅ User-familiar UX patterns (minimize visual changes during migration)
- ✅ Comprehensive documentation (README, API spec, architecture docs)
- ✅ CI/CD automation (GitHub Actions - adapt for frontend-only)

**Architecture Changes (Migration Impact)**:
- ❌ **Remove**: Tauri desktop wrapper (migrate to web-only SPA)
- ❌ **Remove**: Rust API server (delegate to matric-memory API)
- ❌ **Remove**: Direct PostgreSQL/pgvector access (API-only data access)
- ❌ **Remove**: Embedded Ollama NLP processing (server-side processing)
- ❌ **Remove**: Desktop-specific features (system tray, global hotkeys, Windows 11 native styling)
- ✅ **Add**: Keycloak OIDC authentication (multi-user, secure access)
- ✅ **Add**: matric-memory API client layer (centralized API communication)
- ✅ **Add**: React Router for SPA navigation
- ✅ **Add**: React Query for API data caching and state management

**What to Include** (Production profile with small team):
- ✅ Migration scope document (intake forms - completed)
- ✅ API integration guide (matric-memory endpoints, auth flow, error handling)
- ✅ Deployment guide (Nginx configuration, environment setup, CI/CD)
- ✅ User migration guide (export from old HotM, import to matric-memory)
- ✅ ADRs for key decisions (SPA migration rationale, Keycloak OIDC choice)
- ✅ 60%+ test coverage (unit, component, integration, E2E)
- ✅ Code review (PR required, 1+ reviewer)
- ✅ Monitoring (frontend error tracking, API call metrics)

**What to Skip** (appropriate for small team, Production SPA):
- ❌ Heavy governance (no change control board, no formal requirements templates)
- ❌ Comprehensive traceability (lightweight ADRs sufficient)
- ❌ Security compliance certifications (SOC2, ISO27001 - matric-memory team responsibility)
- ❌ Formal SLAs (best-effort uptime, no contractual commitments)
- ❌ Multi-agent artifact reviews (small team, peer review sufficient)

## Post-Migration Profile Evolution

### When to Scale Up from Production Profile

**Trigger 1: Significant User Growth (1,000+ active users)**
- Upgrade monitoring (APM, distributed tracing)
- Add performance testing (load testing)
- Consider CDN for global distribution
- Increase test coverage to 80%+

**Trigger 2: Team Expansion (5+ developers)**
- Formal code review process (2+ reviewers)
- Comprehensive traceability (requirements → code → tests)
- Architecture review cycle (ADRs for significant decisions)

**Trigger 3: Authentication Required**
- Add OAuth/OIDC integration (Keycloak, Auth0, or similar)
- Implement secure token management
- Add user session handling

**Current Recommendation**: Production profile is appropriate for HotM frontend post-migration. Authentication deferred to later phase.

## Metrics and Tracking (Post-Migration)

### Migration Success Metrics

**Migration Progress**:
- [ ] API discovery complete (all matric-memory endpoints tested)
- [ ] Rust backend removed (zero `*.rs` files in `server/`)
- [ ] Tauri desktop removed (zero `*.rs` files in `ui/src-tauri/`)
- [ ] API client layer complete (`ui/src/api/`)
- [ ] UI components updated (use API client, preserve UX)
- [ ] 60%+ test coverage achieved
- [ ] Staging deployment successful
- [ ] Production deployment successful

**Development Velocity**:
- Test coverage: Target 60%+
- CI pass rate: Target 95%+
- Deployment frequency: Weekly to staging

### Production Metrics (Post-Launch)

**Performance**:
- Page load time: <2s p95
- API call latency: <500ms p95
- Search latency: <1s total
- Error rate: <1% failed API calls

## Recommendations Summary

**Immediate (Week 1-2)**:
1. ✅ Complete intake documents
2. 🔍 API discovery (test all matric-memory endpoints)
3. 📋 Verify CORS configuration

**Short-term (Week 3-6)**:
4. 🗑️ Remove Rust backend and Tauri desktop code
5. ➕ Add React Router, React Query
6. 🔌 Build API client layer (`ui/src/api/`)
7. 🎨 Update UI components (preserve UX, use API client)

**Medium-term (Week 7-10)**:
8. 🧪 Testing (60%+ coverage, E2E tests)
9. 🚀 Deployment to staging
10. 📊 Monitoring setup

**Deferred (Post-MVP)**:
- OAuth/OIDC authentication (Keycloak integration)
- User session management
- Multi-user access control

**Success Criteria for Production Launch**:
- ✅ Zero Rust backend code remaining
- ✅ All UI features use matric-memory API
- ✅ 60%+ test coverage
- ✅ Production deployed via Nginx

**Next Steps**: Review option-matrix.md, then start Inception with `/flow-concept-to-inception .`
