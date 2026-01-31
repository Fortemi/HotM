# Migration Test Strategy Addendum - HotM SPA Migration

**Document Type**: SDLC Artifact - Quality Assurance
**Phase**: Migration Planning (v0.1.2 → v0.2.0)
**Version**: 1.0
**Date**: 2026-01-30
**Status**: DRAFT
**Primary Author**: Test Architect
**Reviewers**: Requirements Analyst, Architecture Designer

---

## Executive Summary

This addendum updates the Master Test Plan for HotM's migration from a Tauri desktop application with embedded Rust API server to a React Single-Page Application (SPA) consuming the production matric-memory API. This represents a fundamental architectural shift from full-stack to frontend-only development.

**Migration Scope Impact on Testing**:
- **Backend Testing (9.91% coverage)**: DEPRECATED - All Rust server code removed
- **Frontend Testing (33.48% coverage)**: REMAINS - Updated scope with new API client layer
- **NEW: API Client Layer Testing**: Critical path requiring 80% coverage
- **NEW: matric-memory Integration Testing**: Live API endpoint validation

**Coverage Target Changes**:
| Component | Pre-Migration | Post-Migration | Priority |
|-----------|---------------|----------------|----------|
| Backend (Rust) | 60% target | **REMOVED** | N/A |
| Frontend (React) | 60% target | 60% target | HIGH |
| API Client Layer | N/A | **80% target** | CRITICAL |
| E2E Web Flows | N/A | **5 scenarios** | HIGH |

---

## 1. Scope Changes

### 1.1 Deprecated: Backend Testing

**Status**: DEPRECATED - All Rust server components removed

**What's Being Removed**:
- All Rust backend code (`server/` directory - 19 source files, 5,273 lines)
- Backend integration tests (`server/tests/` - 10 test files, 922 lines)
- PostgreSQL test database infrastructure (local pgvector setup)
- Ollama mock testing (no local NLP processing)
- API endpoint tests (now handled by matric-memory team)

**Files/Directories to Archive or Delete**:
```
server/                                    # DELETE - All Rust backend
├── src/                                   # DELETE - 19 source files
├── tests/                                 # DELETE - 10 test files
├── migrations/                            # DELETE - Database migrations
├── Cargo.toml                             # DELETE - Rust dependencies
└── Cargo.lock                             # DELETE

.github/workflows/backend-tests.yml        # DELETE - Backend CI workflow
scripts/schema/                            # DELETE - Database schema management
scripts/dev_server.sh                      # DELETE - Local server startup
```

**Coverage Baseline (Final, Before Removal)**:
- Line Coverage: **9.91%** (175/1,766 lines)
- Integration Tests: 5 comprehensive tests
- Unit Tests: 5 model tests
- Total Tests: 13 passing

**Migration Actions**:
- [ ] Archive backend test reports (preserve historical coverage data)
- [ ] Delete `backend-tests.yml` GitHub Actions workflow
- [ ] Remove backend test commands from documentation
- [ ] Update README to reflect frontend-only testing approach
- [ ] Archive backend test fixtures and utilities (for reference if needed)

---

### 1.2 Updated: Frontend Testing

**Status**: REMAINS - Scope expanded with API client layer

**What's Being Preserved**:
- All React components (`ui/src/components/` - 17 feature components)
- UI component library tests (`ui/src/components/ui/__tests__/` - 100% coverage for tested components)
- Existing test infrastructure (Vitest, React Testing Library, jsdom)
- Component test patterns (unit tests, integration tests)

**What's Being Updated**:
- API service layer (`ui/src/services/api.ts` - replace Tauri IPC with HTTP calls)
- WebSocket client (`ui/src/services/websocket.ts` - point to matric-memory WebSocket endpoint)
- Environment configuration (API URLs from environment variables)
- Mock data (mock matric-memory API responses instead of local server)

**New Testing Scope**:
1. **API Client Layer** (NEW):
   - HTTP client for matric-memory API (Axios or Fetch)
   - Bearer token injection (OIDC tokens from Keycloak)
   - Request/response transformation (API contracts → UI models)
   - Error handling (network failures, auth errors, API errors)
   - Automatic token refresh (before expiration)

2. **Authentication Module** (DEFERRED to post-MVP):
   - OIDC login flow (authorization code + PKCE)
   - Token management (access token, refresh token, ID token)
   - Session persistence (secure token storage)
   - Logout and session cleanup

3. **Component Integration with API**:
   - Update component tests to mock matric-memory API responses
   - Test error states (API down, auth failure, network timeout)
   - Test loading states (pending API calls)
   - Test optimistic updates (React Query optimistic mutations)

**Coverage Target**: 60% overall (33.48% → 60%)

---

### 1.3 NEW: API Client Layer Testing

**Status**: NEW - Critical path for migration

**Purpose**: Ensure reliable communication with matric-memory API

**Coverage Target**: 80% line coverage (critical business logic)

**Test Categories**:

#### 1.3.1 Unit Tests (Mock HTTP Responses)

**Scope**: Test API client methods in isolation with mocked HTTP responses

**Test Files**:
- `ui/src/api/__tests__/client.test.ts` - HTTP client configuration, interceptors
- `ui/src/api/__tests__/notes.test.ts` - Notes CRUD operations
- `ui/src/api/__tests__/search.test.ts` - Search and semantic search
- `ui/src/api/__tests__/tags.test.ts` - Tag management
- `ui/src/api/__tests__/collections.test.ts` - Collection management
- `ui/src/api/__tests__/auth.test.ts` - Token injection and refresh (DEFERRED)

