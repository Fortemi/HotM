# Project Intake Form (System Migration)

**Document Type**: Frontend Migration Project
**Generated**: 2026-01-30
**Source**: HotM to matric-memory frontend migration requirements

## Metadata

- **Project name**: HotM Frontend (matric-memory Web Client)
- **Repository**: https://github.com/jmagly/hotm.git (migrating to frontend-only)
- **Current Version**: 0.1.2 (Pre-Migration)
- **Target Version**: 0.2.0 (Post-Migration SPA)
- **Last Updated**: 2026-01-30
- **Stakeholders**: Engineering (migration team), Product, External Users (100+), DevOps (Nginx deployment)

## System Overview

**Purpose**: Migrate HotM from a full-stack Rust/Tauri application to a lightweight React/TypeScript Single-Page Application (SPA) that serves as a web-based frontend client for the mature matric-memory API server. The matric-memory server now provides comprehensive memory management, NLP processing, and search capabilities; HotM will focus solely on delivering an excellent user experience for accessing these features.

**Problem Being Solved**: HotM originally started as a test system for memory tooling but has evolved redundantly—the memory server functionality matured into the separate matric-memory repository with production-ready APIs. The current HotM architecture duplicates orchestration logic and routing that now properly belongs in the matric-memory server. This migration eliminates redundancy, simplifies deployment (static SPA vs. desktop app), and positions HotM as a focused, scalable frontend for external users (100+).

**Current Status**: Migration Planning (v0.1.2 → v0.2.0)
- **Current**: Tauri desktop app with embedded Rust API server
- **Target**: React SPA + Keycloak OIDC auth + matric-memory API integration

**Users**: External users (100+ users), web-based access, multi-device support

**Tech Stack** (post-migration):
- **Languages**: TypeScript/JavaScript (remove all Rust server components)
- **Frontend**: React 19, Vite (preserve existing UI codebase)
- **UI Libraries**: Radix UI, TailwindCSS (preserve design system)
- **Backend API**: matric-memory server (separate repo, production-deployed, comprehensive REST API)
- **Authentication**: Keycloak (self-hosted OIDC provider, OAuth 2.0 / OIDC flows)
- **Deployment**: Static SPA via Nginx (existing pipeline for static sites)
- **Build**: Pre-compiled JavaScript bundles (no Tauri, no desktop packaging)

## Problem and Outcomes

**Problem Statement**:
HotM began as a memory tooling test system and evolved into a full-stack application with embedded Rust server, NLP orchestration, and routing logic. As the project matured, the memory server functionality was properly extracted into the separate matric-memory repository with a comprehensive, production-ready API. The current HotM architecture is now redundant—it contains duplicated orchestration and routing logic that should live exclusively in the matric-memory server. We need to refactor HotM into a lightweight, web-based frontend that:
1. Leverages matric-memory's mature API endpoints for all data operations
2. Preserves the existing React UI and user experience that users know
3. Removes all Rust server components (no more embedded API server)
4. Adds Keycloak OIDC authentication for secure, multi-user access
5. Deploys as a simple static SPA via Nginx for scalability and simplicity

**Target Personas**:
- Primary: External users (100+ active users) managing personal knowledge and memory via web browser
- Secondary: Power users leveraging advanced AI features (semantic search, NLP processing, entity extraction)
- Tertiary: Mobile users accessing via responsive web interface (future enhancement)
- Operational: Developers and administrators managing matric-memory deployments

**Success Metrics (Migration KPIs)**:
- **Migration Completeness**: 100% feature parity with current HotM UI functionality (all features use matric-memory API)
- **Code Simplification**: Remove 100% of Rust server code (`server/` directory eliminated)
- **Authentication Integration**: Seamless Keycloak OIDC login flow with secure token management
- **API Integration**: Zero embedded server logic, all operations via matric-memory REST endpoints
- **Performance**: Page load <2s, API response handling <500ms p95, search latency <1s
- **User Retention**: 90%+ of existing users migrate successfully (zero data loss, familiar UX)
- **Deployment Simplicity**: Single static bundle, deploy via existing Nginx pipeline in <10 minutes

## Current Scope and Features

