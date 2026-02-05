# HotM UI Redesign - Functional Requirements

## FR-001: Collections Management

### Description
Users shall be able to create, edit, delete, and organize collections for grouping related notes.

### Acceptance Criteria
- [ ] Create new collection with name and optional description
- [ ] Edit collection name and description
- [ ] Delete collection (with confirmation, notes remain)
- [ ] View collection contents with pagination
- [ ] Assign/remove notes from collections via drag-drop or menu
- [ ] Filter notes by collection in search
- [ ] Show collection badge on note cards

### API Endpoints
- `POST /api/v1/collections`
- `GET /api/v1/collections`
- `GET /api/v1/collections/{id}`
- `PUT /api/v1/collections/{id}`
- `DELETE /api/v1/collections/{id}`
- `PUT /api/v1/notes/{id}/collection`

### Priority: P1 (Must Have)

---

## FR-002: Knowledge Health Dashboard

### Description
Users shall have access to a dashboard showing knowledge base quality metrics and actionable insights.

### Acceptance Criteria
- [ ] Display overall health score (0-100)
- [ ] Show orphan notes (no tags, no links)
- [ ] Show stale notes (not updated in N days, configurable)
- [ ] Show unlinked notes
- [ ] Show tag co-occurrence matrix (top 10)
- [ ] Provide quick actions: "Add tags", "Archive", "Link"
- [ ] Auto-refresh on data changes

### API Endpoints
- `GET /api/v1/memory/health`
- `GET /api/v1/analytics/tags`
- `GET /api/v1/analytics/links`

### Priority: P1 (Must Have)

---

## FR-003: Memory Search (Spatiotemporal)

### Description
Users shall be able to search notes by geographic location and time range.

### Acceptance Criteria
- [ ] Search by location (address input or map click)
- [ ] Search by radius (1km, 5km, 10km, 50km)
- [ ] Search by date range (from/to pickers)
- [ ] Combined location + time + keyword search
- [ ] Map view showing note locations as markers
- [ ] Cluster markers when zoomed out
- [ ] Click marker to preview note
- [ ] Timeline scrubber for temporal navigation

### API Endpoints
- `POST /api/v1/memory/search`
- `GET /api/v1/memory/timeline`
- `GET /api/v1/attachments` (for GPS data)

### Priority: P1 (Must Have)

---

## FR-004: Graph Explorer

### Description
Users shall be able to visualize and navigate the knowledge graph of note relationships.

### Acceptance Criteria
- [ ] Display notes as nodes, links as edges
- [ ] Support 100+ nodes with performance
- [ ] Zoom, pan, and drag interactions
- [ ] Filter by tag, collection, date range
- [ ] Click node to preview note details
- [ ] Double-click to open full note
- [ ] Color-code by collection or tag
- [ ] Show link strength via edge thickness
- [ ] Export graph as PNG/SVG

### API Endpoints
- `GET /api/v1/notes/{id}/links`
- `GET /api/v1/notes/{id}/related`
- `GET /api/v1/analytics/links`

### Priority: P2 (Should Have)

---

## FR-005: Template Management

### Description
Users shall be able to create, edit, and use templates for common note types.

### Acceptance Criteria
- [ ] Create template with name, description, content
- [ ] Define template variables with types (text, select, date)
- [ ] Set default tags for template
- [ ] Set default collection for template
- [ ] Preview template before saving
- [ ] Instantiate template with variable substitution
- [ ] List and search templates
- [ ] Edit and delete templates

### API Endpoints
- `POST /api/v1/templates`
- `GET /api/v1/templates`
- `GET /api/v1/templates/{id}`
- `PUT /api/v1/templates/{id}`
- `DELETE /api/v1/templates/{id}`
- `POST /api/v1/templates/{id}/instantiate`

### Priority: P2 (Should Have)

---

## FR-006: Admin Panel

### Description
System administrators shall have access to authentication and system configuration.

