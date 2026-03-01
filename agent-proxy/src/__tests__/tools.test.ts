/**
 * Integration tests for Fortemi tool definitions.
 *
 * Each tool's execute function is tested with mocked fetch to verify:
 * - Correct API URL construction
 * - Request method and body
 * - Response normalization
 * - Error handling for non-200 responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchNotesTool,
  createNoteTool,
  getNoteTool,
  reviseNoteTool,
  updateTagsTool,
  linkNotesTool,
  listCollectionsTool,
  searchConceptsTool,
  getRelatedTool,
  listArchivesTool,
  listNotesTool,
  getAttachmentsTool,
  agentTools,
} from '../tools.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub options for tool execute calls. */
const execOpts = {
  toolCallId: 't1',
  messages: [] as never[],
  abortSignal: undefined as unknown as AbortSignal,
};

/**
 * Call a tool's execute function and cast the result.
 * AI SDK v6 execute returns T | AsyncIterable<T> but our tools always return T.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTool<T = any>(tool: { execute?: (...args: any[]) => any }, args: Record<string, unknown>): Promise<T> {
  return tool.execute!(args, execOpts) as Promise<T>;
}

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  process.env.FORTEMI_API_URL = 'http://test-fortemi:3000/api/v1';
});

afterEach(() => {
  delete process.env.FORTEMI_API_URL;
});

/** Helper to create a successful JSON response. */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Helper to create an error response. */
function errorResponse(status: number, body = ''): Response {
  return new Response(body, { status });
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

describe('agentTools registry', () => {
  it('exports all 12 tools', () => {
    expect(Object.keys(agentTools)).toHaveLength(12);
  });

  it('contains expected tool names', () => {
    const names = Object.keys(agentTools);
    expect(names).toContain('search_notes');
    expect(names).toContain('create_note');
    expect(names).toContain('get_note');
    expect(names).toContain('revise_note');
    expect(names).toContain('update_tags');
    expect(names).toContain('link_notes');
    expect(names).toContain('list_collections');
    expect(names).toContain('search_concepts');
    expect(names).toContain('get_related');
    expect(names).toContain('list_archives');
    expect(names).toContain('list_notes');
    expect(names).toContain('get_attachments');
  });

  it('every tool has a description and execute function', () => {
    for (const [name, t] of Object.entries(agentTools)) {
      expect(t, `${name} missing description`).toHaveProperty('description');
      expect(t, `${name} missing execute`).toHaveProperty('execute');
    }
  });
});

// ---------------------------------------------------------------------------
// search_notes
// ---------------------------------------------------------------------------

describe('searchNotesTool', () => {
  it('calls /search with correct params', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { note_id: 'n1', title: 'AI Notes', snippet: '...', score: 0.9, tags: ['ai'] },
      ]),
    );

    const result = await callTool<Array<Record<string, unknown>>>(
      searchNotesTool, { query: 'machine learning', limit: 10, mode: 'hybrid' },
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/search?');
    expect(String(url)).toContain('q=machine+learning');
    expect(init?.headers).toHaveProperty('Content-Type', 'application/json');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      note_id: 'n1',
      title: 'AI Notes',
      snippet: '...',
      score: 0.9,
      tags: ['ai'],
    });
  });

  it('normalizes { results: [...] } response format', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [{ note_id: 'n2', title: 'Test', snippet: '', score: 0.5, tags: [] }],
      }),
    );

    const result = await callTool<Array<Record<string, unknown>>>(
      searchNotesTool, { query: 'test', limit: 5, mode: 'fts' },
    );

    expect(result).toHaveLength(1);
    expect(result[0].note_id).toBe('n2');
  });

  it('throws on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal error'));

    await expect(
      callTool(searchNotesTool, { query: 'fail', limit: 10, mode: 'hybrid' }),
    ).rejects.toThrow(/500/);
  });
});

// ---------------------------------------------------------------------------
// create_note
// ---------------------------------------------------------------------------

