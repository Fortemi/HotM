# matric-memory API Client

TypeScript API client for the matric-memory API used by HotM SPA.

## Overview

This directory contains a complete, production-ready API client for interacting with the matric-memory backend API. The client is organized into modular components with comprehensive error handling, retry logic, and TypeScript type safety.

## Structure

```
api/
├── client.ts         # Base HTTP client with retry logic
├── errors.ts         # Custom error types
├── types.ts          # TypeScript interfaces for API entities
├── notes.ts          # Notes CRUD operations
├── search.ts         # Search operations (FTS, semantic, hybrid)
├── tags.ts           # Tag management
├── index.ts          # Public exports and configured client
└── __tests__/        # Comprehensive test suite
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

## Configuration

### Environment Variables

Create `.env.local` in the `ui/` directory:

```bash
# API Base URL (default: http://localhost:3000)
VITE_API_BASE_URL=http://localhost:3000

# For remote server:
VITE_API_BASE_URL=http://titan:3000

# For production:
VITE_API_BASE_URL=https://api.example.com
```

### Custom Client Instance

```typescript
import { createApi } from '@/api';

// Create client with custom base URL
const customApi = createApi('http://custom-server:3000');

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
  fetch() → matric-memory API
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

## Best Practices

1. **Use React Query**: Wrap API calls in React Query hooks for caching, optimistic updates, and background refetching

2. **Handle Errors**: Always catch and handle API errors appropriately (show user feedback, retry logic, fallback UI)

3. **Type Everything**: Use TypeScript interfaces from `types.ts` for all request/response data

4. **Configure Base URL**: Set `VITE_API_BASE_URL` in `.env.local` for development, CI/CD for production

5. **Test with Mocks**: Use the factory functions to inject mock clients in tests

## Related Documentation

- [ADR-004: SPA Migration](../../../../.aiwg/architecture/adr/ADR-004-spa-migration.md) - Architecture decision for matric-memory integration
- [MVP Acceptance Criteria](../../../../.aiwg/requirements/mvp-acceptance-criteria-v2.md) - Feature requirements
- [matric-memory API Specification](../../../../docs/specifications/api-specification.md) - Full API documentation

## Maintainers

- Frontend Team (HotM SPA)
- Backend Team (matric-memory API)

For API changes, coordinate with the matric-memory team to ensure contract compatibility.
