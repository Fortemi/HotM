# HotM Agent Guide

Reference for AI agents and automated tooling interacting with HotM and the Fortemi API it wraps.

## Overview

HotM provides a React UI over Fortemi — a Rust HTTP API with PostgreSQL + pgvector storage, NLP pipelines, and an embedded MCP server. Agents can interact at two levels:

| Level | How | Best for |
|-------|-----|----------|
| **MCP** | Connect to the Fortemi MCP server | Claude, Cursor, VS Code Copilot |
| **REST API** | HTTP requests to `http://127.0.0.1:PORT/api/v1` | Automation, scripts, pipelines |

## MCP Server

Fortemi ships an embedded MCP server (stdio transport) that exposes the full knowledge base as MCP tools.

### Available MCP Tools

See [`docs/mcp_tools.json`](../mcp_tools.json) for the full schema. Key tools:

| Tool | Description |
|------|-------------|
| `create_note` | Create a new note (triggers NLP pipeline) |
| `get_note` | Retrieve a note by ID with its revision |
| `search_notes` | Hybrid search (full-text + semantic) |
| `list_notes` | List notes with filter/sort/pagination |
| `update_note_metadata` | Update title, tags, document type |
| `list_tags` | List all tags with usage counts |
| `get_knowledge_health` | Retrieve knowledge base health metrics |
| `list_collections` | List note collections |
| `add_note_to_collection` | Add note to a collection |
| `get_note_links` | Retrieve semantic links for a note |
| `list_archives` | List available archives (namespaces) |

### Connecting via MCP

Point your AI client at the Fortemi MCP binary. For Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "fortemi": {
      "command": "/path/to/hotm-matric-api",
      "args": ["--mcp"],
      "env": {
        "DATABASE_URL": "postgres://matric:matric@localhost/matric"
      }
    }
  }
}
```

Or use the installed sidecar binary:
- **Linux:** `/usr/bin/hotm-matric-api --mcp`
- **macOS:** `/Applications/HotM.app/Contents/MacOS/hotm-matric-api --mcp`

### Archive Routing

Fortemi supports multiple named knowledge bases (archives). Route to a specific archive by setting the `X-Memory-Archive` header on REST calls, or pass `archive=<name>` to MCP tools that accept it.

The default archive is selected automatically.

## REST API

The Fortemi API is available at `http://127.0.0.1:<PORT>/api/v1` while HotM is running.

Find the active port:
```bash
# Linux
PORT=$(jq -r .api_base_url ~/.config/com.hotm.app/config.json | grep -oP ':\K[0-9]+')

# macOS
PORT=$(jq -r .api_base_url ~/Library/Application\ Support/com.hotm.app/config.json | grep -oP ':\K[0-9]+')

BASE="http://127.0.0.1:${PORT}/api/v1"
```

### Key Endpoints

**Health:**
```bash
curl "${BASE%/api/v1}/health"
```

**Create a note:**
```bash
curl -X POST "${BASE}/notes" \
  -H "Content-Type: application/json" \
  -d '{"content": "Meeting notes: ...", "document_type": "meeting_notes"}'
```

**Search:**
```bash
curl "${BASE}/search?q=project+timeline&limit=10"
```

**Get a note:**
```bash
curl "${BASE}/notes/{note_id}"
```

**List tags:**
```bash
curl "${BASE}/tags"
```

**Knowledge health:**
```bash
curl "${BASE}/health/knowledge"
```

Full API reference: [`docs/specifications/api-specification.md`](../specifications/api-specification.md)
OpenAPI schema: [`docs/openapi.json`](../openapi.json)

## Note Lifecycle

When a note is created:

1. Content is stored as an immutable original
2. The NLP pipeline runs asynchronously:
   - Chunking and summarization
   - Revision generation (AI-enhanced rewrite)
   - Tag and entity extraction
   - Semantic link detection
   - Embedding computation (pgvector)
3. Search indexes are updated

Poll job status or use SSE for pipeline completion events:

```bash
# SSE event stream
curl -N "${BASE}/events"
```

Agents should prefer `get_note` over caching note content — the revision field updates as the NLP pipeline completes.

## Document Types

Fortemi uses document types to tune the NLP pipeline. Available types (via `list_document_types` or API):

| Type | NLP behaviour |
|------|--------------|
| `general` | Standard summarization and revision |
| `meeting_notes` | Structured extraction of action items |
| `research` | Academic-style revision, citation awareness |
| `code` | Code-aware extraction, no prose rewriting |
| `reference` | Preserves structure, light revision |
| `journal` | Personal entry — minimal revision |

Set document type at creation or update via `update_note_metadata`.

## Search Best Practices

Fortemi search combines BM25 full-text and cosine vector similarity via Reciprocal Rank Fusion.

**For concept lookup:** use plain query text — the semantic component handles synonyms.
**For exact phrase match:** wrap in quotes: `"exact phrase"`.
**For filtering by tag:** use `tags=tag-name` query param.
**For time-scoped queries:** use `created_after` / `created_before` params.

```bash
# Recent meeting notes tagged "product"
curl "${BASE}/search?q=roadmap&tags=product&document_type=meeting_notes&created_after=2026-01-01"
```

## Handling Degraded State

If the API health endpoint returns `capabilities.chat.available: false`, inference is unavailable (Ollama not connected). Notes can still be created and searched — the NLP revision will be missing until inference is restored.

Agents should not fail hard on degraded state for read/write operations, but should surface the degradation clearly for enhancement-dependent workflows.

```bash
curl "${BASE%/api/v1}/health" | jq '.capabilities.chat.available'
# false = degraded, true = full inference available
```

## Agent Memory Pattern

For agents using HotM as persistent memory:

1. **Store context:** create notes with `document_type=reference` for facts, decisions, and session summaries
2. **Retrieve context:** use semantic search before generating — `search_notes` with the current task as query
3. **Tag for retrieval:** tag notes with project/topic tags to enable scoped search
4. **Archive isolation:** use separate archives for different projects to avoid cross-contamination

Example session summary workflow:
```python
# End of session — store summary
api.post("/api/v1/notes", json={
    "content": f"Session {date}: {summary}",
    "document_type": "journal",
    "tags": ["session-log", project_tag]
})

# Start of next session — retrieve context
results = api.get("/api/v1/search", params={
    "q": current_task,
    "tags": project_tag,
    "limit": 5
}).json()
```

## Error Handling

| HTTP status | Meaning | Action |
|-------------|---------|--------|
| `200` | Success | — |
| `422` | Validation error | Check request body schema |
| `404` | Note/resource not found | Verify ID |
| `429` | Rate limited (100 req/60s) | Back off and retry |
| `500` | Sidecar error | Check logs, restart HotM |
| `503` | Database unavailable | Check PostgreSQL |

The sidecar enforces a rate limit of 100 requests per 60 seconds per IP. For bulk operations, add `time.sleep(0.6)` between batches.
