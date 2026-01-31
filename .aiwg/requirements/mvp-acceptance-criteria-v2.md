# MVP Acceptance Criteria (v2.0 - SPA Migration)

**Document Type**: Requirements Specification
**Generated**: 2026-01-30
**Project**: HotM (Hall Of The Mind) - React SPA Frontend
**Phase**: Migration MVP (v0.1.2 → v0.2.0)
**Profile**: Production Web Application (100+ External Users, matric-memory API Backend)

---

## Executive Summary

### What "MVP Done" Means

**MVP Goal**: Successfully migrate HotM from a Tauri desktop application with embedded Rust server to a production-ready React SPA that leverages the mature matric-memory API backend. The migration demonstrates that the new architecture effectively supports 100+ external users with web-based access, proper authentication, and feature parity with the existing desktop application.

**Success Definition**: Deploying a fully functional web application that:
- Provides seamless feature parity with existing HotM desktop UI
- Integrates cleanly with matric-memory API for all data operations
- Supports 100+ concurrent users with responsive performance
- Eliminates architectural redundancy (no duplicated Rust server code)
- Deploys as static assets via Nginx in <10 minutes

**Migration Validation Criteria**:
- Zero data loss for migrated users (100% successful migration)
- All core workflows functional (note capture, search, organization)
- API integration working reliably (matric-memory endpoints respond correctly)
- Authentication ready (foundation for Keycloak OIDC, deferred to post-MVP)
- Performance acceptable (page load <2s, API calls <500ms p95)
- User adoption sustained (90%+ of desktop users migrate to web SPA)

**Out of Scope for MVP**: See section 7 for explicit deferrals (Keycloak OIDC integration, offline PWA capabilities, mobile native apps, advanced UI polish)

---

## 1. Feature Acceptance Criteria

### 1.1 Note Management (matric-memory API Integration)

**Priority**: Must-Have (Critical)
**Status**: Migration Phase
**Component**: React SPA + matric-memory API Client

#### Acceptance Criteria

**AC-1.1: Create Note (API Integration)**
- Given: User wants to capture a quick thought
- When: User creates a new note with markdown content
- Then:
  - Note is sent to matric-memory API via POST /api/v1/notes
  - API returns 201 Created with note ID within 500ms
  - Note appears in local UI immediately (optimistic update via React Query)
  - Background NLP processing happens server-side (no frontend involvement)
  - UI shows success confirmation or error message
- Verification:
  - API client sends correct request payload (markdown content, metadata)
  - React Query cache updated with new note
  - Error handling works (network failure, API error, validation error)
  - Test: Create 10 notes sequentially, verify all appear in note list

**AC-1.2: Read Note (API Retrieval)**
- Given: A note exists in matric-memory backend
- When: User retrieves note by ID
- Then:
  - Frontend fetches note via GET /api/v1/notes/{id}
  - Returns note with complete metadata (id, original/revised content, timestamps, tags)
  - Response cached by React Query (5-minute TTL)
  - Original content shown by default, toggle available for revised view
  - Response time < 300ms for cached requests, < 500ms for fresh requests
- Verification:
  - API client handles response correctly (parse JSON, map to UI models)
  - React Query cache prevents duplicate requests
  - Toggle between original/revised content works
  - Test: Retrieve note, verify all metadata displayed correctly

**AC-1.3: Update Note (Create Revision via API)**
- Given: A note with original content exists
- When: User updates the note content
- Then:
  - Frontend sends PUT /api/v1/notes/{id}/revised with updated content
  - matric-memory creates new revision server-side (immutability preserved)
  - API returns 200 OK with revision metadata
  - UI updates immediately (optimistic update), rolls back on error
  - Revision history link available (shows provenance via matric-memory API)
- Verification:
  - API client sends correct revision payload
  - Optimistic update works (UI updates before API confirms)
  - Error rollback works (UI reverts to previous state if API fails)
  - Test: Update note 3 times, verify revision count increments

**AC-1.4: Delete Note (Soft Delete via API)**
- Given: A note exists
- When: User deletes a note
- Then:
  - Frontend sends DELETE /api/v1/notes/{id}
  - matric-memory soft-deletes note server-side (preserves provenance)
  - API returns 204 No Content
  - Note removed from UI immediately (optimistic update)
  - Note no longer appears in search results
- Verification:
  - API client handles DELETE correctly
  - React Query cache invalidates deleted note
  - Confirmation dialog shown before delete (prevent accidental deletion)
  - Test: Delete note, verify removed from list, search no longer finds it

#### Performance Targets

- Note creation: < 500ms (P95) - API call + optimistic update
- Note retrieval: < 300ms (P95) - cached via React Query
- Note update: < 600ms (P95) - API call + optimistic update
- Note deletion: < 300ms (P95) - API call + cache invalidation
- Batch rendering (100 notes): < 1s (virtualized list)

#### Definition of Done

- [ ] All 4 CRUD operations implemented via matric-memory API
- [ ] API client layer with error handling and retries
- [ ] React Query integration (caching, optimistic updates, invalidation)
- [ ] Immutability preserved server-side (frontend delegates to API)
- [ ] Test coverage: 70%+ for note CRUD (mocked API, component tests)
- [ ] Performance targets met on production API
- [ ] Integration test covers full CRUD lifecycle with real API

---

### 1.2 Hybrid Search (matric-memory API)

**Priority**: Must-Have (Critical)
**Status**: Migration Phase
**Component**: React SPA + matric-memory Search API

#### Acceptance Criteria

