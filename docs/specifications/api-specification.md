# API Specification v2 (Current Implementation)

## Overview
RESTful API with WebSocket support for HotM note management system with NLP enhancements and real-time job monitoring.

**Base URL**: `http://127.0.0.1:53211/api/v1`  
**WebSocket URL**: `ws://127.0.0.1:53211/api/v1/ws`  
**Protocol**: HTTP/1.1+ with WebSocket upgrade  
**Content-Type**: `application/json`  
**Authentication**: None currently (v0.2.0+ will add Bearer token)

## Core Endpoints

### Health Check
```http
GET /health

Response: 200 OK
{
  "ok": true,
  "db": true,
  "vector": true,
  "ollama": true
}
```

### Notes Management

#### Create Note
```http
POST /notes
Content-Type: application/json

{
  "content": "My note content here",
  "format": "markdown",  // Optional: plaintext | markdown | webclip
  "source": "manual"      // Optional: manual | import | clip | api
}

Response: 201 Created
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000"
}

Side Effects:
- Queues AI revision job (priority: 5)
- Queues embedding generation job (priority: 3)
- Queues link detection job (priority: 2)
```

#### Get Note (Full)
```http
GET /notes/{id}

Response: 200 OK
{
  "note": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "collection_id": null,
    "format": "markdown",
    "source": "manual",
    "created_at_utc": "2025-01-01T12:00:00Z",
    "updated_at_utc": "2025-01-01T12:00:00Z",
    "starred": false,
    "archived": false,
    "last_accessed_at": "2025-01-01T12:05:00Z",
    "metadata": {}
  },
  "original": {
    "content": "Original content",
    "hash": "sha256_hash",
    "user_created_at": "2025-01-01T12:00:00Z",
    "user_last_edited_at": "2025-01-01T12:00:00Z"
  },
  "revised": {
    "content": "Enhanced content with improvements",
    "last_revision_id": "660e8400-e29b-41d4-a716-446655440000",
    "ai_metadata": {
      "categories": ["Technology", "Documentation"],
      "topics": ["API Design", "REST", "WebSockets"],
      "entities": {
        "people": [],
        "organizations": ["HotM"],
        "technologies": ["HTTP", "WebSocket", "JSON"],
        "locations": []
      },
      "summary": "API specification document...",
      "keywords": ["api", "rest", "websocket"]
    },
    "ai_generated_at": "2025-01-01T12:01:00Z",
    "user_last_edited_at": null,
    "is_user_edited": false,
    "generation_count": 1
  },
  "tags": ["api", "documentation", "technical"],
  "links": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "from_note_id": "550e8400-e29b-41d4-a716-446655440000",
      "to_note_id": "880e8400-e29b-41d4-a716-446655440000",
      "to_url": null,
      "kind": "semantic",
      "score": 0.85,
      "created_at_utc": "2025-01-01T12:02:00Z",
      "snippet": "Related content snippet...",
      "metadata": null
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "from_note_id": "550e8400-e29b-41d4-a716-446655440000",
      "to_note_id": "aa0e8400-e29b-41d4-a716-446655440000",
      "to_url": null,
      "kind": "keyword",
      "score": 0.5,
      "created_at_utc": "2025-01-01T12:02:00Z",
      "snippet": "Keyword match snippet...",
      "metadata": {
        "keywords": ["api", "specification"]
      }
    }
  ]
}
```

#### List Notes
```http
GET /notes?sort_by=created_at&sort_order=desc&filter=all&limit=50

Query Parameters:
- sort_by: created_at | updated_at | accessed_at (default: created_at)
- sort_order: asc | desc (default: desc)
- filter: all | starred | archived | recent (default: all)
- limit: number (default: 50, max: 200)

Response: 200 OK
{
  "notes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "First line of content (max 50 chars)",
      "snippet": "First 200 characters of content...",
      "created_at_utc": "2025-01-01T12:00:00Z",
      "updated_at_utc": "2025-01-01T12:00:00Z",
      "starred": false,
      "archived": false,
      "tags": ["api", "documentation"],
      "has_revision": true,
      "metadata": {}
    }
  ],
  "total": 42
}
```

