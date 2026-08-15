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
import { requireCompatibleFortemiMutation } from './compatibility.js';
import {
  AGENT_TOOL_PRIVILEGES,
  assertCompleteToolClassification,
  type OperationPrivilege,
} from './privileges.js';

export type AgentToolSafety = 'read' | 'write';

export type AgentToolIntent = 'exploratory' | 'knowledge-action';

export interface AgentToolMetadata {
  intentSets: AgentToolIntent[];
  routeFamilies: string[];
  endpoints: string[];
  safety: AgentToolSafety;
  privilege: OperationPrivilege;
  capabilityGate: string;
  roleScope: string;
  resultPolicy: string;
}

export interface DeferredToolDecision {
  candidate: string;
  routeFamilies: string[];
  disposition: 'ui_only' | 'diagnostic_candidate' | 'deferred' | 'excluded';
  reason: string;
}

// ---------------------------------------------------------------------------
// Fortemi API client (lightweight fetch wrapper)
// ---------------------------------------------------------------------------

function fortemiUrl(): string {
  return process.env.FORTEMI_API_URL ?? 'http://localhost:3000/api/v1';
}

// Default timeout for Fortemi API calls — prevents tool chains from hanging
// indefinitely when the API is slow or unresponsive.
const FORTEMI_TIMEOUT_MS = 120_000; // 2 minutes

async function fortemi<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiBaseUrl = fortemiUrl();
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    await requireCompatibleFortemiMutation(apiBaseUrl);
  }
  const url = `${apiBaseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(FORTEMI_TIMEOUT_MS),
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
    'Supports filtering by tags, concepts, dates, collections, starred/archived status, ' +
    'and searching across different memory archives. ' +
    'Just pass the query — all other parameters have sensible defaults.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: optionalInt(10, 1, 50, 'Max results (default 10)'),
    mode: optionalEnum(['hybrid', 'fts', 'semantic'], 'hybrid', 'Search mode (default hybrid)'),
    tags: optionalStringArray('Filter by tags (e.g. ["work", "urgent"])'),
    concepts: optionalStringArray('Filter by extracted concepts'),
    starred: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : val),
      z.boolean().optional(),
    ).describe('Filter to starred notes only'),
    archived: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : val),
      z.boolean().optional(),
    ).describe('Include/exclude archived notes (default: exclude)'),
    collection: optionalString('Filter by collection ID'),
    before: optionalString('Notes created before this date (ISO 8601)'),
    after: optionalString('Notes created after this date (ISO 8601)'),
    source: optionalString('Filter by note source (e.g. "agent-session")'),
    sort: optionalString('Sort order (e.g. "relevance", "created_at", "updated_at")'),
    archive: optionalString('Memory/archive name to search in (routes via X-Fortemi-Memory header)'),
  }),
  execute: async ({ query, limit, mode, tags, concepts, starred, archived, collection, before, after, source, sort, archive }) => {
    const params = new URLSearchParams({ q: query, limit: String(limit), mode });
    if (tags && tags.length > 0) params.set('tags', tags.join(','));
    if (concepts && concepts.length > 0) params.set('concepts', concepts.join(','));
    if (starred !== undefined) params.set('starred', String(starred));
    if (archived !== undefined) params.set('archived', String(archived));
    if (collection) params.set('collection', collection);
    if (before) params.set('before', before);
    if (after) params.set('after', after);
    if (source) params.set('source', source);
    if (sort) params.set('sort', sort);

    const headers: Record<string, string> = {};
    if (archive) headers['X-Fortemi-Memory'] = archive;

    const results = await fortemi<unknown>(`/search?${params}`, {
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
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
    // Apply tags if provided — use PUT (Fortemi returns 405 for PATCH)
    if (tags && tags.length > 0 && noteId) {
      await fortemi(`/notes/${noteId}/tags`, {
        method: 'PUT',
        body: JSON.stringify({ tags }),
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

    // Fetch attachment summary (non-blocking — don't fail if endpoint unavailable)
    let attachments: Array<{ id: string; filename: string; content_type: string; size_bytes: number }> = [];
    try {
      const attData = await fortemi<unknown>(`/notes/${note_id}/attachments`);
      const attItems = Array.isArray(attData)
        ? attData
        : ((attData as Record<string, unknown>).attachments ?? []) as Array<Record<string, unknown>>;
      attachments = (attItems as Array<Record<string, unknown>>).map((a) => ({
        id: a.id as string,
        filename: a.filename as string ?? a.original_filename as string ?? 'unknown',
        content_type: a.content_type as string ?? 'application/octet-stream',
        size_bytes: (a.size_bytes as number) ?? 0,
      }));
    } catch {
      // Attachments endpoint may not be available — continue without
    }

    return {
      note_id: note.id ?? note_id,
      title: note.title,
      content: revised?.content ?? original?.content ?? note.content ?? '',
      tags: data.tags ?? note.tags ?? [],
      created_at: note.created_at_utc ?? note.created_at,
      attachment_count: attachments.length,
      attachments: attachments.length > 0 ? attachments : undefined,
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
    // Fortemi only supports GET+PUT on /tags (PATCH → 405).
    // Fetch current tags, apply changes, then PUT the full set.
    const currentRaw = await fortemi<string[] | Record<string, unknown>>(
      `/notes/${note_id}/tags`,
    );
    const currentTags = new Set(
      Array.isArray(currentRaw) ? currentRaw as string[] : (currentRaw as Record<string, unknown>).tags as string[] ?? [],
    );
    for (const t of add ?? []) currentTags.add(t);
    for (const t of remove ?? []) currentTags.delete(t);

    const updatedTags = Array.from(currentTags);
    await fortemi(`/notes/${note_id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags: updatedTags }),
    });
    return { note_id, tags: updatedTags };
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