**Example - Notes API Unit Test**:
```typescript
// ui/src/api/__tests__/notes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNote, getNote, updateNote, deleteNote } from '../notes';
import { mockFetch } from '../__mocks__/fetch';

describe('notes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNote', () => {
    it('sends POST request to /api/v1/notes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({
          id: 'note-123',
          content: 'Test note',
          created_at: '2026-01-30T12:00:00Z'
        })
      });

      const result = await createNote('Test note');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.matric-memory.example.com/api/v1/notes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            // 'Authorization': 'Bearer <token>' // DEFERRED - auth not in MVP
          }),
          body: JSON.stringify({ content: 'Test note' })
        })
      );

      expect(result).toEqual({
        id: 'note-123',
        content: 'Test note',
        createdAt: new Date('2026-01-30T12:00:00Z')
      });
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(createNote('Test note')).rejects.toThrow('Network error');
    });

    it('throws error on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      });

      await expect(createNote('Test note')).rejects.toThrow('Unauthorized');
    });

    it('throws error on 500 Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      });

      await expect(createNote('Test note')).rejects.toThrow('Internal server error');
    });
  });

  describe('getNote', () => {
    it('sends GET request to /api/v1/notes/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'note-123',
          original_content: 'Original text',
          revised_content: 'Revised text',
          created_at: '2026-01-30T12:00:00Z',
          updated_at: '2026-01-30T12:05:00Z',
          tags: ['ai', 'testing'],
          collection_id: 'col-456'
        })
      });

      const result = await getNote('note-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.matric-memory.example.com/api/v1/notes/note-123',
        expect.objectContaining({ method: 'GET' })
      );

      expect(result).toEqual({
        id: 'note-123',
        originalContent: 'Original text',
        revisedContent: 'Revised text',
        createdAt: new Date('2026-01-30T12:00:00Z'),
        updatedAt: new Date('2026-01-30T12:05:00Z'),
        tags: ['ai', 'testing'],
        collectionId: 'col-456'
      });
    });

    it('returns null on 404 Not Found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Note not found' })
      });

      const result = await getNote('nonexistent');

      expect(result).toBeNull();
    });
  });
});
```

**Coverage Priority**:
- Happy path: All CRUD operations succeed
- Network errors: Timeout, connection refused, DNS failure
- HTTP errors: 4xx client errors (401, 403, 404), 5xx server errors
- Edge cases: Empty responses, malformed JSON, missing fields

---

#### 1.3.2 Integration Tests (Real matric-memory Endpoints)

**Scope**: Test API client against live matric-memory staging/dev server

**Test Files**:
- `ui/src/api/__tests__/integration/notes.integration.test.ts`
- `ui/src/api/__tests__/integration/search.integration.test.ts`
- `ui/src/api/__tests__/integration/tags.integration.test.ts`

**Setup Requirements**:
- **Test Environment**: Staging matric-memory API server
- **Test Database**: Separate test database (coordinate with matric-memory team)
- **Test Data**: Seed data for repeatable tests (create via API before test runs)
- **Cleanup**: Delete test data after tests complete (teardown)

**Example - Notes Integration Test**:
```typescript
// ui/src/api/__tests__/integration/notes.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createNote, getNote, updateNote, deleteNote, listNotes } from '../../notes';

// IMPORTANT: These tests run against REAL matric-memory API
// Set environment variable: VITE_API_BASE_URL=https://staging.matric-memory.example.com
// Tests may be skipped if API unavailable (CI can skip or require staging deployment)

const SKIP_INTEGRATION = !import.meta.env.VITE_RUN_INTEGRATION_TESTS;

describe.skipIf(SKIP_INTEGRATION)('notes API integration', () => {
  let testNoteId: string;

  beforeAll(async () => {
    // Verify API is reachable
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error('matric-memory API unavailable - skipping integration tests');
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test note if created
    if (testNoteId) {
      await deleteNote(testNoteId);
    }
  });

  it('creates, retrieves, updates, and deletes a note (full CRUD lifecycle)', async () => {
    // 1. Create note
    const created = await createNote('Integration test note');
    expect(created.id).toBeTruthy();
    expect(created.content).toBe('Integration test note');
    testNoteId = created.id;

    // 2. Retrieve note
    const retrieved = await getNote(testNoteId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.originalContent).toBe('Integration test note');

    // 3. Update note
    const updated = await updateNote(testNoteId, 'Updated content');
    expect(updated.originalContent).toBe('Integration test note'); // Immutable
    expect(updated.revisedContent).toBe('Updated content');

    // 4. Delete note
    await deleteNote(testNoteId);
    const deletedNote = await getNote(testNoteId);
    expect(deletedNote).toBeNull(); // Or soft-deleted if API uses soft delete

    testNoteId = ''; // Mark as cleaned up
  });

  it('lists notes with pagination', async () => {
    // Create 3 test notes
    const note1 = await createNote('Note 1');
    const note2 = await createNote('Note 2');
    const note3 = await createNote('Note 3');

    try {
      // List with limit and offset
      const page1 = await listNotes({ limit: 2, offset: 0 });
      expect(page1.notes.length).toBe(2);
      expect(page1.total).toBeGreaterThanOrEqual(3);

      const page2 = await listNotes({ limit: 2, offset: 2 });
      expect(page2.notes.length).toBeGreaterThanOrEqual(1);
    } finally {
      // Cleanup
      await deleteNote(note1.id);
      await deleteNote(note2.id);
      await deleteNote(note3.id);
    }
  });

  it('handles search with filters', async () => {
    const testNote = await createNote('Searchable integration test content');

    try {
      const results = await search('integration test');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.id === testNote.id)).toBe(true);
    } finally {
      await deleteNote(testNote.id);
    }
  });
});
```

**CI/CD Integration**:
- **Local Development**: Skip integration tests by default (fast unit tests only)
- **CI/CD**: Run integration tests against staging matric-memory API (on PR or nightly)
- **Environment Variable**: `VITE_RUN_INTEGRATION_TESTS=true` to enable

**Coverage Priority**:
- Full CRUD lifecycle (create → retrieve → update → delete)
- Pagination and filtering
- Search functionality (FTS and semantic)
- Error handling (API returns error responses)

---

#### 1.3.3 State Management Tests (React Query, Zustand)

**Scope**: Test API data caching, invalidation, and optimistic updates

**Test Files**:
- `ui/src/hooks/__tests__/useNotes.test.ts` - React Query hook for notes
- `ui/src/hooks/__tests__/useSearch.test.ts` - React Query hook for search
- `ui/src/hooks/__tests__/useTags.test.ts` - React Query hook for tags
- `ui/src/store/__tests__/uiStore.test.ts` - Zustand store for UI state (DEFERRED)

