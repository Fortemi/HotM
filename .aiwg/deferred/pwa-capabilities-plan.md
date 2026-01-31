# PWA Capabilities Implementation Plan

**Status**: Deferred (Post-MVP)
**Priority**: Medium
**Complexity**: Medium-High
**Estimated Effort**: 6 weeks
**Created**: 2026-01-31
**Last Updated**: 2026-01-31

---

## 1. Overview

### Goal
Enable offline note viewing and basic editing capabilities for the HotM SPA to provide resilient user experience in low-connectivity scenarios.

### Timeline
Post-MVP implementation, triggered when:
- User demand warrants offline access (feedback from beta users)
- Online-first SPA is stable and battle-tested in production
- Core features (search, notes, collections) are feature-complete

### Complexity Assessment
**Medium-High** due to:
- Sync conflict resolution requirements
- State management across online/offline transitions
- Cache invalidation strategies
- Background sync queue management
- IndexedDB transaction handling

### Success Criteria
- Users can view recently accessed notes while offline
- Users can create/edit notes offline with queued sync
- Zero data loss during online/offline transitions
- Clear UI indicators for sync status and conflicts
- <200ms overhead for service worker intercept

---

## 2. PWA Features to Implement

### 2.1 Service Worker
**Purpose**: Intercept network requests, cache assets, enable offline functionality

**Capabilities**:
- Cache static assets (JS, CSS, fonts, images)
- Intercept API calls to matric-memory server
- Network-first with cache fallback for note data
- Background sync queue for offline edits
- Cache versioning and cleanup

### 2.2 Web App Manifest
**Purpose**: Enable install prompt and native app-like experience

**Manifest Properties**:
```json
{
  "name": "HotM - History of the Mind",
  "short_name": "HotM",
  "description": "Local-first notes with NLP-powered revisions",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 2.3 Offline Storage (IndexedDB)
**Purpose**: Persist note cache and sync queue locally

**Data Stores**:
- `notes`: Cached note documents with metadata
- `sync_queue`: Pending offline edits awaiting sync
- `assets`: Static asset cache metadata
- `search_index`: Optional lightweight local search index

**Schema**:
```typescript
interface CachedNote {
  id: string;
  content: {
    original: string;
    revised?: string;
  };
  metadata: {
    title?: string;
    tags?: string[];
    collection?: string;
  };
  cached_at: number;
  last_accessed: number;
  version: number; // Optimistic concurrency control
}

interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  timestamp: number;
  retries: number;
}
```

### 2.4 Background Sync
**Purpose**: Queue changes when offline, sync when connectivity restored

**Strategy**:
- Queue operations in IndexedDB
- Register background sync event on network restore
- Process queue with exponential backoff on failure
- Notify user of sync status (pending, success, conflict)

### 2.5 Push Notifications (Optional)
**Future Enhancement**: Enable collaboration features

**Use Cases**:
- Note shared by another user
- Sync conflict requires resolution
- Server-side NLP processing complete

**Deferred Until**: Collaboration features planned

---

## 3. Technical Implementation Plan

### Phase 1: Basic PWA Setup (1 week)

**Goal**: Enable installation and cache static assets

**Tasks**:
1. Create `public/manifest.json` with app metadata
2. Generate PWA icons (192x192, 512x512)
3. Implement service worker registration in `src/main.tsx`
4. Create basic service worker (`public/sw.js`) with static asset caching
5. Add install prompt component
6. Test installation on Chrome, Edge, Firefox

**Deliverables**:
- Installable PWA with app icon
- Cached static assets for faster load times
- Install prompt UI component

**Acceptance Criteria**:
- [x] PWA passes Lighthouse audit (PWA score >90)
- [x] App installs correctly on desktop and mobile
- [x] Static assets load from cache on repeat visits
- [x] Install prompt respects user dismissal

### Phase 2: Offline Reading (2 weeks)

**Goal**: Enable offline access to recently viewed notes

**Tasks**:
1. Implement IndexedDB wrapper (`src/utils/db.ts`)
2. Create note cache store with LRU eviction policy
3. Cache notes on view (hook into note detail component)
4. Update service worker to serve cached notes when offline
5. Add offline indicator to UI (`OfflineBanner` component)
6. Implement graceful degradation for search (disabled offline)
7. Add cache management settings (max cache size, clear cache)

**Deliverables**:
- IndexedDB storage for note cache
- Service worker intercepts for note API endpoints
- Offline banner component
- Cache management UI

**Acceptance Criteria**:
- [x] Recently viewed notes load instantly when offline
- [x] Offline indicator displays when network unavailable
- [x] Search shows "Offline - search unavailable" message
- [x] Cache respects size limits (default 50MB, configurable)
- [x] Cache evicts oldest notes when full (LRU)

**Cache Strategy**:
```javascript
// Network-first with cache fallback
async function handleNoteRequest(request) {
  try {
    const response = await fetch(request);
    await cacheNote(response.clone());
    return response;
  } catch (error) {
    const cached = await getCachedNote(request.url);
    if (cached) return cached;
    throw error;
  }
}
```

### Phase 3: Offline Editing (2-3 weeks)

**Goal**: Enable note creation/editing while offline with sync queue

**Tasks**:
1. Implement sync queue in IndexedDB
2. Create optimistic UI updates for offline edits
3. Queue operations when offline (create, update, delete)
4. Implement background sync registration
5. Build sync processor with conflict detection
6. Create conflict resolution UI
7. Add sync status indicator (pending, syncing, synced, error)
8. Implement retry logic with exponential backoff
9. Test sync scenarios (online -> offline -> online transitions)

**Deliverables**:
- Sync queue system
- Background sync integration
- Conflict resolution UI
- Sync status indicator

**Acceptance Criteria**:
- [x] Users can create notes while offline
- [x] Users can edit existing notes while offline
- [x] Sync queue processes on network restore
- [x] Conflicts detected and presented to user
- [x] Sync status visible in UI
- [x] Failed syncs retry with backoff (max 5 retries)
- [x] No data loss during transitions

**Sync Queue Processing**:
```javascript
async function processSyncQueue() {
  const queue = await getSyncQueue();
  for (const item of queue) {
    try {
      await syncItem(item);
      await removeFromQueue(item.id);
    } catch (error) {
      if (isConflict(error)) {
        await handleConflict(item, error);
      } else if (item.retries < MAX_RETRIES) {
        await retryLater(item);
      } else {
        await markAsFailed(item);
      }
    }
  }
}
```

---

## 4. Service Worker Strategy

### 4.1 Cache-First (Static Assets)
**Resources**: JS bundles, CSS, fonts, images, icons

**Strategy**:
```javascript
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Static assets
  if (url.pathname.match(/\.(js|css|woff2|png|svg)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
  }
});
```

### 4.2 Network-First with Cache Fallback (Notes API)
**Resources**: `/api/notes/:id`, `/api/notes/:id/revised`

**Strategy**:
```javascript
// Notes API
if (url.pathname.match(/^\/api\/notes\/[^/]+$/)) {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open('notes-v1').then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request);
      })
  );
}
```

### 4.3 Network-Only (Search API)
**Resources**: `/api/search`, `/api/semantic`

**Strategy**:
```javascript
// Search API - no offline support
if (url.pathname.match(/^\/api\/(search|semantic)/)) {
  event.respondWith(fetch(event.request));
}
```

### 4.4 Stale-While-Revalidate (Collections, Tags)
**Resources**: `/api/collections`, `/api/tags`

**Strategy**:
```javascript
// Collections/Tags - serve cached immediately, update in background
if (url.pathname.match(/^\/api\/(collections|tags)$/)) {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        caches.open('metadata-v1').then((cache) => {
          cache.put(event.request, response.clone());
        });
        return response;
      });
      return cached || fetchPromise;
    })
  );
}
```

### 4.5 Cache Versioning
**Strategy**: Version cache names, clean up old caches on activation

```javascript
const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  static: `static-${CACHE_VERSION}`,
  notes: `notes-${CACHE_VERSION}`,
  metadata: `metadata-${CACHE_VERSION}`,
};

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