describe('createNoteTool', () => {
  it('creates a note with POST /notes', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ note_id: 'new-123', id: 'new-123' }),
    );

    const result = await callTool<{ note_id: string; revision_mode: string }>(
      createNoteTool, { content: 'Hello world', revision_mode: 'standard', tags: undefined },
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0];
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.content).toBe('Hello world');
    expect(body.revision_mode).toBe('standard');

    expect(result).toEqual({ note_id: 'new-123', revision_mode: 'standard' });
  });

  it('applies tags with a separate PUT call', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ note_id: 'new-456' }))
      .mockResolvedValueOnce(jsonResponse({ tags: ['important'] }));

    const result = await callTool<{ note_id: string; revision_mode: string }>(
      createNoteTool, { content: 'Tagged note', revision_mode: 'none', tags: ['important'] },
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [url2, init2] = mockFetch.mock.calls[1];
    expect(String(url2)).toContain('/notes/new-456/tags');
    expect(init2?.method).toBe('PUT');
    const body2 = JSON.parse(init2?.body as string);
    expect(body2.tags).toEqual(['important']);

    expect(result.note_id).toBe('new-456');
  });

  it('extracts note ID from nested { note: { id } } format', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ note: { id: 'nested-id' } }),
    );

    const result = await callTool<{ note_id: string }>(
      createNoteTool, { content: 'Nested format', revision_mode: 'standard', tags: undefined },
    );

    expect(result.note_id).toBe('nested-id');
  });
});

// ---------------------------------------------------------------------------
// get_note
// ---------------------------------------------------------------------------

describe('getNoteTool', () => {
  it('retrieves note by ID with attachment summary', async () => {
    // First call: GET /notes/:id
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        note: { id: 'abc', title: 'My Note', created_at_utc: '2026-01-01T00:00:00Z' },
        original: { content: 'Original text' },
        revised: { content: 'Revised text' },
        tags: ['test'],
      }),
    );
    // Second call: GET /notes/:id/attachments
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: 'att1', filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 1024 },
      ]),
    );

    const result = await callTool<Record<string, unknown>>(
      getNoteTool, { note_id: 'abc' },
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[0][0])).toContain('/notes/abc');
    expect(String(mockFetch.mock.calls[1][0])).toContain('/notes/abc/attachments');

    expect(result.note_id).toBe('abc');
    expect(result.title).toBe('My Note');
    expect(result.content).toBe('Revised text');
    expect(result.tags).toEqual(['test']);
    expect(result.attachment_count).toBe(1);
    expect(result.attachments).toEqual([
      { id: 'att1', filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 1024 },
    ]);
  });

  it('falls back to original content when revised is missing', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        note: { id: 'abc', title: 'Original Only' },
        original: { content: 'Original text' },
        tags: [],
      }),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse([])); // no attachments

    const result = await callTool<Record<string, unknown>>(
      getNoteTool, { note_id: 'abc' },
    );

    expect(result.content).toBe('Original text');
    expect(result.attachment_count).toBe(0);
  });

  it('handles flat response format', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 'flat-1',
        title: 'Flat Format',
        content: 'Direct content',
        tags: ['flat'],
        created_at: '2026-01-01',
      }),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse([])); // no attachments

    const result = await callTool<Record<string, unknown>>(
      getNoteTool, { note_id: 'flat-1' },
    );

    expect(result.note_id).toBe('flat-1');
    expect(result.content).toBe('Direct content');
  });

  it('continues gracefully when attachments endpoint fails', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        note: { id: 'abc', title: 'Test' },
        original: { content: 'Content' },
        tags: [],
      }),
    );
    mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not found')); // attachments fail

    const result = await callTool<Record<string, unknown>>(
      getNoteTool, { note_id: 'abc' },
    );

    expect(result.note_id).toBe('abc');
    expect(result.attachment_count).toBe(0);
    expect(result.attachments).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// revise_note
// ---------------------------------------------------------------------------

