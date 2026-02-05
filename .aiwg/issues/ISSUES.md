# HotM UI Redesign - Issue Tracker

*Note: Gitea repo is archived. Using local tracking.*

## Epic: UI Redesign - Complete Fortemi API Coverage

| ID | Title | Priority | Status | Estimate |
|----|-------|----------|--------|----------|
| HOTM-001 | Collections Management UI | P1 | Open | 30h |
| HOTM-002 | Knowledge Health Dashboard | P1 | Open | 40h |
| HOTM-003 | Memory Search (Spatiotemporal) | P1 | Open | 60h |
| HOTM-004 | Graph Explorer | P2 | Open | 50h |
| HOTM-005 | Template Management | P2 | Open | 25h |
| HOTM-006 | Admin Panel | P2 | Open | 45h |
| HOTM-007 | Timeline View | P2 | Open | 35h |
| HOTM-008 | Enhanced Tag Management | P2 | Open | 20h |
| HOTM-009 | Enhanced Attachments | P2 | Open | 30h |
| HOTM-010 | Advanced Search Filters | P3 | Open | 25h |

**Total Estimate: ~360 hours**

---

## Epic: Elaboration Phase - Gate Deficiencies

| ID | Title | Priority | Status | Estimate | Blocks |
|----|-------|----------|--------|----------|--------|
| HOTM-011 | API Endpoint Verification | P0 | **DONE** | 6h | ABM Gate |
| HOTM-012 | Wireframes & UI Mockups | P1 | **DONE** | 30h | Construction |
| HOTM-013 | Risk Register Expansion | P2 | **DONE** | 8h | ABM Gate |
| HOTM-014 | Performance Validation Strategy | P2 | **DONE** | 12h | IOC Gate |
| HOTM-015 | Responsive Design Specifications | P2 | **DONE** | 12h | Construction |
| HOTM-016 | Client-Side Tag Bulk Operations | P2 | Open | 4h | HOTM-008 |
| HOTM-017 | Auth UI Placeholder (Deferred) | P3 | Deferred | 0h | Future |

**Total Elaboration Estimate: ~72 hours**

---

## HOTM-011: API Endpoint Verification

**Priority:** P0 (Blocker)
**Status:** COMPLETE
**Estimate:** 6 hours
**Blocks:** ABM Gate Sign-off
**Completed:** 2026-02-05

### Description
Verify all 40+ required API endpoints exist in current Fortemi API. Create verification matrix mapping each endpoint to API availability status.

### Acceptance Criteria
- [x] Create endpoint verification matrix (48 rows)
- [x] Test each endpoint against running Fortemi instance
- [x] Document any missing endpoints (9 found)
- [x] Propose mitigation for missing endpoints
- [x] Obtain Architecture team sign-off

### Results
- **Coverage**: 88% (42/48 endpoints available)
- **Missing**: 4 auth endpoints (deferred), 2 tag bulk ops (client-side mitigation)
- **Decision**: PROCEED with mitigations

### Deliverable
`.aiwg/elaboration/api-endpoint-verification.md`

---

## HOTM-012: Wireframes & UI Mockups

**Priority:** P1 (Must Have)
**Status:** Open
**Estimate:** 30 hours
**Blocks:** Construction Phase

### Description
Create wireframes and UI mockups for all P1 features (Collections, Health Dashboard, Memory Search).

### Acceptance Criteria
- [ ] Collections Management wireframes (5+ screens)
- [ ] Health Dashboard wireframes (3+ screens)
- [ ] Memory Search wireframes (5+ screens)
- [ ] User flow diagrams for critical journeys
- [ ] Mobile/tablet responsive variants
- [ ] Design system baseline (colors, typography, spacing)

### Deliverable
`.aiwg/elaboration/wireframes/` directory

---

## HOTM-013: Risk Register Expansion

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 8 hours
**Blocks:** ABM Gate

### Description
Expand risk register from 4 identified risks to 8-12 risks with detailed mitigations covering technical, schedule, and resource risks.