**Core Features** (in-scope for migration, preserving HotM UI patterns):

**Phase 1: Core Migration (Must-Have for MVP)**
1. **Note Management via matric-memory API**:
   - Create, read, update, delete notes (CRUD operations via REST API)
   - Display original and revised note content (immutable originals preserved server-side)
   - Note metadata display (timestamps, user attribution, version info)

2. **Search & Discovery**:
   - Full-text search (FTS) via matric-memory `/search` endpoint
   - Hybrid search (FTS + vector similarity) with reciprocal rank fusion
   - Search result highlighting and snippets
   - Filter by tags, collections, date ranges

3. **Organization Features**:
   - Tag management (create, assign, remove tags via API)
   - Collection management (organize notes into collections)
   - Note categorization and bulk operations

4. **API Client Layer**:
   - Centralized matric-memory API integration
   - Error handling (network failures, API errors)
   - Request/response transformation
   - Environment-based API URLs (dev, staging, production)

**Phase 2: Advanced Features (Nice-to-Have, Post-MVP)**
5. **AI-Powered Features** (display results from matric-memory processing):
   - View AI-generated summaries and revisions
   - Display extracted entities and auto-tags
   - Show semantic similarity scores
   - Note provenance and revision history visualization

6. **Advanced Search**:
   - Semantic search via vector embeddings
   - "Find similar" functionality
   - Search filters and advanced query syntax
   - Saved searches and search history

7. **User Experience Enhancements**:
   - Real-time updates (if matric-memory adds WebSocket support)
   - Offline mode with local storage caching
   - Mobile-responsive design
   - Dark mode and theme customization

**Out-of-Scope** (removed or delegated to matric-memory server):
- ❌ **Rust API server** (remove entire `server/` directory, all `*.rs` backend files)
- ❌ **Tauri desktop packaging** (migrate from desktop app to web-only SPA)
- ❌ **Embedded Ollama NLP processing** (server-side via matric-memory background jobs)
- ❌ **Database schema management** (handled by matric-memory server, PostgreSQL + pgvector)
- ❌ **Background job orchestration** (server-side workers in matric-memory)
- ❌ **Direct PostgreSQL access** (all data access via matric-memory REST API)
- ❌ **MCP server embedding** (if needed, runs server-side in matric-memory)
- ❌ **System tray integration** (desktop-only feature, not applicable to web SPA)
- ❌ **Global hotkeys** (desktop-only, removed with Tauri migration)

**Future Considerations** (post-migration enhancements):
- OAuth/OIDC authentication (Keycloak integration for multi-user access)
- User session management and secure token handling
- Progressive Web App (PWA) capabilities (offline access, install prompt)
- Browser extensions for web clipping (capture web content to matric-memory)
- Mobile native apps (React Native, leveraging same API)
- Real-time collaboration features (if matric-memory adds multi-user sync)
- Multi-language support (i18n/l10n)
- Accessibility enhancements (WCAG 2.1 AA compliance)

## Architecture (Target Post-Migration)

**Architecture Style**: Single-Page Application (SPA) + Remote API Server

**Chosen**: SPA Client-Server (React SPA → matric-memory API) - **Rationale**: Clean separation of concerns, leverage existing mature API, deploy as static assets via Nginx pipeline, supports 100+ external users with production API backend, eliminates architectural redundancy.

**Components** (post-migration):

1. **React SPA Frontend** (`ui/src/` - preserved and adapted):
   - **Location**: `ui/src/` (React/TypeScript components, existing codebase)
   - **Technology**: React 19, TypeScript, Vite build system
   - **UI Libraries**: Radix UI (accessible components), TailwindCSS (utility-first styling)
   - **Components**: Preserve existing UI components (NoteEditor, SearchBar, TagManager, etc.)
   - **State Management**: React Query (API data caching, server state), Zustand or Context API (local UI state)
   - **Routing**: React Router v6 (client-side routing for SPA navigation)
   - **Rationale**: Preserve existing UI investment, minimal component changes, proven React 19 stack