**Example - React Query Hook Test**:
```typescript
// ui/src/hooks/__tests__/useNotes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotes, useCreateNote, useDeleteNote } from '../useNotes';
import * as notesAPI from '../../api/notes';

// Mock API functions
vi.mock('../../api/notes');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches notes on mount', async () => {
    vi.mocked(notesAPI.listNotes).mockResolvedValueOnce({
      notes: [
        { id: 'note-1', content: 'Note 1', createdAt: new Date() },
        { id: 'note-2', content: 'Note 2', createdAt: new Date() }
      ],
      total: 2
    });

    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.notes.length).toBe(2);
    expect(notesAPI.listNotes).toHaveBeenCalledOnce();
  });

  it('caches notes and does not refetch on remount', async () => {
    vi.mocked(notesAPI.listNotes).mockResolvedValueOnce({
      notes: [{ id: 'note-1', content: 'Cached note', createdAt: new Date() }],
      total: 1
    });

    const wrapper = createWrapper();
    const { result, unmount } = renderHook(() => useNotes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    const { result: result2 } = renderHook(() => useNotes(), { wrapper });

    // Should use cached data, not refetch
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.data?.notes.length).toBe(1);
    expect(notesAPI.listNotes).toHaveBeenCalledOnce(); // Called only once
  });
});

describe('useCreateNote', () => {
  it('creates note and invalidates cache (optimistic update)', async () => {
    vi.mocked(notesAPI.createNote).mockResolvedValueOnce({
      id: 'note-new',
      content: 'New note',
      createdAt: new Date()
    });

    const { result } = renderHook(() => useCreateNote(), { wrapper: createWrapper() });

    result.current.mutate('New note');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(notesAPI.createNote).toHaveBeenCalledWith('New note');
    expect(result.current.data?.id).toBe('note-new');
  });

  it('shows optimistic update before API completes', async () => {
    // This test verifies optimistic update behavior
    // (requires more complex setup with QueryClient and cache manipulation)
  });
});
```

**Coverage Priority**:
- Data fetching and loading states
- Cache invalidation on mutations (create, update, delete)
- Optimistic updates (UI updates before API confirms)
- Error handling (show error message, retry logic)
- Pagination and infinite scroll

---

### 1.4 NEW: matric-memory Integration Testing

**Status**: NEW - Validate API endpoint coverage and contract compliance

**Purpose**: Ensure all required matric-memory API endpoints exist and work as expected

**Test Strategy**: API Endpoint Coverage Matrix

#### 1.4.1 API Endpoint Coverage Matrix

**Matrix Structure**: Map HotM features → matric-memory API endpoints

| HotM Feature | matric-memory Endpoint | Method | Status | Priority | Test Coverage |
|--------------|------------------------|--------|--------|----------|---------------|
| **Note Management** | | | | | |
| Create note | `/api/v1/notes` | POST | ✅ Required | CRITICAL | Integration test |
| Get note | `/api/v1/notes/:id` | GET | ✅ Required | CRITICAL | Integration test |
| Update note | `/api/v1/notes/:id` | PUT | ✅ Required | CRITICAL | Integration test |
| Delete note | `/api/v1/notes/:id` | DELETE | ✅ Required | CRITICAL | Integration test |
| List notes | `/api/v1/notes` | GET | ✅ Required | CRITICAL | Integration test |
| **Search** | | | | | |
| Full-text search | `/api/v1/search` | GET | ✅ Required | HIGH | Integration test |
| Semantic search | `/api/v1/semantic` | POST | ✅ Required | HIGH | Integration test |
| Hybrid search | `/api/v1/search?mode=hybrid` | GET | ❓ TBD | MEDIUM | Validate existence |
| **Organization** | | | | | |
| List tags | `/api/v1/tags` | GET | ✅ Required | HIGH | Integration test |
| Create tag | `/api/v1/tags` | POST | ✅ Required | MEDIUM | Integration test |
| Assign tags to note | `/api/v1/notes/:id/tags` | PUT | ✅ Required | HIGH | Integration test |
| List collections | `/api/v1/collections` | GET | ✅ Required | MEDIUM | Integration test |
| Create collection | `/api/v1/collections` | POST | ✅ Required | MEDIUM | Integration test |
| Assign note to collection | `/api/v1/notes/:id/collection` | PUT | ✅ Required | MEDIUM | Integration test |
| **Provenance** (Phase 2) | | | | | |
| Revision history | `/api/v1/provenance/:id` | GET | ❓ TBD | LOW | Validate existence |
| **Links** (Phase 2) | | | | | |
| Link notes | `/api/v1/notes/:id/links` | POST | ❓ TBD | LOW | Validate existence |
| Get related notes | `/api/v1/notes/:id/related` | GET | ❓ TBD | LOW | Validate existence |
| **Health** | | | | | |
| API health check | `/health` or `/api/v1/health` | GET | ✅ Required | CRITICAL | Unit test |

**Legend**:
- ✅ Required: Endpoint must exist and work for MVP
- ❓ TBD: Endpoint existence to be validated with matric-memory team
- Priority: CRITICAL (blocks MVP), HIGH (important for UX), MEDIUM (nice-to-have), LOW (future enhancement)

**Test Actions**:
- [ ] **API Discovery**: Review matric-memory OpenAPI/Swagger specification
- [ ] **Endpoint Validation**: Manually test all required endpoints with `curl` or Postman
- [ ] **Contract Testing**: Create integration tests for all CRITICAL and HIGH priority endpoints
- [ ] **Gap Identification**: Coordinate with matric-memory team on missing endpoints (if any)

---

#### 1.4.2 Performance Comparison (Desktop vs Web)

**Purpose**: Ensure SPA performance meets or exceeds desktop app baseline

**Baseline (Current Desktop App)**:
| Operation | Desktop App (Tauri) | Target (Web SPA) | Status |
|-----------|---------------------|------------------|--------|
| App launch | <2s (cold start) | <2s (initial page load) | ⚠️ Test |
| Note creation | <200ms | <300ms (includes API call) | ⚠️ Test |
| Note retrieval | <100ms | <200ms (includes API call) | ⚠️ Test |
| Full-text search (100 notes) | <500ms | <1s (includes API call) | ⚠️ Test |
| Semantic search (100 notes) | <1s | <1.5s (includes API call) | ⚠️ Test |

**Performance Testing Approach**:
1. **Measure Desktop Baseline**: Use current HotM v0.1.2 to establish baseline metrics
2. **Measure SPA Performance**: Use Lighthouse, WebPageTest, or custom performance tests
3. **Compare**: Identify regressions (accept slightly slower due to network latency)
4. **Optimize**: If SPA >2x slower, investigate and optimize (code splitting, caching, etc.)

**Acceptable Degradation**:
- Network latency overhead: +100-200ms for API calls (acceptable)
- Page load: Web SPA may be 1-2s slower than desktop cold start (acceptable)
- Interactive UI: Web SPA should feel as responsive as desktop (NOT acceptable to be slower)

