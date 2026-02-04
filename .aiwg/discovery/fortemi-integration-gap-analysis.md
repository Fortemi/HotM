# Fortemi Integration Gap Analysis

**Document**: Discovery Report
**Version**: 1.0
**Date**: 2026-02-04
**Author**: Claude Code (Ralph Loop Orchestrator)
**Status**: Complete

---

## Executive Summary

HotM currently implements a **limited subset** (~19%) of the Fortemi API. The transition from matric-memory to Fortemi introduces significant new capabilities requiring comprehensive integration work across authentication, SKOS taxonomy, file attachments, versioning, memory search, and knowledge health monitoring.

| Metric | Value |
|--------|-------|
| Total Fortemi Endpoints | ~130+ |
| Currently Implemented | ~25 |
| API Coverage | 19% |
| New Feature Categories | 15+ |
| Breaking Changes | Authentication Required |

---

## 1. Feature Category Coverage

### Fully Missing (0% Coverage)

| Category | Endpoints | Priority | Effort |
|----------|-----------|----------|--------|
| **OAuth2 Authentication** | 9 | P0 - Blocker | High |
| **Note Versioning** | 5 | P1 | Medium |
| **File Attachments** | 5 | P1 | Medium |
| **Memory Search (Spatiotemporal)** | 3 | P2 | Medium |
| **Knowledge Health** | 5 | P2 | Medium |
| **SKOS Concepts** | 25+ | P2 | High |
| **Document Types** | 6 | P3 | Low |
| **Collections** | 7 | P1 | Medium |
| **Links & Graph** | 3 | P3 | Medium |
| **Embedding Sets** | 11 | P3 | Medium |
| **Templates** | 6 | P3 | Low |
| **Backup/Export** | 18 | P2 | High |
| **Note Provenance** | 2 | P4 | Medium |

### Partially Implemented

| Category | Coverage | Gaps |
|----------|----------|------|
| Notes CRUD | 60% | Missing restore, purge, reprocess, bulk operations |
| Search | 70% | Missing strict filtering, POST variant |
| Tags | 66% | Missing stats endpoint, individual tag CRUD |
| Jobs | 40% | Missing list, pending count, queue stats |
| System/Health | 33% | Missing memory info, rate limit status |

### Fully Implemented

| Category | Coverage |
|----------|----------|
| Basic Note CRUD | ✅ |
| Basic Search | ✅ |
| Health Check | ✅ |

---

## 2. Critical Breaking Changes

### 2.1 Authentication (BLOCKING)

**Old (matric-memory)**: No authentication required
**New (Fortemi)**: OAuth2 or API Key required

```typescript
// Required: Authorization header on all requests
headers: {
  'Authorization': 'Bearer mm_key_xxx'  // API Key
  // or
  'Authorization': 'Bearer <oauth_token>'  // OAuth2
}
```

**Impact**: All current API calls will fail without authentication implementation.

### 2.2 Default Port Change

**Old**: `http://localhost:53211`
**New**: `http://localhost:3000`

### 2.3 Response Schema Enhancements

- Notes now include `format`, `source` fields
- Search supports strict filtering via POST
- Health check returns structured object with service statuses

---

## 3. New API Modules Required

### Must Create

| Module | Purpose | Types Required |
|--------|---------|---------------|
| `auth.ts` | OAuth2/API key management | TokenResponse, ClientRegistration |
| `versions.ts` | Note version history | Version, VersionDiff |
| `attachments.ts` | File operations | Attachment, AttachmentMetadata, ExifData |
| `concepts.ts` | SKOS taxonomy | ConceptScheme, Concept, ConceptRelation |
| `collections.ts` | Folder hierarchy | Collection, CollectionTree |
| `backup.ts` | Export/import | BackupInfo, KnowledgeShard |
| `health.ts` | Knowledge metrics | KnowledgeHealth, OrphanTag, StaleNote |
| `memory.ts` | Spatiotemporal search | MemorySearchResult, LocationQuery |
| `templates.ts` | Template management | Template, TemplateVariable |
| `documents.ts` | Document types | DocumentType, DetectionResult |
| `embeddings.ts` | Embedding sets | EmbeddingSet, EmbeddingConfig |
| `links.ts` | Graph exploration | GraphNode, GraphEdge |
| `provenance.ts` | W3C PROV tracking | ProvenanceActivity, ProvenanceAgent |

---

## 4. Type Definition Gaps

### Missing Core Types

