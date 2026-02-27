import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();
const mockUpdateTags = vi.fn();
const mockMoveNote = vi.fn();
const mockTagNote = vi.fn();

vi.mock('@/api', () => ({
  api: {
    notes: {
      create: (...args: unknown[]) => mockCreate(...args),
      updateTags: (...args: unknown[]) => mockUpdateTags(...args),
    },
    attachments: {
      uploadAttachment: vi.fn(),
    },
    collections: {
      moveNote: (...args: unknown[]) => mockMoveNote(...args),
    },
    concepts: {
      tagNote: (...args: unknown[]) => mockTagNote(...args),
    },
  },
}));

vi.mock('@/api/memory-context', () => ({
  getActiveMemory: vi.fn(() => null),
  setActiveMemory: vi.fn(),
}));

const mockEnqueueFiles = vi.fn();

vi.mock('@/services/uploadStore', () => ({
  uploadStore: {
    enqueueFiles: (...args: unknown[]) => mockEnqueueFiles(...args),
  },
}));

import { useNoteCommit } from '../useNoteCommit';
import type { StickySettings } from '../useStickySettings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, size: number, type = 'application/octet-stream'): File {
  const blob = new Blob(['x'], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const defaultSettings: StickySettings = {
  archive: null,
  collectionId: null,
  collectionName: '',
  tags: [],
  conceptId: null,
  conceptLabel: '',
  format: 'markdown',
  revisionMode: 'standard',
  documentType: null,
  documentTypeName: '',
  contextFilter: {},
  processing: {
    autoTagConcepts: true,
    generateEmbeddings: true,
    autoLinkRelated: true,
    extractMedia: true,
    generateTitle: true,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNoteCommit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ note_id: 'note-1' });
  });

  it('enqueues files via uploadStore for background upload', async () => {
    const fileA = makeFile('small.txt', 1024);
    const fileB = makeFile('huge.mp4', 100 * 1024 * 1024, 'video/mp4');

    const { result } = renderHook(() => useNoteCommit());

    let commitResult: Awaited<ReturnType<typeof result.current.commit>> | undefined;
    await act(async () => {
      commitResult = await result.current.commit('test content', defaultSettings, [fileA, fileB]);
    });

    expect(mockEnqueueFiles).toHaveBeenCalledWith('note-1', [fileA, fileB]);
    expect(commitResult?.attachmentCount).toBe(2);
    expect(commitResult?.warnings).toHaveLength(0);
  });

  it('does not enqueue when no files are provided', async () => {
    const { result } = renderHook(() => useNoteCommit());

    await act(async () => {
      await result.current.commit('no files', defaultSettings);
    });

    expect(mockEnqueueFiles).not.toHaveBeenCalled();
  });

  it('reports attachmentCount matching number of queued files', async () => {
    const files = [
      makeFile('a.pdf', 1024),
      makeFile('b.pdf', 2048),
      makeFile('c.pdf', 4096),
    ];

    const { result } = renderHook(() => useNoteCommit());

    let commitResult: Awaited<ReturnType<typeof result.current.commit>> | undefined;
    await act(async () => {
      commitResult = await result.current.commit('test', defaultSettings, files);
    });

    expect(mockEnqueueFiles).toHaveBeenCalledWith('note-1', files);
    expect(commitResult?.attachmentCount).toBe(3);
  });
});
