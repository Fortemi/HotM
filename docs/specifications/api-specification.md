# API Specification v2 (Current Implementation)

## Overview
RESTful API with WebSocket and SSE support for HotM note management system with NLP enhancements and real-time job monitoring.

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
  "format": "markdown",          // Optional: plaintext | markdown | webclip
  "source": "manual",            // Optional: manual | import | clip | api
  "revision_mode": "standard",   // Optional: none | light | standard | contextual | contextual_filtered
  "document_type": "prose",      // Optional
  "context_filter": {            // Optional; required for contextual_filtered mode
    "tags": ["tag1"],
    "collection_id": null,
    "query": "optional fts query"
  },
  "processing": {                // Optional pipeline flags
    "autoTagConcepts": true,
    "generateEmbeddings": true,
    "autoLinkRelated": true,
    "extractMedia": false,
    "generateTitle": true
  }
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
GET /notes?sort_by=created_at&sort_order=desc&limit=50

Query Parameters:
- sort_by: created_at | updated_at | accessed_at (default: created_at)
- sort_order: asc | desc (default: desc)
- limit: number (default: 50, max: 200)
- offset: number (default: 0)
- starred: boolean — filter to starred notes only
- archived: boolean — filter to archived notes only
- tags: comma-separated tag names — filter by tags

Note: The `filter` enum parameter is not supported. Use `starred=true` or
`archived=true` boolean params instead.

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

#### Update Note
```http
PATCH /notes/{noteId}
Content-Type: application/json

{
  "content": "Updated content",   // Optional
  "starred": true,                // Optional
  "archived": false,              // Optional
  "metadata": {}                  // Optional
}

Response: 200 OK
```

This single PATCH endpoint handles both content updates (revision creation) and
field updates. `updateRevision()` and `updateOriginalContent()` in the client
both call `PATCH /notes/{noteId}`.

#### Update Note Status
```http
PATCH /notes/{noteId}/status
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

#### Delete Note
```http
DELETE /notes/{id}

Response: 200 OK
{
  "status": "deleted",
  "note_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Reprocess Note (AI Regeneration)
```http
POST /notes/{noteId}/reprocess
Content-Type: application/json

// Body is optional. All fields are optional.
{
  "revision_mode": "standard",   // none | light | standard | contextual | contextual_filtered
  "model": "llama3.2",           // Override inference model
  "context_filter": {            // Required for contextual_filtered mode
    "tags": ["tag1"],
    "collection_id": null,
    "query": "optional fts"
  },
  "processing": {
    "autoTagConcepts": true,
    "generateEmbeddings": true,
    "autoLinkRelated": true,
    "extractMedia": false,
    "generateTitle": true
  },
  "job_types": ["ai_revision", "embedding"]  // Limit which jobs are queued
}

Response: 200 OK
{
  "status": "ok",
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_ids": [
    "cc0e8400-e29b-41d4-a716-446655440000",
    "dd0e8400-e29b-41d4-a716-446655440000"
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
GET /search?q=search+terms&mode=hybrid

Query Parameters:
- q: Search query (required)
- mode: hybrid | fts | semantic (default: hybrid)
- tags: comma-separated tag names
- concepts: comma-separated concept IDs
- starred: boolean
- archived: boolean
- collection: collection ID
- before: ISO 8601 date
- after: ISO 8601 date
- filters: additional filter expression
- limit: number
- offset: number

Response: 200 OK
{
  "results": [
    {
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.95,
      "snippet": "...matching content snippet...",
      "title": "Note title",
      "tags": ["api"],
      "source": "manual"
    }
  ],
  "total": 5
}
```

#### Semantic Search
```http
POST /semantic
Content-Type: application/json

{
  "text": "Search query for semantic similarity",
  "limit": 10,
  "threshold": 0.7
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

#### Federated Search
```http
POST /search/federated
Content-Type: application/json

{
  "q": "search query",
  "memories": ["archive-name-1", "archive-name-2"],  // or ["all"] to search all archives
  "limit": 10
}

Response: 200 OK
{
  "results": [
    {
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.92,
      "snippet": "Result snippet...",
      "title": "Note title",
      "tags": ["api"],
      "memory": "archive-name-1"
    }
  ],
  "query": "search query",
  "total": 3,
  "memories_searched": ["archive-name-1", "archive-name-2"]
}
```

#### Generate Search Context
```http
POST /search/context
Content-Type: application/json

{
  "query": "search query",
  "hits": [
    { "note_id": "...", "score": 0.9, "snippet": "..." }
  ]
}

Response: 200 OK
{
  "context": "LLM-generated summary of the search results..."
}
```

### Tags and Labels

#### Update Note Tags
```http
PUT /notes/{id}/tags
Content-Type: application/json

{
  "tags": ["tag1", "tag2", "tag3"]
}

// Or with add/remove diff:
PATCH /notes/{id}/tags
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
GET /tags

Response: 200 OK
{
  "tags": [
    { "name": "api", "count": 5 },
    { "name": "documentation", "count": 3 }
  ]
}
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

Manual link mutation is not present in the pinned Fortemi OpenAPI or current
router. HotM does not advertise or dispatch the historical POST/DELETE routes;
replacement contract work is tracked in #294.

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
  "job_type": "ai_revision",  // ai_revision | embedding | linking | context_update | title_generation
  "priority": 5  // 1-10, higher = more urgent
}

