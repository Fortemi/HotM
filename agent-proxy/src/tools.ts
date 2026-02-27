/**
 * Fortemi tool definitions — schema-only (no server-side execution).
 *
 * These tool schemas are sent to the LLM so it can request tool calls.
 * Actual execution happens client-side in the browser via the UI's
 * tools.ts (which calls the Fortemi API through the shared api client).
 */

import { tool } from 'ai';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema-only tool definitions (no execute functions)
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
});

export const createNoteTool = tool({
  description:
    'Create a new note in the knowledge base.',
  inputSchema: z.object({
    content: z.string().describe('The note content (Markdown supported)'),
    revision_mode: z.enum(['none', 'light', 'standard', 'contextual']).optional().default('standard'),
    tags: z.array(z.string()).optional(),
  }),
});

export const getNoteTool = tool({
  description: 'Retrieve a specific note by its ID.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to retrieve'),
  }),
});

export const reviseNoteTool = tool({
  description: 'Trigger an AI revision on an existing note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to revise'),
  }),
});

export const updateTagsTool = tool({
  description: 'Add or remove tags on a note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to update'),
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  }),
});

export const linkNotesTool = tool({
  description: 'Create a semantic link between two notes.',
  inputSchema: z.object({
    source_id: z.string().describe('Source note ID'),
    target_id: z.string().describe('Target note ID'),
    kind: z.enum(['related', 'reference', 'mention', 'task', 'semantic']).optional().default('related'),
  }),
});

export const listCollectionsTool = tool({
  description: 'List available note collections.',
  inputSchema: z.object({
    parent_id: z.string().optional(),
  }),
});

export const searchConceptsTool = tool({
  description: 'Search the SKOS concept taxonomy.',
  inputSchema: z.object({
    query: z.string().describe('Search query for concepts'),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
});

export const getRelatedTool = tool({
  description: 'Find notes semantically related to a given note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to find related notes for'),
    limit: z.number().int().min(1).max(20).optional().default(5),
  }),
});

/**
 * All tools keyed by name — pass directly to streamText({ tools }).
 * Schema-only: the LLM sees these but execution happens client-side.
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
