/**
 * Ad-hoc media analysis API client.
 *
 * These endpoints accept multipart uploads that are not persisted as note
 * attachments. They are used for preview, inline analysis, and tool flows.
 */

import { getTauriFetch } from '@/lib/tauri';
import type { ApiClient } from './client';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';

export interface DescribeImageOptions {
  prompt?: string;
  model?: string;
}

export interface DescribeImageResponse {
  description: string;
  model: string;
  image_size: number;
}

export interface TranscriptionWord {
  word: string;
  start_secs: number;
  end_secs: number;
  confidence?: number | null;
}

export interface TranscriptionSegment {
  start_secs: number;
  end_secs: number;
  text: string;
  speaker_id?: string | null;
  words?: TranscriptionWord[] | null;
}

export interface TranscribeAudioOptions {
  language?: string;
  model?: string;
}

export interface TranscribeAudioResponse {
  text: string;
  segments: TranscriptionSegment[];
  language?: string | null;
  duration_secs?: number | null;
  model: string;
  audio_size: number;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }

  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (obj.error && typeof obj.error === 'object') {
      const nested = obj.error as Record<string, unknown>;
      if (typeof nested.message === 'string') return nested.message;
      if (typeof nested.code === 'string') return nested.code;
    }
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.detail === 'string') return obj.detail;
  }

  return `HTTP ${status}`;
}

async function parseError(response: Response): Promise<string> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    try {
      body = await response.text();
    } catch {
      // Fall through to HTTP status fallback.
    }
  }
  return extractErrorMessage(body, response.status);
}

function appendTrimmed(formData: FormData, key: string, value?: string): void {
  const trimmed = value?.trim();
  if (trimmed) {
    formData.append(key, trimmed);
  }
}

function buildRoutingHeaders(): Record<string, string> | undefined {
  const selectedMemory = getActiveMemory();
  if (!selectedMemory) return undefined;
  return { [getMemoryRoutingHeaderName()]: selectedMemory };
}

function assertFile(file: File | null | undefined, label: string): asserts file is File {
  if (!file) {
    throw new Error(`${label} is required`);
  }
  if (file.size === 0) {
    throw new Error(`${label} must not be empty`);
  }
}

export function createMediaToolsApi(client: ApiClient) {
  async function postMultipart<T>(
    path: string,
    formData: FormData,
    failurePrefix: string,
  ): Promise<T> {
    const response = await getTauriFetch()(`${client.baseUrl}${path}`, {
      method: 'POST',
      body: formData,
      headers: buildRoutingHeaders(),
    });

    if (!response.ok) {
      throw new Error(`${failurePrefix}: ${await parseError(response)}`);
    }

    return response.json();
  }

  return {
    async describeImage(
      file: File,
      options?: DescribeImageOptions,
    ): Promise<DescribeImageResponse> {
      assertFile(file, 'Image file');

      const formData = new FormData();
      formData.append('file', file);
      appendTrimmed(formData, 'prompt', options?.prompt);
      appendTrimmed(formData, 'model', options?.model);

      return postMultipart<DescribeImageResponse>(
        '/vision/describe',
        formData,
        'Image description failed',
      );
    },

    async transcribeAudio(
      file: File,
      options?: TranscribeAudioOptions,
    ): Promise<TranscribeAudioResponse> {
      assertFile(file, 'Audio file');

      const formData = new FormData();
      formData.append('file', file);
      appendTrimmed(formData, 'language', options?.language);
      appendTrimmed(formData, 'model', options?.model);

      return postMultipart<TranscribeAudioResponse>(
        '/audio/transcribe',
        formData,
        'Audio transcription failed',
      );
    },
  };
}

export type MediaToolsApi = ReturnType<typeof createMediaToolsApi>;