Response: 201 Created
{
  "job_id": "440e8400-e29b-41d4-a716-446655440000",
  "estimated_duration_ms": 5000,
  "queue_position": 3
}
```

#### List Jobs
```http
GET /jobs?status=pending&limit=50&offset=0&archive=my-archive

Query Parameters:
- status: filter by job status string
- limit: number
- offset: number
- archive: restrict to a specific archive/memory

Response: 200 OK
{
  "jobs": [
    {
      "id": "440e8400-e29b-41d4-a716-446655440000",
      "job_type": "ai_revision",
      "status": "pending",
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "priority": 5,
      "progress_percent": 0,
      "progress_message": null,
      "error_message": null,
      "created_at": "2025-01-01T12:00:00Z",
      "started_at": null,
      "completed_at": null,
      "retry_count": 0,
      "max_retries": 3
    }
  ],
  "total": 12
}
```

#### Get Job Queue Stats
```http
GET /jobs/stats?archive=my-archive

Response: 200 OK
{
  "pending": 4,
  "processing": 1,
  "completed_last_hour": 12,
  "failed_last_hour": 0,
  "total": 17
}
```

#### Get Queue Pause Status
```http
GET /jobs/status

Response: 200 OK
{
  "global": "running",   // "running" | "paused"
  "archives": {
    "my-archive": "paused"
  },
  "queue": {
    "pending": 4,
    "running": 1
  }
}
```

#### Pause / Resume Job Processing (Global)
```http
POST /jobs/pause

Response: 200 OK
{
  "status": "paused",
  "scope": "global"
}
```

```http
POST /jobs/resume

Response: 200 OK
{
  "status": "resumed",
  "scope": "global"
}
```

#### Pause / Resume Job Processing (Archive-scoped)
```http
POST /jobs/pause/{archive}

POST /jobs/resume/{archive}

Response: 200 OK
{
  "status": "paused",   // or "resumed"
  "scope": "archive",
  "archive": "my-archive"
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

#### Get Pending Jobs
```http
GET /jobs/pending

Response: 200 OK
{
  "pending": 4
}
// or an array of job objects
```

#### Cancel Job
```http
POST /jobs/{job_id}/cancel
// Falls back to DELETE /jobs/{job_id} if cancel endpoint unavailable

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

### Archives (Multi-Memory)

Archives are isolated PostgreSQL schemas that each act as a separate note store ("memory"). Routing to a specific archive is done via the `X-Memory` header.

#### List Archives
```http
GET /archives

Response: 200 OK
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "personal",
    "schema_name": "memory_personal",
    "description": "Personal notes",
    "created_at": "2025-01-01T12:00:00Z",
    "last_accessed": "2025-01-10T08:00:00Z",
    "note_count": 142,
    "size_bytes": 1048576,
    "is_default": true,
    "schema_version": 1
  }
]
```

#### Get Archive
```http
GET /archives/{name}

Response: 200 OK
{ /* MemoryArchive object */ }
```

#### Create Archive
```http
POST /archives
Content-Type: application/json

{
  "name": "work",
  "description": "Work-related notes"
}

Response: 201 Created
{
  "id": "...",
  "name": "work",
  "schema_name": "memory_work"
}
```

#### Update Archive
```http
PATCH /archives/{name}
Content-Type: application/json

{
  "description": "Updated description"
}

Response: 204 No Content
```

#### Delete Archive
```http
DELETE /archives/{name}