describe('reviseNoteTool', () => {
  it('queues a revision job via POST /jobs', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ job_id: 'j1' }));

    const result = await callTool<{ note_id: string; status: string }>(
      reviseNoteTool, { note_id: 'note-to-revise' },
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/jobs');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.note_id).toBe('note-to-revise');
    expect(body.job_type).toBe('ai_revision');

    expect(result).toEqual({ note_id: 'note-to-revise', status: 'revision_queued' });
  });
});

// ---------------------------------------------------------------------------
// update_tags
// ---------------------------------------------------------------------------

describe('updateTagsTool', () => {
  it('fetches current tags, merges, and PUTs the result', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(['existing-tag']));
    mockFetch.mockResolvedValueOnce(jsonResponse({ tags: ['existing-tag', 'new-tag'] }));

    const result = await callTool<{ note_id: string; tags: string[] }>(
      updateTagsTool, { note_id: 'n1', add: ['new-tag'], remove: undefined },
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [url1] = mockFetch.mock.calls[0];
    expect(String(url1)).toContain('/notes/n1/tags');

    const [url2, init2] = mockFetch.mock.calls[1];
    expect(String(url2)).toContain('/notes/n1/tags');
    expect(init2?.method).toBe('PUT');
    const body = JSON.parse(init2?.body as string);
    expect(body.tags).toContain('existing-tag');
    expect(body.tags).toContain('new-tag');

    expect(result.tags).toContain('existing-tag');
    expect(result.tags).toContain('new-tag');
  });

  it('removes tags from the current set', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(['keep', 'remove-me']));
    mockFetch.mockResolvedValueOnce(jsonResponse({ tags: ['keep'] }));

    const result = await callTool<{ tags: string[] }>(
      updateTagsTool, { note_id: 'n1', add: undefined, remove: ['remove-me'] },
    );

    expect(result.tags).toEqual(['keep']);
  });

  it('handles { tags: [...] } response format for current tags', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ tags: ['a', 'b'] }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ tags: ['a', 'b', 'c'] }));

    const result = await callTool<{ tags: string[] }>(
      updateTagsTool, { note_id: 'n1', add: ['c'], remove: undefined },
    );

    expect(result.tags).toContain('a');
    expect(result.tags).toContain('b');
    expect(result.tags).toContain('c');
  });
});

// ---------------------------------------------------------------------------
// link_notes
// ---------------------------------------------------------------------------

describe('linkNotesTool', () => {
  it('creates a link via POST /notes/:id/links', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'link-1' }));

    const result = await callTool<{ source_id: string; target_id: string; kind: string }>(
      linkNotesTool, { source_id: 's1', target_id: 't1', kind: 'related' },
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/notes/s1/links');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.to_note_id).toBe('t1');
    expect(body.kind).toBe('related');

    expect(result).toEqual({ source_id: 's1', target_id: 't1', kind: 'related' });
  });
});

// ---------------------------------------------------------------------------
// list_collections
// ---------------------------------------------------------------------------

describe('listCollectionsTool', () => {
  it('lists root collections when no parent_id', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: 'c1', name: 'Work', description: 'Work notes' },
        { id: 'c2', name: 'Personal', description: 'Personal notes' },
      ]),
    );

    const result = await callTool<{ collections: Array<Record<string, unknown>> }>(
      listCollectionsTool, { parent_id: undefined },
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).not.toContain('parent_id');

    expect(result.collections).toHaveLength(2);
    expect(result.collections[0]).toEqual({ id: 'c1', name: 'Work', description: 'Work notes' });
  });

  it('passes parent_id as query param', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await callTool(listCollectionsTool, { parent_id: 'parent-1' });

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('parent_id=parent-1');
  });
});

// ---------------------------------------------------------------------------
// search_concepts
// ---------------------------------------------------------------------------