**AC-2.1: Full-Text Search (API Integration)**
- Given: Multiple notes exist with diverse content
- When: User searches with keywords (e.g., "machine learning")
- Then:
  - Frontend sends GET /api/v1/search?q=keywords&mode=fts
  - matric-memory executes PostgreSQL FTS (tsvector/GIN index)
  - Returns ranked results with snippets and highlights
  - UI displays results within 1s (API call + rendering)
  - Search debounced (300ms delay after user stops typing)
- Verification:
  - API client sends correct search query parameters
  - Results displayed with ranking, snippets, highlights
  - Search is responsive (debounced, no lag while typing)
  - Test: Search 100 notes for common term, verify correct ranking

**AC-2.2: Semantic Search (API Integration)**
- Given: Notes have been processed with Ollama embeddings (server-side)
- When: User performs semantic search (e.g., "how to train AI models?")
- Then:
  - Frontend sends POST /api/v1/semantic with text query
  - matric-memory computes similarity via pgvector (HNSW index)
  - Returns notes ranked by cosine similarity score
  - Results include semantic matches even without exact keywords
  - Response time < 1.5s (API call + rendering)
- Verification:
  - API client sends correct semantic query payload
  - Semantic results differ from keyword search (more contextual)
  - Similarity scores displayed in UI (optional, for power users)
  - Test: Query "neural networks training" finds note about "deep learning"

**AC-2.3: Hybrid Search (FTS + Vector, RRF Fusion via API)**
- Given: Both FTS and vector indexes available server-side
- When: User performs hybrid search (default mode)
- Then:
  - Frontend sends GET /api/v1/search?q=query&mode=hybrid
  - matric-memory combines FTS + semantic results with RRF fusion
  - Returns top-k results (default: 20, max: 100)
  - UI displays unified result set with combined ranking
  - Response time < 1.5s (API call + rendering)
- Verification:
  - Hybrid search combines keyword and semantic results
  - Results include both exact matches and related concepts
  - Ranking appears balanced (not dominated by one method)
  - Test: Hybrid search finds both exact keyword matches and semantically related notes

**AC-2.4: Search Filters (API Query Parameters)**
- Given: User wants to refine search results
- When: User applies filters (tags, date range, collections)
- Then:
  - Frontend sends GET /api/v1/search?q=query&tag=work&after=2025-01-01
  - matric-memory filters results server-side (no client-side filtering)
  - Filters combine with AND logic
  - Date filters support ISO 8601 format (before/after)
  - Tag filters support multiple tags (repeatable parameter)
- Verification:
  - Filter UI updates query parameters correctly
  - API client encodes filters properly (URL encoding)
  - Results reflect applied filters
  - Test: Search with 2 tags + date range, verify only matching notes returned

#### Performance Targets

- Full-text search: < 1s (P95) - API call + rendering
- Semantic search: < 1.5s (P95) - API call + rendering
- Hybrid search: < 1.5s (P95) - API call + rendering
- Search with filters: < 2s (P95) - API call + rendering
- Debounce delay: 300ms (prevent excessive API calls)

#### Definition of Done

- [ ] Full-text search integrated with matric-memory API
- [ ] Semantic search integrated with matric-memory API
- [ ] Hybrid search mode working (default)
- [ ] Search filters apply correctly (tags, date, collections)
- [ ] Performance targets met for typical corpus (< 1000 notes)
- [ ] Test coverage: 70%+ for search functionality (mocked API)
- [ ] Integration test covers all search modes with real API
- [ ] User validation: "Can I find what I need?" = Yes (90%+ success rate)

---

### 1.3 Organization Features (Tags & Collections)

**Priority**: Must-Have (Important)
**Status**: Migration Phase
**Component**: React SPA + matric-memory API

#### Acceptance Criteria

**AC-3.1: Tag Display on Notes**
- Given: Note has tags (auto-generated by matric-memory or manual)
- When: User views note
- Then:
  - Tags fetched from matric-memory API (included in note response)
  - Tags displayed in note metadata area
  - Tags are clickable (filter search by tag)
  - Tag source indicator (auto vs manual) visible
- Verification:
  - API response includes tags array
  - Tags rendered correctly in UI
  - Clicking tag triggers search filter
  - Test: View note with 5 tags, verify all displayed and clickable

**AC-3.2: Tag Management (Manual Operations via API)**
- Given: User wants to refine tags
- When: User adds or removes tags manually
- Then:
  - Frontend sends PUT /api/v1/notes/{id}/tags with updated tag list
  - matric-memory updates note_tags junction table
  - UI updates immediately (optimistic update)
  - Tag changes reflected in note metadata
- Verification:
  - API client sends correct tag update payload
  - Optimistic update works (UI updates before API confirms)
  - Error handling works (rollback on failure)
  - Test: Add tag "important", remove tag "draft", verify both operations work

**AC-3.3: Collection Management (via API)**
- Given: User wants to organize notes into collections
- When: User creates/updates collections
- Then:
  - Frontend sends POST /api/v1/collections (create collection)
  - Frontend sends PUT /api/v1/notes/{id}/collection (assign note to collection)
  - matric-memory manages collection relationships
  - UI displays collections in sidebar or navigation
- Verification:
  - Collection CRUD operations work via API
  - Notes can be assigned/unassigned from collections
  - Collection filtering works in search
  - Test: Create collection "Work", assign 5 notes, verify collection view shows 5 notes

**AC-3.4: Tag & Collection Display Quality**
- Given: Tags and collections are managed via matric-memory
- When: User reviews organization features
- Then:
  - Tag relevance > 60% (for auto-generated tags, server-side metric)
  - Collection organization intuitive (user can find notes by category)
  - UI shows tag/collection counts (note counts per tag/collection)
