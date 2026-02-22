/**
 * tus Resumable Upload Adapter
 *
 * Wraps tus-js-client in a Promise-based API compatible with uploadStore.
 * Files >= TUS_THRESHOLD_BYTES are uploaded via the tus protocol (chunked,
 * resumable); smaller files continue through the existing fetch path.
 *
 * tus-js-client uses XHR internally, which avoids the Chrome HTTP/2
 * fetch bug that drops connections on large transfers.
 */

import * as tus from 'tus-js-client';
import { api } from '@/api';
import type { Attachment } from '@/api/types-extended';
import { getActiveMemory, getMemoryRoutingHeaderName } from '@/api/memory-context';
import { getTauriFetch } from '@/lib/tauri';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Files at or above this size use the tus resumable protocol. */
export const TUS_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50 MB

/** Maximum bytes per PATCH request — keeps each chunk well under Chrome's HTTP/2 threshold. */
export const TUS_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

/** Retry delays (ms) with exponential backoff for transient failures. */
const TUS_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TusUploadOptions {
  noteId: string;
  file: File;
  mediaOptimize: boolean;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
}

export interface TusUploadHandle {
  /** Resolves with the Attachment JSON when the upload + finalize GET complete. */
  promise: Promise<Attachment>;
  /** Aborts the in-flight tus upload. */
  abort: () => void;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Determine whether a file should use the tus resumable protocol. */
export function shouldUseTus(file: File): boolean {
  return file.size >= TUS_THRESHOLD_BYTES;
}

/**
 * Start a tus resumable upload and return a handle with a Promise + abort.
 *
 * The tus endpoint is `POST /api/v1/notes/{noteId}/attachments/tus`.
 * On completion, a `GET` to the tus Location URL retrieves the Attachment JSON.
 */
export function startTusUpload(opts: TusUploadOptions): TusUploadHandle {
  const { noteId, file, mediaOptimize, onProgress } = opts;
  const baseUrl = api.client.baseUrl;
  const endpoint = `${baseUrl}/api/v1/notes/${noteId}/attachments/tus`;

  // Build routing headers
  const headers: Record<string, string> = {};
  const selectedMemory = getActiveMemory();
  if (selectedMemory) {
    headers[getMemoryRoutingHeaderName()] = selectedMemory;
  }

  // Build tus metadata (values are base64-encoded per tus spec)
  const metadata: Record<string, string> = {
    filename: file.name,
    filetype: file.type,
  };
  if (mediaOptimize) {
    metadata['media_optimize'] = 'true';
  }

  let tusUpload: tus.Upload;
  let aborted = false;

  const promise = new Promise<Attachment>((resolve, reject) => {
    tusUpload = new tus.Upload(file, {
      endpoint,
      headers,
      metadata,
      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: TUS_RETRY_DELAYS,

      onProgress(bytesUploaded: number, bytesTotal: number) {
        if (!aborted) {
          onProgress?.(bytesUploaded, bytesTotal);
        }
      },

      async onSuccess() {
        if (aborted) return;

        try {
          // GET the tus Location URL to retrieve the finalized Attachment JSON
          const uploadUrl = tusUpload.url;
          if (!uploadUrl) {
            reject(new Error('tus upload completed but no URL available'));
            return;
          }

          const fetchFn = getTauriFetch();
          const fetchHeaders: Record<string, string> = { ...headers };

          const response = await fetchFn(uploadUrl, {
            method: 'GET',
            headers: fetchHeaders,
          });

          if (!response.ok) {
            reject(new Error(`Finalize failed: HTTP ${response.status}`));
            return;
          }

          const attachment: Attachment = await response.json();
          resolve(attachment);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      },

      onError(err: Error) {
        if (!aborted) {
          reject(err);
        }
      },
    });

    tusUpload.start();
  });

  return {
    promise,
    abort() {
      aborted = true;
      tusUpload?.abort();
    },
  };
}