describe('searchConceptsTool', () => {
  it('searches concepts with correct params', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        concepts: [
          { id: 'c1', pref_label: 'Machine Learning', notation: 'ML', status: 'active', note_count: 5 },
        ],
        total: 1,
      }),
    );

    const result = await callTool<{ concepts: Array<Record<string, unknown>> }>(
      searchConceptsTool, { query: 'machine learning', limit: 10 },
    );

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('search=machine+learning');

    expect(result.concepts).toHaveLength(1);
    expect(result.concepts[0]).toEqual({
      id: 'c1',
      label: 'Machine Learning',
      notation: 'ML',
      status: 'active',
      note_count: 5,
    });
  });

  it('normalizes array response format', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: 'c2', pref_label: 'AI', notation: 'AI', status: 'active', note_count: 3 },
      ]),
    );

    const result = await callTool<{ concepts: unknown[] }>(
      searchConceptsTool, { query: 'AI', limit: 5 },
    );

    expect(result.concepts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// get_related
// ---------------------------------------------------------------------------

describe('getRelatedTool', () => {
  it('finds similar notes via /notes/:id/similar', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { note_id: 'r1', title: 'Related', snippet: '...', score: 0.8, tags: ['ai'] },
      ]),
    );

    const result = await callTool<{ notes: Array<Record<string, unknown>> }>(
      getRelatedTool, { note_id: 'base-note', limit: 5 },
    );

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/notes/base-note/similar');
    expect(String(url)).toContain('limit=5');

    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].note_id).toBe('r1');
  });
});

// ---------------------------------------------------------------------------
// list_archives
// ---------------------------------------------------------------------------

describe('listArchivesTool', () => {
  it('lists archives via GET /archives', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          name: 'default',
          description: 'Default archive',
          is_default: true,
          note_count: 100,
          size_bytes: 1048576,
          created_at: '2026-01-01',
        },
      ]),
    );

    const result = await callTool<{ archives: Array<Record<string, unknown>> }>(
      listArchivesTool, {},
    );

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/archives');

    expect(result.archives).toHaveLength(1);
    expect(result.archives[0]).toEqual({
      name: 'default',
      description: 'Default archive',
      is_default: true,
      note_count: 100,
      size_bytes: 1048576,
      created_at: '2026-01-01',
    });
  });

  it('returns empty array for non-array response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    const result = await callTool<{ archives: unknown[] }>(
      listArchivesTool, {},
    );

    expect(result.archives).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// list_notes
// ---------------------------------------------------------------------------

describe('listNotesTool', () => {
  it('lists notes with default params', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        notes: [
          {
            id: 'n1',
            title: 'Note 1',
            content: 'Short content',
            tags: ['test'],
            created_at_utc: '2026-01-01',
            attachments: [],
          },
        ],
      }),
    );

    const result = await callTool<{ notes: Array<Record<string, unknown>>; total: number }>(
      listNotesTool, { limit: 20, sort_by: 'created_at', sort_order: 'desc', tags: undefined, archived: undefined },
    );

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('limit=20');
    expect(String(url)).toContain('sort_by=created_at');
    expect(String(url)).toContain('sort_order=desc');

    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].note_id).toBe('n1');
    expect(result.notes[0].has_attachments).toBe(false);
    expect(result.total).toBe(1);
  });

  it('passes tag and archived filters', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await callTool(listNotesTool, {
      limit: 10, sort_by: 'updated_at', sort_order: 'asc',
      tags: ['important', 'work'], archived: false,
    });

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('tags=important%2Cwork');
    expect(String(url)).toContain('archived=false');
  });

  it('truncates content to snippet (150 chars)', async () => {
    const longContent = 'A'.repeat(300);
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: 'n2', title: 'Long', content: longContent, tags: [], attachments: [] }]),
    );

    const result = await callTool<{ notes: Array<{ snippet: string }> }>(
      listNotesTool, { limit: 10, sort_by: 'created_at', sort_order: 'desc', tags: undefined, archived: undefined },
    );

    expect(result.notes[0].snippet.length).toBe(150);
  });

  it('detects attachments', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: 'n3', title: 'With Attachment', content: 'Has file', tags: [], attachments: [{ id: 'a1' }] },
      ]),
    );

    const result = await callTool<{ notes: Array<{ has_attachments: boolean }> }>(
      listNotesTool, { limit: 10, sort_by: 'created_at', sort_order: 'desc', tags: undefined, archived: undefined },
    );

    expect(result.notes[0].has_attachments).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_attachments