**Test Files**:
- `ui/__tests__/performance/page-load.test.ts` - Lighthouse CI integration
- `ui/__tests__/performance/api-latency.test.ts` - Measure API call times
- Manual testing with Chrome DevTools Performance tab

---

## 2. New Test Categories

### 2.1 API Client Unit Tests

**Purpose**: Verify API client methods work correctly with mocked HTTP responses

**Coverage Target**: 80% (critical business logic)

**Test Organization**:
```
ui/src/api/
├── client.ts                      # HTTP client setup (Axios/Fetch)
├── notes.ts                       # Notes CRUD methods
├── search.ts                      # Search methods
├── tags.ts                        # Tag management
├── collections.ts                 # Collection management
├── auth.ts                        # OIDC token injection (DEFERRED)
└── __tests__/
    ├── client.test.ts             # HTTP client config, interceptors
    ├── notes.test.ts              # Notes API mocks
    ├── search.test.ts             # Search API mocks
    ├── tags.test.ts               # Tags API mocks
    ├── collections.test.ts        # Collections API mocks
    └── __mocks__/
        └── fetch.ts               # Mock fetch implementation
```

**Key Test Scenarios**:
- ✅ Happy path: All methods succeed with valid responses
- ✅ Network errors: Timeout, connection refused, DNS failure
- ✅ HTTP errors: 4xx (401, 403, 404), 5xx (500, 502, 503)
- ✅ Malformed responses: Invalid JSON, missing fields, unexpected types
- ✅ Edge cases: Empty arrays, null values, large payloads
- ⚠️ Token refresh: Automatic refresh before expiration (DEFERRED)

**Example Test Template**:
```typescript
// ui/src/api/__tests__/<resource>.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResource, getResource, updateResource, deleteResource } from '../<resource>';
import { mockFetch } from '../__mocks__/fetch';

describe('<resource> API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createResource', () => {
    it('sends correct POST request', async () => { /* ... */ });
    it('throws on network error', async () => { /* ... */ });
    it('throws on 401 Unauthorized', async () => { /* ... */ });
    it('throws on 500 Server Error', async () => { /* ... */ });
  });

  describe('getResource', () => {
    it('sends correct GET request', async () => { /* ... */ });
    it('returns null on 404 Not Found', async () => { /* ... */ });
  });

  describe('updateResource', () => {
    it('sends correct PUT request', async () => { /* ... */ });
    it('handles 409 Conflict (concurrent edit)', async () => { /* ... */ });
  });

  describe('deleteResource', () => {
    it('sends correct DELETE request', async () => { /* ... */ });
    it('succeeds even if resource already deleted (idempotent)', async () => { /* ... */ });
  });
});
```

---

### 2.2 API Integration Tests

**Purpose**: Validate API client against real matric-memory server

**Coverage Target**: All CRITICAL and HIGH priority endpoints

**Test Organization**:
```
ui/src/api/__tests__/integration/
├── notes.integration.test.ts      # Notes CRUD lifecycle
├── search.integration.test.ts     # Search functionality
├── tags.integration.test.ts       # Tag management
├── collections.integration.test.ts # Collection management
└── setup.ts                       # Test environment setup
```

**Setup Requirements**:
- **Environment Variable**: `VITE_RUN_INTEGRATION_TESTS=true` (CI only)
- **API Server**: Staging matric-memory API (coordinate with matric-memory team)
- **Test Database**: Separate database for integration tests (avoid polluting production)
- **Cleanup**: Teardown test data after each test run

**CI/CD Integration**:
```yaml
# .github/workflows/frontend-tests.yml (updated)
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    env:
      VITE_API_BASE_URL: https://staging.matric-memory.example.com
      VITE_RUN_INTEGRATION_TESTS: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
```

---

### 2.3 State Management Tests

**Purpose**: Test React Query caching, invalidation, and optimistic updates

**Coverage Target**: All data-fetching hooks

**Test Organization**:
```
ui/src/hooks/
├── useNotes.ts                    # Notes data fetching
├── useSearch.ts                   # Search data fetching
├── useTags.ts                     # Tags data fetching
├── useCollections.ts              # Collections data fetching
└── __tests__/
    ├── useNotes.test.ts           # React Query hook tests
    ├── useSearch.test.ts
    ├── useTags.test.ts
    └── useCollections.test.ts
```

**Key Test Scenarios**:
- ✅ Data fetching: Hook fetches data on mount
- ✅ Caching: Data cached and reused on remount (no refetch)
- ✅ Invalidation: Cache invalidated on mutations (create, update, delete)
- ✅ Optimistic updates: UI updates immediately, syncs with API
- ✅ Error handling: Show error state, retry logic
- ✅ Loading states: Show loading spinner during fetch

---

### 2.4 Migration Validation Tests

**Purpose**: Ensure feature parity between desktop app and SPA

**Coverage**: 100% of existing HotM features

**Test Organization**:
```
ui/__tests__/migration/
├── feature-parity.checklist.md    # Manual checklist
├── feature-parity.test.ts         # Automated E2E tests
└── performance-comparison.test.ts # Performance baseline
```

**Feature Parity Checklist** (manual validation):
```markdown
## Note Management
- [ ] Create note (desktop vs web)
- [ ] View note (original and revised content)
- [ ] Update note (revised content only, original immutable)
- [ ] Delete note (soft delete)
- [ ] List notes (pagination, sorting, filtering)

## Search
- [ ] Full-text search (keyword matching)
- [ ] Semantic search (vector similarity)
- [ ] Hybrid search (FTS + vector)
- [ ] Search result highlighting
- [ ] Filter by tags, collections, date range

## Organization
- [ ] Create tags
- [ ] Assign tags to notes
- [ ] Create collections
- [ ] Assign notes to collections
- [ ] Bulk tag/collection operations

## UI/UX
- [ ] Markdown editor (same editing experience)
- [ ] Markdown preview (same rendering)
- [ ] Syntax highlighting (code blocks)
- [ ] Mermaid diagrams
- [ ] PlantUML diagrams (if supported)
- [ ] Math rendering (KaTeX)
- [ ] Dark mode (if supported)

## Performance
- [ ] Page load <2s
- [ ] Note creation <300ms
- [ ] Search <1s
- [ ] No UI lag when scrolling large lists
```

