# Fortemi API Client

TypeScript API client for the Fortemi API used by HotM SPA.

## Overview

This directory contains a complete, production-ready API client for interacting with the Fortemi backend API. The client is organized into modular components with comprehensive error handling, retry logic, and TypeScript type safety.

## Structure

```
api/
├── client.ts           # Base HTTP client with retry logic
├── errors.ts           # Custom error types
├── types.ts            # Core TypeScript interfaces
├── types-extended.ts   # Extended types for Fortemi features
├── index.ts            # Public exports and configured client
│
├── notes.ts            # Notes CRUD operations
├── search.ts           # Search operations (FTS, semantic, hybrid)
├── tags.ts             # Tag management
│
├── attachments.ts      # File attachments with EXIF/provenance
├── auth.ts             # Authentication (OIDC/Keycloak)
├── backup.ts           # Backup, export, restore operations
├── collections.ts      # Note collection management
├── concepts.ts         # SKOS concept schemes and vocabulary
├── documents.ts        # Document type detection
├── embeddings.ts       # Embedding configuration
├── health.ts           # Knowledge health metrics
├── links.ts            # Dynamic link management
├── memory.ts           # Spatiotemporal memory search
├── provenance.ts       # Device provenance tracking
├── templates.ts        # Note templates with variables
├── versions.ts         # Version history and diff
│
└── __tests__/          # Comprehensive test suite
```

## Usage

### Basic Import

```typescript
import { api } from '@/api';

// The default `api` instance is pre-configured using VITE_API_BASE_URL
```

### Notes Operations

```typescript
// List notes with filters
const notes = await api.notes.list({
  sortBy: 'updated_at',
  sortOrder: 'desc',
  limit: 20,
  tags: ['work', 'important'],
  starred: true
});

// Get a single note
const note = await api.notes.get('note-id');

// Create a note
const { note_id } = await api.notes.create({
  content: '# My Note\n\nContent here...',
  format: 'markdown',
  source: 'user'
});

// Update note metadata
await api.notes.update('note-id', {
  starred: true,
  archived: false
});

// Update note content (creates revision)
await api.notes.update('note-id', {
  content: 'Updated content'
});

// Delete a note (soft delete)
await api.notes.delete('note-id');

// Tag operations
const tags = await api.notes.getTags('note-id');
await api.notes.updateTags('note-id', {
  add: ['new-tag'],
  remove: ['old-tag']
});
```

### Search Operations

```typescript
// Hybrid search (default - combines FTS + semantic)
const results = await api.search.search('machine learning', {
  mode: 'hybrid',
  limit: 10
});

// Full-text search only
const ftsResults = await api.search.search('keywords', {
  mode: 'fts',
  tags: ['research']
});

// Semantic search only
const semanticResults = await api.search.search('concept query', {
  mode: 'semantic',
  starred: true
});

// Find similar notes
const similar = await api.search.findSimilar('note-id', {
  limit: 5,
  threshold: 0.7
});

// Search by tags only
const tagResults = await api.search.searchByTags(['work', 'urgent']);
```

### Tag Management

```typescript
// List all tags with counts
const tags = await api.tags.list({
  sortBy: 'count',  // or 'name'
  minCount: 2
});

// Create a tag
await api.tags.create('new-tag');

// Rename a tag
await api.tags.rename('old-name', 'new-name');

// Delete a tag
await api.tags.delete('obsolete-tag');

// Get tag statistics
const stats = await api.tags.getStats();
// Returns: { total_tags, total_tagged_notes, avg_tags_per_note, most_used }
```

### Health Check

```typescript
const health = await api.health();
// Returns: { ok, database, ollama?, vector? }
```

### SKOS Concept Browser

