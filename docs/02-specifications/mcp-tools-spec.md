# MCP Server Tools Specification

## Overview
Model Context Protocol (MCP) server implementation for HotM, providing deterministic tools for AI assistants to interact with notes.

**Protocol**: JSON-RPC 2.0  
**Transport**: stdio (embedded) or TCP (standalone)  
**Version**: MCP 1.0

## Architecture

### Embedding Strategy
The MCP server will be embedded in the Rust API server (`server/src/mcp/`) to:
- Share database connections and state
- Avoid duplicate business logic
- Enable both local and remote deployment
- Maintain single source of truth

### Communication Flow
```
AI Assistant <-> MCP Client <-> MCP Server (in Rust API) <-> Database
                                        |
                                        v
                                    Ollama API
```

## Tool Definitions

### Note Management

#### create_note
Create a new note with automatic NLP processing.

```typescript
{
  "name": "create_note",
  "description": "Create a new note with content",
  "inputSchema": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string",
        "description": "The note content"
      },
      "format": {
        "type": "string",
        "enum": ["plaintext", "markdown", "webclip"],
        "default": "markdown"
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Initial tags to assign"
      }
    },
    "required": ["content"]
  }
}

// Response
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing"
}
```

#### get_note
Retrieve a note with all its metadata.

```typescript
{
  "name": "get_note",
  "description": "Get a note by ID",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_id": {
        "type": "string",
        "format": "uuid"
      },
      "view": {
        "type": "string",
        "enum": ["revised", "original", "both"],
        "default": "revised"
      }
    },
    "required": ["note_id"]
  }
}

// Response
{
  "note": { /* note metadata */ },
  "original": { /* if requested */ },
  "revised": { /* if requested */ },
  "tags": ["tag1", "tag2"],
  "links": [ /* link objects */ ]
}
```

#### update_note
Update the revised content of a note.

```typescript
{
  "name": "update_note",
  "description": "Update revised content of a note",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_id": {
        "type": "string",
        "format": "uuid"
      },
      "content": {
        "type": "string",
        "description": "New revised content"
      },
      "rationale": {
        "type": "string",
        "description": "Reason for revision"
      }
    },
    "required": ["note_id", "content"]
  }
}
```

#### delete_note
Delete a note and all associated data.

```typescript
{
  "name": "delete_note",
  "description": "Delete a note permanently",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_id": {
        "type": "string",
        "format": "uuid"
      }
    },
    "required": ["note_id"]
  }
}
```

### Search Tools

#### search_notes
Search notes using various strategies.

```typescript
{
  "name": "search_notes",
  "description": "Search notes with filters",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query"
      },
      "mode": {
        "type": "string",
        "enum": ["hybrid", "fts", "vector"],
        "default": "hybrid"
      },
      "filters": {
        "type": "object",
        "properties": {
          "tags": {
            "type": "array",
            "items": { "type": "string" }
          },
          "collection_id": {
            "type": "string",
            "format": "uuid"
          },
          "before": {
            "type": "string",
            "format": "date-time"
          },
          "after": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100,
        "default": 20
      }
    },
    "required": ["query"]
  }
}

// Response
{
  "hits": [
    {
      "note_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.95,
      "snippet": "...matching content...",
      "title": "Note title"
    }
  ],
  "total": 42
}
```

#### find_similar
Find notes similar to given text.

```typescript
{
  "name": "find_similar",
  "description": "Find semantically similar notes",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "Text to find similar notes for"
      },
      "threshold": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "default": 0.7
      },
      "limit": {
        "type": "integer",
        "default": 10
      }
    },
    "required": ["text"]
  }
}
```

### Organization Tools

#### set_tags
Manage tags for a note.

```typescript
{
  "name": "set_tags",
  "description": "Add or remove tags from a note",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_id": {
        "type": "string",
        "format": "uuid"
      },
      "add": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tags to add"
      },
      "remove": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tags to remove"
      }
    },
    "required": ["note_id"]
  }
}
```

#### set_collection
Assign a note to a collection.

```typescript
{
  "name": "set_collection",
  "description": "Assign note to a collection",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_id": {
        "type": "string",
        "format": "uuid"
      },
      "collection_name": {
        "type": "string",
        "description": "Collection name (created if doesn't exist)"
      }
    },
    "required": ["note_id", "collection_name"]
  }
}
```

### Linking Tools

#### link_notes
Create a link between two notes.

```typescript
{
  "name": "link_notes",
  "description": "Create a link between notes",
  "inputSchema": {
    "type": "object",
    "properties": {
      "from_note_id": {
        "type": "string",
        "format": "uuid"
      },
      "to_note_id": {
        "type": "string",
        "format": "uuid"
      },
      "kind": {
        "type": "string",
        "enum": ["related", "mention", "reference", "task"],
        "default": "related"
      },
      "bidirectional": {
        "type": "boolean",
        "default": false
      }
    },
    "required": ["from_note_id", "to_note_id"]
  }
}
```

