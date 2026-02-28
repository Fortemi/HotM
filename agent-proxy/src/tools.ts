/**
 * Fortemi tool definitions with server-side execution.
 *
 * Tools execute directly against the Fortemi API from the agent-proxy,
 * keeping the full tool loop server-side. This enables streamText's
 * automatic multi-step execution — the LLM calls a tool, the proxy
 * executes it, feeds results back, and the LLM continues.
 *
 * The Fortemi API URL is read from FORTEMI_API_URL env var.
 *
 * NOTE: All optional schemas use nullish() to tolerate LLMs sending null
 * instead of omitting the field. A .transform() coerces null → default.
 */

import { tool } from 'ai';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Fortemi API client (lightweight fetch wrapper)
// ---------------------------------------------------------------------------

function fortemiUrl(): string {
  return process.env.FORTEMI_API_URL ?? 'http://localhost:3000/api/v1';
}

async function fortemi<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${fortemiUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fortemi ${init?.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Null-safe schema helpers
// LLMs frequently send null for optional fields. Zod's .optional().default()
// only fires on undefined, not null. These helpers handle both.
// ---------------------------------------------------------------------------

/** Optional integer with default — accepts null, undefined, or number. */
function optionalInt(def: number, min: number, max: number, desc: string) {
  return z.preprocess(
    (val) => (val === null || val === undefined ? undefined : val),
    z.coerce.number().int().min(min).max(max).optional().default(def),
  ).describe(desc);
}

/** Optional enum with default — accepts null, undefined, or valid value. */
function optionalEnum<T extends string>(values: readonly [T, ...T[]], def: T, desc: string) {
  return z.preprocess(
    (val) => (val === null || val === undefined || val === '' ? undefined : val),
    z.enum(values).optional().default(def),
  ).describe(desc);
}

/** Optional string array — accepts null or undefined as empty. */
function optionalStringArray(desc: string) {
  return z.preprocess(
    (val) => (val === null || val === undefined ? undefined : val),
    z.array(z.string()).optional(),
  ).describe(desc);
}

/** Optional string — accepts null as undefined. */
function optionalString(desc: string) {
  return z.preprocess(
    (val) => (val === null || val === undefined || val === '' ? undefined : val),
    z.string().optional(),
  ).describe(desc);
}

// ---------------------------------------------------------------------------
// Tool definitions with execute functions
// ---------------------------------------------------------------------------

export const searchNotesTool = tool({
  description:
    'Search notes using hybrid full-text and semantic search. ' +
    'Use this when the user asks to find, look up, or search for notes. ' +
    'Just pass the query — limit and mode have sensible defaults.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: optionalInt(10, 1, 50, 'Max results (default 10)'),
    mode: optionalEnum(['hybrid', 'fts', 'semantic'], 'hybrid', 'Search mode (default hybrid)'),
  }),
  execute: async ({ query, limit, mode }) => {
    const params = new URLSearchParams({ q: query, limit: String(limit), mode });
    const results = await fortemi<unknown>(`/search?${params}`);
    // Normalize — Fortemi may return array or { results: [...] }
    const items = Array.isArray(results)
      ? results
      : ((results as Record<string, unknown>).results ?? []) as Array<Record<string, unknown>>;
    return (items as Array<Record<string, unknown>>).map((r) => ({
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
    revision_mode: optionalEnum(
      ['none', 'light', 'standard', 'contextual'],
      'standard',
      'AI revision mode (default standard)',
    ),
    tags: optionalStringArray('Tags to apply to the new note'),
  }),
  execute: async ({ content, revision_mode, tags }) => {
    const note = await fortemi<Record<string, unknown>>('/notes', {
      method: 'POST',
      body: JSON.stringify({ content, revision_mode }),
    });
    const noteId = (note.note_id ?? note.id ?? (note.note as Record<string, unknown>)?.id) as string;
    // Apply tags if provided
    if (tags && tags.length > 0 && noteId) {
      await fortemi(`/notes/${noteId}/tags`, {
        method: 'PATCH',
        body: JSON.stringify({ add: tags }),
      });
    }
    return { note_id: noteId, revision_mode };
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
    const data = await fortemi<Record<string, unknown>>(`/notes/${note_id}`);
    const note = (data.note ?? data) as Record<string, unknown>;
    const revised = data.revised as Record<string, unknown> | undefined;
    const original = data.original as Record<string, unknown> | undefined;
    return {
      note_id: note.id ?? note_id,
      title: note.title,
      content: revised?.content ?? original?.content ?? note.content ?? '',
      tags: data.tags ?? note.tags ?? [],
      created_at: note.created_at_utc ?? note.created_at,
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
    await fortemi('/jobs', {
      method: 'POST',
      body: JSON.stringify({ note_id, job_type: 'ai_revision' }),
    });
    return { note_id, status: 'revision_queued' };
  },
});

export const updateTagsTool = tool({
  description:
    'Add or remove tags on a note. ' +
    'Use this when the user asks to tag, label, or categorise a note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to update'),
    add: optionalStringArray('Tags to add'),
    remove: optionalStringArray('Tags to remove'),
  }),
  execute: async ({ note_id, add, remove }) => {
    const result = await fortemi<string[] | Record<string, unknown>>(
      `/notes/${note_id}/tags`,
      { method: 'PATCH', body: JSON.stringify({ add, remove }) },
    );
    const tags = Array.isArray(result) ? result : (result as Record<string, unknown>).tags ?? [];
    return { note_id, tags };
  },
});