**Automated E2E Tests** (Playwright or Cypress):
```typescript
// ui/__tests__/migration/feature-parity.test.ts
import { test, expect } from '@playwright/test';

test.describe('Migration Feature Parity', () => {
  test('creates note and displays in list', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Create note
    await page.fill('[data-testid="note-input"]', 'Migration test note');
    await page.click('[data-testid="create-note-button"]');

    // Wait for API call to complete
    await page.waitForSelector('[data-testid="note-list-item"]');

    // Verify note appears in list
    const noteText = await page.textContent('[data-testid="note-list-item"]');
    expect(noteText).toContain('Migration test note');
  });

  test('searches notes and displays results', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Perform search
    await page.fill('[data-testid="search-input"]', 'migration test');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Wait for search results
    await page.waitForSelector('[data-testid="search-results"]');

    // Verify results contain expected note
    const results = await page.textContent('[data-testid="search-results"]');
    expect(results).toContain('Migration test note');
  });

  // Additional tests for tags, collections, etc.
});
```

---

## 3. Updated Coverage Targets

### 3.1 Overall Coverage Goals

| Component | Current | Target (MVP) | Post-MVP Stretch | Priority |
|-----------|---------|--------------|------------------|----------|
| **Frontend Components** | 33.48% | 60% | 80% | HIGH |
| **API Client Layer** | N/A | **80%** | 90% | CRITICAL |
| **React Query Hooks** | N/A | **70%** | 85% | HIGH |
| **UI Components** | 47.94% | 60% | 80% | MEDIUM |
| **Services** | 39.4% | **80%** | 90% | CRITICAL |
| **Utils** | 100% | 100% | 100% | ✅ DONE |
| **Backend (Rust)** | 9.91% | **REMOVED** | N/A | N/A |

**Overall Target**: 60% line coverage across frontend codebase

---

### 3.2 Critical Path Coverage (80% Target)

**Critical business logic requiring 80% coverage**:

1. **API Client Layer** (`ui/src/api/*.ts`):
   - All HTTP methods (GET, POST, PUT, DELETE)
   - Request/response transformation
   - Error handling (network, HTTP, validation)
   - Token injection (DEFERRED for auth)

2. **Data Fetching Hooks** (`ui/src/hooks/use*.ts`):
   - React Query hooks for notes, search, tags, collections
   - Cache management and invalidation
   - Optimistic updates

3. **Core Services** (`ui/src/services/*.ts`):
   - API client (`api.ts` - already 64.34%, update to 80%)
   - WebSocket client (`websocket.ts` - currently 0%, target 70%)

**Rationale**: These are the most critical integration points with matric-memory API. Bugs here directly impact all features.

---

### 3.3 Component Coverage (60% Target)

**Major components requiring 60% coverage**:

1. **Main Application** (`ui/src/components/HallOfMind.tsx`):
   - Component lifecycle and state management
   - User interactions (create, edit, delete)
   - WebSocket integration
   - Error states

2. **Editor Components**:
   - `MarkdownEditor.tsx` (content editing, toolbar)
   - `MarkdownPreview.tsx` (rendering, syntax highlighting)
   - `MermaidRenderer.tsx`, `PlantUMLRenderer.tsx` (diagram rendering)

3. **Feature Components**:
   - `SearchDropdown.tsx` (search UI, filtering)
   - `JobQueueMonitor.tsx` (job status display)
   - `NoteContextMenu.tsx` (context menu actions)
   - `RelatedNotes.tsx` (related notes display)

**Rationale**: These components directly impact user experience. Bugs here are visible and frustrating.

---

### 3.4 E2E Coverage (5 Critical Scenarios)

**E2E test scenarios** (Playwright or Cypress):

1. **Note Creation Flow**:
   - User creates note → API call → Note appears in list
   - Verify optimistic update (immediate UI update)
   - Verify API call succeeded (note persisted)

2. **Search Flow**:
   - User searches for term → API call → Results displayed
   - Verify search highlighting
   - Verify filter by tags/collections

3. **Tag Management Flow**:
   - User creates tag → Assigns to note → Tag displayed
   - Verify tag CRUD operations
   - Verify tag filtering in search

4. **Error Handling Flow**:
   - API down → User attempts create → Error message displayed
   - Verify retry logic (auto-retry after timeout)
   - Verify graceful degradation (show cached data)

5. **Performance Flow**:
   - Large dataset (100+ notes) → Scroll list → No lag
   - Search large dataset → Results <1s
   - Create note → Response <300ms

**Rationale**: E2E tests validate critical user journeys end-to-end. These are the "smoke tests" for production deployment.

---

## 4. CI/CD Updates

### 4.1 Removed Workflows

**Delete or Archive**:
- ✅ `.github/workflows/backend-tests.yml` - No more Rust backend
- ✅ `.github/workflows/release.yml` - No more MSI builds (or update for web deployment)

**Justification**: These workflows test components that no longer exist post-migration.

---

### 4.2 Updated Workflows

#### 4.2.1 Frontend Tests (Updated)

**File**: `.github/workflows/frontend-tests.yml`

**Changes**:
```yaml
name: Frontend Tests (SPA Migration)

on:
  push:
    branches: [main, develop]
    paths:
      - 'ui/**'
      - '.github/workflows/frontend-tests.yml'
  pull_request:
    branches: [main]
    paths:
      - 'ui/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test -- --run                          # Unit tests only
      - run: npm run test:coverage -- --run                 # Coverage report
      - run: npm audit --audit-level high                   # Security audit

  integration-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    env:
      VITE_API_BASE_URL: https://staging.matric-memory.example.com
      VITE_RUN_INTEGRATION_TESTS: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration                       # NEW: Integration tests

  e2e-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    env:
      VITE_API_BASE_URL: https://staging.matric-memory.example.com
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build                                  # Build SPA
      - run: npm run preview &                              # Serve SPA locally
      - run: npx playwright test                            # NEW: E2E tests
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

**New Steps**:
- `integration-tests` job: Test against staging matric-memory API
- `e2e-tests` job: Playwright E2E tests for critical user journeys

---

#### 4.2.2 E2E Web Testing (New Workflow)

**File**: `.github/workflows/e2e-tests.yml` (NEW)

```yaml
name: E2E Web Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM UTC

jobs:
  e2e:
    runs-on: ubuntu-latest
    env:
      VITE_API_BASE_URL: https://staging.matric-memory.example.com
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run preview &
      - run: sleep 5  # Wait for preview server to start
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-screenshots
          path: playwright-screenshots/
