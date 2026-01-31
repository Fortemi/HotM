/**
 * Test Data Fixtures for E2E Tests
 *
 * Provides factories and static fixtures for deterministic test scenarios.
 */

import type { NoteFull, SearchHit, NoteSummary, HealthResponse } from '../../src/services/api';

/**
 * Factory: Generate dynamic note data with overrides
 */
export const noteFactory = {
  build: (overrides: Partial<NoteFull> = {}): NoteFull => ({
    note: {
      id: `test-note-${Date.now()}`,
      format: 'markdown',
      source: 'test',
      created_at_utc: new Date().toISOString(),
      updated_at_utc: new Date().toISOString(),
      starred: false,
      archived: false,
      title: 'Test Note Title',
      ...overrides.note,
    },
    original: {
      content: 'Test note content',
      hash: 'abc123',
      ...overrides.original,
    },
    revised: {
      content: 'Revised test note content',
      last_revision_id: 'rev-001',
      ...overrides.revised,
    },
    tags: ['test', 'example'],
    links: [],
    labels: [],
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<NoteFull> = {}): NoteFull[] =>
    Array.from({ length: count }, (_, i) =>
      noteFactory.build({
        ...overrides,
        note: {
          id: `test-note-${i}`,
          title: `Test Note ${i}`,
          ...overrides.note,
        },
      })
    ),
};

/**
 * Factory: Generate search results
 */
export const searchHitFactory = {
  build: (overrides: Partial<SearchHit> = {}): SearchHit => ({
    note_id: `search-note-${Date.now()}`,
    score: 0.85,
    snippet: 'This is a search result snippet...',
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<SearchHit> = {}): SearchHit[] =>
    Array.from({ length: count }, (_, i) =>
      searchHitFactory.build({
        ...overrides,
        note_id: `search-note-${i}`,
        score: 0.9 - i * 0.1,
      })
    ),
};

/**
 * Factory: Generate note summaries for list view
 */
export const noteSummaryFactory = {
  build: (overrides: Partial<NoteSummary> = {}): NoteSummary => ({
    id: `summary-note-${Date.now()}`,
    title: 'Test Summary Note',
    snippet: 'This is a test note snippet for the summary view...',
    created_at_utc: new Date().toISOString(),
    updated_at_utc: new Date().toISOString(),
    starred: false,
    archived: false,
    tags: ['test'],
    has_revision: true,
    metadata: {},
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<NoteSummary> = {}): NoteSummary[] =>
    Array.from({ length: count }, (_, i) =>
      noteSummaryFactory.build({
        ...overrides,
        id: `summary-note-${i}`,
        title: `Summary Note ${i}`,
      })
    ),
};

/**
 * Static Fixtures: Deterministic test scenarios
 */
export const fixtures = {
  // Health check responses
  healthySystem: {
    ok: true,
    ollama: true,
    db: true,
    vector: true,
  } as HealthResponse,

  unhealthySystem: {
    ok: false,
    ollama: false,
    db: true,
    vector: false,
  } as HealthResponse,

  // Standard test note
  standardNote: {
    note: {
      id: 'fixture-note-001',
      format: 'markdown',
      source: 'ui',
      created_at_utc: '2024-01-15T10:00:00Z',
      updated_at_utc: '2024-01-15T10:00:00Z',
      starred: false,
      archived: false,
      title: 'Fixture Standard Note',
    },
    original: {
      content: '# Fixture Note\n\nThis is a fixture note for testing.',
      hash: 'fixture-hash-001',
    },
    revised: {
      content: '# Fixture Note (Revised)\n\nThis is a revised fixture note for testing with AI enhancements.',
      last_revision_id: 'rev-fixture-001',
    },
    tags: ['fixture', 'test'],
    links: [],
    labels: [],
  } as NoteFull,

  // Starred note
  starredNote: {
    note: {
      id: 'fixture-note-002',
      format: 'markdown',
      source: 'ui',
      created_at_utc: '2024-01-14T10:00:00Z',
      updated_at_utc: '2024-01-14T10:00:00Z',
      starred: true,
      archived: false,
      title: 'Important Starred Note',
    },
    original: {
      content: '# Important Note\n\nThis note is starred.',
      hash: 'fixture-hash-002',
    },
    revised: {
      content: '# Important Note (Revised)\n\nThis note is starred and has been revised.',
      last_revision_id: 'rev-fixture-002',
    },
    tags: ['important', 'starred'],
    links: [],
    labels: [],
  } as NoteFull,

  // Archived note
  archivedNote: {
    note: {
      id: 'fixture-note-003',
      format: 'markdown',
      source: 'ui',
      created_at_utc: '2024-01-10T10:00:00Z',
      updated_at_utc: '2024-01-10T10:00:00Z',
      starred: false,
      archived: true,
      title: 'Old Archived Note',
    },
    original: {
      content: '# Old Note\n\nThis note is archived.',
      hash: 'fixture-hash-003',
    },
    revised: {
      content: '# Old Note (Revised)\n\nThis note is archived.',
      last_revision_id: 'rev-fixture-003',
    },
    tags: ['archived', 'old'],
    links: [],
    labels: [],
  } as NoteFull,

  // Note with tags and labels
  taggedNote: {
    note: {
      id: 'fixture-note-004',
      format: 'markdown',
      source: 'ui',
      created_at_utc: '2024-01-16T10:00:00Z',
      updated_at_utc: '2024-01-16T10:00:00Z',
      starred: false,
      archived: false,
      title: 'Tagged Note',
    },
    original: {
      content: '# Tagged Note\n\nThis note has multiple tags and labels.',
      hash: 'fixture-hash-004',
    },
    revised: {
      content: '# Tagged Note (Revised)\n\nThis note has multiple tags and labels.',
      last_revision_id: 'rev-fixture-004',
    },
    tags: ['tag1', 'tag2', 'tag3'],
    links: [],
    labels: [
      {
        id: 'label-001',
        note_id: 'fixture-note-004',
        label: 'Priority: High',
        color: '#ff0000',
        created_at: '2024-01-16T10:00:00Z',
      },
      {
        id: 'label-002',
        note_id: 'fixture-note-004',
        label: 'Status: In Progress',
        color: '#00ff00',
        created_at: '2024-01-16T10:00:00Z',
      },
    ],
  } as NoteFull,

  // Empty note (edge case)
  emptyNote: {
    note: {
      id: 'fixture-note-005',
      format: 'markdown',
      source: 'ui',
      created_at_utc: '2024-01-17T10:00:00Z',
      updated_at_utc: '2024-01-17T10:00:00Z',
      starred: false,
      archived: false,
      title: 'Empty Note',
    },
    original: {
      content: '',
      hash: 'fixture-hash-005',
    },
    revised: {
      content: '',
    },
    tags: [],
    links: [],
    labels: [],
  } as NoteFull,

  // Note with very long content (boundary test)
  longNote: {
    note: {
      id: 'fixture-note-006',
      format: 'markdown',
      source: 'ui',
      created_at_utc: '2024-01-18T10:00:00Z',
      updated_at_utc: '2024-01-18T10:00:00Z',
      starred: false,
      archived: false,
      title: 'Very Long Note',
    },
    original: {
      content: '# Long Note\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(1000),
      hash: 'fixture-hash-006',
    },
    revised: {
      content: '# Long Note (Revised)\n\n' + 'Lorem ipsum dolor sit amet (revised). '.repeat(1000),
      last_revision_id: 'rev-fixture-006',
    },
    tags: ['long', 'boundary'],
    links: [],
    labels: [],
  } as NoteFull,

  // Search results
  searchResults: [
    {
      note_id: 'fixture-note-001',
      score: 0.95,
      snippet: 'This is a fixture note for testing...',
    },
    {
      note_id: 'fixture-note-002',
      score: 0.87,
      snippet: 'This note is starred...',
    },
    {
      note_id: 'fixture-note-004',
      score: 0.75,
      snippet: 'This note has multiple tags and labels...',
    },
  ] as SearchHit[],

  // Empty search results (edge case)
  emptySearchResults: [] as SearchHit[],

  // API error responses
  apiErrors: {
    notFound: {
      status: 404,
      body: { error: 'Note not found' },
    },
    serverError: {
      status: 500,
      body: { error: 'Internal server error' },
    },
    unauthorized: {
      status: 401,
      body: { error: 'Unauthorized' },
    },
    badRequest: {
      status: 400,
      body: { error: 'Bad request' },
    },
    timeout: {
      status: 408,
      body: { error: 'Request timeout' },
    },
  },
};

/**
 * Mock API Response Helpers
 */
export const mockResponses = {
  createNote: (noteId: string) => ({
    note_id: noteId,
  }),

  listNotes: (notes: NoteSummary[]) => ({
    notes,
    total: notes.length,
  }),

  searchNotes: (hits: SearchHit[]) => ({
    notes: hits,
  }),
};