export const listArchivesTool = tool({
  description:
    'List all knowledge base archives (memory spaces). ' +
    'Use this when the user asks about their archives, memories, or knowledge spaces.',
  inputSchema: z.object({}),
  execute: async () => {
    const results = await fortemi<unknown>('/archives');
    const items = Array.isArray(results) ? results : [];
    return {
      archives: (items as Array<Record<string, unknown>>).map((a) => ({
        name: a.name,
        description: a.description,
        is_default: a.is_default,
        note_count: a.note_count,
        size_bytes: a.size_bytes,
        created_at: a.created_at,
      })),
    };
  },
});

export const listNotesTool = tool({
  description:
    'List recent notes in the knowledge base. ' +
    'Use this when the user asks to see their notes, recent entries, or wants an overview.',
  inputSchema: z.object({
    limit: optionalInt(20, 1, 100, 'Max notes to return (default 20)'),
    sort_by: optionalEnum(
      ['created_at', 'updated_at'],
      'created_at',
      'Sort field (default created_at)',
    ),
    sort_order: optionalEnum(['desc', 'asc'], 'desc', 'Sort order (default desc)'),
    tags: optionalStringArray('Filter by tags'),
    archived: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : val),
      z.boolean().optional(),
    ).describe('Filter by archived status'),
  }),
  execute: async ({ limit, sort_by, sort_order, tags, archived }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      sort_by,
      sort_order,
    });
    if (tags && tags.length > 0) params.set('tags', tags.join(','));
    if (archived !== undefined) params.set('archived', String(archived));

    const results = await fortemi<unknown>(`/notes?${params}`);
    const items = Array.isArray(results)
      ? results
      : ((results as Record<string, unknown>).notes ?? []) as Array<Record<string, unknown>>;
    return {
      notes: (items as Array<Record<string, unknown>>).map((n) => ({
        note_id: n.id ?? n.note_id,
        title: n.title,
        snippet: typeof n.content === 'string' ? (n.content as string).slice(0, 150) : '',
        tags: n.tags ?? [],
        created_at: n.created_at_utc ?? n.created_at,
        has_attachments: Array.isArray(n.attachments) && (n.attachments as unknown[]).length > 0,
      })),
      total: items.length,
    };
  },
});