```typescript
// List concept schemes
const schemes = await api.concepts.listSchemes();

// Get top-level concepts in a scheme
const topConcepts = await api.concepts.getTopConcepts('scheme-id');

// Get narrower concepts (children)
const narrower = await api.concepts.getNarrower('concept-id');

// Get full concept details
const concept = await api.concepts.getConceptFull('concept-id');

// Search concepts
const results = await api.concepts.listConcepts({
  search: 'keyword',
  scheme_id: 'scheme-id'
});
```

### File Attachments

```typescript
// List attachments for a note
const attachments = await api.attachments.listAttachments('note-id');

// Remote file uploads use the typed TUS service for all sizes
const upload = startTusUpload({
  noteId: 'note-id',
  file,
  mediaOptimize: false,
});
const newAttachment = await upload.promise;

// Get attachment metadata (EXIF, location, provenance)
const metadata = await api.attachments.getMetadata('attachment-id');

// Get download URL
const url = await api.attachments.getDownloadUrl('attachment-id');

// Delete attachment
await api.attachments.deleteAttachment('attachment-id');
```

### Memory Search (Spatiotemporal)

```typescript
// Search by location
const locationResults = await api.memory.searchByLocation({
  latitude: 40.7128,
  longitude: -74.006,
  radius_meters: 1000
});

// Search by time range
const timeResults = await api.memory.searchByTimeRange({
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-12-31T23:59:59Z'
});

// Combined spatiotemporal search
const combined = await api.memory.searchCombined({
  latitude: 40.7128,
  longitude: -74.006,
  radius_meters: 5000,
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-06-30T23:59:59Z'
});
```

### Version History

```typescript
// List versions of a note
const versions = await api.versions.listVersions('note-id');

// Get specific version content
const version = await api.versions.getVersion('note-id', 2);

// Get diff between versions
const diff = await api.versions.diffVersions('note-id', 1, 2);

// Restore a previous version
await api.versions.restoreVersion('note-id', 2);
```

### Knowledge Health Dashboard

```typescript
// Get knowledge base health metrics
const health = await api.health.getKnowledgeHealth();
// Returns: total_notes, orphan_notes, stale_notes, unlinked_notes,
//          avg_links_per_note, tag_coverage, last_activity
```

### Templates

```typescript
// List all templates
const templates = await api.templates.list();

// Get template by ID
const template = await api.templates.get('template-id');

// Create a template
const newTemplate = await api.templates.create({
  name: 'Meeting Notes',
  content: '# Meeting: {{title}}\n\nDate: {{date}}\n\nAttendees:\n- {{attendees}}',
  default_tags: ['meetings']
});

// Update a template
await api.templates.update('template-id', {
  name: 'Updated Name'
});

// Delete a template
await api.templates.delete('template-id');

// Instantiate template with variables
const noteContent = await api.templates.instantiate('template-id', {
  title: 'Sprint Planning',
  date: '2024-01-15',
  attendees: 'Alice, Bob'
});
```

### Backup & Export

```typescript
// List available backups
const backups = await api.backup.listBackups();

// Create a backup
await api.backup.triggerBackup();

// Download a database backup
const blob = await api.backup.downloadDatabaseBackup('backup.db');

// Restore from backup
await api.backup.restoreDatabase({ filename: 'backup.db' });

// Export knowledge shard
const shard = await api.backup.exportKnowledgeShard({
  collection_id: 'collection-id'
});

// Import through the multipart, profile-gated recovery path
await api.backup.uploadKnowledgeShard(shardFile);
```

## Configuration

### Environment Variables

Create `.env.local` in the `ui/` directory:

```bash
# API Base URL (default: http://localhost:3000)
VITE_API_BASE_URL=http://localhost:3000

# For remote Fortemi environment:
VITE_API_BASE_URL=http://localhost:3000

# For production:
VITE_API_BASE_URL=https://api.fortemi.example.com
```

### Custom Client Instance

```typescript
import { createApi } from '@/api';

// Create client with custom base URL
const customApi = createApi('http://localhost:3000');

// Use as normal
const notes = await customApi.notes.list();
```

## Error Handling

The client provides typed error classes for different failure scenarios:

