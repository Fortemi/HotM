import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentTools } from '../tools';

// Mock the API module
vi.mock('@/api', () => ({
  api: {
    search: {
      search: vi.fn().mockResolvedValue([
        { note_id: 'n1', title: 'Test', snippet: 'snippet', score: 0.9, tags: ['tag1'] },
      ]),
      findSimilar: vi.fn().mockResolvedValue([
        { note_id: 'n2', title: 'Related', snippet: 'related', score: 0.8, tags: [] },
      ]),
    },
    notes: {
      create: vi.fn().mockResolvedValue({ note_id: 'new-1', status: 'created' }),
      get: vi.fn().mockResolvedValue({
        note: { id: 'n1', title: 'My Note', created_at_utc: '2025-01-01T00:00:00Z' },
        original: { content: 'original content' },
        revised: { content: 'revised content' },
        tags: ['tag1', 'tag2'],
      }),
      updateTags: vi.fn().mockResolvedValue(['tag1', 'tag2', 'newtag']),
    },
    extended: {
      queueJob: vi.fn().mockResolvedValue({ job_id: 'job-1' }),
    },
    links: {
      createLink: vi.fn().mockResolvedValue({ id: 'link-1' }),
    },
    collections: {
      list: vi.fn().mockResolvedValue([
        { id: 'c1', name: 'Work', description: 'Work notes' },
        { id: 'c2', name: 'Personal', description: null },
      ]),
    },
    concepts: {
      listConcepts: vi.fn().mockResolvedValue([
        { id: 'con1', pref_label: 'AI', definition: 'Artificial Intelligence' },
      ]),
    },
  },
}));

describe('agentTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports all 9 tool definitions', () => {
    expect(Object.keys(agentTools)).toHaveLength(9);
    expect(Object.keys(agentTools)).toEqual([
      'search_notes',
      'create_note',
      'get_note',
      'revise_note',
      'update_tags',
      'link_notes',
      'list_collections',
      'search_concepts',
      'get_related',
    ]);
  });

  it('each tool has description and inputSchema', () => {
    for (const [name, t] of Object.entries(agentTools)) {
      expect(t.description, `${name} missing description`).toBeTruthy();
      expect(t.inputSchema, `${name} missing inputSchema`).toBeTruthy();
    }
  });

  it('each tool has an execute function', () => {
    for (const [name, t] of Object.entries(agentTools)) {
      expect(typeof t.execute, `${name} missing execute`).toBe('function');
    }
  });

  describe('search_notes', () => {
    it('calls api.search.search and maps results', async () => {
      const { api } = await import('@/api');
      const result = await agentTools.search_notes.execute!(
        { query: 'test', limit: 10, mode: 'hybrid' },
        { toolCallId: 'tc1', messages: [] },
      );

      expect(api.search.search).toHaveBeenCalledWith('test', {
        limit: 10,
        mode: 'hybrid',
      });
      expect(result).toEqual([
        { note_id: 'n1', title: 'Test', snippet: 'snippet', score: 0.9, tags: ['tag1'] },
      ]);
    });
  });

  describe('create_note', () => {
    it('creates note and applies tags', async () => {
      const { api } = await import('@/api');
      const result = await agentTools.create_note.execute!(
        { content: 'hello', revision_mode: 'standard', tags: ['tag1'] },
        { toolCallId: 'tc2', messages: [] },
      );

      expect(api.notes.create).toHaveBeenCalledWith({
        content: 'hello',
        revision_mode: 'standard',
      });
      expect(api.notes.updateTags).toHaveBeenCalledWith('new-1', { add: ['tag1'] });
      expect(result).toMatchObject({ note_id: 'new-1' });
    });

    it('skips tag update when no tags provided', async () => {
      const { api } = await import('@/api');
      await agentTools.create_note.execute!(
        { content: 'hello', revision_mode: 'none' },
        { toolCallId: 'tc3', messages: [] },
      );

      expect(api.notes.updateTags).not.toHaveBeenCalled();
    });
  });

  describe('get_note', () => {
    it('returns revised content by default', async () => {
      const result = await agentTools.get_note.execute!(
        { note_id: 'n1' },
        { toolCallId: 'tc4', messages: [] },
      );

      expect(result).toMatchObject({
        note_id: 'n1',
        title: 'My Note',
        content: 'revised content',
        tags: ['tag1', 'tag2'],
      });
    });
  });

  describe('revise_note', () => {
    it('queues an ai_revision job', async () => {
      const { api } = await import('@/api');
      const result = await agentTools.revise_note.execute!(
        { note_id: 'n1' },
        { toolCallId: 'tc5', messages: [] },
      );

      expect(api.extended.queueJob).toHaveBeenCalledWith('n1', 'ai_revision');
      expect(result).toMatchObject({ note_id: 'n1', status: 'revision_queued' });
    });
  });

  describe('update_tags', () => {
    it('calls updateTags with add and remove', async () => {
      const { api } = await import('@/api');
      const result = await agentTools.update_tags.execute!(
        { note_id: 'n1', add: ['newtag'], remove: ['oldtag'] },
        { toolCallId: 'tc6', messages: [] },
      );

      expect(api.notes.updateTags).toHaveBeenCalledWith('n1', {
        add: ['newtag'],
        remove: ['oldtag'],
      });
      expect(result).toMatchObject({ note_id: 'n1', tags: ['tag1', 'tag2', 'newtag'] });
    });
  });

  describe('link_notes', () => {
    it('creates a link between two notes', async () => {
      const { api } = await import('@/api');
      const result = await agentTools.link_notes.execute!(
        { source_id: 'n1', target_id: 'n2', kind: 'related' },
        { toolCallId: 'tc7', messages: [] },
      );

      expect(api.links.createLink).toHaveBeenCalledWith('n1', {
        to_note_id: 'n2',
        kind: 'related',
      });
      expect(result).toMatchObject({
        source_id: 'n1',
        target_id: 'n2',
        kind: 'related',
      });
    });
  });

  describe('list_collections', () => {
    it('lists and maps collections', async () => {
      const result = await agentTools.list_collections.execute!(
        { parent_id: undefined },
        { toolCallId: 'tc8', messages: [] },
      );

      expect(result).toMatchObject({
        collections: [
          { id: 'c1', name: 'Work', description: 'Work notes' },
          { id: 'c2', name: 'Personal' },
        ],
      });
    });
  });

  describe('search_concepts', () => {
    it('searches and maps concepts', async () => {
      const { api } = await import('@/api');
      const result = await agentTools.search_concepts.execute!(
        { query: 'AI', limit: 10 },
        { toolCallId: 'tc9', messages: [] },
      );

      expect(api.concepts.listConcepts).toHaveBeenCalledWith({
        search: 'AI',
        limit: 10,
      });
      expect(result).toMatchObject({
        concepts: [{ id: 'con1', label: 'AI', definition: 'Artificial Intelligence' }],
      });
    });
  });

  describe('get_related', () => {
    it('finds similar notes via search API', async () => {
      const { api } = await import('@/api');
      const result = await agentTools.get_related.execute!(
        { note_id: 'n1', limit: 5 },
        { toolCallId: 'tc10', messages: [] },
      );

      expect(api.search.findSimilar).toHaveBeenCalledWith('n1', { limit: 5 });
      expect(result).toMatchObject({
        notes: [{ note_id: 'n2', title: 'Related', score: 0.8 }],
      });
    });
  });
});
