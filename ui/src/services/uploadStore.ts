/**
 * Background Upload Store
 *
 * Singleton store managing a sequential upload queue. Files are enqueued
 * fire-and-forget by AttachmentsPanel and processed one at a time.
 * Exposes a useSyncExternalStore-compatible API so React components
 * (JobQueueIndicator, JobQueueMonitor) can display transfer status.
 */

import { api } from '@/api';
import { getActiveMemory, getMemoryRoutingHeaderName } from '@/api/memory-context';
import { invokeTauri } from '@/lib/tauri';
import type { Attachment } from '@/api/types-extended';
import { startTusUpload, shouldUseTus, type TusUploadHandle } from './tusUploader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadStatus = 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled';

export interface LocalFileAttachment {
  source: 'local';
  path: string;
  name: string;
  size: number;
  type: string;
}

export type UploadInput = File | LocalFileAttachment;

function isLocalFile(file: UploadInput): file is LocalFileAttachment {
  return (file as LocalFileAttachment).source === 'local';
}

function getUploadType(file: UploadInput): string {
  return file.type || 'application/octet-stream';
}

export interface UploadFileEntry {
  id: string;
  file: UploadInput;
  noteId: string;
  status: UploadStatus;
  bytesUploaded: number;
  bytesTotal: number;
  error: string | null;
  retryCount: number;
  mediaOptimize: boolean;
  result: Attachment | null;
  enqueuedAt: number;
  completedAt: number | null;
}

export interface UploadStoreSummary {
  queued: number;
  uploading: number;
  completed: number;
  failed: number;
}

export interface UploadStoreState {
  entries: Map<string, UploadFileEntry>;
  isProcessing: boolean;
  summary: UploadStoreSummary;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_CLEAR_DELAY_MS = 30_000;

// ---------------------------------------------------------------------------
// UploadStore
// ---------------------------------------------------------------------------

type Listener = () => void;
type NoteUploadCallback = (noteId: string, entry: UploadFileEntry) => void;

let idCounter = 0;

class UploadStore {
  private state: UploadStoreState;
  private listeners = new Set<Listener>();
  private noteUploadCallbacks = new Set<NoteUploadCallback>();
  private clearTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeTusUploads = new Map<string, TusUploadHandle>();

  constructor() {
    this.state = {
      entries: new Map(),
      isProcessing: false,
      summary: { queued: 0, uploading: 0, completed: 0, failed: 0 },
    };
  }

  // ---- useSyncExternalStore API ----

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): UploadStoreState => {
    return this.state;
  };

  getServerSnapshot = (): UploadStoreState => {
    return this.state;
  };

  // ---- Public API ----

  enqueueFiles(
    noteId: string,
    files: FileList | UploadInput[],
    opts?: { mediaOptimize?: boolean },
  ): void {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    this.mutate((s) => {
      const newEntries = new Map(s.entries);
      for (const file of fileArray) {
        const id = `upload-${++idCounter}-${Date.now()}`;
        const fileType = getUploadType(file);
        const isMedia = fileType.startsWith('audio/') || fileType.startsWith('video/');
        newEntries.set(id, {
          id,
          file,
          noteId,
          status: 'queued',
          bytesUploaded: 0,
          bytesTotal: file.size,
          error: null,
          retryCount: 0,
          mediaOptimize: !!(opts?.mediaOptimize && isMedia),
          result: null,
          enqueuedAt: Date.now(),
          completedAt: null,
        });
      }
      s.entries = newEntries;
    });

    this.kickQueue();
  }

  retryFile(id: string): void {
    const entry = this.state.entries.get(id);
    if (!entry || entry.status !== 'failed') return;

    // tus resumes from server offset via HEAD — preserve bytesUploaded.
    // Fetch uploads restart from scratch.
    const preserveProgress = !isLocalFile(entry.file) && shouldUseTus(entry.file);

    this.mutate((s) => {
      const newEntries = new Map(s.entries);
      newEntries.set(id, {
        ...entry,
        status: 'queued',
        error: null,
        retryCount: entry.retryCount + 1,
        bytesUploaded: preserveProgress ? entry.bytesUploaded : 0,
        result: null,
        completedAt: null,
      });
      s.entries = newEntries;
    });

    this.kickQueue();
  }