```typescript
import { api, isApiError, ApiError, NetworkError, ValidationError, NotFoundError } from '@/api';

try {
  const note = await api.notes.get('invalid-id');
} catch (error) {
  if (isApiError(error)) {
    // API-level error (HTTP 4xx/5xx)
    console.error('API Error:', error.statusCode, error.message);
    console.error('Response:', error.response);
  } else if (error instanceof NetworkError) {
    // Network failure (connection refused, timeout, etc.)
    console.error('Network Error:', error.message);
    console.error('Original Error:', error.originalError);
  } else if (error instanceof ValidationError) {
    // Validation error (400 with field errors)
    console.error('Validation Error:', error.message);
    console.error('Field Errors:', error.fields);
  } else if (error instanceof NotFoundError) {
    // Resource not found (404)
    console.error('Not Found:', error.resourceType, error.resourceId);
  } else {
    // Unknown error
    console.error('Unexpected Error:', error);
  }
}
```

## Retry Logic

The base HTTP client includes automatic retry logic with exponential backoff:

- **Retries**: 3 attempts by default
- **Backoff**: Exponential (1s, 2s, 4s, max 10s)
- **Retry Conditions**:
  - Network errors (connection failures, timeouts)
  - Server errors (5xx status codes)
- **No Retry**:
  - Client errors (4xx status codes)
  - Successful responses

## Type Safety

All API responses are fully typed:

```typescript
import type {
  NoteFull,
  NoteSummary,
  SearchResult,
  Tag,
  TagStats,
  NoteListOptions,
  SearchOptions,
} from '@/api';

// Type-safe note list
const notes: NoteSummary[] = await api.notes.list({
  sortBy: 'created_at',  // Type-checked
  limit: 50
});

// Type-safe search
const results: SearchResult[] = await api.search.search('query', {
  mode: 'hybrid',  // Type-checked: 'hybrid' | 'fts' | 'semantic'
});
```

## Testing

Run the test suite:

```bash
# All API tests
npm test -- src/api/__tests__ --run

# Specific module
npm test -- src/api/__tests__/notes.test.ts --run
npm test -- src/api/__tests__/search.test.ts --run
npm test -- src/api/__tests__/tags.test.ts --run

# With coverage
npm test -- src/api/__tests__ --coverage
```

## React Integration

Use with React Query for optimal caching and state management:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';

// Fetch notes
function useNotes(options) {
  return useQuery({
    queryKey: ['notes', options],
    queryFn: () => api.notes.list(options)
  });
}

// Create note
function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => api.notes.create({ content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    }
  });
}

// Search
function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search.search(query),
    enabled: query.length > 0
  });
}
```

## Architecture

### Modular Design

Each module (`notes`, `search`, `tags`) is created via factory functions that receive a base HTTP client. This enables:

- Easy mocking for tests
- Custom client configurations
- Composable API modules

### Request Flow

```
Component/Hook
    ↓
  api.notes.create()
    ↓
  notes.ts (validation, transform)
    ↓
  client.ts (HTTP, retry, errors)
    ↓
  fetch() → Fortemi API
```

### Error Flow

```
HTTP Error (4xx/5xx)
    ↓
  ApiError (with statusCode, response)
    ↓
  Component error handling

Network Failure
    ↓
  NetworkError (with originalError)
    ↓
  Component error handling (retry UI, offline mode, etc.)
```

## API Endpoints

All endpoints use the `/api/v1` prefix:

### Core Notes & Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/notes` | List notes |
| POST | `/api/v1/notes` | Create note |
| GET | `/api/v1/notes/:id` | Get note |
| PATCH | `/api/v1/notes/:id` | Update note |
| DELETE | `/api/v1/notes/:id` | Delete note |
| GET | `/api/v1/notes/:id/tags` | Get note tags |
| PATCH | `/api/v1/notes/:id/tags` | Update note tags |
| GET | `/api/v1/search` | Search notes |
| GET | `/api/v1/notes/:id/similar` | Find similar notes |
| GET | `/api/v1/tags` | List tags |
| POST | `/api/v1/tags` | Create tag |
| PATCH | `/api/v1/tags/:name` | Rename tag |
| DELETE | `/api/v1/tags/:name` | Delete tag |
| GET | `/api/v1/tags/stats` | Tag statistics |