### Acceptance Criteria
- [ ] Login form with username/password
- [ ] JWT token storage and refresh
- [ ] API key creation with expiration
- [ ] API key revocation
- [ ] List all API keys
- [ ] System settings panel (embedding model, etc.)
- [ ] Logout functionality

### API Endpoints
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/api-keys`
- `GET /api/v1/embeddings/config`
- `PUT /api/v1/embeddings/config`

### Priority: P2 (Should Have)

---

## FR-007: Timeline View

### Description
Users shall be able to browse notes chronologically with a visual timeline interface.

### Acceptance Criteria
- [ ] Vertical timeline with date markers
- [ ] Note cards positioned by creation date
- [ ] Infinite scroll with virtualization
- [ ] Filter by tag, collection
- [ ] Zoom levels: day, week, month, year
- [ ] Jump to specific date
- [ ] Show activity indicators (created, updated, accessed)

### API Endpoints
- `GET /api/v1/memory/timeline`
- `GET /api/v1/notes` (with date filters)

### Priority: P2 (Should Have)

---

## FR-008: Enhanced Tag Management

### Description
Users shall have advanced tag management capabilities including hierarchy and bulk operations.

### Acceptance Criteria
- [ ] Tree view of tag hierarchy
- [ ] Create nested tags (e.g., programming/rust/async)
- [ ] Rename tags across all notes
- [ ] Merge duplicate tags
- [ ] Delete unused tags
- [ ] Show tag usage statistics
- [ ] Bulk add/remove tags from multiple notes

### API Endpoints
- `GET /api/v1/tags`
- `PUT /api/v1/notes/{id}/tags`
- (Bulk operations may require multiple calls)

### Priority: P2 (Should Have)

---

## FR-009: Enhanced Attachment Management

### Description
Users shall have full attachment management with metadata viewing and map integration.

### Acceptance Criteria
- [ ] Upload multiple files at once
- [ ] View EXIF data for images
- [ ] View GPS location on map
- [ ] Show device provenance (camera, device name)
- [ ] Generate and display thumbnails
- [ ] Download original files
- [ ] Delete attachments
- [ ] Link attachments to notes

### API Endpoints
- `POST /api/v1/attachments`
- `GET /api/v1/attachments`
- `GET /api/v1/attachments/{id}`
- `DELETE /api/v1/attachments/{id}`
- `GET /api/v1/notes/{id}/attachments`

### Priority: P2 (Should Have)

---

## FR-010: Advanced Search Filters

### Description
Users shall have access to advanced search filters and saved searches.

### Acceptance Criteria
- [ ] Filter by multiple tags (AND/OR/NOT)
- [ ] Filter by collection
- [ ] Filter by date range (created, updated)
- [ ] Filter by has attachments
- [ ] Filter by has AI content
- [ ] Filter by starred/archived status
- [ ] Save search as "smart collection"
- [ ] Search history with quick recall

### API Endpoints
- `GET /api/v1/search` (existing, with filters)

### Priority: P3 (Could Have)

---

## Non-Functional Requirements

### NFR-001: Performance
- Page load (LCP): < 2.5 seconds
- Search response: < 500ms
- Graph render: < 1 second for 500 nodes
- Bundle size: < 500KB gzipped

### NFR-002: Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation for all features
- Screen reader announcements
- Color contrast ratios ≥ 4.5:1

### NFR-003: Responsiveness
- Full functionality on desktop (1024px+)
- Adapted layouts for tablet (768px-1023px)
- Essential features on mobile (320px-767px)
- Touch targets ≥ 44x44px

### NFR-004: Browser Support
- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

### NFR-005: Security
- No sensitive data in localStorage
- XSS prevention (React default escaping)
- CSRF protection (if auth implemented)
- Secure cookie handling

---

*Document Version: 1.0*
*Created: 2026-02-05*
*Status: Draft for Review*
