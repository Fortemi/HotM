# API Specification

## Overview
RESTful API for HotM note management system with NLP enhancements.

**Base URL**: `http://127.0.0.1:53211/api/v1`  
**Protocol**: HTTP/1.1+  
**Content-Type**: `application/json`  
**Authentication**: Bearer token (future)

## Authentication (v0.2.0+)

### Admin Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "secure_password"
}

Response: 200 OK
{
  "token": "jwt_token_here",
  "expires_at": "2025-01-01T00:00:00Z"
}
```

### Generate API Key
```http
POST /auth/api-keys
Authorization: Bearer {admin_token}

{
  "name": "My Integration",
  "expires_in_days": 90
}

Response: 201 Created
{
  "key_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_key": "hotm_ak_...",
  "expires_at": "2025-04-01T00:00:00Z"
}
```

## Core Endpoints

### Health Check
```http
GET /health

Response: 200 OK
{
  "ok": true,
  "db": true,
  "vector": true,
  "ollama": true,
  "version": "0.1.2"
}
```

### Notes

#### Create Note
```http
POST /notes
Content-Type: application/json

{
  "content": "My note content here",
  "format": "markdown",  // plaintext | markdown | webclip
  "source": "manual"      // manual | import | clip | api
}

Response: 201 Created
{
  "noteId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Get Note
```http
GET /notes/{id}

Response: 200 OK
{
  "note": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "collection_id": "660e8400-e29b-41d4-a716-446655440000",
    "format": "markdown",
    "source": "manual",
    "created_at_utc": "2025-01-01T12:00:00Z",
    "updated_at_utc": "2025-01-01T12:00:00Z"
  },
  "original": {
    "content": "Original content",
    "hash": "sha256_hash"
  },
  "revised": {
    "content": "Enhanced content with improvements",
    "last_revision_id": "770e8400-e29b-41d4-a716-446655440000"
  },
  "tags": ["work", "project-x", "meeting"],
  "links": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "from_note_id": "550e8400-e29b-41d4-a716-446655440000",
      "to_note_id": "990e8400-e29b-41d4-a716-446655440000",
      "to_url": null,
      "kind": "related",
      "score": 0.85,
      "created_at_utc": "2025-01-01T12:05:00Z"
    }
  ]
}
```

#### Update Revised Content
```http
PUT /notes/{id}/revised
Content-Type: application/json

{
  "content": "Manually edited revision",
  "rationale": "Corrected technical details"
}

Response: 200 OK
{
  "revisionId": "aa0e8400-e29b-41d4-a716-446655440000",
  "revisedContent": "Manually edited revision"
}
```

#### Delete Note
```http
DELETE /notes/{id}

Response: 204 No Content
```

### Search

#### Hybrid Search
```http
GET /search?q=machine+learning&mode=hybrid&limit=20

Query Parameters:
- q: Search query (required)
- mode: hybrid | fts | vector (default: hybrid)
- limit: Max results (default: 20, max: 100)
- offset: Pagination offset (default: 0)
- tag: Filter by tag (repeatable)
- collection: Filter by collection ID
- before: ISO 8601 date
- after: ISO 8601 date

Response: 200 OK
{
  "hits": [
    {
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.95,
      "snippet": "...machine learning algorithms..."
    }
  ],
  "total": 42,
  "query": "machine learning",
  "mode": "hybrid"
}
```

#### Semantic Search
```http
POST /semantic
Content-Type: application/json

{
  "text": "How do neural networks learn?",
  "limit": 10,
  "threshold": 0.7
}

Response: 200 OK
{
  "similar": [
    {
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.92,
      "snippet": "Neural networks learn through backpropagation..."
    }
  ]
}
```

### Tags

#### Create Tag
```http
POST /tags
Content-Type: application/json

{
  "name": "machine-learning"
}

Response: 201 Created
{
  "name": "machine-learning"
}
```

#### List Tags
```http
GET /tags

Response: 200 OK
{
  "tags": [
    {
      "name": "machine-learning",
      "count": 42
    }
  ]
}
```

#### Update Note Tags
```http
PUT /notes/{id}/tags
Content-Type: application/json

{
  "add": ["ai", "research"],
  "remove": ["draft"]
}

Response: 200 OK
{
  "tags": ["ai", "research", "machine-learning"]
}
```

### Collections

#### Create Collection
```http
POST /collections
Content-Type: application/json

{
  "name": "Research Papers",
  "description": "Academic research and papers"
}

Response: 201 Created
{
  "collectionId": "660e8400-e29b-41d4-a716-446655440000"
}
```

#### List Collections
```http
GET /collections

Response: 200 OK
{
  "collections": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Research Papers",
      "description": "Academic research and papers",
      "note_count": 23
    }
  ]
}
```

#### Assign Note to Collection
```http
PUT /notes/{id}/collection
Content-Type: application/json

{
  "collectionId": "660e8400-e29b-41d4-a716-446655440000"
}

Response: 200 OK
{
  "collectionId": "660e8400-e29b-41d4-a716-446655440000"
}
```

### Links

#### Create Link
```http
POST /notes/{id}/links
Content-Type: application/json

{
  "toNoteId": "990e8400-e29b-41d4-a716-446655440000",
  "toUrl": null,
  "kind": "reference",  // related | mention | reference | task
  "score": 0.85
}

Response: 201 Created
{
  "linkId": "880e8400-e29b-41d4-a716-446655440000"
}
```

#### Get Note Links
```http
GET /notes/{id}/links

Response: 200 OK
{
  "links": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "to_note_id": "990e8400-e29b-41d4-a716-446655440000",
      "to_url": null,
      "kind": "reference",
      "score": 0.85,
      "created_at_utc": "2025-01-01T12:05:00Z"
    }
  ]
}
```

### Provenance

#### Get Provenance
```http
GET /notes/{id}/provenance

Response: 200 OK
{
  "revisions": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "parent_revision_id": null,
      "created_at_utc": "2025-01-01T12:00:00Z",
      "type": "auto",
      "summary": "Initial revision",
      "rationale": "Automatic enhancement on creation"
    }
  ],
  "edges": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440000",
      "revision_id": "770e8400-e29b-41d4-a716-446655440000",
      "source_note_id": "cc0e8400-e29b-41d4-a716-446655440000",
      "source_url": null,
      "relation": "derived_from",
      "created_at_utc": "2025-01-01T12:00:00Z"
    }
  ]
}
```

## WebSocket Events

### Connection
```javascript
ws://127.0.0.1:53211/api/v1/events

// Subscribe to events
{
  "type": "subscribe",
  "channels": ["notes", "jobs"]
}
```

### Event Types
```javascript
// Note created
{
  "type": "note.created",
  "data": {
    "noteId": "550e8400-e29b-41d4-a716-446655440000"
  }
}

// NLP processing progress
{
  "type": "job.progress",
  "data": {
    "jobId": "dd0e8400-e29b-41d4-a716-446655440000",
    "noteId": "550e8400-e29b-41d4-a716-446655440000",
    "stage": "revision",
    "progress": 0.5
  }
}

// Processing complete
{
  "type": "job.complete",
  "data": {
    "jobId": "dd0e8400-e29b-41d4-a716-446655440000",
    "noteId": "550e8400-e29b-41d4-a716-446655440000",
    "result": "success"
  }
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Note not found",
    "details": {
      "note_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|------------|-------------|
| BAD_REQUEST | 400 | Invalid request format |
| UNAUTHORIZED | 401 | Missing or invalid auth |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Dependency unavailable |

## Rate Limiting

Headers included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1609459200
```

## Pagination

Standard pagination for list endpoints:
```http
GET /endpoint?limit=20&offset=40

Response includes:
{
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 40,
    "has_more": true
  }
}
```