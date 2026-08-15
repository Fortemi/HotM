/**
 * Base HTTP client for Fortemi API
 * Handles requests, retries, and error handling
 */

import { ApiError, NetworkError } from './errors';
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

        // Parse response
        let responseData: unknown;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          if (!response.ok) {
            throw new ApiError(response.statusText, response.status);
          }
          throw jsonError;
        }

        // Handle HTTP errors
        if (!response.ok) {
          const error = new ApiError(
            response.statusText,
            response.status,
            responseData
          );

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

        return responseData as T;
      } catch (error) {
        // Network errors or fetch failures
        if (error instanceof ApiError) {
          throw error; // Re-throw API errors
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

    async post<T>(
      path: string,
      body?: unknown,
      headers?: Record<string, string>,
      params?: Record<string, string>
    ): Promise<T> {
      return request<T>(path, { method: 'POST', body, headers, params });
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
      headers?: Record<string, string>
    ): Promise<T> {
      return request<T>(path, { method: 'DELETE', headers });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