### SKOS Concepts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/concepts/schemes` | List concept schemes |
| GET | `/api/v1/concepts/schemes/:id` | Get scheme details |
| GET | `/api/v1/concepts/schemes/:id/top` | Get top-level concepts |
| GET | `/api/v1/concepts` | List/search concepts |
| GET | `/api/v1/concepts/:id` | Get concept |
| GET | `/api/v1/concepts/:id/full` | Get concept with relations |
| GET | `/api/v1/concepts/:id/narrower` | Get child concepts |
| GET | `/api/v1/concepts/:id/broader` | Get parent concepts |
| GET | `/api/v1/concepts/:id/related` | Get related concepts |

### Attachments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notes/:id/attachments` | List note attachments |
| POST | `/api/v1/notes/:id/attachments` | Upload attachment |
| GET | `/api/v1/attachments/:id` | Get attachment metadata |
| GET | `/api/v1/attachments/:id/download` | Download attachment |
| DELETE | `/api/v1/attachments/:id` | Delete attachment |

### Memory Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/memory/location` | Search by location |
| GET | `/api/v1/memory/time` | Search by time range |
| GET | `/api/v1/memory/combined` | Combined spatiotemporal search |

### Versions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notes/:id/versions` | List note versions |
| GET | `/api/v1/notes/:id/versions/:version` | Get specific version |
| GET | `/api/v1/notes/:id/versions/diff` | Compare versions |
| POST | `/api/v1/notes/:id/versions/:version/restore` | Restore version |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/templates` | List templates |
| POST | `/api/v1/templates` | Create template |
| GET | `/api/v1/templates/:id` | Get template |
| PATCH | `/api/v1/templates/:id` | Update template |
| DELETE | `/api/v1/templates/:id` | Delete template |
| POST | `/api/v1/templates/:id/instantiate` | Instantiate template |

### Backup & Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/backup/list` | List backups |
| POST | `/api/v1/backup/trigger` | Create backup |
| GET | `/api/v1/backup/download/:filename` | Download backup |
| POST | `/api/v1/backup/restore` | Restore from backup |
| POST | `/api/v1/backup/export/shard` | Export knowledge shard |
| POST | `/api/v1/backup/import/shard` | Import knowledge shard |

### Health Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health/knowledge` | Knowledge health metrics |
| GET | `/api/v1/health/orphans` | List orphan notes |
| GET | `/api/v1/health/stale` | List stale notes |
| GET | `/api/v1/health/unlinked` | List unlinked notes |

## Best Practices

1. **Use React Query**: Wrap API calls in React Query hooks for caching, optimistic updates, and background refetching

2. **Handle Errors**: Always catch and handle API errors appropriately (show user feedback, retry logic, fallback UI)

3. **Type Everything**: Use TypeScript interfaces from `types.ts` for all request/response data

4. **Configure Base URL**: Set `VITE_API_BASE_URL` in `.env.local` for development, CI/CD for production

5. **Test with Mocks**: Use the factory functions to inject mock clients in tests

## Related Documentation

- [ADR-004: SPA Migration](../../../../.aiwg/architecture/adr/ADR-004-spa-migration.md) - Architecture decision for Fortemi integration
- [MVP Acceptance Criteria](../../../../.aiwg/requirements/mvp-acceptance-criteria-v2.md) - Feature requirements
- [Fortemi API Specification](../../../../docs/specifications/api-specification.md) - Full API documentation

## Maintainers

- Frontend Team (HotM SPA)
- Backend Team (Fortemi API)

For API changes, coordinate with the Fortemi team to ensure contract compatibility.