2. **API Client Layer** (`ui/src/api/` - new integration layer):
   - **Location**: `ui/src/api/` (centralized API communication)
   - **Technology**: Axios or native Fetch API with interceptors
   - **Responsibilities**:
     - matric-memory API integration (all REST endpoints)
     - OIDC Bearer token injection (from Keycloak)
     - Automatic token refresh (before expiration)
     - Error handling (network failures, auth errors, API errors)
     - Request/response transformation (API contracts → UI models)
   - **Rationale**: Single source of truth for API calls, consistent error handling, easy to mock for testing

3. **Authentication Module** (DEFERRED - post-MVP):
   - **Status**: Deferred to future phase
   - **Planned Technology**: `oidc-client-ts` or `react-oidc-context` with Keycloak
   - **Initial Approach**: Direct API access (matric-memory handles auth if needed)
   - **Future Integration**: OAuth/OIDC for multi-user access when required
   - **Rationale**: Focus on core migration first, add auth layer when user management needed

4. **Build & Deployment** (static SPA pipeline):
   - **Build**: Vite production build → optimized static assets (HTML, JS, CSS bundles)
   - **Code Splitting**: Lazy-loaded routes and components for faster initial load
   - **Deployment Target**: Nginx static file serving (existing pipeline for static sites)
   - **Configuration**: Environment-based API URLs via `.env` files (dev, staging, production)
   - **Assets**: Minified bundles, tree-shaking, gzip/brotli compression
   - **Rationale**: Lightweight deployment model, CDN-friendly static assets, existing Nginx infrastructure

**Removed Components** (eliminated in migration):
- ❌ **Tauri Desktop Wrapper** (`ui/src-tauri/` directory - removed entirely)
- ❌ **Rust API Server** (`server/` directory - removed entirely, all `*.rs` backend files)
- ❌ **Direct PostgreSQL Access** (no SQLx, no database migrations in frontend repo)
- ❌ **Embedded Ollama Client** (no direct NLP processing in frontend)
- ❌ **Desktop-Specific Features** (system tray, global hotkeys, Windows 11 native styling)

**Data Models** (API contracts from matric-memory):
- **Note**: `id`, `original_content`, `revised_content`, `created_at`, `updated_at`, `user_id`, `tags[]`, `collection_id`
- **Tag**: `id`, `name`, `color`, `user_id`, `note_count`
- **Collection**: `id`, `name`, `description`, `note_count`, `user_id`, `created_at`
- **Revision**: `id`, `note_id`, `content`, `version`, `created_at`, `author`, `metadata`
- **SearchResult**: `note_id`, `score`, `snippet`, `highlights`, `metadata`, `similarity_score`
- **User**: `id`, `username`, `email`, `display_name`, `created_at` (from OIDC claims)

**Integration Points**:
- **matric-memory API** (primary backend, all data operations):
  - Base URL: Production server URL (configured via environment variable)
  - Authentication: Bearer token (from Keycloak OIDC)
  - Endpoints:
    - `/api/v1/notes` (CRUD operations)
    - `/api/v1/search` (full-text and hybrid search)
    - `/api/v1/tags`, `/api/v1/collections` (organization)
    - `/api/v1/semantic` (semantic search)
    - `/api/v1/provenance` (revision history)
    - `/api/v1/links` (note linking)
  - Error Handling: Consistent error responses, proper HTTP status codes
  - CORS: matric-memory must allow frontend origin (coordinate with API team)

- **Authentication** (DEFERRED to post-MVP):
  - **Planned**: Keycloak OIDC integration when multi-user access required
  - **Initial**: Direct API access (matric-memory handles any auth requirements)

## Scale and Performance (Target Post-Migration)

**Target Capacity**:
- **Initial users**: 100+ external users (production launch)
- **6-month projection**: 500-1,000 users (organic growth, word-of-mouth)
- **2-year vision**: 5,000+ users (if product-market fit achieved, potential for hosted service)

**Performance Targets**:
- **Page Load**: <2s for initial SPA load (first contentful paint)
- **API Latency**: <500ms p95 for matric-memory API calls (search, note retrieval)
- **Search Response**: <1s total (API call + result rendering)
- **UI Responsiveness**: <100ms for local UI interactions (typing, navigation)
- **Availability**: 99.5% uptime (depends on matric-memory API and Nginx availability)