```

**Purpose**: Run E2E tests on every PR and nightly to catch regressions.

---

### 4.3 New Test Commands (package.json)

**Update `ui/package.json` scripts**:
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:integration": "VITE_RUN_INTEGRATION_TESTS=true vitest run --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

**Usage**:
```bash
# Unit tests only (fast, for local dev)
npm run test:unit

# Integration tests (against staging API, slower)
npm run test:integration

# E2E tests (requires SPA build)
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

---

## 5. Migration-Specific Tests

### 5.1 Feature Parity Checklist

**Purpose**: Ensure no features lost during migration

**Location**: `ui/__tests__/migration/feature-parity.checklist.md`

**Content** (excerpt):
```markdown
# HotM Feature Parity Checklist (Desktop → Web SPA)

## Core Features (Must-Have for MVP)

### Note Management
- [ ] Create note (desktop: Ctrl+N, web: button or hotkey)
- [ ] View note (original and revised content side-by-side)
- [ ] Edit note (revised content only, original immutable)
- [ ] Delete note (soft delete, recoverable)
- [ ] List notes (pagination, sorting by date/relevance)
- [ ] Search within note content

### Search & Discovery
- [ ] Full-text search (keyword matching, case-insensitive)
- [ ] Semantic search (vector similarity, "find similar")
- [ ] Hybrid search (FTS + vector, reciprocal rank fusion)
- [ ] Search result highlighting (matched terms)
- [ ] Filter by tags (multi-select)
- [ ] Filter by collections (single-select)
- [ ] Filter by date range (created, updated)
- [ ] Sort results (relevance, date, title)

### Organization
- [ ] Create tags (inline or dedicated UI)
- [ ] Assign tags to notes (batch operations)
- [ ] Create collections (organize notes into groups)
- [ ] Assign notes to collections (drag-drop or menu)
- [ ] View all tags (tag cloud or list)
- [ ] View all collections (list with note counts)

### Editor Features
- [ ] Markdown syntax highlighting (editor)
- [ ] Markdown rendering (preview)
- [ ] Code block syntax highlighting (Prism or highlight.js)
- [ ] Mermaid diagram rendering (charts, flowcharts, etc.)
- [ ] PlantUML diagram rendering (if supported)
- [ ] Math rendering (KaTeX, inline and block)
- [ ] Auto-save (debounced, every 5s or on blur)
- [ ] Keyboard shortcuts (bold, italic, heading, etc.)

### UI/UX
- [ ] Responsive design (desktop, tablet, mobile)
- [ ] Dark mode (if supported in desktop app)
- [ ] Loading states (spinners, skeleton screens)
- [ ] Error states (graceful error messages)
- [ ] Offline indicator (if API unreachable)
- [ ] Performance (no lag when scrolling large lists)

## Advanced Features (Post-MVP)

### AI-Powered Features
- [ ] View AI-generated summaries (revised content)
- [ ] View extracted entities (people, places, concepts)
- [ ] View auto-generated tags
- [ ] Semantic similarity scores (related notes)
- [ ] Revision history (provenance, lineage)

### Advanced Search
- [ ] "Find similar" functionality
- [ ] Saved searches (reusable queries)
- [ ] Search history (recent searches)
- [ ] Advanced query syntax (boolean operators, field-specific)

### User Experience Enhancements
- [ ] Real-time updates (if matric-memory supports WebSocket)
- [ ] Offline mode (PWA with service worker)
- [ ] Mobile-responsive design (touch-optimized)
- [ ] Theme customization (colors, fonts)
- [ ] Multi-language support (i18n/l10n)
- [ ] Accessibility (WCAG 2.1 AA compliance)

## Performance Comparison (Desktop vs Web)

| Operation | Desktop App | Web SPA | Status |
|-----------|-------------|---------|--------|
| App launch | <2s | <2s | ⚠️ Test |
| Note creation | <200ms | <300ms | ⚠️ Test |
| Note retrieval | <100ms | <200ms | ⚠️ Test |
| Full-text search (100 notes) | <500ms | <1s | ⚠️ Test |
| Semantic search (100 notes) | <1s | <1.5s | ⚠️ Test |

**Acceptance Criteria**: Web SPA should be no more than 2x slower than desktop app for any operation.
```

**Usage**: Manual validation by QA or developer before production release.

---

### 5.2 API Endpoint Coverage Matrix

**Purpose**: Ensure all required matric-memory API endpoints exist

**Location**: `ui/__tests__/migration/api-endpoint-coverage.md`

**Content**: (See Section 1.4.1 above)

**Validation Steps**:
1. **API Discovery**: Review matric-memory OpenAPI/Swagger spec
2. **Manual Testing**: Test all endpoints with `curl` or Postman
3. **Automated Tests**: Create integration tests for all CRITICAL/HIGH endpoints
4. **Gap Analysis**: Identify missing endpoints, coordinate with matric-memory team

---

### 5.3 Performance Comparison Tests

**Purpose**: Ensure web SPA performance is acceptable compared to desktop app

**Location**: `ui/__tests__/migration/performance-comparison.test.ts`

**Test Strategy**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Performance Comparison (Desktop vs Web)', () => {
  test('page load time <2s', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="note-list"]');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000); // 2 seconds
  });

  test('note creation <300ms', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const startTime = Date.now();
    await page.fill('[data-testid="note-input"]', 'Performance test note');
    await page.click('[data-testid="create-note-button"]');
    await page.waitForSelector('[data-testid="note-list-item"]');
    const createTime = Date.now() - startTime;

    expect(createTime).toBeLessThan(300); // 300ms (includes API call)
  });

  test('search response <1s', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const startTime = Date.now();
    await page.fill('[data-testid="search-input"]', 'performance');
    await page.press('[data-testid="search-input"]', 'Enter');
    await page.waitForSelector('[data-testid="search-results"]');
    const searchTime = Date.now() - startTime;

    expect(searchTime).toBeLessThan(1000); // 1 second
  });

  test('no UI lag when scrolling large list', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Scroll to bottom of note list (100+ notes)
    await page.evaluate(() => {
      const list = document.querySelector('[data-testid="note-list"]');
      list?.scrollTo(0, list.scrollHeight);
    });

    // Measure frame rate (should be >30 FPS, ideally 60 FPS)
    // (requires custom performance profiling, not shown here)
  });
});
```

**Acceptance Criteria**:
- Page load <2s
- Note creation <300ms
- Search <1s
- No UI lag (60 FPS when scrolling)

---

## 6. Test Data Management (Updated)

### 6.1 Mock Data for API Client Tests

**Strategy**: Mock matric-memory API responses for unit tests

**Location**: `ui/src/api/__mocks__/fetch.ts`

**Implementation**:
```typescript
// ui/src/api/__mocks__/fetch.ts
import { vi } from 'vitest';