### Acceptance Criteria
- [ ] Identify 4-8 additional risks
- [ ] Document impact and probability for each
- [ ] Define mitigation strategies
- [ ] Assign risk owners
- [ ] Create risk monitoring schedule

### Deliverable
`.aiwg/risks/ui-redesign-risk-register.md`

---

## HOTM-014: Performance Validation Strategy

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 12 hours
**Blocks:** IOC Gate

### Description
Define performance testing strategy for complex features: graph visualization (100+ nodes), memory search with maps, timeline with virtualization.

### Acceptance Criteria
- [ ] Define performance targets (LCP, FCP, INP)
- [ ] Create load testing approach for graph rendering
- [ ] Define bundle size budget per feature
- [ ] Create accessibility testing plan (axe-core)
- [ ] Define monitoring metrics for production

### Deliverable
`.aiwg/testing/ui-redesign-performance-strategy.md`

---

## HOTM-015: Responsive Design Specifications

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 12 hours
**Blocks:** Construction Phase

### Description
Define responsive design breakpoints and component behavior for desktop, tablet, and mobile viewports.

### Acceptance Criteria
- [ ] Define breakpoints (mobile: 320-767px, tablet: 768-1023px, desktop: 1024px+)
- [ ] Document component behavior at each breakpoint
- [ ] Define navigation patterns per viewport
- [ ] Define touch target sizes (44x44px minimum)
- [ ] Create responsive grid system specification

### Deliverable
`.aiwg/elaboration/responsive-design-spec.md`

---

## HOTM-001: Collections Management UI

**Priority:** P1 (Must Have)
**Status:** Open
**Estimate:** 30 hours

### Description
Create, edit, delete, and organize collections for grouping related notes.

### Acceptance Criteria
- [ ] Create new collection with name and optional description
- [ ] Edit collection name and description
- [ ] Delete collection (with confirmation)
- [ ] View collection contents with pagination
- [ ] Assign/remove notes via drag-drop or menu
- [ ] Filter notes by collection in search
- [ ] Show collection badge on note cards

### API Endpoints
- `POST /api/v1/collections`
- `GET /api/v1/collections`
- `GET /api/v1/collections/{id}`
- `PUT /api/v1/collections/{id}`
- `DELETE /api/v1/collections/{id}`

---

## HOTM-002: Knowledge Health Dashboard

**Priority:** P1 (Must Have)
**Status:** Open
**Estimate:** 40 hours

### Description
Dashboard showing knowledge base quality metrics and actionable insights.

### Acceptance Criteria
- [ ] Display overall health score (0-100)
- [ ] Show orphan notes (no tags, no links)
- [ ] Show stale notes (not updated in N days)
- [ ] Show tag co-occurrence matrix
- [ ] Provide quick actions
- [ ] Auto-refresh on changes

### API Endpoints
- `GET /api/v1/memory/health`
- `GET /api/v1/analytics/tags`
- `GET /api/v1/analytics/links`

---

## HOTM-003: Memory Search (Spatiotemporal)

**Priority:** P1 (Must Have)
**Status:** Open
**Estimate:** 60 hours

### Description
Search notes by geographic location and time range.

### Acceptance Criteria
- [ ] Search by location (address or map click)
- [ ] Search by radius (1km, 5km, 10km, 50km)
- [ ] Search by date range
- [ ] Map view with markers
- [ ] Marker clustering
- [ ] Timeline scrubber

### API Endpoints
- `POST /api/v1/memory/search`
- `GET /api/v1/memory/timeline`

### Tech Stack
- Leaflet.js for maps

---

## HOTM-004: Graph Explorer

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 50 hours

### Description
Visualize and navigate the knowledge graph.

### Acceptance Criteria
- [ ] Notes as nodes, links as edges
- [ ] Support 100+ nodes
- [ ] Zoom, pan, drag
- [ ] Filter by tag/collection
- [ ] Click to preview, double-click to open
- [ ] Color-code by collection
- [ ] Export as PNG/SVG

