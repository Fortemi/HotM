/**
 * Fortemi tool definitions for server-side execution.
 *
 * These tools call the Fortemi API from the proxy server, executing
 * search, note creation, tagging, and other operations on behalf
 * of the AI agent.
 */

import { tool } from 'ai';
import { z } from 'zod';

const FORTEMI_API_URL = process.env.FORTEMI_API_URL ?? 'http://localhost:3000/api/v1';

async function fortemiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${FORTEMI_API_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Fortemi API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function fortemiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FORTEMI_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fortemi API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function fortemiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FORTEMI_API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fortemi API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tool definitions (server-side with execute functions)
// ---------------------------------------------------------------------------

export const searchNotesTool = tool({
  description:
    'Search notes using hybrid full-text and semantic search. ' +
    'Use this when the user asks to find, look up, or search for notes.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().int().min(1).max(50).optional().default(10),
    mode: z.enum(['hybrid', 'fts', 'semantic']).optional().default('hybrid'),
  }),
  execute: async ({ query, limit, mode }) => {
    const results = await fortemiGet<Array<{
      note_id: string; title?: string; snippet: string; score: number; tags?: string[];
    }>>('/search', { q: query, limit: String(limit), mode });
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
    'Create a new note in the knowledge base.',
  inputSchema: z.object({
    content: z.string().describe('The note content (Markdown supported)'),
    revision_mode: z.enum(['none', 'light', 'standard', 'contextual']).optional().default('standard'),
    tags: z.array(z.string()).optional(),
  }),
  execute: async ({ content, revision_mode, tags }) => {
    const response = await fortemiPost<{ note_id: string }>('/notes', {
      content,
      revision_mode,
    });
    if (tags && tags.length > 0) {
      await fortemiPatch(`/notes/${response.note_id}/tags`, { add: tags });
    }
    return { note_id: response.note_id, revision_mode };
  },
});

export const getNoteTool = tool({
  description: 'Retrieve a specific note by its ID.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to retrieve'),
  }),
  execute: async ({ note_id }) => {
    const note = await fortemiGet<{
      note: { id: string; title?: string; created_at_utc: string };
      original: { content: string };
      revised?: { content: string };
      tags: string[];
    }>(`/notes/${note_id}`);
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
  description: 'Trigger an AI revision on an existing note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to revise'),
  }),
  execute: async ({ note_id }) => {
    await fortemiPost('/jobs', {
      note_id,
      job_type: 'ai_revision',
      priority: 5,
    });
    return { note_id, status: 'revision_queued' };
  },
});

export const updateTagsTool = tool({
  description: 'Add or remove tags on a note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to update'),
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  }),
  execute: async ({ note_id, add, remove }) => {
    const tags = await fortemiPatch<string[]>(`/notes/${note_id}/tags`, { add, remove });
    return { note_id, tags };
  },
});

export const linkNotesTool = tool({
  description: 'Create a semantic link between two notes.',
  inputSchema: z.object({
    source_id: z.string().describe('Source note ID'),
    target_id: z.string().describe('Target note ID'),
    kind: z.enum(['related', 'reference', 'mention', 'task', 'semantic']).optional().default('related'),
  }),
  execute: async ({ source_id, target_id, kind }) => {
    await fortemiPost(`/notes/${source_id}/links`, {
      to_note_id: target_id,
      kind,
    });
    return { source_id, target_id, kind };
  },
});

export const listCollectionsTool = tool({
  description: 'List available note collections.',
  inputSchema: z.object({
    parent_id: z.string().optional(),
  }),
  execute: async ({ parent_id }) => {
    const params: Record<string, string> = {};
    if (parent_id) params.parent_id = parent_id;
    const collections = await fortemiGet<Array<{
      id: string; name: string; description?: string;
    }>>('/collections', params);
    return {
      collections: collections.map((c) => ({
        id: c.id, name: c.name, description: c.description,
      })),
    };
  },
});

export const searchConceptsTool = tool({
  description: 'Search the SKOS concept taxonomy.',
  inputSchema: z.object({
    query: z.string().describe('Search query for concepts'),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  execute: async ({ query, limit }) => {
    const concepts = await fortemiGet<Array<{
      id: string; pref_label: string; definition?: string;
    }>>('/concepts', { search: query, limit: String(limit) });
    return {
      concepts: concepts.map((c) => ({
        id: c.id, label: c.pref_label, definition: c.definition,
      })),
    };
  },
});

export const getRelatedTool = tool({
  description: 'Find notes semantically related to a given note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to find related notes for'),
    limit: z.number().int().min(1).max(20).optional().default(5),
  }),
  execute: async ({ note_id, limit }) => {
    const results = await fortemiGet<Array<{
      note_id: string; title?: string; snippet: string; score: number; tags?: string[];
    }>>(`/notes/${note_id}/similar`, { limit: String(limit) });
    return {
      notes: results.map((r) => ({
        note_id: r.note_id, title: r.title, snippet: r.snippet, score: r.score, tags: r.tags,
      })),
    };
  },
});

/**
 * All tools keyed by name — pass directly to streamText({ tools }).
 */
export const agentTools = {
  search_notes: searchNotesTool,
  create_note: createNoteTool,
  get_note: getNoteTool,
  revise_note: reviseNoteTool,
  update_tags: updateTagsTool,
  link_notes: linkNotesTool,
  list_collections: listCollectionsTool,
  search_concepts: searchConceptsTool,
  get_related: getRelatedTool,
} as const;