export const mockFetch = vi.fn();

// Default successful response
mockFetch.mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ data: [] })
});

// Helper to mock specific responses
export const mockResponse = (data: any, status = 200, ok = true) => {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data)
  });
};

// Helper to mock errors
export const mockError = (message: string) => {
  mockFetch.mockRejectedValueOnce(new Error(message));
};

// Helper to mock HTTP errors
export const mockHttpError = (status: number, message: string) => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message })
  });
};

// Override global fetch with mock
global.fetch = mockFetch;
```

**Usage in Tests**:
```typescript
import { mockResponse, mockError, mockHttpError } from '../__mocks__/fetch';

describe('notes API', () => {
  it('creates note successfully', async () => {
    mockResponse({ id: 'note-123', content: 'Test note' }, 201);
    const result = await createNote('Test note');
    expect(result.id).toBe('note-123');
  });

  it('handles network error', async () => {
    mockError('Network error');
    await expect(createNote('Test')).rejects.toThrow('Network error');
  });

  it('handles 401 Unauthorized', async () => {
    mockHttpError(401, 'Unauthorized');
    await expect(createNote('Test')).rejects.toThrow('Unauthorized');
  });
});
```

---

### 6.2 Test Data for Integration Tests

**Strategy**: Use real matric-memory staging API with test database

**Setup**:
1. **Test Database**: Coordinate with matric-memory team for test database
2. **Seed Data**: Create seed data via API calls in test setup
3. **Cleanup**: Delete test data in teardown

**Example Setup**:
```typescript
// ui/src/api/__tests__/integration/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { createNote, deleteNote } from '../../notes';

let testNoteIds: string[] = [];

export const setupTestData = async () => {
  // Create seed data
  const note1 = await createNote('Integration test note 1');
  const note2 = await createNote('Integration test note 2');
  testNoteIds = [note1.id, note2.id];
};

export const cleanupTestData = async () => {
  // Delete all test data
  for (const id of testNoteIds) {
    await deleteNote(id);
  }
  testNoteIds = [];
};

beforeAll(setupTestData);
afterAll(cleanupTestData);
```

---

### 6.3 E2E Test Data

**Strategy**: Use staging matric-memory API with ephemeral test data

**Approach**:
1. **Create Test Data**: Each E2E test creates its own data
2. **Cleanup**: Delete test data at end of test (even on failure)
3. **Isolation**: Tests do not depend on shared state

**Example**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Note Management E2E', () => {
  test('creates and deletes note', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Create note
    await page.fill('[data-testid="note-input"]', 'E2E test note');
    await page.click('[data-testid="create-note-button"]');
    await page.waitForSelector('[data-testid="note-list-item"]');

    // Verify note exists
    const noteText = await page.textContent('[data-testid="note-list-item"]');
    expect(noteText).toContain('E2E test note');

    // Delete note (cleanup)
    await page.click('[data-testid="note-list-item"]');
    await page.click('[data-testid="delete-note-button"]');
    await page.click('[data-testid="confirm-delete-button"]');

    // Verify note deleted
    await page.waitForSelector('[data-testid="note-list-item"]', { state: 'detached' });
  });
});
```

---

## 7. Test Schedule (Migration Timeline)

### Phase 1: Core Migration (Weeks 1-6)

**Goal**: Remove backend, add API client layer, preserve frontend

**Testing Focus**:
- [ ] Week 1-2: API Client Unit Tests (mock HTTP responses)
  - Create `ui/src/api/__tests__/` directory
  - Write unit tests for all API methods (notes, search, tags, collections)
  - Target 80% coverage on API client layer
  - CI: Update `frontend-tests.yml` to run API client tests

- [ ] Week 3-4: Component Updates and Tests
  - Update React components to use API client (instead of Tauri IPC)
  - Update existing component tests (mock API responses)
  - Target 60% coverage on updated components

- [ ] Week 5-6: Integration Tests (real matric-memory API)
  - Create integration tests for CRITICAL/HIGH priority endpoints
  - Test against staging matric-memory API
  - CI: Add `integration-tests` job to workflow

**Deliverables**:
- [ ] API client layer with 80% unit test coverage
- [ ] Updated frontend components with 60% test coverage
- [ ] Integration tests for all CRITICAL endpoints
- [ ] CI/CD updated (remove backend-tests.yml, add integration tests)

---

### Phase 2: E2E and Migration Validation (Weeks 7-9)

**Goal**: E2E tests for critical journeys, validate feature parity

**Testing Focus**:
- [ ] Week 7: E2E Test Infrastructure
  - Install Playwright or Cypress
  - Create E2E test scaffolding
  - Test 1: Note creation flow

- [ ] Week 8: E2E Critical Scenarios
  - Test 2: Search flow
  - Test 3: Tag management flow
  - Test 4: Error handling flow
  - Test 5: Performance flow

- [ ] Week 9: Feature Parity Validation
  - Manual testing with feature parity checklist
  - Performance comparison (desktop vs web)
  - API endpoint coverage verification

**Deliverables**:
- [ ] 5 E2E test scenarios passing
- [ ] Feature parity checklist 100% complete
- [ ] Performance comparison report
- [ ] API endpoint coverage matrix validated

---

### Phase 3: Production Readiness (Weeks 10-12)

**Goal**: Security audit, load testing, production deployment validation

**Testing Focus**:
- [ ] Week 10: Security Testing
  - Dependency audit (`npm audit`)
  - XSS vulnerability testing
  - CORS configuration validation
  - Security headers validation (CSP, X-Frame-Options, etc.)

- [ ] Week 11: Load Testing (Optional)
  - Test with large datasets (1,000+ notes)
  - Pagination performance
  - Concurrent user simulation (if applicable)

- [ ] Week 12: Production Validation
  - Deploy to staging environment
  - Full regression test suite
  - User acceptance testing (UAT)
  - Go/No-Go decision

**Deliverables**:
- [ ] Security audit report (zero high-severity vulnerabilities)
- [ ] Load testing report (if applicable)
- [ ] UAT sign-off
- [ ] Production deployment approval