- Verification:
  - User validation: Review tags on 50 notes, assess relevance
  - Collection structure makes sense (logical groupings)
  - Tag/collection counts accurate

#### Performance Targets

- Tag display: < 50ms (included in note retrieval)
- Tag management: < 400ms (P95) - API call + optimistic update
- Collection management: < 400ms (P95) - API call + optimistic update
- Tag/collection list retrieval: < 500ms (with counts)

#### Definition of Done

- [ ] Tag display on notes functional
- [ ] Manual tag management working via API
- [ ] Collection CRUD operations working via API
- [ ] Tag/collection filtering in search functional
- [ ] Performance targets met
- [ ] Test coverage: 60%+ for organization features
- [ ] User validation: Tag/collection UX intuitive

---

### 1.4 Web Browser UX (SPA Experience)

**Priority**: Must-Have (Critical)
**Status**: Migration Phase
**Component**: React SPA + Vite + TailwindCSS

#### Acceptance Criteria

**AC-4.1: SPA Routing (React Router)**
- Given: HotM is deployed as a web application
- When: User navigates between views
- Then:
  - Client-side routing via React Router (no page reloads)
  - Browser back/forward buttons work correctly
  - URL reflects current view (e.g., `/notes/{id}`, `/search?q=query`)
  - Deep linking works (user can bookmark and share URLs)
  - Nginx configured to serve index.html for all routes (SPA fallback)
- Verification:
  - React Router routes configured correctly
  - Navigation is instant (no page reload)
  - Browser history works (back/forward buttons)
  - Test: Navigate to note detail, press back, verify returns to list

**AC-4.2: Responsive Layout (Mobile & Desktop)**
- Given: HotM is accessed from various devices
- When: User opens application on mobile, tablet, or desktop
- Then:
  - Layout adapts to screen size (responsive design)
  - Mobile: Single-column layout, touch-friendly buttons
  - Tablet: Two-column layout (list + detail)
  - Desktop: Multi-column layout (sidebar, list, detail)
  - No horizontal scrolling (content fits viewport)
- Verification:
  - TailwindCSS responsive classes applied correctly
  - Test on mobile (iPhone, Android), tablet (iPad), desktop (1920x1080)
  - Touch targets > 44px on mobile (accessibility)
  - Test: Resize browser window, verify layout adapts

**AC-4.3: Markdown Editor (Preserved from Desktop)**
- Given: User wants to create or edit a note
- When: User types in note editor
- Then:
  - Markdown syntax supported (headings, lists, links, code blocks)
  - Live preview available (split view or toggle)
  - Syntax highlighting for code blocks
  - Auto-save on blur (prevents data loss, optimistic update to API)
  - Editor responsive with < 50ms keystroke latency
- Verification:
  - Existing markdown editor (`@uiw/react-md-editor`) works in browser
  - Preview renders markdown correctly (Mermaid diagrams, KaTeX math)
  - Auto-save triggers API update after 3 seconds of inactivity
  - Test: Type markdown with headers, lists, code, verify preview renders

**AC-4.4: Note List View (Virtualized for Performance)**
- Given: Multiple notes exist
- When: User views note list
- Then:
  - Notes displayed in chronological order (newest first)
  - Each note shows: title (first line), snippet, tags, timestamp
  - List is scrollable and virtualized (handles 1000+ notes via react-window)
  - Search bar filters list in real-time (debounced)
  - Click note to navigate to detail view
- Verification:
  - Note list renders correctly with pagination or virtualization
  - Scrolling is smooth (60 FPS, no jank)
  - Test: Load 100 notes, scroll through list, verify performance
  - Test: Search filters list correctly, no UI lag

**AC-4.5: Note Detail View (Original vs Revised Toggle)**
- Given: User selects a note from list
- When: Note detail loads
- Then:
  - Shows revised content by default (AI-enhanced view from matric-memory)
  - Toggle available to view original content
  - Tags displayed and clickable (filter by tag)
  - Links to related notes visible (auto-generated server-side)
  - Metadata visible (created, updated, user attribution)
- Verification:
  - Detail view fetches note via matric-memory API
  - Toggle between original and revised works
  - Related links functional (navigate to related notes)
  - Test: View note, verify all metadata present, toggle original/revised

**AC-4.6: Page Load Performance**
- Given: User accesses HotM web application
- When: Initial page load
- Then:
  - First contentful paint (FCP) < 2s on 3G network
  - Time to interactive (TTI) < 3s on 3G network
  - Largest contentful paint (LCP) < 2.5s
  - Static assets cached aggressively (1 year cache headers)
  - Code splitting reduces initial bundle size (< 200KB gzipped)
- Verification:
  - Lighthouse performance score > 90
  - Vite build produces optimized bundles (minified, tree-shaken)
  - Test on slow network (3G throttling), verify acceptable load times

#### Performance Targets

- Initial page load: < 2s (first contentful paint)
- Route navigation: < 100ms (client-side routing)
- Keystroke latency: < 50ms (editor responsiveness)
- Note list rendering (100 notes): < 1s
- Note detail load: < 500ms (API call + rendering)
- Search results update: < 1.5s (debounced search + API)

#### Definition of Done

- [ ] React Router configured for SPA routing
- [ ] Responsive layout for mobile, tablet, desktop
- [ ] Markdown editor with preview functional in browser
- [ ] Note list virtualized for performance (1000+ notes)
- [ ] Note detail view with original/revised toggle
- [ ] Performance targets met (Lighthouse score > 90)
- [ ] Test coverage: 60%+ for UI components
- [ ] User validation: "Web UX is smooth and friction-free" = Yes

---

## 2. Performance Targets