---

## 5. Sync Conflict Resolution

### 5.1 Conflict Scenarios

**Scenario A**: User edits note offline, server version unchanged
- **Resolution**: Accept client changes (simple case)

**Scenario B**: User edits note offline, server version also edited
- **Resolution**: Conflict detected via version mismatch

**Scenario C**: User deletes note offline, server version edited
- **Resolution**: Resurrect note or confirm deletion

### 5.2 Resolution Strategies

#### Option A: Last-Write-Wins
**Pros**: Simple to implement, no user intervention
**Cons**: May lose data, poor UX for concurrent edits

**Implementation**:
```typescript
async function syncNote(queuedEdit: SyncQueueItem) {
  try {
    await api.updateNote(queuedEdit.payload);
    return { success: true };
  } catch (error) {
    if (error.status === 409) {
      // Conflict - overwrite server version
      await api.forceUpdateNote(queuedEdit.payload);
      return { success: true, conflict: true };
    }
    throw error;
  }
}
```

#### Option B: Server-Wins with Local Backup (Recommended for MVP PWA)
**Pros**: No data loss, clear UX, simple conflict resolution
**Cons**: User must manually merge if they want offline edits

**Implementation**:
```typescript
async function syncNote(queuedEdit: SyncQueueItem) {
  try {
    await api.updateNote(queuedEdit.payload);
    return { success: true };
  } catch (error) {
    if (error.status === 409) {
      // Conflict - save local version as backup
      const serverVersion = await api.getNote(queuedEdit.payload.id);
      await saveConflict({
        localEdit: queuedEdit.payload,
        serverVersion,
        timestamp: Date.now(),
      });
      return { success: false, conflict: true };
    }
    throw error;
  }
}
```

**UI Flow**:
1. Show notification: "Sync conflict detected for note 'X'"
2. Open conflict resolution modal with 3 columns:
   - Server version (current)
   - Your offline changes
   - Merged version (editable)
3. User chooses: Keep server, Keep mine, Manually merge
4. Apply chosen resolution

#### Option C: Full Merge (Future Enhancement)
**Pros**: Best UX, preserves all changes
**Cons**: Complex to implement, requires diff/merge algorithms

**Implementation**: Deferred until collaboration features planned

**Recommendation**: **Option B (Server-Wins with Local Backup)** for MVP PWA

### 5.3 Optimistic Concurrency Control

Use version field to detect conflicts:

```typescript
interface Note {
  id: string;
  content: string;
  version: number; // Increment on each update
}

// Client sends version with update
PUT /api/notes/:id
{
  "content": "...",
  "version": 5
}

// Server checks version
if (dbNote.version !== requestBody.version) {
  return 409 Conflict;
}
// Increment version on success
dbNote.version++;
```

---

## 6. Dependencies

### 6.1 SPA Migration Complete
**Blocker**: PWA requires online-first SPA to be stable
- Electron retirement complete
- matric-memory API integration stable
- Radix UI components finalized
- TanStack Query caching operational

**Gate**: SPA MVP deployed to production

### 6.2 User Demand Validated
**Trigger**: Feedback from beta users requesting offline access
- Survey results show >30% users want offline capabilities
- Support tickets requesting offline mode
- Feature request upvotes on issue tracker

**Measurement**: User interviews, analytics, feedback forms

### 6.3 matric-memory API Versioning
**Requirement**: API must support optimistic concurrency control
- Version field added to note schema
- 409 Conflict responses for version mismatches
- GET /api/notes/:id returns current version

**Implementation**: Backend change (matric-memory repository)