```typescript
// OAuth2
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

// Attachments
interface Attachment {
  id: string;
  note_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  has_exif?: boolean;
  has_location?: boolean;
}

interface ExifData {
  camera_make?: string;
  camera_model?: string;
  capture_time?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  // ... more fields
}

// Versioning
interface NoteVersion {
  version: number;
  created_at: string;
  change_summary?: string;
  content_hash: string;
}

interface VersionDiff {
  from_version: number;
  to_version: number;
  diff: string; // Unified diff format
}

// SKOS
interface ConceptScheme {
  id: string;
  title: string;
  description?: string;
  namespace?: string;
}

interface Concept {
  id: string;
  scheme_id: string;
  pref_label: string;
  alt_labels?: string[];
  definition?: string;
  notation?: string;
}

// Memory Search
interface MemorySearchResult {
  note_id: string;
  attachment_id?: string;
  title: string;
  distance_meters?: number;
  capture_time?: string;
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  snippet?: string;
}

// Knowledge Health
interface KnowledgeHealth {
  total_notes: number;
  orphan_notes: number;
  stale_notes: number;
  unlinked_notes: number;
  avg_links_per_note: number;
  tag_coverage: number;
  last_activity: string;
}
```

---

## 5. Branding Changes Required

### File References

| Location | Old | New |
|----------|-----|-----|
| `ui/src/api/client.ts` | matric-memory | Fortemi |
| `ui/src/api/README.md` | matric-memory API | Fortemi API |
| `CLAUDE.md` | matric-memory | Fortemi |
| `docs/**/*.md` | matric-memory | Fortemi |
| `ui/package.json` description | - | Update branding |
| Environment variables | `VITE_API_BASE_URL` | Keep but update default |
| Error messages | matric-memory references | Fortemi |

### Visual Branding

- Update any logos/icons referencing old branding
- Update application title: "Hall of the Mind - Fortemi"
- Update footer/about text

---

## 6. UX Opportunities from New Features

### High-Impact Features

1. **SKOS Concept Browser**
   - Tree view for hierarchical taxonomy
   - Concept search with autocomplete
   - Visual relationship mapping
   - Tag notes with structured concepts

2. **File Attachment Gallery**
   - Image preview with EXIF data
   - Map view for geotagged photos
   - Timeline of attachments
   - PDF preview

3. **Memory Search Interface**
   - Map-based location picker
   - Date range selector
   - Combined search with visual results

4. **Knowledge Health Dashboard**
   - Health score visualization
   - Orphan/stale note discovery
   - Connection suggestions
   - Tag co-occurrence network

5. **Version History Viewer**
   - Side-by-side diff comparison
   - Version timeline
   - One-click restore
   - Provenance chain visualization

6. **Template System**
   - Template library browser
   - Variable substitution preview
   - Quick note creation from templates

---

## 7. Environment Configuration

### Current `.env`
```env
VITE_API_BASE_URL=http://localhost:53211
VITE_API_TIMEOUT=30000
VITE_APP_TITLE=HotM
```

### Required `.env` Updates
```env
# Updated for Fortemi
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
VITE_APP_TITLE=Hall of the Mind

# New: Authentication
VITE_OAUTH_CLIENT_ID=
VITE_OAUTH_CLIENT_SECRET=
VITE_API_KEY=
VITE_AUTH_MODE=api_key  # or 'oauth2'
```

---

## 8. Implementation Priority Matrix

### Phase 1: Foundation (Blockers)
- [ ] OAuth2/API Key authentication
- [ ] Update type definitions
- [ ] Branding updates

### Phase 2: Core Features
- [ ] Note versioning and diff
- [ ] File attachments
- [ ] Collections (folders)

### Phase 3: Advanced Features
- [ ] SKOS concepts
- [ ] Backup/export
- [ ] Knowledge health
- [ ] Memory search

### Phase 4: Polish
- [ ] Templates
- [ ] Document types
- [ ] Embedding sets
- [ ] Graph exploration

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Auth breaking existing users | High | High | Graceful migration with API key generation |
| SKOS complexity | Medium | Medium | Phased rollout, optional feature |
| Performance with large attachments | Medium | Medium | Chunked uploads, progress indicators |
| Breaking existing integrations | Medium | High | Compatibility layer, deprecation warnings |

---

## 10. Acceptance Criteria

### Discovery Phase Complete When:
- [x] All Fortemi API endpoints inventoried
- [x] Gap analysis completed with coverage percentages
- [x] Breaking changes documented
- [x] New type definitions identified
- [x] Branding changes listed
- [x] UX opportunities identified
- [x] Implementation priorities established
- [x] Risk assessment completed

---

## References

- [Fortemi API Documentation](/home/roctinam/dev/fortemi/fortemi/docs/content/api.md)
- [Fortemi README](/home/roctinam/dev/fortemi/fortemi/README.md)
- [HotM Current API Client](/mnt/dev-inbox/fortemi/HotM/ui/src/api/)
- [AIWG Flowgate System](.aiwg/gates/)