export const linkNotesTool = tool({
  description:
    'Create a semantic link between two notes. ' +
    'Use this when the user asks to connect, link, or relate two notes.',
  inputSchema: z.object({
    source_id: z.string().describe('Source note ID'),
    target_id: z.string().describe('Target note ID'),
    kind: optionalEnum(
      ['related', 'reference', 'mention', 'task', 'semantic'],
      'related',
      'Link type (default related)',
    ),
  }),
  execute: async ({ source_id, target_id, kind }) => {
    await fortemi(`/notes/${source_id}/links`, {
      method: 'POST',
      body: JSON.stringify({ to_note_id: target_id, kind }),
    });
    return { source_id, target_id, kind };
  },
});

export const listCollectionsTool = tool({
  description:
    'List available note collections. ' +
    'Use this when the user asks about their collections or folders.',
  inputSchema: z.object({
    parent_id: optionalString('Parent collection ID (omit for root)'),
  }),
  execute: async ({ parent_id }) => {
    const params = parent_id ? `?parent_id=${encodeURIComponent(parent_id)}` : '';
    const results = await fortemi<unknown>(`/collections${params}`);
    const items = Array.isArray(results) ? results : [];
    return {
      collections: (items as Array<Record<string, unknown>>).map((c) => ({
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
    limit: optionalInt(10, 1, 50, 'Max results (default 10)'),
  }),
  execute: async ({ query, limit }) => {
    const params = new URLSearchParams({ search: query, limit: String(limit) });
    const results = await fortemi<unknown>(`/concepts?${params}`);
    // Fortemi wraps results in { concepts: [...], total, limit, offset }
    const items = Array.isArray(results)
      ? results
      : ((results as Record<string, unknown>).concepts ?? []) as Array<Record<string, unknown>>;
    return {
      concepts: (items as Array<Record<string, unknown>>).map((c) => ({
        id: c.id,
        label: c.pref_label,
        notation: c.notation,
        status: c.status,
        note_count: c.note_count,
      })),
    };
  },
});

export const getRelatedTool = tool({
  description:
    'Find notes semantically related to a given note. ' +
    'Use this when the user asks for similar or related notes.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to find related notes for'),
    limit: optionalInt(5, 1, 20, 'Max related notes (default 5)'),
  }),
  execute: async ({ note_id, limit }) => {
    const params = new URLSearchParams({ limit: String(limit) });
    const results = await fortemi<unknown>(
      `/notes/${note_id}/similar?${params}`,
    );
    const items = Array.isArray(results) ? results : [];
    return {
      notes: (items as Array<Record<string, unknown>>).map((r) => ({
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
// Tool registry
// ---------------------------------------------------------------------------

/**
 * All tools keyed by name — pass directly to streamText({ tools }).
 * Each tool has an execute function that calls the Fortemi API server-side.
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