---

## 8. Success Criteria (Updated)

### 8.1 MVP Gate Criteria

**All must pass before MVP release**:

- [ ] **Frontend Coverage**: ≥60% line coverage
- [ ] **API Client Coverage**: ≥80% line coverage
- [ ] **React Query Hooks Coverage**: ≥70% line coverage
- [ ] **Integration Tests**: All CRITICAL/HIGH endpoints tested
- [ ] **E2E Tests**: 5 critical scenarios passing
- [ ] **Feature Parity**: 100% of checklist items validated
- [ ] **Performance**: Web SPA no more than 2x slower than desktop app
- [ ] **Security**: Zero high-severity npm audit vulnerabilities
- [ ] **CI/CD**: All workflows green (unit, integration, E2E)
- [ ] **Backend Removal**: All Rust server code deleted or archived

---

### 8.2 Production Readiness Criteria

**All must pass before production deployment**:

- [ ] **Coverage**: ≥70% overall (stretch goal: 80%)
- [ ] **E2E Tests**: 10+ scenarios covering all major features
- [ ] **Load Testing**: Supports 100+ concurrent users (if applicable)
- [ ] **Security Audit**: Third-party security review (if budget allows)
- [ ] **Accessibility**: WCAG 2.1 AA compliance (if applicable)
- [ ] **User Migration**: Zero data loss, all users successfully migrated
- [ ] **Monitoring**: Sentry or similar error tracking enabled
- [ ] **Documentation**: Updated README, deployment guide, migration notes

---

## 9. Risk Mitigation (Testing-Specific)

### 9.1 API Contract Changes

**Risk**: matric-memory API evolves, breaking frontend assumptions

**Mitigation**:
- [ ] **Integration Tests**: Run nightly against staging API (detect breaking changes early)
- [ ] **Contract Testing**: Use Pact or similar for API contract validation
- [ ] **Versioning**: Use API versioning (`/api/v1/`) to avoid breaking changes
- [ ] **Communication**: Coordinate with matric-memory team on API changes

---

### 9.2 Performance Regressions

**Risk**: Web SPA is significantly slower than desktop app

**Mitigation**:
- [ ] **Performance Tests**: Automated performance tests in CI (Lighthouse CI)
- [ ] **Baseline**: Establish performance baseline before migration
- [ ] **Monitoring**: Track page load, API latency, UI responsiveness
- [ ] **Optimization**: Code splitting, lazy loading, caching, CDN

---

### 9.3 Test Flakiness

**Risk**: Integration/E2E tests fail intermittently due to network, timing, or API issues

**Mitigation**:
- [ ] **Retry Logic**: Automatically retry failed tests (max 3 retries)
- [ ] **Timeouts**: Use realistic timeouts (not too short, not too long)
- [ ] **Isolation**: Each test is independent (no shared state)
- [ ] **Debugging**: Capture screenshots, videos, logs on failure

---

## 10. Appendices

### Appendix A: Test Command Quick Reference

```bash
# Unit tests (fast, for local dev)
cd ui && npm run test:unit

# Integration tests (against staging API, slower)
cd ui && npm run test:integration

# E2E tests (requires SPA build)
cd ui && npm run test:e2e

# All tests with coverage
cd ui && npm run test:coverage

# Watch mode (local development)
cd ui && npm test

# CI/CD (Act - local validation)
gh act -j frontend-tests         # Full frontend validation (unit + integration + E2E)
```

---

### Appendix B: Test Coverage Checklist (Migration-Specific)

**Frontend (33.48% → 60%)**:
- [ ] API Client Layer (NEW, 0% → 80%)
  - [ ] `client.ts` - HTTP client setup
  - [ ] `notes.ts` - Notes CRUD
  - [ ] `search.ts` - Search methods
  - [ ] `tags.ts` - Tag management
  - [ ] `collections.ts` - Collection management
- [ ] React Query Hooks (NEW, 0% → 70%)
  - [ ] `useNotes.ts` - Notes data fetching
  - [ ] `useSearch.ts` - Search data fetching
  - [ ] `useTags.ts` - Tags data fetching
  - [ ] `useCollections.ts` - Collections data fetching
- [ ] Services (39.4% → 80%)
  - [ ] `api.ts` (64.34% → 80%)
  - [ ] `websocket.ts` (0% → 70%)
- [ ] Components (27.02% → 60%)
  - [ ] `HallOfMind.tsx` (30% → 80%)
  - [ ] `MarkdownEditor.tsx` (0% → 70%)
  - [ ] `MarkdownPreview.tsx` (0% → 70%)
  - [ ] `SearchDropdown.tsx` (0% → 60%)
  - [ ] `JobQueueMonitor.tsx` (0% → 60%)

**Backend (~17.5% → REMOVED)**:
- [ ] Archive backend test reports
- [ ] Delete `server/` directory
- [ ] Delete `backend-tests.yml` workflow
- [ ] Update documentation (remove backend testing references)

**Integration (NEW, 0% → 100% of CRITICAL endpoints)**:
- [ ] Notes CRUD (create, get, update, delete, list)
- [ ] Search (FTS, semantic, hybrid)
- [ ] Tags (CRUD, assign to notes)
- [ ] Collections (CRUD, assign notes)

**E2E (NEW, 0 → 5 scenarios)**:
- [ ] Note creation flow
- [ ] Search flow
- [ ] Tag management flow
- [ ] Error handling flow
- [ ] Performance flow

---

### Appendix C: References

**Project Documentation**:
- Project Intake: `.aiwg/intake/project-intake.md` (migration scope)
- Master Test Plan: `.aiwg/testing/master-test-plan.md` (original plan)
- Coverage Baseline: `.aiwg/testing/coverage-baseline.md` (pre-migration metrics)

**External Resources**:
- Vitest: https://vitest.dev
- React Testing Library: https://testing-library.com/react
- Playwright: https://playwright.dev
- React Query: https://tanstack.com/query/latest

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2026-01-30 |
| **Version** | 1.0 DRAFT |
| **Status** | DRAFT |
| **Primary Author** | Test Architect |
| **Reviewers** | Requirements Analyst, Architecture Designer |
| **Next Review** | After Phase 1 completion (6 weeks) |

**Change Log**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | Test Architect | Initial draft for SPA migration |

---

**End of Migration Test Strategy Addendum**