#### link_external
Create a link to an external URL.

```typescript
{
  "name": "link_external",
  "description": "Link a note to an external URL",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_id": {
        "type": "string",
        "format": "uuid"
      },
      "url": {
        "type": "string",
        "format": "uri"
      },
      "kind": {
        "type": "string",
        "enum": ["source", "reference", "related"],
        "default": "reference"
      }
    },
    "required": ["note_id", "url"]
  }
}
```

### Analysis Tools

#### get_provenance
Get the revision history of a note.

```typescript
{
  "name": "get_provenance",
  "description": "Get revision history and sources",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_id": {
        "type": "string",
        "format": "uuid"
      }
    },
    "required": ["note_id"]
  }
}

// Response
{
  "revisions": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "created_at": "2025-01-01T12:00:00Z",
      "type": "auto",
      "summary": "Initial enhancement"
    }
  ],
  "sources": [
    {
      "type": "note",
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "relation": "derived_from"
    }
  ]
}
```

#### analytics_query
Run analytics queries on notes.

```typescript
{
  "name": "analytics_query",
  "description": "Run analytics on notes",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query_type": {
        "type": "string",
        "enum": [
          "tag_frequency",
          "note_count",
          "link_graph",
          "activity_timeline",
          "collection_stats"
        ]
      },
      "filters": {
        "type": "object",
        "properties": {
          "date_range": {
            "type": "object",
            "properties": {
              "start": { "type": "string", "format": "date-time" },
              "end": { "type": "string", "format": "date-time" }
            }
          },
          "collection_id": { "type": "string", "format": "uuid" }
        }
      }
    },
    "required": ["query_type"]
  }
}
```

### Export Tools

#### export_notes
Export notes in various formats.

```typescript
{
  "name": "export_notes",
  "description": "Export notes to a format",
  "inputSchema": {
    "type": "object",
    "properties": {
      "note_ids": {
        "type": "array",
        "items": { "type": "string", "format": "uuid" },
        "description": "Specific notes to export (empty for all)"
      },
      "format": {
        "type": "string",
        "enum": ["markdown", "json", "html", "pdf"],
        "default": "markdown"
      },
      "include_metadata": {
        "type": "boolean",
        "default": true
      }
    },
    "required": ["format"]
  }
}

// Response
{
  "export_path": "/exports/notes_2025-01-01.zip",
  "note_count": 42,
  "size_bytes": 1048576
}
```

### System Tools

#### health_check
Check system health and capabilities.

```typescript
{
  "name": "health_check",
  "description": "Check system health",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}

// Response
{
  "status": "healthy",
  "components": {
    "database": true,
    "vector_extension": true,
    "ollama": true,
    "nlp_models": {
      "generation": "gpt-oss:20b",
      "embedding": "nomic-embed-text"
    }
  },
  "stats": {
    "note_count": 1234,
    "tag_count": 456,
    "collection_count": 12
  }
}
```

## Implementation Details

### Module Structure
```rust
// server/src/mcp/mod.rs
pub mod server;     // MCP server implementation
pub mod tools;      // Tool definitions and handlers
pub mod transport;  // stdio/TCP transport
pub mod types;      // MCP protocol types

// server/src/mcp/tools/
mod notes;          // Note management tools
mod search;         // Search tools
mod organization;   // Tags and collections
mod links;          // Linking tools
mod analytics;      // Analysis tools
mod export;         // Export tools
mod system;         // System tools
```

### Error Handling
All tools return standardized errors:
```json
{
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "type": "DATABASE_ERROR",
      "details": "Connection timeout"
    }
  }
}
```

### Tool Registration
```rust
impl McpServer {
    pub fn new(app_state: AppState) -> Self {
        let mut server = Self::default();
        
        // Register all tools
        server.register_tool("create_note", notes::create_note);
        server.register_tool("get_note", notes::get_note);
        server.register_tool("search_notes", search::search_notes);
        // ... etc
        
        server
    }
}
```

### Async Execution
All tools are async and leverage Tokio runtime:
```rust
async fn create_note(
    params: CreateNoteParams,
    state: &AppState
) -> Result<CreateNoteResponse> {
    // Validate input
    // Create note in database
    // Trigger NLP pipeline
    // Return response
}
```

## Testing Strategy

### Unit Tests
- Mock database and Ollama
- Test each tool in isolation
- Validate input/output schemas

### Integration Tests
- Test with real PostgreSQL
- Verify tool interactions
- Test error scenarios

### MCP Compliance Tests
- Validate JSON-RPC format
- Test protocol compliance
- Verify tool discovery

## Security Considerations

1. **Input Validation**: All tool inputs sanitized
2. **Rate Limiting**: Per-tool rate limits
3. **Authorization**: Future: tool-level permissions
4. **Audit Logging**: All tool invocations logged
5. **Sandboxing**: Tools cannot access filesystem directly