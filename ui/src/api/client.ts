/**
 * Base HTTP client for Fortemi API
 * Handles requests, retries, and error handling
 */

import { ApiError, ContractDecodeError, NetworkError } from './errors';
import { getAuthorizationHeader } from './auth-context';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import { getTauriFetch } from '@/lib/tauri';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  retryAttempts?: number;
  retryDelay?: number;
  maxResponseBytes?: number;
  acceptedResponseStatuses?: readonly number[];
}

interface TextResponseOptions {
  params?: Record<string, string>;
  headers?: Record<string, string>;
  maxBytes?: number;
}

export const DEFAULT_MAX_TEXT_RESPONSE_BYTES = 4 * 1024 * 1024;
export const DEFAULT_MAX_JSON_RESPONSE_BYTES = 16 * 1024 * 1024;

async function readBoundedText(
  response: Response,
  path: string,
  maxBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new ContractDecodeError(path, 'text response limit must be a positive integer');
  }
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const advertisedBytes = Number(contentLength);
    if (Number.isFinite(advertisedBytes) && advertisedBytes > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new ContractDecodeError(path, `text response exceeds the ${maxBytes}-byte limit`);
    }
  }

  const reader = response.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let decoded = '';
    let bytesRead = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ContractDecodeError(path, `text response exceeds the ${maxBytes}-byte limit`);
      }
      decoded += decoder.decode(value, { stream: true });
    }
    return decoded + decoder.decode();
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ContractDecodeError(path, `text response exceeds the ${maxBytes}-byte limit`);
  }
  return text;
}

async function readBoundedJson<T>(response: Response, path: string, maxBytes: number): Promise<T> {
  if (response.body) {
    const text = await readBoundedText(response, path, maxBytes);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ContractDecodeError(path, 'response is not valid JSON');
    }
  }

  // Test adapters and older host shims may expose json() without a readable body.
  try {
    return await response.json() as T;
  } catch {
    throw new ContractDecodeError(path, 'response is not valid JSON');
  }
}

export interface MutationRequestContext {
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
}

export type MutationGate = (context: MutationRequestContext) => Promise<void>;

/**
 * Exponential backoff delay calculation
 */
function calculateBackoff(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 10000);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
  // Normalize base URL and path
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${normalizedBase}${normalizedPath}`;

  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const queryString = new URLSearchParams(params).toString();
  return `${url}?${queryString}`;
}

/**
 * Derive server root URL by stripping the /api/vN suffix.
 * e.g. "http://localhost:3000/api/v1" → "http://localhost:3000"
 */
export function getServerRoot(apiBaseUrl: string): string {
  const normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return normalized.replace(/\/api\/v\d+$/, '') || normalized;
}

/**
 * Create API client instance
 */
export function createApiClient(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.endsWith('/')
    ? baseUrl.slice(0, -1)
    : baseUrl;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let mutationGate: MutationGate | null = null;

  async function request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      params,
      retryAttempts = 3,
      retryDelay = 1000,
      maxResponseBytes = DEFAULT_MAX_JSON_RESPONSE_BYTES,
      acceptedResponseStatuses = [],
    } = options;

    if (method !== 'GET') {
      await requireMutation(method, path);
    }

    const url = buildUrl(normalizedBaseUrl, path, params);
    const requestHeaders = { ...defaultHeaders, ...getAuthorizationHeader(), ...headers };
    const selectedMemory = getActiveMemory();
    if (selectedMemory && !requestHeaders[getMemoryRoutingHeaderName()]) {
      requestHeaders[getMemoryRoutingHeaderName()] = selectedMemory;
    }

    let lastError: Error | null = null;

    // Initial attempt + retries
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const httpFetch = getTauriFetch();
        const response = await httpFetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Handle 204 No Content
        if (response.status === 204) {
          return null as T;
        }

        // Handle HTTP errors
        if (!response.ok && !acceptedResponseStatuses.includes(response.status)) {
          await response.body?.cancel().catch(() => undefined);
          const error = new ApiError(response.statusText, response.status);

          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }

          // Retry server errors (5xx)
          if (attempt < retryAttempts) {
            lastError = error;
            const backoffMs = calculateBackoff(attempt, retryDelay);
            await sleep(backoffMs);
            continue;
          }

          throw error;
        }

        return readBoundedJson<T>(response, path, maxResponseBytes);
      } catch (error) {
        // Network errors or fetch failures
        if (error instanceof ApiError || error instanceof ContractDecodeError) {
          throw error;
        }

        // Network errors - retry
        if (attempt < retryAttempts) {
          lastError = error as Error;
          const backoffMs = calculateBackoff(attempt, retryDelay);
          await sleep(backoffMs);
          continue;
        }

        throw new NetworkError(error as Error);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new NetworkError(lastError || new Error('Request failed'));
  }

  async function requireMutation(
    method: MutationRequestContext['method'],
    path: string,
  ): Promise<void> {
    if (mutationGate) await mutationGate({ method, path });
  }

  async function requestText(path: string, options: TextResponseOptions = {}): Promise<string> {
    const url = buildUrl(normalizedBaseUrl, path, options.params);
    const requestHeaders: Record<string, string> = {
      Accept: 'text/markdown,text/turtle,text/plain,*/*',
      ...getAuthorizationHeader(),
      ...options.headers,
    };
    const selectedMemory = getActiveMemory();
    if (selectedMemory && !requestHeaders[getMemoryRoutingHeaderName()]) {
      requestHeaders[getMemoryRoutingHeaderName()] = selectedMemory;
    }

    try {
      const response = await getTauriFetch()(url, { method: 'GET', headers: requestHeaders });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new ApiError(response.statusText || `HTTP ${response.status}`, response.status);
      }
      return readBoundedText(response, path, options.maxBytes ?? DEFAULT_MAX_TEXT_RESPONSE_BYTES);
    } catch (error) {
      if (error instanceof ApiError || error instanceof ContractDecodeError) throw error;
      throw new NetworkError(error as Error);
    }
  }

  return {
    baseUrl: normalizedBaseUrl,
    serverUrl: getServerRoot(normalizedBaseUrl),

    setMutationGate(gate: MutationGate | null): void {
      mutationGate = gate;
    },

    requireMutation,

    async get<T>(
      path: string,
      params?: Record<string, string>,
      headers?: Record<string, string>
    ): Promise<T> {
      return request<T>(path, { method: 'GET', params, headers });
    },

    async getText(
      path: string,
      params?: Record<string, string>,
      headers?: Record<string, string>,
      maxBytes?: number,
    ): Promise<string> {
      return requestText(path, { params, headers, maxBytes });
    },

    async post<T>(
      path: string,
      body?: unknown,
      headers?: Record<string, string>,
      params?: Record<string, string>,
      acceptedResponseStatuses?: readonly number[],
    ): Promise<T> {
      return request<T>(path, {
        method: 'POST',
        body,
        headers,
        params,
        acceptedResponseStatuses,
      });
    },

    async patch<T>(
      path: string,
      body?: unknown,
      headers?: Record<string, string>
    ): Promise<T> {
      return request<T>(path, { method: 'PATCH', body, headers });
    },

    async put<T>(
      path: string,
      body?: unknown,
      headers?: Record<string, string>
    ): Promise<T> {
      return request<T>(path, { method: 'PUT', body, headers });
    },

    async delete<T>(
      path: string,
      headers?: Record<string, string>,
      params?: Record<string, string>,
    ): Promise<T> {
      return request<T>(path, { method: 'DELETE', headers, params });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
