import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUploadAttachment = vi.fn();
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
      uploadAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
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

const mockStartTusUpload = vi.fn();
const mockShouldUseTus = vi.fn();

vi.mock('@/services/tusUploader', () => ({
  shouldUseTus: (...args: unknown[]) => mockShouldUseTus(...args),
  startTusUpload: (...args: unknown[]) => mockStartTusUpload(...args),
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
  revisionMode: 'default',
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
    mockUploadAttachment.mockResolvedValue({ id: 'att-1', filename: 'small.txt' });
  });

  it('uses regular upload for small files', async () => {
    const smallFile = makeFile('small.txt', 1024);
    mockShouldUseTus.mockReturnValue(false);

    const { result } = renderHook(() => useNoteCommit());

    await act(async () => {
      await result.current.commit('test content', defaultSettings, [smallFile]);
    });

    expect(mockShouldUseTus).toHaveBeenCalledWith(smallFile);
    expect(mockUploadAttachment).toHaveBeenCalledWith('note-1', smallFile);
    expect(mockStartTusUpload).not.toHaveBeenCalled();
  });

  it('uses TUS upload for large files', async () => {
    const largeFile = makeFile('huge.mp4', 100 * 1024 * 1024, 'video/mp4');
    mockShouldUseTus.mockReturnValue(true);
    mockStartTusUpload.mockReturnValue({
      promise: Promise.resolve({ id: 'att-2', filename: 'huge.mp4' }),
      abort: vi.fn(),
    });

    const { result } = renderHook(() => useNoteCommit());

    await act(async () => {
      await result.current.commit('test content', defaultSettings, [largeFile]);
    });

    expect(mockShouldUseTus).toHaveBeenCalledWith(largeFile);
    expect(mockStartTusUpload).toHaveBeenCalledWith({
      noteId: 'note-1',
      file: largeFile,
      mediaOptimize: false,
    });
    expect(mockUploadAttachment).not.toHaveBeenCalled();
  });

  it('routes mixed files correctly (small via fetch, large via TUS)', async () => {
    const smallFile = makeFile('doc.pdf', 1024);
    const largeFile = makeFile('video.mkv', 627 * 1024 * 1024, 'video/x-matroska');
    mockShouldUseTus.mockImplementation((file: File) => file.size >= 50 * 1024 * 1024);
    mockStartTusUpload.mockReturnValue({
      promise: Promise.resolve({ id: 'att-tus', filename: 'video.mkv' }),
      abort: vi.fn(),
    });

    const { result } = renderHook(() => useNoteCommit());

    let commitResult: Awaited<ReturnType<typeof result.current.commit>> | undefined;
    await act(async () => {
      commitResult = await result.current.commit('test', defaultSettings, [smallFile, largeFile]);
    });

    // Small file goes through regular upload
    expect(mockUploadAttachment).toHaveBeenCalledWith('note-1', smallFile);
    // Large file goes through TUS
    expect(mockStartTusUpload).toHaveBeenCalledWith({
      noteId: 'note-1',
      file: largeFile,
      mediaOptimize: false,
    });
    expect(commitResult?.attachmentCount).toBe(2);
    expect(commitResult?.warnings).toHaveLength(0);
  });

  it('reports warning when TUS upload fails', async () => {
    const largeFile = makeFile('huge.mp4', 100 * 1024 * 1024);
    mockShouldUseTus.mockReturnValue(true);
    mockStartTusUpload.mockReturnValue({
      promise: Promise.reject(new Error('Connection reset')),
      abort: vi.fn(),
    });

    const { result } = renderHook(() => useNoteCommit());

    let commitResult: Awaited<ReturnType<typeof result.current.commit>> | undefined;
    await act(async () => {
      commitResult = await result.current.commit('test', defaultSettings, [largeFile]);
    });

    expect(commitResult?.attachmentCount).toBe(0);
    expect(commitResult?.warnings).toContain(
      'Could not upload: huge.mp4 — Connection reset',
    );
  });
});