// ---------------------------------------------------------------------------

describe('getAttachmentsTool', () => {
  it('lists attachments for a note', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        attachments: [
          {
            id: 'att-1',
            filename: 'photo.jpg',
            content_type: 'image/jpeg',
            size_bytes: 1024,
            status: 'completed',
            ai_description: 'A photo of a cat',
            extracted_text: null,
            has_preview: true,
          },
          {
            id: 'att-2',
            original_filename: 'report.pdf',
            content_type: 'application/pdf',
            size_bytes: 50000,
            status: 'completed',
            ai_description: null,
            extracted_text: 'Quarterly report summary...',
            has_preview: false,
          },
        ],
      }),
    );

    const result = await callTool<{ note_id: string; attachments: Array<Record<string, unknown>>; total: number }>(
      getAttachmentsTool, { note_id: 'n1' },
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/notes/n1/attachments');

    expect(result.note_id).toBe('n1');
    expect(result.total).toBe(2);
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[0]).toMatchObject({
      id: 'att-1',
      filename: 'photo.jpg',
      content_type: 'image/jpeg',
      size_bytes: 1024,
      has_preview: true,
    });
    // Falls back to original_filename
    expect(result.attachments[1].filename).toBe('report.pdf');
  });

  it('normalizes array response format', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: 'att-3', filename: 'audio.mp3', content_type: 'audio/mpeg', size_bytes: 999 },
      ]),
    );

    const result = await callTool<{ attachments: Array<Record<string, unknown>>; total: number }>(
      getAttachmentsTool, { note_id: 'n2' },
    );

    expect(result.total).toBe(1);
    expect(result.attachments[0].id).toBe('att-3');
    expect(result.attachments[0].status).toBe('completed'); // default
    expect(result.attachments[0].ai_description).toBeNull(); // default
  });

  it('truncates extracted_text to 500 chars', async () => {
    const longText = 'X'.repeat(1000);
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: 'att-4', filename: 'doc.txt', content_type: 'text/plain', extracted_text: longText },
      ]),
    );

    const result = await callTool<{ attachments: Array<{ extracted_text: string | null }> }>(
      getAttachmentsTool, { note_id: 'n3' },
    );

    expect(result.attachments[0].extracted_text).toHaveLength(500);
  });

  it('returns empty array for note with no attachments', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const result = await callTool<{ attachments: Array<unknown>; total: number }>(
      getAttachmentsTool, { note_id: 'n4' },
    );

    expect(result.attachments).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Error handling (shared across tools)
// ---------------------------------------------------------------------------

describe('Fortemi API error handling', () => {
  it('includes status code and body in error message', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, 'Note not found'));

    await expect(
      callTool(getNoteTool, { note_id: 'nonexistent' }),
    ).rejects.toThrow(/404.*Note not found/);
  });

  it('handles fetch network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(
      callTool(listArchivesTool, {}),
    ).rejects.toThrow('ECONNREFUSED');
  });
});

// ---------------------------------------------------------------------------
// Fortemi URL configuration
// ---------------------------------------------------------------------------

describe('Fortemi URL configuration', () => {
  it('uses FORTEMI_API_URL env var', async () => {
    process.env.FORTEMI_API_URL = 'http://custom-fortemi:9000/api/v2';
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await callTool(listArchivesTool, {});

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('http://custom-fortemi:9000/api/v2/archives');
  });

  it('defaults to localhost:3000 when env var not set', async () => {
    delete process.env.FORTEMI_API_URL;
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await callTool(listArchivesTool, {});

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('http://localhost:3000/api/v1/archives');
  });
});