Response: 204 No Content
```

#### Set Default Archive
```http
POST /archives/{name}/set-default

Response: 200 OK
```

#### Get Archive Stats
```http
GET /archives/{name}/stats

Response: 200 OK
{
  "name": "personal",
  "note_count": 142,
  "size_bytes": 1048576,
  "schema_name": "memory_personal"
}
```

#### Clone Archive
```http
POST /archives/{name}/clone
Content-Type: application/json

{
  "new_name": "personal-backup",
  "description": "Backup copy"
}

Response: 201 Created
{
  "id": "...",
  "name": "personal-backup",
  "schema_name": "memory_personal_backup",
  "cloned_from": "personal"
}
```

### Chat / Agent

#### Send Message
```http
POST /chat
Content-Type: application/json

{
  "input": "Summarize my notes about API design",
  "context": {                          // Optional
    "note_id": "550e8400-...",
    "collection_id": "...",
    "search_query": "api design",
    "conversation_history": [
      { "role": "user", "content": "Previous message", "timestamp": "..." },
      { "role": "assistant", "content": "Previous reply", "timestamp": "..." }
    ]
  }
}

Response: 200 OK
{
  "messages": [
    {
      "role": "assistant",
      "content": "Here is a summary of your API design notes...",
      "timestamp": "2025-01-01T12:00:00Z"
    }
  ],
  "actions": [
    {
      "type": "navigate",
      "payload": { "note_id": "550e8400-..." }
    }
  ]
}
```

#### Get Available Chat Models
```http
GET /chat/models

Response: 200 OK
{
  "models": [
    {
      "model": "llama3.2",
      "context_window": 128000,
      "max_output_tokens": 4096,
      "supports_thinking": false,
      "thinking_type": "none",
      "speed_tok_s": 45.2,
      "parameter_size": "3B",
      "family": "llama",
      "size_bytes": 2000000000
    }
  ],
  "default_model": "llama3.2"
}
```

### Webhooks

#### List Webhooks
```http
GET /webhooks

Response: 200 OK
{
  "webhooks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com/hook",
      "events": ["note.created", "note.updated"],
      "is_active": true,
      "created_at": "2025-01-01T12:00:00Z",
      "updated_at": "2025-01-01T12:00:00Z",
      "last_triggered_at": null,
      "failure_count": 0,
      "max_retries": 3
    }
  ]
}
// or an array of webhook objects
```

#### Get Webhook
```http
GET /webhooks/{webhookId}

Response: 200 OK
{ /* Webhook object */ }
```

#### Register Webhook
```http
POST /webhooks
Content-Type: application/json

{
  "url": "https://example.com/hook",
  "secret": "optional-signing-secret",
  "events": ["note.created", "note.updated", "job.completed"],
  "max_retries": 3
}

Response: 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/hook",
  "events": ["note.created", "note.updated", "job.completed"],
  "is_active": true,
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:00:00Z",
  "last_triggered_at": null,
  "failure_count": 0,
  "max_retries": 3
}
```

#### Update Webhook
```http
PATCH /webhooks/{webhookId}
Content-Type: application/json

{
  "url": "https://example.com/hook-v2",   // Optional
  "secret": "new-secret",                  // Optional
  "events": ["note.created"],              // Optional
  "is_active": false,                      // Optional
  "max_retries": 5                         // Optional
}

Response: 200 OK
{ /* Updated Webhook object */ }
```

#### Delete Webhook
```http
DELETE /webhooks/{webhookId}

Response: 204 No Content
```

#### List Webhook Deliveries
```http
GET /webhooks/{webhookId}/deliveries

Response: 200 OK
{
  "deliveries": [
    {
      "id": "...",
      "webhook_id": "550e8400-...",
      "event_type": "note.created",
      "payload": { "note_id": "..." },
      "status_code": 200,
      "response_body": "ok",
      "delivered_at": "2025-01-01T12:01:00Z",
      "success": true
    }
  ]
}
// or an array of delivery objects
```

#### Test Webhook
```http
POST /webhooks/{webhookId}/test

Response: 200 OK
{ /* WebhookDelivery object */ }
```

### Inference Configuration

#### Get Inference Config
```http
GET /inference/config