export const getAttachmentsTool = tool({
  description:
    'List file attachments for a note. ' +
    'Use this when the user asks about files, images, audio, video, or documents attached to a note.',
  inputSchema: z.object({
    note_id: z.string().describe('The note ID to list attachments for'),
  }),
  execute: async ({ note_id }) => {
    const results = await fortemi<unknown>(`/notes/${note_id}/attachments`);
    const items = Array.isArray(results)
      ? results
      : ((results as Record<string, unknown>).attachments ?? []) as Array<Record<string, unknown>>;

    return {
      note_id,
      attachments: (items as Array<Record<string, unknown>>).map((a) => ({
        id: a.id,
        filename: a.filename ?? a.original_filename ?? 'unknown',
        content_type: a.content_type ?? 'application/octet-stream',
        size_bytes: a.size_bytes ?? 0,
        status: a.status ?? 'completed',
        ai_description: a.ai_description ?? null,
        extracted_text: a.extracted_text
          ? (a.extracted_text as string).slice(0, 500)
          : null,
        has_preview: a.has_preview ?? false,
      })),
      total: items.length,
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
  list_archives: listArchivesTool,
  list_notes: listNotesTool,
  get_attachments: getAttachmentsTool,
} as const;

export type AgentToolName = keyof typeof agentTools;

assertCompleteToolClassification(agentTools);

export const toolMetadata: Record<AgentToolName, AgentToolMetadata> = {
  search_notes: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['search'],
    endpoints: ['GET /api/v1/search'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.search_notes,
    capabilityGate: 'search capability available',
    roleScope: 'read',
    resultPolicy: 'Return note id, title, snippet, score, and tags only.',
  },
  create_note: {
    intentSets: ['knowledge-action'],
    routeFamilies: ['notes', 'tags'],
    endpoints: ['POST /api/v1/notes', 'PUT /api/v1/notes/{id}/tags'],
    safety: 'write',
    privilege: AGENT_TOOL_PRIVILEGES.create_note,
    capabilityGate: 'notes write capability available',
    roleScope: 'write',
    resultPolicy: 'Return created note id and revision mode; do not return raw auth or server internals.',
  },
  get_note: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['notes', 'attachments'],
    endpoints: ['GET /api/v1/notes/{id}', 'GET /api/v1/notes/{id}/attachments'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.get_note,
    capabilityGate: 'notes read capability available',
    roleScope: 'read',
    resultPolicy: 'Return note content and attachment summaries only; no attachment bytes or private paths.',
  },
  revise_note: {
    intentSets: ['knowledge-action'],
    routeFamilies: ['jobs', 'notes'],
    endpoints: ['POST /api/v1/jobs'],
    safety: 'write',
    privilege: AGENT_TOOL_PRIVILEGES.revise_note,
    capabilityGate: 'jobs and revision capability available',
    roleScope: 'write',
    resultPolicy: 'Return queued-state summary only.',
  },
  update_tags: {
    intentSets: ['knowledge-action'],
    routeFamilies: ['tags', 'notes'],
    endpoints: ['GET /api/v1/notes/{id}/tags', 'PUT /api/v1/notes/{id}/tags'],
    safety: 'write',
    privilege: AGENT_TOOL_PRIVILEGES.update_tags,
    capabilityGate: 'tag update capability available',
    roleScope: 'write',
    resultPolicy: 'Return final tag set only.',
  },
  link_notes: {
    intentSets: ['knowledge-action'],
    routeFamilies: ['notes'],
    endpoints: ['POST /api/v1/notes/{id}/links'],
    safety: 'write',
    privilege: AGENT_TOOL_PRIVILEGES.link_notes,
    capabilityGate: 'note link capability available',
    roleScope: 'write',
    resultPolicy: 'Return source id, target id, and link kind only.',
  },
  list_collections: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['collections'],
    endpoints: ['GET /api/v1/collections'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.list_collections,
    capabilityGate: 'collections read capability available',
    roleScope: 'read',
    resultPolicy: 'Return collection id, name, and description only.',
  },
  search_concepts: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['concepts'],
    endpoints: ['GET /api/v1/concepts'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.search_concepts,
    capabilityGate: 'concept taxonomy read capability available',
    roleScope: 'read',
    resultPolicy: 'Return concept id, label, notation, status, and note count only.',
  },
  get_related: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['notes', 'search'],
    endpoints: ['GET /api/v1/notes/{id}/similar'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.get_related,
    capabilityGate: 'related-notes capability available',
    roleScope: 'read',
    resultPolicy: 'Return related note summaries only.',
  },
  list_archives: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['archives'],
    endpoints: ['GET /api/v1/archives'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.list_archives,
    capabilityGate: 'archive listing capability available',
    roleScope: 'read',
    resultPolicy: 'Return archive summary metadata only.',
  },
  list_notes: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['notes'],
    endpoints: ['GET /api/v1/notes'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.list_notes,
    capabilityGate: 'notes list capability available',
    roleScope: 'read',
    resultPolicy: 'Return note summaries and attachment presence only.',
  },
  get_attachments: {
    intentSets: ['exploratory', 'knowledge-action'],
    routeFamilies: ['attachments'],
    endpoints: ['GET /api/v1/notes/{id}/attachments'],
    safety: 'read',
    privilege: AGENT_TOOL_PRIVILEGES.get_attachments,
    capabilityGate: 'attachment listing capability available',
    roleScope: 'read',
    resultPolicy: 'Return attachment metadata and truncated extracted text only; no bytes, paths, or upload credentials.',
  },
};

export const deferredToolDecisions: DeferredToolDecision[] = [
  {
    candidate: 'inspect_streaming_health',
    routeFamilies: ['streaming_health'],
    disposition: 'diagnostic_candidate',
    reason: 'Admin API Surface owns streaming health diagnostics until agent read-only summaries have capability-disabled fixtures.',
  },
  {
    candidate: 'stream_ingest',
    routeFamilies: ['streaming_ingest'],
    disposition: 'deferred',
    reason: 'Backup owns tokenized NDJSON ingest; agent tools must not mint, persist, or render ingest tokens.',
  },
  {
    candidate: 'inspect_inference_providers',
    routeFamilies: ['inference'],
    disposition: 'diagnostic_candidate',
    reason: 'Admin inference settings own provider diagnostics until agent summaries prove secret redaction.',
  },
  {
    candidate: 'inspect_backup_status',
    routeFamilies: ['backup_archive'],
    disposition: 'diagnostic_candidate',
    reason: 'Backup Manager owns backup/archive controls; agent candidate is read-only status after path redaction evidence.',
  },
  {
    candidate: 'inspect_incoming_receivers',
    routeFamilies: ['incoming_webhook_receivers', 'inbound_sources'],
    disposition: 'diagnostic_candidate',
    reason: 'Admin Webhooks owns receiver/source lifecycle; agent candidate must never return receiver secrets or connector config.',
  },
  {
    candidate: 'describe_attachment_image',
    routeFamilies: ['vision_tools', 'attachments'],
    disposition: 'ui_only',
    reason: 'Attachment preview action is the accepted surface; agent exposure remains gated by capability and redaction tests.',
  },
  {
    candidate: 'transcribe_attachment_audio',
    routeFamilies: ['audio_tools', 'attachments'],
    disposition: 'ui_only',
    reason: 'Attachment preview action is the accepted surface; sensitive transcript handling remains UI-first.',
  },
  {
    candidate: 'inspect_call_session',
    routeFamilies: ['realtime_calls'],
    disposition: 'diagnostic_candidate',
    reason: 'Admin API Surface owns redacted call diagnostics; no agent call summary until operator diagnostics are accepted.',
  },
];

export const nonToolBoundaries: DeferredToolDecision[] = [
  {
    candidate: 'oauth_or_api_key_management',
    routeFamilies: ['oauth', 'auth_api_keys'],
    disposition: 'excluded',
    reason: 'Credential exchange and API key creation are system/admin flows, not agent tools.',
  },
  {
    candidate: 'pke_or_encryption_management',
    routeFamilies: ['pke'],
    disposition: 'excluded',
    reason: 'PKE remains a documented exclusion from current HotM claims.',
  },
  {
    candidate: 'rate_limit_management',
    routeFamilies: ['rate_limit'],
    disposition: 'excluded',
    reason: 'Rate-limit launch proof remains an ops/gate concern, not an embedded agent tool.',
  },
  {
    candidate: 'twilio_realtime_debug',
    routeFamilies: ['realtime_calls'],
    disposition: 'excluded',
    reason: 'Twilio realtime WebSocket diagnostics are explicitly excluded by ADR-011.',
  },
  {
    candidate: 'destructive_backup_or_purge',
    routeFamilies: ['backup_archive', 'notes'],
    disposition: 'excluded',
    reason: 'Restore, import, purge, and destructive backup actions require explicit confirmation, audit, and recovery UX outside the agent.',
  },
];