### API Endpoints
- `GET /api/v1/notes/{id}/links`
- `GET /api/v1/notes/{id}/related`

### Tech Stack
- Cytoscape.js

---

## HOTM-005: Template Management

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 25 hours

### Description
Create and use templates for common note types.

### Acceptance Criteria
- [ ] Create template with variables
- [ ] Preview template
- [ ] Instantiate with substitution
- [ ] List and search templates
- [ ] Edit and delete

### API Endpoints
- `POST /api/v1/templates`
- `GET /api/v1/templates`
- `POST /api/v1/templates/{id}/instantiate`

---

## HOTM-006: Admin Panel

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 45 hours

### Description
Authentication and system configuration.

### Acceptance Criteria
- [ ] Login form
- [ ] JWT token handling
- [ ] API key management
- [ ] System settings

### API Endpoints
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/api-keys`
- `GET/PUT /api/v1/embeddings/config`

---

## HOTM-007: Timeline View

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 35 hours

### Description
Browse notes chronologically with visual timeline.

### Acceptance Criteria
- [ ] Vertical timeline with date markers
- [ ] Note cards by creation date
- [ ] Infinite scroll with virtualization
- [ ] Zoom levels: day/week/month/year
- [ ] Jump to date

### API Endpoints
- `GET /api/v1/memory/timeline`

---

## HOTM-008: Enhanced Tag Management

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 20 hours

### Description
Advanced tag management with hierarchy and bulk operations.

### Acceptance Criteria
- [ ] Tree view of hierarchy
- [ ] Create nested tags
- [ ] Rename across all notes
- [ ] Merge duplicates
- [ ] Usage statistics

---

## HOTM-009: Enhanced Attachments

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 30 hours

### Description
Full attachment management with metadata and maps.

### Acceptance Criteria
- [ ] Multi-file upload
- [ ] View EXIF data
- [ ] View GPS on map
- [ ] Device provenance
- [ ] Thumbnails

---

## HOTM-010: Advanced Search Filters

**Priority:** P3 (Could Have)
**Status:** Open
**Estimate:** 25 hours

### Description
Advanced filters and saved searches.

### Acceptance Criteria
- [ ] Multiple tag filters (AND/OR/NOT)
- [ ] Date range filters
- [ ] Has attachments filter
- [ ] Save as smart collection

---

---

## HOTM-016: Client-Side Tag Bulk Operations

**Priority:** P2 (Should Have)
**Status:** Open
**Estimate:** 4 hours
**Blocks:** HOTM-008

### Description
Implement client-side logic for tag merge and rename operations since Fortemi API lacks bulk tag endpoints.

### Acceptance Criteria
- [ ] Implement tag merge via iterating notes
- [ ] Implement tag rename via iterating notes
- [ ] Add progress indicator for bulk operations
- [ ] Handle errors gracefully with retry

### Technical Approach
```typescript
// Client-side merge: tag A -> tag B
async function mergeTag(fromTag: string, toTag: string) {
  const notes = await api.searchNotes({ tags: [fromTag] });
  for (const note of notes) {
    await api.updateTags(note.id, { remove: [fromTag], add: [toTag] });
  }
}
```

---

## HOTM-017: Auth UI Placeholder (Deferred)

**Priority:** P3 (Could Have)
**Status:** Deferred
**Estimate:** TBD (depends on Fortemi auth implementation)
**Blocks:** None

### Description
Add placeholder UI for authentication features in Admin Panel. Will be implemented when Fortemi adds OAuth2/API key support.

### Acceptance Criteria
- [ ] Add "Authentication" section to Admin Panel
- [ ] Show "Coming Soon" message
- [ ] Link to Fortemi roadmap/documentation

---

**Grand Total: ~432 hours** (360h Construction + 72h Elaboration)

---

*Last Updated: 2026-02-05 - Added Elaboration deficiency issues (HOTM-011 to HOTM-015)*