### 2.1 API Integration Performance

| Operation | Target (P95) | Max Acceptable |
|-----------|--------------|----------------|
| POST /notes (create) | < 500ms | 1s |
| GET /notes/{id} (read, cached) | < 300ms | 500ms |
| GET /notes/{id} (read, fresh) | < 500ms | 1s |
| PUT /notes/{id}/revised (update) | < 600ms | 1.5s |
| DELETE /notes/{id} (delete) | < 300ms | 500ms |
| GET /search (hybrid) | < 1.5s | 3s |
| POST /semantic (semantic search) | < 1.5s | 3s |
| GET /tags, /collections | < 500ms | 1s |

### 2.2 Frontend Performance

| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| First Contentful Paint (FCP) | < 2s | 3s |
| Time to Interactive (TTI) | < 3s | 5s |
| Largest Contentful Paint (LCP) | < 2.5s | 4s |
| Cumulative Layout Shift (CLS) | < 0.1 | 0.25 |
| Route navigation (SPA) | < 100ms | 300ms |
| Note list render (100 notes) | < 1s | 2s |
| Search debounce delay | 300ms | 500ms |

### 2.3 Network Performance

| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| Initial bundle size (gzipped) | < 200KB | 300KB |
| Total page weight (first load) | < 500KB | 1MB |
| Static asset cache TTL | 1 year | 1 week |
| API request timeout | 10s | 30s |
| Retry attempts (failed API calls) | 3 | 5 |

### 2.4 Scalability Targets (MVP)

| Metric | MVP Target | Future Scale |
|--------|------------|--------------|
| Concurrent users (web) | 100 | 1,000+ |
| Notes per user | 1,000 | 10,000+ |
| Search corpus size | 1,000 notes | 10,000+ notes |
| API availability | 99.5% | 99.9% |
| Error rate (frontend) | < 1% | < 0.1% |

### 2.5 Resource Usage (Browser)

| Resource | Target | Max Acceptable |
|----------|--------|----------------|
| Memory (browser tab) | < 256MB | 512MB |
| CPU (idle) | < 5% | 10% |
| CPU (active, rendering) | < 50% avg | 80% spike |
| Local storage (cache) | < 10MB | 50MB |

---

## 3. Non-Functional Requirements

### 3.1 Privacy (Server-Side Responsibility)

**NFR-1.1: Data Storage and Processing**
- All note data stored in matric-memory PostgreSQL database (server-side)
- All AI processing performed by matric-memory (Ollama server-side)
- Frontend only stores cached API responses (React Query, 5-minute TTL)
- No persistent data storage in browser (localStorage only for UI preferences)
- User owns and controls data (matric-memory responsibility)

**NFR-1.2: Data Immutability (Server-Side)**
- Original note content never modified (matric-memory enforces immutability)
- All edits create new revisions with provenance (server-side)
- Revision history is complete and auditable (API provides provenance endpoint)
- Soft deletes preserve data for recovery (server-side)

**NFR-1.3: Encryption in Transit**
- All API calls over HTTPS/TLS (encrypted in transit)
- Browser enforces secure context (no mixed content warnings)
- HSTS headers from Nginx (HTTP Strict Transport Security)

### 3.2 Reliability

**NFR-2.1: Error Handling (Frontend)**
- matric-memory API unavailable: Show offline message, cached data if available
- Network timeout: Retry with exponential backoff (3 attempts, then error message)
- Invalid API response: Display user-friendly error, log to Sentry
- Authentication failure: Redirect to login (when Keycloak integrated)

**NFR-2.2: Fault Tolerance (Frontend)**
- React Error Boundaries: Catch component errors, show fallback UI
- API client retries: 3 attempts with exponential backoff (500ms, 1s, 2s)
- Optimistic updates: Roll back on API failure (React Query automatic)
- Offline detection: Show banner if network unavailable

**NFR-2.3: Data Durability (Server-Side Responsibility)**
- matric-memory handles PostgreSQL ACID compliance
- Frontend relies on server-side WAL and backup strategy
- No data loss from frontend bugs (all data server-side)

### 3.3 Usability

**NFR-3.1: Learnability**
- Quick capture workflow: < 5 seconds to create note (same as desktop)
- Search workflow: < 10 seconds to find note (same as desktop)
- No manual required for core features (intuitive web UI)
- Keyboard shortcuts preserved where applicable (Ctrl+K for search, etc.)

**NFR-3.2: Efficiency**
- Note creation: 3 clicks or less (same as desktop)
- Search: Type and go (no complex query syntax required)
- Navigation: Browser back/forward, SPA routing (instant)
- Bulk operations: Deferred to post-MVP

**NFR-3.3: Error Prevention**
- Auto-save on blur (prevents data loss, optimistic API update)
- Confirmation dialog for destructive actions (delete note)
- Clear validation messages for invalid input
- Network error recovery (retry, offline mode)

**NFR-3.4: Accessibility (WCAG 2.1 A/AA Target)**
- Keyboard navigation (tab order, focus indicators, skip links)
- Screen reader support (ARIA labels, semantic HTML)
- Resizable text (respects browser font size settings)
- Color contrast (minimum 4.5:1 for text, 3:1 for UI components)
- Radix UI components provide baseline accessibility

### 3.4 Maintainability

**NFR-4.1: Code Quality**
- TypeScript: Zero ESLint warnings (strict mode)
- Formatting: Prettier (consistent style)
- React: Functional components with hooks (no class components)
- API client: Centralized in `ui/src/api/` (single source of truth)