### 6.4 Storage Quota Management
**Consideration**: Browser storage limits
- Chrome: ~60% of disk space
- Firefox: ~50% of available disk space
- Safari: 1GB default, requestable

**Solution**: Request persistent storage for critical data

```javascript
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist();
  console.log(`Storage persisted: ${isPersisted}`);
}
```

---

## 7. Estimated Effort

### 7.1 Phase Breakdown

| Phase | Tasks | Effort | Dependencies |
|-------|-------|--------|--------------|
| Phase 1: Basic PWA | Manifest, SW registration, static caching, install prompt | 1 week | None |
| Phase 2: Offline Reading | IndexedDB setup, note caching, offline UI, cache management | 2 weeks | Phase 1 complete |
| Phase 3: Offline Editing | Sync queue, background sync, conflict resolution, retry logic | 3 weeks | Phase 2 complete, API versioning |

**Total Effort**: 6 weeks (assumes 1 developer full-time)

### 7.2 Risk Contingency

**Medium Risks** (15% contingency):
- IndexedDB transaction complexity
- Service worker debugging challenges
- Cross-browser compatibility issues

**Contingency Buffer**: +1 week

**Total with Contingency**: 7 weeks

### 7.3 Testing Effort (Included in Estimates)

**Unit Tests**: 15% of development time
- IndexedDB wrapper tests
- Sync queue logic tests
- Conflict resolution tests

**Integration Tests**: 10% of development time
- Service worker lifecycle tests
- Online/offline transition tests

**Manual Testing**: 5% of development time
- Cross-browser testing (Chrome, Firefox, Edge, Safari)
- Mobile testing (Android, iOS)
- Network throttling scenarios

---

## 8. Implementation Roadmap

### 8.1 Prerequisites (Before Starting)
- [ ] SPA MVP deployed to production
- [ ] User demand validated (>30% users request offline)
- [ ] matric-memory API supports version field
- [ ] PWA icons designed (192x192, 512x512)

### 8.2 Phase 1: Basic PWA (Week 1)
**Sprint Goal**: Installable PWA with static asset caching

- [ ] Day 1-2: Create manifest.json, generate icons
- [ ] Day 3: Implement service worker registration
- [ ] Day 4: Build static asset caching strategy
- [ ] Day 5: Create install prompt component
- [ ] Testing: Lighthouse audit, installation testing

**Deliverable**: Installable PWA passing Lighthouse audit

### 8.3 Phase 2: Offline Reading (Weeks 2-3)
**Sprint Goal**: Offline access to recently viewed notes

- [ ] Week 2, Day 1-2: IndexedDB wrapper implementation
- [ ] Week 2, Day 3-4: Note caching logic
- [ ] Week 2, Day 5: Service worker note intercepts
- [ ] Week 3, Day 1-2: Offline banner component
- [ ] Week 3, Day 3: Cache management UI
- [ ] Week 3, Day 4-5: Testing (offline scenarios, cache limits)

**Deliverable**: Notes viewable offline with cache management

### 8.4 Phase 3: Offline Editing (Weeks 4-6)
**Sprint Goal**: Note editing offline with sync queue

- [ ] Week 4, Day 1-2: Sync queue IndexedDB schema
- [ ] Week 4, Day 3-4: Optimistic UI updates
- [ ] Week 4, Day 5: Background sync registration
- [ ] Week 5, Day 1-3: Sync processor with conflict detection
- [ ] Week 5, Day 4-5: Conflict resolution UI
- [ ] Week 6, Day 1-2: Sync status indicator
- [ ] Week 6, Day 3-4: Testing (conflict scenarios, retry logic)
- [ ] Week 6, Day 5: Documentation, knowledge transfer

**Deliverable**: Full offline editing with conflict resolution

---

## 9. Testing Strategy

### 9.1 Service Worker Testing

**Tools**: Workbox Testing Library, Playwright