  cancelFile(id: string): void {
    const entry = this.state.entries.get(id);
    if (!entry) return;

    // Clear any auto-clear timer
    const timer = this.clearTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.clearTimers.delete(id);
    }

    if (entry.status === 'uploading') {
      // Abort active tus upload if present; fetch uploads just get marked cancelled
      this.activeTusUploads.get(id)?.abort();
      this.activeTusUploads.delete(id);

      this.mutate((s) => {
        const newEntries = new Map(s.entries);
        newEntries.set(id, { ...entry, status: 'cancelled' });
        s.entries = newEntries;
      });
    } else {
      this.mutate((s) => {
        const newEntries = new Map(s.entries);
        newEntries.delete(id);
        s.entries = newEntries;
      });
    }
  }

  clearCompleted(): void {
    this.mutate((s) => {
      const newEntries = new Map(s.entries);
      for (const [id, entry] of newEntries) {
        if (entry.status === 'completed' || entry.status === 'failed') {
          newEntries.delete(id);
          const timer = this.clearTimers.get(id);
          if (timer) {
            clearTimeout(timer);
            this.clearTimers.delete(id);
          }
        }
      }
      s.entries = newEntries;
    });
  }

  /**
   * Register a callback that fires each time a file upload completes
   * (or fails) for a given note. Returns an unsubscribe function.
   */
  onNoteUploadsComplete(cb: NoteUploadCallback): () => void {
    this.noteUploadCallbacks.add(cb);
    return () => {
      this.noteUploadCallbacks.delete(cb);
    };
  }

  // ---- Internal ----

  private mutate(updater: (state: UploadStoreState) => void): void {
    const next = { ...this.state };
    updater(next);
    next.summary = this.computeSummary(next.entries);
    this.state = next;
    this.notify();
  }

  private computeSummary(entries: Map<string, UploadFileEntry>): UploadStoreSummary {
    let queued = 0;
    let uploading = 0;
    let completed = 0;
    let failed = 0;
    for (const entry of entries.values()) {
      switch (entry.status) {
        case 'queued': queued++; break;
        case 'uploading': uploading++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
      }
    }
    return { queued, uploading, completed, failed };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('uploadStore listener error:', err);
      }
    });
  }

  private async kickQueue(): Promise<void> {
    if (this.state.isProcessing) return;

    this.mutate((s) => {
      s.isProcessing = true;
    });

    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (true) {
      // Find next queued entry (FIFO by insertion order)
      let nextEntry: UploadFileEntry | null = null;
      for (const entry of this.state.entries.values()) {
        if (entry.status === 'queued') {
          nextEntry = entry;
          break;
        }
      }

      if (!nextEntry) break;

      const entryId = nextEntry.id;

      // Mark as uploading
      this.mutate((s) => {
        const entry = s.entries.get(entryId);
        if (!entry) return;
        const newEntries = new Map(s.entries);
        newEntries.set(entryId, { ...entry, status: 'uploading' });
        s.entries = newEntries;
      });

      const current = this.state.entries.get(entryId);
      if (!current) continue;

      try {
        const result = isLocalFile(current.file)
          ? await this.uploadViaLocal(current)
          : shouldUseTus(current.file)
            ? await this.uploadViaTus(entryId, current)
            : await this.uploadViaFetch(entryId, current);

        // Check if cancelled during upload
        const postUpload = this.state.entries.get(entryId);
        if (postUpload?.status === 'cancelled') {
          this.mutate((s) => {
            const newEntries = new Map(s.entries);
            newEntries.delete(entryId);
            s.entries = newEntries;
          });
          continue;
        }

        this.mutate((s) => {
          const entry = s.entries.get(entryId);
          if (!entry) return;
          const newEntries = new Map(s.entries);
          newEntries.set(entryId, {
            ...entry,
            status: 'completed',
            bytesUploaded: entry.bytesTotal,
            result,
            completedAt: Date.now(),
          });
          s.entries = newEntries;
        });

        this.emitNoteCallback(current.noteId, this.state.entries.get(entryId)!);
        this.scheduleAutoClear(entryId);
      } catch (err) {
        // Check if cancelled during upload
        const postUpload = this.state.entries.get(entryId);
        if (postUpload?.status === 'cancelled') {
          this.mutate((s) => {
            const newEntries = new Map(s.entries);
            newEntries.delete(entryId);
            s.entries = newEntries;
          });
          continue;
        }

        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        this.mutate((s) => {
          const entry = s.entries.get(entryId);
          if (!entry) return;
          const newEntries = new Map(s.entries);
          newEntries.set(entryId, {
            ...entry,
            status: 'failed',
            error: errorMsg,
            completedAt: Date.now(),
          });
          s.entries = newEntries;
        });

        this.emitNoteCallback(current.noteId, this.state.entries.get(entryId)!);
        this.scheduleAutoClear(entryId);
      } finally {
        this.activeTusUploads.delete(entryId);
      }
    }

    this.mutate((s) => {
      s.isProcessing = false;
    });
  }

  private async uploadViaFetch(_entryId: string, entry: UploadFileEntry): Promise<Attachment> {
    if (isLocalFile(entry.file)) {
      return this.uploadViaLocal(entry);
    }
    const opts = entry.mediaOptimize ? { mediaOptimize: true } : undefined;
    return api.attachments.uploadAttachment(entry.noteId, entry.file, opts);
  }

  private async uploadViaLocal(entry: UploadFileEntry): Promise<Attachment> {
    if (!isLocalFile(entry.file)) {
      throw new Error('Local upload requires a local file path');
    }

    const headers: Record<string, string> = {};
    const selectedMemory = getActiveMemory();
    if (selectedMemory) {
      headers[getMemoryRoutingHeaderName()] = selectedMemory;
    }

    const attachment = await invokeTauri<Attachment>('hotm_upload_local_file', {
      api_base_url: api.client.baseUrl,
      note_id: entry.noteId,
      path: entry.file.path,
      content_type: entry.file.type,
      media_optimize: entry.mediaOptimize,
      headers,
    });

    if (!attachment) {
      throw new Error('Desktop local upload is unavailable');
    }
    return attachment;
  }

  private async uploadViaTus(entryId: string, entry: UploadFileEntry): Promise<Attachment> {
    const handle = startTusUpload({
      noteId: entry.noteId,
      file: entry.file as File,
      mediaOptimize: entry.mediaOptimize,
      onProgress: (bytesUploaded, bytesTotal) => {
        this.mutate((s) => {
          const current = s.entries.get(entryId);
          if (!current || current.status !== 'uploading') return;
          const newEntries = new Map(s.entries);
          newEntries.set(entryId, { ...current, bytesUploaded, bytesTotal });
          s.entries = newEntries;
        });
      },
    });

    this.activeTusUploads.set(entryId, handle);
    return handle.promise;
  }

  private emitNoteCallback(noteId: string, entry: UploadFileEntry): void {
    this.noteUploadCallbacks.forEach((cb) => {
      try {
        cb(noteId, entry);
      } catch (err) {
        console.error('uploadStore note callback error:', err);
      }
    });
  }

  private scheduleAutoClear(id: string): void {
    const timer = setTimeout(() => {
      this.clearTimers.delete(id);
      const entry = this.state.entries.get(id);
      if (entry && (entry.status === 'completed' || entry.status === 'failed')) {
        this.mutate((s) => {
          const newEntries = new Map(s.entries);
          newEntries.delete(id);
          s.entries = newEntries;
        });
      }
    }, AUTO_CLEAR_DELAY_MS);
    this.clearTimers.set(id, timer);
  }
}

// Singleton
export const uploadStore = new UploadStore();