**NFR-4.2: Testing**
- Unit test coverage: 60%+ (components, utilities)
- Integration test coverage: 50%+ (API client, error handling)
- E2E test coverage: Core user journeys (create note, search, navigate)
- CI passes all tests before merge (GitHub Actions)

**NFR-4.3: Documentation**
- README: Installation, setup, deployment
- API integration guide: How to connect to matric-memory
- Migration guide: For users migrating from desktop app
- Deployment guide: Nginx configuration, environment variables

**NFR-4.4: Logging and Monitoring**
- Frontend error logging: Sentry or similar (unhandled exceptions, API errors)
- Performance monitoring: Web Vitals (FCP, LCP, CLS, TTI)
- User analytics: Optional privacy-friendly analytics (Plausible, Matomo)
- No sensitive data in logs (no note content, no credentials)

---

## 4. Validation Metrics (Post-Migration)

### 4.1 Migration Success Metrics (Quantitative)

**User Migration Rate**
- Goal: 90%+ of desktop users migrate to web SPA
- Measure: Track active users (desktop vs web) over 3 months
- Success: Web SPA becomes primary interface, desktop usage drops to <10%

**Data Migration Completeness**
- Goal: Zero data loss during migration
- Measure: Compare note count, tag count, collection count (desktop vs matric-memory)
- Success: 100% of data migrated successfully, validated by users

**Feature Parity**
- Goal: All desktop features available in web SPA
- Measure: Checklist of features (note CRUD, search, tags, collections)
- Success: 100% feature parity, no missing functionality

### 4.2 Performance Metrics (Quantitative)

**Page Load Performance**
- Goal: Fast initial load for good UX
- Measure: Lighthouse scores (Performance, Accessibility, Best Practices)
- Success: Performance score > 90, all Core Web Vitals pass

**API Integration Performance**
- Goal: Responsive API calls for smooth UX
- Measure: P95 latency for API calls (create, read, search)
- Success: All operations within targets (section 2.1)

**Error Rate**
- Goal: Reliable frontend with minimal errors
- Measure: Sentry error rate (unhandled exceptions, API failures)
- Success: Error rate < 1% of user sessions

### 4.3 User Experience Metrics (Qualitative)

**Search Success Rate**
- Goal: Users find what they need
- Measure: Track search queries and user feedback
- Success: > 80% of searches find relevant notes (user validation)

**UI Responsiveness**
- Goal: Web SPA feels as fast as desktop app
- Measure: Subjective user feedback, keystroke latency benchmarks
- Success: No user complaints about lag or slowness

**Mobile Usability**
- Goal: Functional on mobile devices (even if not optimized)
- Measure: Test on iPhone, Android, verify core workflows work
- Success: Note creation, search, navigation all functional on mobile

### 4.4 Architectural Metrics (Migration Goal)

**Code Simplification**
- Goal: Eliminate redundant Rust server code
- Measure: Lines of code removed (entire `server/` directory)
- Success: 100% of Rust backend code removed, zero server-side logic in frontend repo

**Deployment Simplicity**
- Goal: Fast, simple deployments via Nginx
- Measure: Time to deploy (build + copy to Nginx)
- Success: Deploy in < 10 minutes (automated CI/CD)

**Scalability Improvement**
- Goal: Support more users with SPA architecture
- Measure: Concurrent user capacity (load testing)
- Success: 100+ concurrent users with acceptable performance

---

## 5. Success Criteria (Migration Completion)

### 5.1 Technical Migration Complete

**Indicators**:
- All Rust server code removed (`server/` directory deleted)
- All Tauri desktop code removed (`ui/src-tauri/` directory deleted)
- All desktop-specific dependencies removed (`@tauri-apps/api`, etc.)
- matric-memory API client layer implemented and tested
- React SPA deployable as static assets via Nginx
- All CI/CD workflows updated (no more backend tests, MSI builds)

**Next Steps**:
- Deploy to production Nginx
- Monitor for errors and performance issues
- Iterate on UX improvements based on user feedback

### 5.2 User Adoption Success

**Indicators**:
- 90%+ of desktop users migrated to web SPA
- Zero critical user complaints (no P0 bugs preventing usage)
- Search quality acceptable (> 80% success rate)
- Performance acceptable (no user complaints about slowness)
- Feature parity achieved (all desktop features available in web)

**Next Steps**:
- Deprecate desktop application (sunset timeline)
- Focus development on web SPA improvements
- Add deferred features (PWA, offline mode, mobile optimization)

### 5.3 Production Deployment Ready

**Indicators**:
- Nginx deployment tested and stable
- Environment configuration correct (API URLs, CORS)
- Monitoring in place (Sentry, Web Vitals, uptime checks)
- Documentation complete (README, deployment guide, migration guide)
- Security best practices implemented (HTTPS, CSP headers, dependency audits)

**Next Steps**:
- Add Keycloak OIDC authentication (post-MVP)
- Improve mobile UX (responsive design refinements)
- Add PWA capabilities (offline mode, install prompt)

---

## 6. Testing Strategy (Migration MVP)

### 6.1 Unit Tests

**Coverage Target**: 60%+

**Focus Areas**:
- API client layer (request/response handling, error handling)
- React components (note editor, search bar, tag manager)
- Utility functions (markdown parsing, date formatting, URL encoding)
- React Query hooks (API data fetching, caching, mutations)

**Test Organization**:
- Tests colocated with components (`*.test.tsx` files)
- API client tests in `ui/src/api/__tests__/`
- Run via: `npm test -- --run` (Vitest)

### 6.2 Integration Tests

**Coverage Target**: 50%+