**Scenarios**:
- Service worker installs correctly
- Cache versioning works (old caches deleted)
- Static assets served from cache
- Network-first strategy for notes
- Offline fallback works

**Example Test**:
```typescript
test('serves cached note when offline', async () => {
  await page.goto('/notes/123');
  await page.waitForSelector('[data-testid="note-content"]');

  // Simulate offline
  await page.context().setOffline(true);
  await page.reload();

  // Should load from cache
  await expect(page.locator('[data-testid="note-content"]')).toBeVisible();
  await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
});
```

### 9.2 Sync Queue Testing

**Tools**: Vitest, MSW (Mock Service Worker)

**Scenarios**:
- Queue operations when offline
- Process queue on network restore
- Retry failed operations with backoff
- Detect and handle conflicts
- Clear queue after successful sync

**Example Test**:
```typescript
test('queues note update when offline', async () => {
  const db = await openDB('hotm-pwa', 1);

  // Simulate offline
  setOnline(false);

  await updateNote({ id: '123', content: 'Updated offline' });

  // Check queue
  const queue = await db.getAll('sync_queue');
  expect(queue).toHaveLength(1);
  expect(queue[0].operation).toBe('update');
  expect(queue[0].payload.content).toBe('Updated offline');
});
```

### 9.3 Conflict Resolution Testing

**Tools**: Vitest, manual testing

**Scenarios**:
- Server version unchanged (no conflict)
- Server version updated (conflict)
- User chooses "Keep server"
- User chooses "Keep mine"
- User manually merges versions

**Example Test**:
```typescript
test('detects conflict on version mismatch', async () => {
  // Setup: server version is 5, client cached version is 4
  server.use(
    http.put('/api/notes/123', () => {
      return HttpResponse.json(
        { error: 'Version mismatch' },
        { status: 409 }
      );
    })
  );

  const result = await syncNote({
    id: '123',
    content: 'Client edit',
    version: 4,
  });

  expect(result.conflict).toBe(true);

  // Check conflict saved for user resolution
  const conflicts = await getConflicts();
  expect(conflicts).toHaveLength(1);
});
```

### 9.4 Cross-Browser Testing

**Browsers**: Chrome, Firefox, Edge, Safari (macOS/iOS)

**Focus Areas**:
- Service worker support (Safari limited)
- IndexedDB compatibility
- Background Sync API (not supported in Safari)
- Storage quota behavior

**Safari Limitations**:
- No Background Sync API (use polling fallback)
- 7-day service worker cache limit
- Smaller storage quotas

---

## 10. Rollout Strategy

### 10.1 Feature Flag
**Control**: Toggle PWA features without redeployment

```typescript
// src/config/features.ts
export const FEATURES = {
  PWA_ENABLED: import.meta.env.VITE_ENABLE_PWA === 'true',
  OFFLINE_EDITING: import.meta.env.VITE_ENABLE_OFFLINE_EDIT === 'true',
};
```

### 10.2 Phased Rollout

**Week 1**: Internal testing (dev team)
- Enable PWA for internal users
- Test installation, caching, sync queue
- Gather feedback on UX

**Week 2**: Beta users (opt-in)
- Add "Enable offline mode (beta)" toggle in settings
- 10% of beta users invited to test
- Monitor error rates, sync conflicts

**Week 3-4**: Gradual rollout
- 25% of users (if error rate <1%)
- 50% of users (if error rate <0.5%)
- 100% of users (if error rate <0.1%)

**Rollback Plan**: Disable feature flag, clear caches, notify users

### 10.3 Monitoring

**Metrics to Track**:
- Service worker install success rate
- Cache hit/miss ratio
- Sync queue processing time
- Conflict resolution rate
- Storage quota usage
- Error rates (by browser)

**Alerting**:
- Error rate >1% → investigate
- Sync queue backlog >100 items → investigate
- Storage quota exceeded for >5% users → warn users

---

## 11. Documentation Requirements