**Performance Strategy**:

1. **Client-Side Optimizations**:
   - **Code Splitting**: Lazy load routes and components (React.lazy + Suspense)
   - **Bundle Optimization**: Vite tree-shaking, minification, gzip/brotli compression
   - **Asset Caching**: Aggressive browser caching for static assets (CSS, JS, images)
   - **Virtual Scrolling**: Render only visible items for large note lists (react-window or similar)

2. **API Integration Optimizations**:
   - **React Query Caching**: Cache API responses (5-minute TTL for note lists, 1-minute for search)
   - **Request Deduplication**: Prevent duplicate concurrent API calls (React Query automatic)
   - **Pagination**: Fetch notes in batches (20-50 per page) to reduce payload size
   - **Batch Operations**: Combine multiple tag/collection updates into single API call

3. **User Experience Optimizations**:
   - **Optimistic Updates**: Update UI immediately, sync with API asynchronously (React Query optimistic updates)
   - **Skeleton Screens**: Show loading placeholders instead of spinners
   - **Debounced Search**: Wait 300ms after user stops typing before sending search query
   - **Progressive Enhancement**: Core functionality works without JavaScript (if feasible)

4. **Network Optimizations**:
   - **CDN**: Nginx with static asset caching headers (1 year for immutable assets)
   - **HTTP/2**: Enable multiplexing for parallel resource loading
   - **Preloading**: Preload critical resources (fonts, initial API data)
   - **Service Worker**: Cache static assets for offline-first experience (PWA future enhancement)

## Security and Compliance (Target Post-Migration)

**Security Posture**: Baseline (MVP) → Strong (when auth added) - **Rationale**: Focus on core migration first. OAuth/OIDC authentication deferred to post-MVP phase.

**Data Classification**: Confidential - **Evidence**: User-generated notes may contain personal information, business data, or sensitive content. Data stored server-side in matric-memory database.

**Security Controls** (MVP - core migration):

1. **Authentication** (DEFERRED to post-MVP):
   - **Initial**: Direct API access (matric-memory handles any auth requirements)
   - **Future**: Keycloak OIDC integration when multi-user access required
   - **Rationale**: Focus on migration first, add auth layer when needed

2. **Data Protection**:
   - **HTTPS/TLS**: All traffic encrypted in transit (HTTPS for SPA, TLS for API calls)
   - **API Encryption**: matric-memory handles encryption at rest (database-level)
   - **No Sensitive Data in Frontend**: Frontend only stores cached API responses

3. **Frontend Security**:
   - **XSS Protection**: React's built-in auto-escaping, CSP headers from Nginx
   - **Dependency Security**: Regular `npm audit` checks in CI/CD, automated updates
   - **Input Sanitization**: User-generated content sanitized before display

4. **Secrets Management**:
   - **Environment Variables**: API URLs (NOT committed to git)
   - **Build-Time Injection**: Vite injects env vars at build time
   - **No Secrets in Frontend**: All sensitive config server-side

**Compliance Requirements**:
- **GDPR/CCPA**: matric-memory API handles data privacy (server-side responsibility)
- **None (Frontend-Specific)**: Frontend is stateless, compliance primarily server-side

**Security Best Practices**:
- Regular security audits of dependencies (`npm audit`)
- Security headers in Nginx (CSP, X-Frame-Options, X-Content-Type-Options)
- HTTPS-only (redirect HTTP → HTTPS)

## Team and Operations (Target Post-Migration)

**Team Size**: Small team (1-3 developers, frontend/full-stack focused)

**Team Skills** (required for migration):
- **Frontend Development**: React 19, TypeScript, Vite (existing HotM codebase familiarity)
- **API Integration**: REST API consumption, error handling, React Query or similar data fetching
- **DevOps**: Nginx deployment, static site pipelines, environment configuration
- **Testing**: Jest/Vitest (unit tests), React Testing Library (component tests), Playwright or Cypress (E2E tests)

**Development Velocity** (target):
- **Sprint Length**: 2 weeks (agile iterations)
- **Release Frequency**: Weekly to Nginx staging environment, bi-weekly to production
- **Migration Timeline**: Flexible (no hard deadline, quality over speed)