**Focus Areas**:
- API client with mocked matric-memory responses (success, error, timeout)
- React Query cache behavior (optimistic updates, invalidation, stale-while-revalidate)
- Error boundary handling (component crashes, API failures)
- Form submission flows (create note, update note, add tags)

**Test Organization**:
- Integration tests in `ui/src/__tests__/integration/`
- Mock matric-memory API responses using MSW (Mock Service Worker)
- Run via: `npm test -- --run` (Vitest)

### 6.3 E2E Tests

**Coverage Target**: Core user journeys

**Test Scenarios**:
1. **Quick Capture**: Open app → Create note → Verify note appears in list
2. **Search & Retrieve**: Create notes → Search by keyword → View result
3. **Tag Management**: Create note → Add tags → Filter by tag → Verify results
4. **Note Editing**: Create note → Edit content → Verify revision created
5. **Error Handling**: Simulate API failure → Verify error message shown

**Test Organization**:
- Playwright tests in `ui/tests/e2e/`
- Test against staging matric-memory API
- Run via: `npm run test:e2e`

### 6.4 CI/CD Testing

**GitHub Actions Workflows** (updated for SPA):
- `frontend-tests.yml`: TypeScript build, lint, unit tests, component tests, security audit (`npm audit`)
- `e2e-tests.yml`: Playwright E2E tests (against staging API)
- `deploy.yml`: Build static assets, deploy to Nginx staging/production
- ~~`backend-tests.yml`~~: **REMOVED** (no more Rust backend)
- ~~`release.yml`~~: **REMOVED** (no more MSI builds)

**Local Testing**:
- Before pushing: `npm run build && npm test && npm run lint`
- Before production deploy: `npm run test:e2e` (E2E against staging API)

### 6.5 API Contract Testing

**Approach**: Verify frontend assumptions match matric-memory API reality

**Focus Areas**:
- Request/response schema validation (Zod or similar)
- API versioning checks (frontend warns if API version incompatible)
- Error response handling (4xx, 5xx status codes)
- CORS configuration validation (preflight requests)

**Test Organization**:
- Contract tests in `ui/src/api/__tests__/contracts/`
- Run against real matric-memory API (integration environment)

---

## 7. Out of Scope (Deferred Post-MVP)

### 7.1 Authentication and Authorization (Deferred)

**Deferred Features**:
- [ ] Keycloak OIDC integration (OAuth 2.0 flows, token management)
- [ ] Multi-user support (user isolation, permissions)
- [ ] Session management (token refresh, logout, expiration handling)
- [ ] Admin panel (user management, analytics)

**Rationale**: Focus on core migration first. Authentication adds complexity (OIDC flows, token refresh, security). Defer until MVP validated. Initial deployment can use direct API access or basic auth if needed.

### 7.2 Progressive Web App (PWA) Capabilities (Deferred)

**Deferred Features**:
- [ ] Service worker for offline mode (cache API responses, background sync)
- [ ] Install prompt (Add to Home Screen on mobile)
- [ ] Push notifications (new notes, search results)
- [ ] Offline editing (local IndexedDB, sync when online)

**Rationale**: PWA features enhance UX but not critical for MVP. Focus on core functionality first. Add offline mode post-MVP for mobile users.

### 7.3 Mobile Native Apps (Deferred)

**Deferred Features**:
- [ ] React Native mobile app (iOS, Android)
- [ ] Mobile-specific UX optimizations (gestures, native controls)
- [ ] App Store / Play Store distribution
- [ ] Deep linking (open notes from external apps)

**Rationale**: Web SPA provides mobile access via browser (responsive design). Native apps add development/maintenance burden. Defer until proven demand from mobile users.

### 7.4 Advanced UI Polish (Deferred)

**Deferred Features**:
- [ ] Dark mode / theme customization
- [ ] Advanced markdown features (custom plugins, extensible editor)
- [ ] Drag-and-drop file attachments (upload to matric-memory)
- [ ] Rich text editor (WYSIWYG alternative to markdown)
- [ ] Link graph visualization (interactive web of connections)
- [ ] Keyboard shortcut customization
- [ ] Multi-language support (i18n/l10n)

**Rationale**: MVP focuses on feature parity with desktop app. UI polish can be added iteratively based on user feedback. Avoid scope creep during migration.

### 7.5 Advanced Features (Deferred)

**Deferred Features**:
- [ ] Real-time collaboration (multi-user editing, presence indicators)
- [ ] Advanced search filters UI (date picker, tag selector, saved searches)
- [ ] Export/import (markdown, JSON, PDF)
- [ ] Browser extension (web clipping, quick capture from any page)
- [ ] AI chat interface (conversational access to notes)
- [ ] Note templates and automation (daily notes, meeting notes)

**Rationale**: Advanced features add complexity. Focus on core workflows (create, search, organize). Add features based on user demand post-MVP.

### 7.6 Observability and Monitoring (Deferred)

**Deferred Features**:
- [ ] Comprehensive user analytics (funnel analysis, cohort retention)
- [ ] A/B testing framework (experiment with UI variants)
- [ ] Performance profiling (RUM - Real User Monitoring)
- [ ] Custom dashboards (Grafana, DataDog)

**Rationale**: Basic monitoring (Sentry, Web Vitals) sufficient for MVP. Advanced observability can be added if product scales to 1,000+ users.

---

## 8. Dependencies and Prerequisites

### 8.1 Development Environment

**Required Tools**:
- Node.js 20+ (LTS)
- npm or pnpm (package manager)
- Git (version control)
- Web browser (Chrome, Firefox, Safari for testing)
- GitHub CLI (`gh` for CI/CD workflows)

**Optional Tools**:
- Playwright (E2E testing)
- Docker (for local matric-memory API, Keycloak)
- Visual Studio Code (recommended editor)