### 11.1 User Documentation

**Help Article**: "Using HotM Offline"
- How to install the app
- What works offline vs online
- How sync works
- Resolving sync conflicts
- Managing cache storage

**In-App Tooltips**:
- Install prompt: "Install HotM for faster access and offline use"
- Offline banner: "You're offline. Changes will sync when reconnected."
- Sync status: "Syncing 3 changes..." / "All changes synced"

### 11.2 Developer Documentation

**Technical Guide**: `docs/pwa-architecture.md`
- Service worker strategies
- IndexedDB schema
- Sync queue processing
- Conflict resolution algorithm
- Testing guidelines

**API Documentation**: Update matric-memory API docs
- Document version field requirement
- Document 409 Conflict response format
- Document optimistic concurrency control

---

## 12. Success Metrics

### 12.1 Technical Metrics
- **PWA Lighthouse Score**: >90
- **Service Worker Cache Hit Rate**: >80%
- **Sync Queue Processing Time**: <2s median
- **Conflict Rate**: <5% of offline edits
- **Storage Quota Exceeded**: <1% of users

### 12.2 User Experience Metrics
- **Install Conversion Rate**: >10% of active users
- **Offline Usage**: >5% of sessions include offline access
- **Sync Conflict Resolution Time**: <30s median
- **Offline Edit Abandonment**: <2% (edits lost due to sync failure)

### 12.3 Performance Metrics
- **First Load (Cached)**: <500ms
- **Note View (Offline)**: <100ms
- **Sync Queue Processing**: <2s per operation

---

## 13. Open Questions

### 13.1 Product Questions
- **Q**: Should collections/tags be editable offline?
  - **A**: Deferred - read-only offline, too complex for MVP

- **Q**: Should search work offline (with cached notes)?
  - **A**: Deferred - local search index is complex, low ROI

- **Q**: How many notes should we cache by default?
  - **A**: 100 most recently viewed, ~10MB storage (configurable)

### 13.2 Technical Questions
- **Q**: Should we support Safari's limited PWA features?
  - **A**: Yes, with graceful degradation (polling instead of Background Sync)

- **Q**: How do we handle storage quota exceeded?
  - **A**: LRU eviction, prompt user to clear cache or increase quota

- **Q**: Should we implement compression for cached notes?
  - **A**: Yes if storage becomes an issue, use LZ-string library

### 13.3 UX Questions
- **Q**: Should we auto-install on first visit?
  - **A**: No - show install prompt after 2nd visit or first offline scenario

- **Q**: How do we indicate sync status for individual notes?
  - **A**: Badge on note card (synced ✓, pending ⟳, conflict !)

---

## 14. References

### 14.1 External Resources
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [Service Worker Cookbook](https://serviceworke.rs/)
- [Workbox (Google's PWA toolkit)](https://developers.google.com/web/tools/workbox)
- [IndexedDB Best Practices](https://web.dev/indexeddb-best-practices/)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API)

### 14.2 Internal Documents
- [SPA Migration Plan](.aiwg/migration/spa-migration-plan.md)
- [matric-memory API Specification](../docs/specifications/api-specification.md)
- [HotM Architecture](../docs/architecture/system-architecture.md)

### 14.3 Related Issues
- Issue #61: Electron Retirement (blocking)
- Issue #62: PWA Capabilities (this document)
- Issue #63: Advanced Search Improvements (deferred)

---

## 15. Approval & Sign-Off

**Document Owner**: Software Implementer
**Reviewers**: Test Architect, DevOps Engineer, UX Lead
**Approval Required From**: Product Owner, Technical Lead

**Approval Status**: DRAFT (pending SPA MVP completion)

---

**Next Steps**:
1. Wait for SPA MVP deployment to production
2. Survey beta users on offline access demand
3. Implement version field in matric-memory API
4. Schedule PWA implementation sprint (6 weeks + 1 week contingency)
5. Update issue #62 with links to this plan