**Process Maturity** (target): Moderate (appropriate for small team, production SPA)

- **Version Control**: Git (GitHub) with feature branches
- **Branch Strategy**: Trunk-based development (main branch + short-lived feature branches)
- **Code Review**: PR required for all changes, 1+ reviewer approval before merge
- **Testing**:
  - **Target Coverage**: 60%+ (component tests, API integration mocks, E2E smoke tests)
  - **Unit Tests**: Jest or Vitest (React components, utility functions)
  - **Integration Tests**: Mock matric-memory API responses, test error handling
  - **E2E Tests**: Playwright or Cypress (critical user journeys: login, create note, search)
- **Versioning**: Semantic versioning (v0.2.0 post-migration, v1.0.0 after production validation)
- **Documentation**: README (updated for SPA), API integration guide, deployment guide, migration notes

**CI/CD** (target):
- **Platform**: GitHub Actions (existing workflows)
- **Workflows** (updated for SPA-only):
  - `frontend-tests.yml`: TypeScript build, lint, unit tests, component tests, security audit (`npm audit`)
  - `e2e-tests.yml`: Playwright or Cypress E2E tests (against staging matric-memory API)
  - `deploy.yml`: Build static assets, deploy to Nginx staging/production
  - ~~`backend-tests.yml`~~: **REMOVED** (no more Rust backend)
  - ~~`release.yml`~~: **REMOVED** (no more MSI builds)
  - `docs-link-check.yml`: Documentation integrity (keep for docs/)

**Operational Support** (target):
- **Monitoring**:
  - Frontend error tracking: Sentry or similar (capture unhandled exceptions, API errors)
  - API call metrics: Track latency, success/failure rates via React Query dev tools or custom logging
  - User analytics: Optional (privacy-friendly analytics like Plausible or self-hosted Matomo)
- **Logging**:
  - Structured frontend logs (API errors, auth failures, critical user actions)
  - Send error logs to monitoring service (Sentry, Datadog, or CloudWatch)
- **Alerting**:
  - Email or Slack alerts for critical frontend errors (auth failures, API unavailability)
  - Monitor API health (matric-memory team responsibility, frontend shows error states gracefully)
- **On-Call**: None (best-effort support, matric-memory API team handles backend incidents)

## Dependencies and Infrastructure

**Key Frontend Dependencies** (ui/package.json - post-migration):

**Core Dependencies** (preserved from existing HotM):
- `react` 19.1.0, `react-dom` 19.1.0 (UI framework, preserve existing version)
- `@radix-ui/*` (accessible UI primitives, preserve existing components)
- `@uiw/react-md-editor` (markdown editing, preserve existing editor)
- `mermaid` 11.10.1 (diagram rendering in notes)
- `katex` 0.16.22 (math rendering in notes)
- `tailwindcss` 3.4.17 (utility-first styling)
- `vite` 7.0.4 (build tool and dev server)

**New Dependencies** (added for migration):
- `@tanstack/react-query` (API data fetching, caching, and state management)
- `axios` or native Fetch API (HTTP client for matric-memory API calls)
- `react-router-dom` v6 (client-side routing for SPA navigation)
- `oidc-client-ts` or `react-oidc-context` (Keycloak OIDC integration)
- `zustand` or Context API (local UI state management, lightweight alternative to Redux)

**Removed Dependencies** (eliminated with Rust backend):
- ~~`@tauri-apps/api`~~: **REMOVED** (no more Tauri desktop integration)
- All Rust dependencies (`server/Cargo.toml`): **REMOVED** (no more Rust backend)

**Development Dependencies**:
- `vitest` (unit testing, existing choice)
- `@testing-library/react`, `@testing-library/jest-dom` (component testing)
- `@playwright/test` or `cypress` (E2E testing)
- `eslint`, `@typescript-eslint/*` (linting and code quality)
- `prettier` (code formatting)
- `@types/*` (TypeScript type definitions)