Response: 200 OK
{
  "default_backend": "ollama",
  "providers": ["ollama", "openai"],
  "ollama": {
    "base_url": { "value": "http://localhost:11434", "source": "default" },
    "generation_model": { "value": "llama3.2", "source": "env" },
    "embedding_model": { "value": "nomic-embed-text", "source": "default" }
  },
  "openai": null,
  "llamacpp": null
}

// source values: "db_override" | "env" | "default"
```

#### Update Inference Config
```http
POST /inference/config
Content-Type: application/json

// All fields optional (partial merge + hot-swap)
{
  "ollama": {
    "base_url": "http://localhost:11434",
    "generation_model": "llama3.2",
    "embedding_model": "nomic-embed-text"
  },
  "openai": {
    "base_url": "https://api.openai.com",
    "api_key": "sk-...",
    "generation_model": "gpt-4o",
    "embedding_model": "text-embedding-3-small"
  }
}

// With validation:
POST /inference/config?validate=true

Response: 200 OK
{ /* Updated InferenceConfig object */ }
```

#### Reset Inference Config
```http
DELETE /inference/config

Removes all DB overrides, reverting to env/default values.

Response: 204 No Content
```

#### Test Inference Connection
```http
POST /inference/test-connection
Content-Type: application/json

{
  "base_url": "http://localhost:11434",
  "provider": "auto",     // Optional: auto | ollama | openai
  "api_key": null,        // Optional
  "timeout_secs": 10      // Optional
}

Response: 200 OK (reachable)
{
  "reachable": true,
  "detected_provider": "ollama",
  "ollama_version": "0.3.12",
  "available_models": ["llama3.2", "nomic-embed-text"],
  "latency_ms": 45,
  "capabilities": {
    "generation": true,
    "embedding": true,
    "vision": false
  }
}

Response: 200 OK (unreachable)
{
  "reachable": false,
  "detected_provider": null,
  "error": "Connection refused",
  "suggestions": ["Ensure Ollama is running", "Check the base URL"]
}
```

## Server-Sent Events (SSE)

### Connection
```http
GET /events?types=note,job,queue&last_event_id=<cursor>

Query Parameters:
- types: comma-separated type prefixes for server-side filtering
         (e.g., "note,job,queue,collection,tag,concept,archive")
- last_event_id: replay cursor for reconnection (resume from last seen event)

Response: 200 OK  text/event-stream
```

The client automatically reconnects on disconnect using exponential backoff (1s → 2s → 4s → max 15s).

### Event Envelope Format
Events may be delivered as a flat JSON object or in the SSE EventEnvelope format:

```json
{
  "type": "note.updated",
  "payload": {
    "note_id": "550e8400-...",
    "title": "Updated title"
  },
  "metadata": {
    "actor": "user",
    "memory": "personal",
    "correlation_id": "...",
    "occurred_at": "2025-01-01T12:00:00Z"
  }
}
```

### Supported Event Types

**Job lifecycle** (PascalCase WebSocket legacy / dot-notation SSE):
- `JobQueued` / `job.queued`
- `JobStarted` / `job.started`
- `JobProgress` / `job.progress`
- `JobCompleted` / `job.completed`
- `JobFailed` / `job.failed`
- `JobsPaused` / `jobs.paused`
- `JobsResumed` / `jobs.resumed`
- `QueueStatus` / `queue.status`

**Note lifecycle**:
- `NoteCreated` / `note.created`
- `NoteUpdated` / `note.updated`
- `NoteDeleted` / `note.deleted`
- `note.tags.updated`
- `note.links.updated`
- `note.revision.created`

**SKOS concepts**:
- `concept.created`, `concept.updated`, `concept.deleted`
- `concept.scheme.created`, `concept.scheme.updated`, `concept.scheme.deleted`
- `concept.relations.updated`, `concept.scheme.changed`
- `concept.collection.membership.changed`

**Tag governance**:
- `tag.created`, `tag.renamed`, `tag.deleted`, `tag.merged`, `tag.stats.updated`

**Search index materialization**:
- `index.embedding.updated`, `index.linking.updated`, `index.fts.updated`
- `readmodel.search.ready`, `readmodel.graph.updated`

**Attachments**:
- `attachment.extraction.updated`

**Resilience signals**:
- `resync_required` — client should reload state
- `events.lagged` — SSE stream fell behind; client should resync

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
- **204 No Content**: Success with no body
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
- **v1.2**: Added SSE `/events`, Archives API, Chat API, Webhooks API, Inference config API
- **v2.0**: Will add authentication, rate limiting, pagination
