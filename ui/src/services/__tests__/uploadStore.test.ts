import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the API before importing the store
vi.mock('@/api', () => ({
  api: {
    attachments: {
      uploadAttachment: vi.fn(),
    },
  },
}));

describe('uploadStore', () => {
  let mod: typeof import('@/services/uploadStore');
  let apiMod: typeof import('@/api');

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    mod = await import('@/services/uploadStore');
    apiMod = await import('@/api');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeFile(name: string, type = 'text/plain', size = 1024): File {
    const content = new Array(size).fill('x').join('');
    return new File([content], name, { type });
  }

  function makeFileList(...files: File[]): FileList {
    return {
      ...files.reduce((acc, f, i) => ({ ...acc, [i]: f }), {}),
      length: files.length,
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: function* () { yield* files; },
    } as unknown as FileList;
  }

  /** Flush microtasks without advancing timer clock past 30s auto-clear */
  async function flushQueue() {
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(0);
    }
  }

  it('starts with empty state', () => {
    const state = mod.uploadStore.getSnapshot();
    expect(state.entries.size).toBe(0);
    expect(state.isProcessing).toBe(false);
    expect(state.summary).toEqual({ queued: 0, uploading: 0, completed: 0, failed: 0 });
  });

  it('enqueues files with correct status and counters', () => {
    const files = makeFileList(makeFile('a.txt'), makeFile('b.txt'));
    mod.uploadStore.enqueueFiles('note-1', files);

    const state = mod.uploadStore.getSnapshot();
    expect(state.entries.size).toBe(2);
    // First entry may already be 'uploading' because kickQueue runs synchronously up to first await
    const entries = Array.from(state.entries.values());
    expect(entries[0].noteId).toBe('note-1');
    expect(['queued', 'uploading']).toContain(entries[0].status);
    expect(entries[1].file.name).toBe('b.txt');
    expect(entries[1].status).toBe('queued');
  });

  it('processes queue — entries transition through uploading to completed', async () => {
    const mockAttachment = { id: 'att-1', filename: 'a.txt' };
    vi.mocked(apiMod.api.attachments.uploadAttachment).mockResolvedValue(mockAttachment as never);

    const file = makeFile('a.txt');
    mod.uploadStore.enqueueFiles('note-1', [file]);

    await flushQueue();

    const state = mod.uploadStore.getSnapshot();
    const entries = Array.from(state.entries.values());
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('completed');
    expect(entries[0].result).toEqual(mockAttachment);
    expect(state.summary.completed).toBe(1);
    expect(state.isProcessing).toBe(false);
  });

  it('marks entry as failed when upload throws, continues with next file', async () => {
    vi.mocked(apiMod.api.attachments.uploadAttachment)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ id: 'att-2', filename: 'b.txt' } as never);

    const files = makeFileList(makeFile('a.txt'), makeFile('b.txt'));
    mod.uploadStore.enqueueFiles('note-1', files);

    await flushQueue();

    const state = mod.uploadStore.getSnapshot();
    const entries = Array.from(state.entries.values());
    expect(entries).toHaveLength(2);
    expect(entries[0].status).toBe('failed');
    expect(entries[0].error).toBe('Network error');
    expect(entries[1].status).toBe('completed');
    expect(state.summary.failed).toBe(1);
    expect(state.summary.completed).toBe(1);
  });

  it('retryFile resets failed entry to queued and restarts processing', async () => {
    vi.mocked(apiMod.api.attachments.uploadAttachment)
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ id: 'att-1', filename: 'a.txt' } as never);

    mod.uploadStore.enqueueFiles('note-1', [makeFile('a.txt')]);

    await flushQueue();

    let state = mod.uploadStore.getSnapshot();
    const failedEntry = Array.from(state.entries.values())[0];
    expect(failedEntry.status).toBe('failed');

    mod.uploadStore.retryFile(failedEntry.id);

    // retryFile resets to queued then kickQueue picks it up immediately,
    // so it may already be 'uploading' by the time we snapshot
    state = mod.uploadStore.getSnapshot();
    const retried = state.entries.get(failedEntry.id)!;
    expect(['queued', 'uploading']).toContain(retried.status);
    expect(retried.retryCount).toBe(1);

    await flushQueue();

    state = mod.uploadStore.getSnapshot();
    const completed = state.entries.get(failedEntry.id)!;
    expect(completed.status).toBe('completed');
  });

  it('cancelFile removes a queued entry', () => {
    mod.uploadStore.enqueueFiles('note-1', [makeFile('a.txt'), makeFile('b.txt')]);

    const state = mod.uploadStore.getSnapshot();
    // First entry may already be uploading; cancel the second (still queued)
    const entries = Array.from(state.entries.values());
    const queuedEntry = entries.find(e => e.status === 'queued')!;
    expect(queuedEntry).toBeTruthy();

    mod.uploadStore.cancelFile(queuedEntry.id);

    const after = mod.uploadStore.getSnapshot();
    expect(after.entries.has(queuedEntry.id)).toBe(false);
    expect(after.entries.size).toBe(1);
  });

  it('clearCompleted removes completed and failed entries', async () => {
    vi.mocked(apiMod.api.attachments.uploadAttachment)
      .mockResolvedValueOnce({ id: 'att-1' } as never)
      .mockRejectedValueOnce(new Error('fail'));

    mod.uploadStore.enqueueFiles('note-1', makeFileList(makeFile('a.txt'), makeFile('b.txt')));

    await flushQueue();

    let state = mod.uploadStore.getSnapshot();
    expect(state.entries.size).toBe(2);

    mod.uploadStore.clearCompleted();

    state = mod.uploadStore.getSnapshot();
    expect(state.entries.size).toBe(0);
  });

  it('onNoteUploadsComplete callback fires per file completion', async () => {
    vi.mocked(apiMod.api.attachments.uploadAttachment)
      .mockResolvedValueOnce({ id: 'att-1' } as never)
      .mockResolvedValueOnce({ id: 'att-2' } as never);

    const callback = vi.fn();
    const unsub = mod.uploadStore.onNoteUploadsComplete(callback);

    mod.uploadStore.enqueueFiles('note-1', makeFileList(makeFile('a.txt'), makeFile('b.txt')));

    await flushQueue();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith('note-1', expect.objectContaining({ status: 'completed' }));

    unsub();
  });

  it('processes files sequentially (only one uploading at a time)', async () => {
    let activeUploads = 0;
    let maxConcurrent = 0;

    vi.mocked(apiMod.api.attachments.uploadAttachment).mockImplementation(async () => {
      activeUploads++;
      maxConcurrent = Math.max(maxConcurrent, activeUploads);
      // Yield to microtask queue
      await Promise.resolve();
      activeUploads--;
      return { id: 'att' } as never;
    });

    mod.uploadStore.enqueueFiles('note-1', makeFileList(makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')));

    await flushQueue();

    expect(maxConcurrent).toBe(1);
  });

  it('sets mediaOptimize only for audio/video files', () => {
    const video = makeFile('clip.mp4', 'video/mp4');
    const image = makeFile('photo.png', 'image/png');

    mod.uploadStore.enqueueFiles('note-1', [video, image], { mediaOptimize: true });

    const entries = Array.from(mod.uploadStore.getSnapshot().entries.values());
    const videoEntry = entries.find(e => e.file.name === 'clip.mp4')!;
    const imageEntry = entries.find(e => e.file.name === 'photo.png')!;
    expect(videoEntry.mediaOptimize).toBe(true);
    expect(imageEntry.mediaOptimize).toBe(false);
  });

  it('passes mediaOptimize option to API when set', async () => {
    vi.mocked(apiMod.api.attachments.uploadAttachment).mockResolvedValue({ id: 'att-1' } as never);

    const video = makeFile('clip.mp4', 'video/mp4');
    mod.uploadStore.enqueueFiles('note-1', [video], { mediaOptimize: true });

    await flushQueue();

    expect(apiMod.api.attachments.uploadAttachment).toHaveBeenCalledWith(
      'note-1',
      video,
      { mediaOptimize: true },
    );
  });

  it('notifies subscribers on state change', () => {
    const listener = vi.fn();
    const unsub = mod.uploadStore.subscribe(listener);

    mod.uploadStore.enqueueFiles('note-1', [makeFile('a.txt')]);

    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('auto-clears completed entries after 30s', async () => {
    vi.mocked(apiMod.api.attachments.uploadAttachment).mockResolvedValue({ id: 'att-1' } as never);

    mod.uploadStore.enqueueFiles('note-1', [makeFile('a.txt')]);

    await flushQueue();

    let state = mod.uploadStore.getSnapshot();
    expect(state.entries.size).toBe(1);
    expect(Array.from(state.entries.values())[0].status).toBe('completed');

    // Advance past auto-clear delay
    vi.advanceTimersByTime(31_000);

    state = mod.uploadStore.getSnapshot();
    expect(state.entries.size).toBe(0);
  });
});