**Third-Party Services** (production dependencies):
- **Keycloak**: Self-hosted OIDC authentication provider (production server, managed separately)
- **matric-memory API**: Production REST API server (separate infrastructure, managed separately)
- **Sentry** (optional): Frontend error tracking and monitoring
- **Plausible** or **Matomo** (optional): Privacy-friendly analytics

**Infrastructure** (target deployment):

**Hosting**:
- **Nginx Static File Serving**: Existing pipeline for static sites
- **Static Assets**: HTML, CSS, JS bundles served from document root
- **Configuration**: Nginx config for SPA routing (fallback to index.html for client-side routes)

**Build Pipeline**:
- **Build Command**: `npm run build` (Vite production build)
- **Output**: `ui/dist/` directory with optimized static assets
- **Deployment**: Copy `ui/dist/*` to Nginx document root (e.g., `/var/www/hotm-frontend/`)
- **Environment Config**: `.env.production` with matric-memory API URL and Keycloak endpoints

**Configuration Management**:
- **Development**: `.env.development` (local matric-memory API, local Keycloak)
- **Staging**: `.env.staging` (staging matric-memory API, staging Keycloak)
- **Production**: `.env.production` (production matric-memory API, production Keycloak)
- **Secrets**: No secrets in frontend (public OAuth2 client, PKCE flow)

**Removed Infrastructure** (no longer needed):
- ~~Docker Compose~~: **NOT NEEDED** (no local backend to orchestrate)
- ~~PostgreSQL~~: **NOT NEEDED** (managed by matric-memory server)
- ~~Ollama~~: **NOT NEEDED** (NLP processing server-side)
- ~~MSI Installer~~: **NOT NEEDED** (web-only SPA, no desktop packaging)

## Known Risks and Uncertainties

**Technical Risks**:

1. **matric-memory API Dependency**:
   - **Risk**: Frontend completely dependent on matric-memory API uptime and availability
   - **Likelihood**: Medium (production API should be stable, but outages possible)
   - **Impact**: High (frontend completely unusable if API down)
   - **Mitigation**:
     - Implement graceful error handling (show offline message, retry logic)
     - Display cached data when API unavailable (React Query stale-while-revalidate)
     - API health check endpoint (show status indicator in UI)
     - Coordinate with matric-memory team on SLA and monitoring

2. **Keycloak OIDC Integration Complexity**:
   - **Risk**: OIDC token flow, refresh logic, and error handling can be complex
   - **Likelihood**: Medium (OIDC has many edge cases: token expiration, silent refresh failures, logout errors)
   - **Impact**: Medium (auth issues block users from accessing application)
   - **Mitigation**:
     - Use proven OIDC libraries (`oidc-client-ts`, `react-oidc-context`)
     - Thorough auth flow testing (happy path + error cases)
     - Fallback to session storage if refresh token rotation fails
     - Clear error messages ("Session expired, please log in again")

3. **API Contract Changes**:
   - **Risk**: matric-memory API evolves, breaking frontend assumptions (schema changes, deprecated endpoints)
   - **Likelihood**: Medium (API is under active development)
   - **Impact**: Medium (broken features, failed API calls, data mapping errors)
   - **Mitigation**:
     - Use API versioning (`/api/v1/` in all endpoints)
     - Integration tests with real API contract (not just mocks)
     - Version compatibility checks (frontend warns if API version mismatch)
     - Coordinate with matric-memory team on breaking changes

4. **Performance on Large Datasets**:
   - **Risk**: Slow UI when rendering 1,000+ notes or large search result sets
   - **Likelihood**: Low-Medium (depends on user corpus size)
   - **Impact**: Medium (poor UX, slow page rendering)
   - **Mitigation**:
     - Pagination (fetch 20-50 notes per page)
     - Virtualized lists for large collections (react-window)
     - Lazy loading (load data on scroll)
     - API-side filtering (limit results server-side)

**Integration Risks**:

1. **matric-memory API Endpoint Coverage**:
   - **Risk**: Assumption that all needed endpoints exist and are fully documented
   - **Impact**: Missing endpoints for HotM features, undocumented API behavior
   - **Mitigation**:
     - Early API discovery phase (review matric-memory API spec, test all endpoints)
     - Communication with matric-memory team (identify gaps, request new endpoints if needed)
     - API spec review (OpenAPI/Swagger documentation)

