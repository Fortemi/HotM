/**
 * AI agent tool definitions for Fortemi operations.
 *
 * Each tool maps a natural language agent action to a Fortemi API call.
 * Tool schemas use Zod for validation and are compatible with the Vercel
 * AI SDK `tool()` helper.
 *
 * Execute functions call the Fortemi API via the shared `api` singleton.
 * In production, these execute server-side in the agent-proxy (#121).
 * They are defined here so the proxy can import them directly.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { api } from '@/api';

// ---------------------------------------------------------------------------
// Tool result types (used by ToolResultCard for rendering)
// ---------------------------------------------------------------------------

export interface NoteSearchResult {
  note_id: string;
  title?: string;
  snippet: string;
  score: number;
  tags?: string[];
}

export interface NoteCreatedResult {
  note_id: string;
  title?: string;
  revision_mode: string;
}

export interface NoteDetailResult {
  note_id: string;
  title?: string;
  content: string;
  tags: string[];
  created_at: string;
}

export interface RevisionResult {
  note_id: string;
  status: string;
}

export interface TagUpdateResult {
  note_id: string;
  tags: string[];
}

export interface CollectionListResult {
  collections: Array<{ id: string; name: string; description?: string }>;
}

export interface ConceptSearchResult {
  concepts: Array<{
    id: string;
    label: string;
    notation?: string;
    status?: string;
    note_count?: number;
  }>;
}

export interface RelatedNotesResult {
  notes: NoteSearchResult[];
}

// Union of all tool result types for discriminated rendering
export type ToolResult =
  | { type: 'search_notes'; data: NoteSearchResult[] }
  | { type: 'create_note'; data: NoteCreatedResult }
  | { type: 'get_note'; data: NoteDetailResult }
  | { type: 'revise_note'; data: RevisionResult }
  | { type: 'update_tags'; data: TagUpdateResult }
  | { type: 'list_collections'; data: CollectionListResult }
  | { type: 'search_concepts'; data: ConceptSearchResult }
  | { type: 'get_related'; data: RelatedNotesResult };

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const searchNotesTool = tool({
  description:
    'Search notes using hybrid full-text and semantic search. ' +
    'Use this when the user asks to find, look up, or search for notes. ' +
    'Supports filtering by tags, concepts, dates, collections, starred/archived status, ' +
    'and searching across different memory archives.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: z
      .coerce.number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe('Max results to return'),
    mode: z
      .enum(['hybrid', 'fts', 'semantic'])
      .optional()
      .default('hybrid')
      .describe('Search mode: hybrid (default), fts (full-text only), or semantic (vector only)'),
    tags: z.array(z.string()).optional().describe('Filter by tags (e.g. ["work", "urgent"])'),
    concepts: z.array(z.string()).optional().describe('Filter by extracted concepts'),
    starred: z.boolean().optional().describe('Filter to starred notes only'),
    archived: z.boolean().optional().describe('Include/exclude archived notes (default: exclude)'),
    collection: z.string().optional().describe('Filter by collection ID'),
    before: z.string().optional().describe('Notes created before this date (ISO 8601)'),
    after: z.string().optional().describe('Notes created after this date (ISO 8601)'),
    source: z.string().optional().describe('Filter by note source (e.g. "agent-session")'),
    sort: z.string().optional().describe('Sort order (e.g. "relevance", "created_at", "updated_at")'),
  }),
  execute: async ({ query, limit, mode, tags, concepts, starred, archived, collection, before, after, source }) => {
    const filters = source ? `source:${source}` : undefined;
    const results = await api.search.search(query, {
      limit,
      mode,
      tags,
      concepts,
      starred,
      archived,
      collection,
      before,
      after,
      filters,
    });
    return results.map((r) => ({
      note_id: r.note_id,
      title: r.title,
      snippet: r.snippet,
      score: r.score,
      tags: r.tags,
    }));
  },
});

export const createNoteTool = tool({
  description:
    'Create a new note in the knowledge base. ' +
    'Use this when the user asks to write, create, or save a new note.',
  inputSchema: z.object({
    content: z.string().describe('The note content (Markdown supported)'),
    title: z
      .string()
      .optional()
      .describe(
        'Optional explicit title. When provided, the AI title-generation step is skipped — the caller value is authoritative. Use this when the user names the note ("Save this as Meeting Notes 2026-05-11") or when the title is otherwise obvious from context.',
      ),
    revision_mode: z
      .enum(['none', 'light', 'standard', 'contextual'])
      .optional()
      .default('standard')
      .describe('AI revision mode: none, light, standard (default), or contextual'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Tags to apply to the new note'),
  }),
  execute: async ({ content, title, revision_mode, tags }) => {
    const response = await api.notes.create({
      content,
      ...(title && { title }),
      revision_mode,
    });
    // Apply tags if provided
    if (tags && tags.length > 0 && response.note_id) {
      await api.notes.updateTags(response.note_id, { add: tags });
    }
    return {
      note_id: response.note_id,
      title: title ?? null,
      revision_mode,
    };
  },
});

export const getNoteTool = tool({
  description:
    'Retrieve a specific note by its ID. ' +
    'Use this when the user asks to show, read, or view a particular note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to retrieve'),
  }),
  execute: async ({ note_id }) => {
    const note = await api.notes.get(note_id);
    return {
      note_id: note.note.id,
      title: note.note.title,
      content: note.revised?.content ?? note.original.content,
      tags: note.tags,
      created_at: note.note.created_at_utc,
    };
  },
});

export const reviseNoteTool = tool({
  description:
    'Trigger an AI revision on an existing note. ' +
    'Use this when the user asks to improve, revise, or enhance a note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to revise'),
  }),
  execute: async ({ note_id }) => {
    await api.extended.queueJob(note_id, 'ai_revision');
    return {
      note_id,
      status: 'revision_queued',
    };
  },
});

export const updateTagsTool = tool({
  description:
    'Add or remove tags on a note. ' +
    'Use this when the user asks to tag, label, or categorise a note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to update'),
    add: z
      .array(z.string())
      .optional()
      .describe('Tags to add'),
    remove: z
      .array(z.string())
      .optional()
      .describe('Tags to remove'),
  }),
  execute: async ({ note_id, add, remove }) => {
    const tags = await api.notes.updateTags(note_id, { add, remove });
    return {
      note_id,
      tags,
    };
  },
});

export const listCollectionsTool = tool({
  description:
    'List available note collections. ' +
    'Use this when the user asks about their collections or folders.',
  inputSchema: z.object({
    parent_id: z
      .string()
      .optional()
      .describe('Parent collection ID to list children of (omit for root collections)'),
  }),
  execute: async ({ parent_id }) => {
    const collections = await api.collections.list(parent_id);
    return {
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    };
  },
});

export const searchConceptsTool = tool({
  description:
    'Search the SKOS concept taxonomy. ' +
    'Use this when the user asks about concepts, topics, or the knowledge taxonomy.',
  inputSchema: z.object({
    query: z.string().describe('Search query for concepts'),
    limit: z
      .coerce.number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe('Max results'),
  }),
  execute: async ({ query, limit }) => {
    const concepts = await api.concepts.listConcepts({
      search: query,
      limit,
    });
    return {
      concepts: concepts.map((c) => {
        // The API returns status and note_count but the Concept type doesn't include them
        const raw = c as unknown as Record<string, unknown>;
        return {
          id: c.id,
          label: c.pref_label,
          notation: c.notation,
          status: raw.status as string | undefined,
          note_count: raw.note_count as number | undefined,
        };
      }),
    };
  },
});

export const getRelatedTool = tool({
  description:
    'Find notes semantically related to a given note. ' +
    'Use this when the user asks for similar or related notes.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to find related notes for'),
    limit: z
      .coerce.number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe('Max related notes to return'),
  }),
  execute: async ({ note_id, limit }) => {
    const results = await api.search.findSimilar(note_id, { limit });
    return {
      notes: results.map((r) => ({
        note_id: r.note_id,
        title: r.title,
        snippet: r.snippet,
        score: r.score,
        tags: r.tags,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Tool registry — all tools keyed by name for dynamic access
// ---------------------------------------------------------------------------

export const agentTools = {
  search_notes: searchNotesTool,
  create_note: createNoteTool,
  get_note: getNoteTool,
  revise_note: reviseNoteTool,
  update_tags: updateTagsTool,
  list_collections: listCollectionsTool,
  search_concepts: searchConceptsTool,
  get_related: getRelatedTool,
} as const;

export type AgentToolName = keyof typeof agentTools;