#### Update Note Status
```http
PUT /notes/{id}/status
Content-Type: application/json

{
  "starred": true,
  "archived": false
}

Response: 200 OK
{
  "status": "updated",
  "note_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Update Note Revision
```http
PUT /notes/{id}/revised
Content-Type: application/json

{
  "content": "Updated revised content",
  "rationale": "Manual improvement"
}

Response: 200 OK
{
  "revision_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "revised_content": "Updated revised content"
}
```

#### Delete Note
```http
DELETE /notes/{id}

Response: 200 OK
{
  "status": "deleted",
  "note_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Regenerate AI Enhancement
```http
POST /notes/{id}/regenerate-ai

Response: 200 OK
{
  "status": "regenerating",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_ids": [
    "cc0e8400-e29b-41d4-a716-446655440000",
    "dd0e8400-e29b-41d4-a716-446655440000",
    "ee0e8400-e29b-41d4-a716-446655440000"
  ]
}

Side Effects:
- Queues AI revision job (priority: 8)
- Queues embedding generation job (priority: 5)
- Queues link detection job (priority: 3)
```

### Search

#### Hybrid Search
```http
GET /search?q=search+terms&mode=hybrid&filters=tag:api

Query Parameters:
- q: Search query (required)
- mode: hybrid | fts | semantic (default: hybrid)
- filters: Filter expression (optional)

Response: 200 OK
{
  "notes": [
    {
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.95,
      "snippet": "...matching content snippet..."
    }
  ]
}
```

#### Semantic Search
```http
POST /semantic
Content-Type: application/json

{
  "text": "Search query for semantic similarity"
}

Response: 200 OK
{
  "similar": [
    {
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.89,
      "snippet": "Similar content..."
    }
  ]
}
```

### Tags and Labels

#### Update Note Tags
```http
PUT /notes/{id}/tags
Content-Type: application/json

{
  "add": ["new-tag", "another-tag"],
  "remove": ["old-tag"]
}

Response: 200 OK
{
  "tags": ["new-tag", "another-tag", "existing-tag"]
}
```

#### Get All Labels
```http
GET /labels

Response: 200 OK
["api", "documentation", "technical", "tutorial", "reference"]
```

#### Add Metadata Label
```http
POST /notes/{id}/labels
Content-Type: application/json

{
  "label": "Important",
  "color": "#FF5733"
}

Response: 201 Created
{
  "id": "ff0e8400-e29b-41d4-a716-446655440000",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "label": "Important",
  "color": "#FF5733",
  "created_at": "2025-01-01T12:00:00Z"
}
```

#### Remove Metadata Label
```http
DELETE /notes/{note_id}/labels/{label_id}

Response: 200 OK
{
  "status": "removed",
  "label_id": "ff0e8400-e29b-41d4-a716-446655440000"
}
```

### Links

#### Create Manual Link
```http
POST /notes/{id}/links
Content-Type: application/json

{
  "to_note_id": "110e8400-e29b-41d4-a716-446655440000"
}

Response: 201 Created
{
  "status": "created",
  "link_id": "220e8400-e29b-41d4-a716-446655440000",
  "from_note_id": "550e8400-e29b-41d4-a716-446655440000",
  "to_note_id": "110e8400-e29b-41d4-a716-446655440000",
  "rows_affected": 1
}
```

#### Get Related Notes
```http
GET /notes/{id}/related

Response: 200 OK
{
  "related": [
    {
      "note_id": "330e8400-e29b-41d4-a716-446655440000",
      "score": 0.92,
      "snippet": "Related content..."
    }
  ],
  "context_summary": "These notes are related because they discuss similar API concepts..."
}
```

### Job Queue

#### Queue a Job
```http
POST /jobs
Content-Type: application/json

{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_type": "ai_revision",  // ai_revision | embedding | linking | context_update
  "priority": 5  // 1-10, higher = more urgent
}

Response: 201 Created
{
  "job_id": "440e8400-e29b-41d4-a716-446655440000",
  "estimated_duration_ms": 5000,
  "queue_position": 3
}
```

#### Get Job Status
```http
GET /jobs/{job_id}

Response: 200 OK
{
  "id": "440e8400-e29b-41d4-a716-446655440000",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_type": "ai_revision",
  "status": "running",  // pending | running | completed | failed | cancelled
  "progress_percent": 65,
  "error_message": null,
  "estimated_duration_ms": 5000,
  "actual_duration_ms": 3200,
  "created_at": "2025-01-01T12:00:00Z",
  "started_at": "2025-01-01T12:00:05Z",
  "completed_at": null
}
```

#### Get Queue Status
```http
GET /jobs/queue

Response: 200 OK
[
  {
    "id": "440e8400-e29b-41d4-a716-446655440000",
    "note_id": "550e8400-e29b-41d4-a716-446655440000",
    "note_title": "API Specification",
    "job_type": "ai_revision",
    "status": "running",
    "progress_percent": 65,
    "estimated_duration_ms": 5000,
    "remaining_ms": 1800,
    "queue_wait_ms": 0
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "note_id": "660e8400-e29b-41d4-a716-446655440000",
    "note_title": "Testing Strategy",
    "job_type": "embedding",
    "status": "pending",
    "progress_percent": 0,
    "estimated_duration_ms": 3000,
    "remaining_ms": 3000,
    "queue_wait_ms": 1800
  }
]
```

#### Cancel Job
```http
POST /jobs/{job_id}/cancel

Response: 200 OK
{
  "status": "cancelled",
  "job_id": "440e8400-e29b-41d4-a716-446655440000"
}
```

#### Get Jobs for Note
```http
GET /notes/{note_id}/jobs

Response: 200 OK
[
  {
    "id": "440e8400-e29b-41d4-a716-446655440000",
    "note_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_type": "ai_revision",
    "status": "completed",
    "progress_percent": 100,
    "created_at": "2025-01-01T12:00:00Z",
    "completed_at": "2025-01-01T12:00:08Z"
  }
]
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:53211/api/v1/ws');
```

### Message Types

#### Client Messages
```javascript
// Request queue status
ws.send('refresh');
```

#### Server Messages

##### Queue Status
```json
{
  "type": "QueueStatus",
  "total_jobs": 5,
  "running": 1,
  "pending": 4,
  "active_job": {
    "job_id": "440e8400-e29b-41d4-a716-446655440000",
    "job_type": "AiRevision",
    "progress_percent": 65,
    "message": "Generating enhanced content",
    "started_at": "2025-01-01T12:00:05Z"
  }
}
```

##### Job Queued
```json
{
  "type": "JobQueued",
  "job_id": "440e8400-e29b-41d4-a716-446655440000",
  "job_type": "AiRevision",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "priority": 5
}
```

##### Job Started
```json
{
  "type": "JobStarted",
  "job_id": "440e8400-e29b-41d4-a716-446655440000",
  "job_type": "AiRevision",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "estimated_duration_ms": 5000
}
```

##### Job Progress
```json
{
  "type": "JobProgress",
  "job_id": "440e8400-e29b-41d4-a716-446655440000",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "progress_percent": 65,
  "message": "Generating enhanced content"
}
```

##### Job Completed
```json
{
  "type": "JobCompleted",
  "job_id": "440e8400-e29b-41d4-a716-446655440000",
  "job_type": "AiRevision",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "duration_ms": 4800
}
```

##### Job Failed
```json
{
  "type": "JobFailed",
  "job_id": "440e8400-e29b-41d4-a716-446655440000",
  "job_type": "AiRevision",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "error": "Failed to connect to Ollama",
  "retry_count": 1
}
```

##### Note Updated
```json
{
  "type": "NoteUpdated",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "API Specification",
  "tags": ["api", "documentation"],
  "has_ai_content": true,
  "has_links": true
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

### HTTP Status Codes
- **200 OK**: Success
- **201 Created**: Resource created
- **400 Bad Request**: Invalid request data
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Ollama or database unavailable

## Rate Limiting (Future)
- **Default**: 100 requests per minute
- **Search**: 30 requests per minute
- **AI Operations**: 10 requests per minute

## Pagination (Future)
```http
GET /notes?page=1&per_page=20

Response Headers:
X-Total-Count: 142
X-Page: 1
X-Per-Page: 20
Link: <http://localhost:53211/api/v1/notes?page=2>; rel="next"
```

## Version History
- **v1.0**: Initial release (current)
- **v1.1**: Added WebSocket support, job queue
- **v2.0**: Will add authentication, rate limiting, pagination