2. **CORS Configuration**:
   - **Risk**: matric-memory API must allow frontend origin (cross-origin requests)
   - **Impact**: CORS errors blocking all API calls (application unusable)
   - **Mitigation**:
     - Coordinate with matric-memory API team on CORS policy (allow frontend domain)
     - Test CORS in dev environment early (before production deployment)
     - Proper CORS headers: `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`

**Timeline Risks**:

1. **Scope Creep**:
   - **Risk**: Temptation to redesign UI or add new features during migration
   - **Impact**: Timeline extends indefinitely, migration never completes
   - **Mitigation**:
     - Strict scope: "Preserve UI, adapt API only" (defer redesign to post-migration)
     - Feature freeze: No new features until migration complete
     - MVP mindset: Ship functional migration, iterate improvements later

2. **Keycloak Setup Delays**:
   - **Risk**: Self-hosted Keycloak OIDC provider configuration takes longer than expected
   - **Impact**: Auth setup blocks migration progress
   - **Mitigation**:
     - Parallel track: Mock auth for dev (bypass Keycloak), real Keycloak for staging/prod
     - Use existing Keycloak instance if available (don't spin up new one)
     - Docker Compose Keycloak for local dev (fast setup)

**Team Risks**:

1. **OIDC Expertise Gap**:
   - **Risk**: Team may be unfamiliar with OIDC flows, token management, security best practices
   - **Impact**: Auth bugs, security vulnerabilities, poor UX (token expiration handling)
   - **Mitigation**:
     - Use proven libraries (don't implement OIDC from scratch)
     - Follow OIDC best practices (PKCE flow, secure token storage)
     - Security review by experienced developer or external consultant

**Migration-Specific Risks**:

1. **User Data Migration**:
   - **Risk**: Existing HotM users have local data that needs migration to matric-memory
   - **Likelihood**: High (if there are existing users)
   - **Impact**: High (data loss would be catastrophic for users)
   - **Mitigation**:
     - Export tool for existing HotM data (notes, tags, collections)
     - Import API in matric-memory (bulk import from export format)
     - Migration guide for users (step-by-step instructions)
     - Data validation (verify all data migrated successfully)

## Why This Intake Now?

**Context**: Architecture evolution and production readiness

HotM started as a test system for memory tooling and evolved into a full-stack Tauri application with an embedded Rust API server. Over time, the memory server functionality matured into the separate matric-memory repository with a comprehensive, production-ready API. The current HotM architecture is now redundant—it duplicates orchestration logic and routing that properly belongs in the matric-memory server.

**Immediate Goals**:
1. **Eliminate architectural redundancy**: Remove HotM's Rust server components, rely on matric-memory API
2. **Simplify deployment**: Migrate from Tauri desktop app to static SPA (Nginx-friendly, web-accessible)
3. **Scale to external users**: Support 100+ users with proper authentication (Keycloak OIDC)
4. **Preserve UI investment**: Keep existing React components and UX patterns (minimal code changes)
5. **Enable multi-device access**: Web-based SPA accessible from any device with a browser

**Triggers**:
- **matric-memory API maturity**: Production-ready server with comprehensive feature set (all needed endpoints exist)
- **Architecture redundancy**: Duplicated orchestration logic between HotM and matric-memory (unsustainable)
- **Deployment complexity**: Tauri desktop app harder to deploy and maintain than static SPA
- **User growth**: 100+ external users need web-based access, not just local desktop app
- **Team focus**: Frontend team should focus on UX, not backend infrastructure

**What's at Stake**:
- **User experience**: 100+ users depend on HotM UI for daily knowledge management
- **Team velocity**: Simplified architecture allows faster iteration on UX features
- **Scalability**: Web SPA can scale to 1,000+ users (desktop app cannot)
- **Deployment simplicity**: Static SPA deploys in minutes (vs. complex desktop app builds)
- **Feature velocity**: Leverage matric-memory's mature API (don't rebuild backend features)

## Attachments

- Solution profile: [solution-profile.md](./solution-profile.md)
- Option matrix: [option-matrix.md](./option-matrix.md)
- Codebase location: `/home/manitcor/dev/hotm`
- Repository: `https://github.com/jmagly/hotm.git`

## Attachments

- Solution profile: `.aiwg/intake/solution-profile.md` (updated for Production profile)
- Option matrix: `.aiwg/intake/option-matrix.md` (updated with migration priorities)

## Next Steps

**Your intake documents are now complete and ready for migration planning!**

### Immediate Actions (Week 1-2)

1. **✅ Complete intake documentation** (this document, solution-profile.md, option-matrix.md)

2. **API Discovery & Validation**:
   - Review matric-memory API specification (OpenAPI/Swagger docs)
   - Test all required endpoints (notes CRUD, search, tags, collections, semantic search)
   - Identify missing endpoints or API gaps (coordinate with matric-memory team)
   - Verify CORS configuration (matric-memory allows frontend origin)

3. **Keycloak Setup & Testing**:
   - Configure Keycloak OIDC client for HotM frontend (public client, PKCE flow)
   - Test authorization code flow (login → token exchange → API call → logout)
   - Verify token refresh works (automatic renewal before expiration)
   - Document Keycloak configuration (realm, client ID, redirect URLs)

### Short-term Actions (Week 3-6)

4. **Frontend Code Migration**:
   - **Remove**: `server/` directory (all Rust backend code)
   - **Remove**: `ui/src-tauri/` directory (Tauri desktop integration)
   - **Remove**: Desktop-specific dependencies (`@tauri-apps/api`)
   - **Add**: OIDC client library (`oidc-client-ts` or `react-oidc-context`)
   - **Add**: API client layer (`ui/src/api/` with matric-memory integration)
   - **Add**: React Router for SPA routing

5. **API Integration Layer**:
   - Create `ui/src/api/` directory (centralized API client)
   - Implement API client with token injection (Bearer token from Keycloak)
   - Add error handling (network errors, auth errors, API errors)
   - Integrate React Query for API data caching and state management

6. **Update UI Components**:
   - Update NoteEditor component (call matric-memory `/notes` API instead of local Rust server)
   - Update SearchBar component (call matric-memory `/search` API)
   - Update TagManager component (call matric-memory `/tags` API)
   - Preserve existing UI/UX patterns (minimal visual changes)

### Medium-term Actions (Week 7-12)

7. **Testing & Quality**:
   - Unit tests for API client layer (mock API responses)
   - Component tests for updated React components
   - E2E tests for critical user journeys (login, create note, search, logout)
   - Target 60%+ test coverage

8. **Deployment Pipeline**:
   - Update CI/CD workflows (remove `backend-tests.yml`, update `frontend-tests.yml`)
   - Create deployment workflow (`deploy.yml` to build and copy to Nginx)
   - Configure environment variables (`.env.production` with API URLs)
   - Deploy to staging environment (test with staging matric-memory API)

9. **User Migration Plan**:
   - Create export tool for existing HotM users (export notes, tags, collections)
   - Coordinate with matric-memory team on import API
   - Write migration guide for users (step-by-step instructions)
   - Test migration with sample user data (verify zero data loss)

### Production Launch (Week 13+)

10. **Production Deployment**:
    - Deploy SPA to production Nginx
    - Configure production Keycloak (production realm, client)
    - Point to production matric-memory API
    - Monitor for errors (Sentry, CloudWatch, or similar)

11. **User Onboarding**:
    - Communicate migration to existing users
    - Provide migration guide and support
    - Monitor user feedback (track issues, feature requests)

12. **Post-Migration Iteration**:
    - Fix bugs and UX friction
    - Improve performance (bundle size, load times)
    - Add deferred features (PWA, offline mode, mobile optimization)

### How to Proceed

**Option 1: Start Inception Phase**
```bash
# Natural language
"Start Inception" or "Let's transition to Inception"

# Explicit command
/flow-concept-to-inception .
```

**Option 2: Use Project Status**
```bash
/project-status
```
This will analyze your current phase, milestones, and recommend next steps.

**Note**: You do NOT need to run `/intake-start` - the `intake-wizard` command produces validated intake ready for immediate use. These documents are complete and ready for the migration planning phase.
