/**
 * tus Resumable Upload Adapter
 *
 * Wraps tus-js-client in a Promise-based API compatible with uploadStore.
 * Files >= TUS_THRESHOLD_BYTES are uploaded via the tus protocol (chunked,
 * resumable); smaller files continue through the existing fetch path.
 *
 * The default tus browser stack uses XHR; in desktop mode we provide a fetch
 * stack so chunks route through HotM's host adapter and bypass webview
 * loopback restrictions.
 */

import * as tus from 'tus-js-client';
import type { HttpRequest, HttpResponse, HttpStack } from 'tus-js-client';
import { api } from '@/api';
import { getAuthorizationHeader } from '@/api/auth-context';
import type { Attachment } from '@/api/types-extended';
import { getActiveMemory, getMemoryRoutingHeaderName } from '@/api/memory-context';
import { getTauriFetch } from '@/lib/tauri';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Kept for compatibility; all remote browser uploads now use TUS. */
export const TUS_THRESHOLD_BYTES = 0;

/** Maximum bytes per PATCH request — keep IPC/base64 payloads small for desktop WebKit/Tauri. */
export const TUS_CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB

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

class FetchHttpResponse implements HttpResponse {
  constructor(
    private readonly response: Response,
    private readonly body: string,
  ) {}

  getStatus(): number {
    return this.response.status;
  }

  getHeader(header: string): string | undefined {
    return this.response.headers.get(header) ?? undefined;
  }

  getBody(): string {
    return this.body;
  }

  getUnderlyingObject(): Response {
    return this.response;
  }
}

class FetchHttpRequest implements HttpRequest {
  private readonly headers: Record<string, string> = {};
  private readonly abortController = new AbortController();
  private progressHandler?: (bytesSent: number) => void;

  constructor(
    private readonly method: string,
    private readonly url: string,
  ) {}

  getMethod(): string {
    return this.method;
  }

  getURL(): string {
    return this.url;
  }

  setHeader(header: string, value: string): void {
    this.headers[header] = value;
  }

  getHeader(header: string): string | undefined {
    return this.headers[header];
  }

  setProgressHandler(handler: (bytesSent: number) => void): void {
    this.progressHandler = handler;
  }

  async send(body?: BodyInit | null): Promise<HttpResponse> {
    const response = await getTauriFetch()(this.url, {
      method: this.method,
      headers: this.headers,
      body: body ?? undefined,
      signal: this.abortController.signal,
    });
    this.progressHandler?.(getBodySize(body));
    return new FetchHttpResponse(response, response.ok ? await response.text() : '');
  }

  async abort(): Promise<void> {
    this.abortController.abort();
  }

  getUnderlyingObject(): AbortController {
    return this.abortController;
  }
}

class FetchHttpStack implements HttpStack {
  createRequest(method: string, url: string): HttpRequest {
    return new FetchHttpRequest(method, url);
  }

  getName(): string {
    return 'FetchHttpStack';
  }
}

function getBodySize(body?: BodyInit | null): number {
  if (!body) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).byteLength;
  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Determine whether a file should use the tus resumable protocol. */
export function shouldUseTus(file: File): boolean {
  void file;
  return true;
}

function validateTusMetadata(noteId: string, file: File): void {
  const invalid = /[\0\r\n]/;
  if (!noteId.trim() || invalid.test(noteId)) throw new Error('A valid note ID is required for upload.');
  if (!file.name || file.name.length > 255 || invalid.test(file.name)) {
    throw new Error('The selected file has invalid upload metadata.');
  }
  if (file.type.length > 255 || invalid.test(file.type)) {
    throw new Error('The selected file has invalid upload metadata.');
  }
}

function redactedTusError(err: unknown): Error {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (/\b(401|403)\b|unauthori[sz]ed|forbidden|auth/.test(message)) {
    return new Error('TUS upload authorization expired or was denied.');
  }
  if (/\b413\b|too large|max(?:imum)? size|chunk/.test(message)) {
    return new Error('TUS upload exceeds the server size limit.');
  }
  if (/\b409\b|offset|conflict/.test(message)) {
    return new Error('TUS upload offset conflict.');
  }
  if (/\b(404|410)\b|expired|not found|gone/.test(message)) {
    return new Error('TUS upload session expired or was not found.');
  }
  return new Error('TUS upload failed.');
}

/**
 * Start a tus resumable upload and return a handle with a Promise + abort.
 *
 * The tus endpoint is `POST {baseUrl}/notes/{noteId}/attachments/tus`.
 * On completion, a `GET` to the tus Location URL retrieves the Attachment JSON.
 */
export function startTusUpload(opts: TusUploadOptions): TusUploadHandle {
  const { noteId, file, mediaOptimize, onProgress } = opts;
  validateTusMetadata(noteId, file);
  const baseUrl = api.client.baseUrl;
  const endpointParams = new URLSearchParams();
  if (mediaOptimize) {
    endpointParams.set('media_optimize', 'true');
  }
  const endpointQuery = endpointParams.toString();
  const endpoint = `${baseUrl}/notes/${encodeURIComponent(noteId)}/attachments/tus${endpointQuery ? `?${endpointQuery}` : ''}`;

  // Build routing headers
  const headers: Record<string, string> = { ...getAuthorizationHeader() };
  const selectedMemory = getActiveMemory();
  if (selectedMemory) {
    headers[getMemoryRoutingHeaderName()] = selectedMemory;
  }

  // Build tus metadata (values are base64-encoded per tus spec)
  const metadata: Record<string, string> = {
    filename: file.name,
    filetype: file.type,
  };

  let tusUpload: tus.Upload;
  let aborted = false;

  const promise = new Promise<Attachment>((resolve, reject) => {
    tusUpload = new tus.Upload(file, {
      endpoint,
      headers,
      metadata,
      chunkSize: TUS_CHUNK_SIZE,
      httpStack: new FetchHttpStack(),
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
            reject(new Error('TUS upload finalization is unavailable.'));
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
          reject(redactedTusError(err));
        }
      },

      onError(err: Error) {
        if (!aborted) {
          reject(redactedTusError(err));
        }
      },
    });

    tusUpload.start();
  });

  return {
    promise,
    abort() {
      aborted = true;
      void tusUpload?.abort(true);
    },
  };
}