### 8.2 External Services (Production Dependencies)

**matric-memory API**:
- Production REST API server (separate infrastructure, managed separately)
- Base URL configured via environment variable (`.env.production`)
- CORS configured to allow frontend origin
- API version: v1 (versioned endpoints: `/api/v1/*`)

**Keycloak OIDC Provider** (DEFERRED to post-MVP):
- Self-hosted Keycloak instance (production server)
- OIDC client configured for HotM (public client, PKCE flow)
- Realm, client ID, redirect URLs documented

**Monitoring Services** (optional):
- Sentry (frontend error tracking)
- Plausible or Matomo (privacy-friendly analytics)

### 8.3 Infrastructure (Deployment)

**Nginx Static File Serving**:
- Nginx server (existing pipeline for static sites)
- Document root: `/var/www/hotm-frontend/` (or similar)
- SPA routing configuration (fallback to index.html)
- HTTPS/TLS certificate (Let's Encrypt or similar)

**Build Pipeline**:
- Build command: `npm run build` (Vite production build)
- Output directory: `ui/dist/` (static assets)
- Deployment: Copy `ui/dist/*` to Nginx document root
- Environment config: `.env.production` (API URLs, Keycloak endpoints)

### 8.4 Environment Variables

**Required** (`.env.production`):
- `VITE_API_BASE_URL`: matric-memory API base URL (e.g., `https://api.matric-memory.example.com`)
- `VITE_APP_VERSION`: Application version (from `package.json`)

**Optional** (Keycloak OIDC, deferred):
- `VITE_OIDC_AUTHORITY`: Keycloak realm URL
- `VITE_OIDC_CLIENT_ID`: OIDC client ID
- `VITE_OIDC_REDIRECT_URI`: OAuth redirect URI

---

## 9. Migration Completion Checklist

### 9.1 Architecture Migration

- [ ] Remove Rust server code (`server/` directory deleted)
- [ ] Remove Tauri desktop code (`ui/src-tauri/` directory deleted)
- [ ] Remove desktop-specific dependencies (`@tauri-apps/api`, etc.)
- [ ] Verify matric-memory API is production-ready (all needed endpoints exist)
- [ ] Document matric-memory API contract (OpenAPI spec, integration guide)
- [ ] All CI/CD workflows updated (no backend tests, no MSI builds)

### 9.2 Core Features (API Integration)

**Note Management**:
- [ ] Create note (POST /api/v1/notes)
- [ ] Read note (GET /api/v1/notes/{id})
- [ ] Update note (PUT /api/v1/notes/{id}/revised)
- [ ] Delete note (DELETE /api/v1/notes/{id})
- [ ] Test coverage: 70%+ for note CRUD

**Hybrid Search**:
- [ ] Full-text search (GET /api/v1/search?mode=fts)
- [ ] Semantic search (POST /api/v1/semantic)
- [ ] Hybrid search (GET /api/v1/search?mode=hybrid)
- [ ] Search filters (tags, date, collections)
- [ ] Test coverage: 70%+ for search functionality

**Organization Features**:
- [ ] Tag display on notes
- [ ] Manual tag management (PUT /api/v1/notes/{id}/tags)
- [ ] Collection CRUD (POST /api/v1/collections)
- [ ] Tag/collection filtering in search
- [ ] Test coverage: 60%+ for organization features

**Web Browser UX**:
- [ ] SPA routing (React Router v6)
- [ ] Responsive layout (mobile, tablet, desktop)
- [ ] Markdown editor with preview
- [ ] Note list view (virtualized for performance)
- [ ] Note detail view (original/revised toggle)
- [ ] Performance targets met (Lighthouse score > 90)
- [ ] Test coverage: 60%+ for UI components

### 9.3 Non-Functional Requirements

- [ ] Privacy: All data server-side (matric-memory API)
- [ ] Reliability: Error handling, retries, offline detection
- [ ] Usability: Intuitive workflows, keyboard shortcuts
- [ ] Maintainability: 60%+ test coverage, zero ESLint warnings
- [ ] Performance: All targets met (section 2)
- [ ] Accessibility: WCAG 2.1 A compliance (minimum)

### 9.4 Deployment Preparation

- [ ] Nginx configuration tested (SPA routing, HTTPS, caching headers)
- [ ] Environment variables configured (`.env.production`)
- [ ] Static assets optimized (minified, compressed, code-split)
- [ ] CORS configured on matric-memory API (allow frontend origin)
- [ ] Monitoring setup (Sentry error tracking, Web Vitals)
- [ ] Documentation complete (README, deployment guide, migration guide)

### 9.5 User Migration

- [ ] Data migration tool created (export from desktop app)
- [ ] Import API tested (bulk import to matric-memory)
- [ ] Migration guide written (step-by-step user instructions)
- [ ] User communication sent (migration announcement, timeline)
- [ ] Support plan ready (handle user questions, bugs)

### 9.6 Migration Launch

- [ ] Deploy to staging (test with staging matric-memory API)
- [ ] E2E tests pass (against staging environment)
- [ ] Beta users test migration (collect feedback)
- [ ] Deploy to production (Nginx production server)
- [ ] Monitor for errors (Sentry, API health checks)
- [ ] User migration support (help users transition from desktop)

---

## 10. Iteration & Evolution

### 10.1 Post-Migration Iterations (Bi-Weekly)

**Iteration Cadence**: Every 2 weeks

**Iteration Structure**:
1. **Planning** (30 min): Review backlog, prioritize next 2 weeks
2. **Development** (10 days): Implement features, fix bugs
3. **Testing** (2 days): Manual testing, CI validation, E2E tests
4. **Retrospective** (30 min): What worked? What didn't? Adjust.

**Iteration Goals**:
- Ship 1-3 UX improvements per iteration
- Fix critical bugs within same iteration (P0/P1)
- Maintain test coverage above 60%
- Monitor performance metrics (Core Web Vitals)

### 10.2 Feature Prioritization

**P0 (Blocker)**: Prevents daily use
- Fix immediately, deploy hotfix if in production

**P1 (Critical)**: Major friction in core workflow
- Fix within 1 iteration (2 weeks)

**P2 (Important)**: Annoying but workaround exists
- Fix within 2-3 iterations (4-6 weeks)

**P3 (Nice-to-Have)**: Quality-of-life improvement
- Defer to backlog, prioritize based on user demand

### 10.3 Evolution Triggers

**When to add authentication** (Keycloak OIDC):
- Multi-user access required (>10 concurrent users)
- User isolation needed (personal vs shared notes)
- Enterprise deployment (OIDC SSO required)

**When to add PWA capabilities**:
- Mobile usage significant (>20% of users)
- Offline access requested by users
- Install prompt desired (web app feels native)

**When to add mobile native apps**:
- Web UX insufficient on mobile (responsive design limitations)
- Native features needed (camera, file access, push notifications)
- App Store distribution desired (discoverability)

---

## 11. Sign-Off & Validation

### 11.1 Migration MVP Sign-Off Criteria

**Technical Sign-Off**:
- [ ] All Rust backend code removed (server-side logic in matric-memory)
- [ ] All Tauri desktop code removed (web-only SPA)
- [ ] All core features functional via matric-memory API (section 1)
- [ ] All performance targets met (section 2)
- [ ] All non-functional requirements satisfied (section 3)
- [ ] Test coverage above 60% (unit, integration, E2E)
- [ ] CI passing consistently (no flaky tests)
- [ ] Documentation complete (README, API integration, deployment)

**User Migration Sign-Off** (3-6 Months Post-Launch):
- [ ] 90%+ of desktop users migrated to web SPA
- [ ] Core workflows smooth (note capture, search, organization)
- [ ] Search quality acceptable (> 80% success rate)
- [ ] Performance acceptable (no user complaints)
- [ ] Feature parity achieved (all desktop features in web)
- [ ] User satisfaction high (NPS > 50, qualitative feedback positive)

### 11.2 Migration Acceptance

**Acceptance Date**: TBD (after migration completion)

**Accepted By**: Engineering Team + Product Owner

**Acceptance Criteria Met**:
- [ ] All must-have features working via matric-memory API
- [ ] No P0 (blocker) issues remaining
- [ ] Performance acceptable for 100+ concurrent users
- [ ] Ready for production deployment

**Next Steps**:
- Deploy to production Nginx
- Monitor user adoption and feedback
- Iterate on UX improvements based on usage data
- Add deferred features based on user demand (Keycloak OIDC, PWA, mobile optimization)

---

## Appendix A: Glossary

**API Client Layer**: Centralized module in frontend that handles all matric-memory API communication (requests, responses, errors, retries)

**Core Web Vitals**: Key performance metrics for web UX (LCP, FID, CLS)

**FCP (First Contentful Paint)**: Time until first content appears on screen

**FTS (Full-Text Search)**: Keyword-based search using PostgreSQL tsvector

**HNSW (Hierarchical Navigable Small World)**: Approximate nearest neighbor algorithm for vector search (pgvector)

**LCP (Largest Contentful Paint)**: Time until largest content element renders

**matric-memory API**: Production REST API server that provides all backend functionality (data storage, NLP processing, search)

**MVP (Minimum Viable Product)**: Minimal feature set for migration validation (feature parity with desktop app)

**OIDC (OpenID Connect)**: Authentication protocol built on OAuth 2.0 (used for Keycloak integration)

**Optimistic Update**: UI updates immediately, syncs with server asynchronously (React Query pattern)

**P95**: 95th percentile (95% of requests faster than this threshold)

**PKCE (Proof Key for Code Exchange)**: OAuth security extension for public clients (prevents code interception)

**PWA (Progressive Web App)**: Web application with native-like capabilities (offline mode, install prompt)

**React Query**: Data-fetching and state management library for API integration (caching, optimistic updates, invalidation)

**RRF (Reciprocal Rank Fusion)**: Method to combine multiple search rankings (FTS + semantic)

**SPA (Single-Page Application)**: Web app with client-side routing (no page reloads)

**TTI (Time to Interactive)**: Time until page is fully interactive (all scripts loaded)

---

## Appendix B: References

**Project Documentation**:
- [Project Intake](./../intake/project-intake.md) - Migration requirements and scope
- [Solution Profile](./../intake/solution-profile.md) - Architecture and technology choices
- [Option Matrix](./../intake/option-matrix.md) - Migration priorities and trade-offs
- [Original MVP Criteria](./mvp-acceptance-criteria.md) - Desktop app acceptance criteria (v1.0)

**External Resources**:
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [React Router Documentation](https://reactrouter.com/)
- [TanStack Query (React Query)](https://tanstack.com/query/)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Web.dev Core Web Vitals](https://web.dev/vitals/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

**matric-memory API** (coordinate with API team):
- API Specification: OpenAPI/Swagger documentation
- API Repository: (link to matric-memory repo)
- API Status Page: (production API health/uptime)

---

**Document Version**: 2.0 (SPA Migration)
**Last Updated**: 2026-01-30
**Maintained By**: Engineering Team (Frontend)
**Next Review**: After Migration Completion (TBD)
