import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaToolsApi } from '../mediaTools';
import type { ApiClient } from '../client';

vi.mock('@/lib/tauri', () => ({
  getTauriFetch: () => global.fetch,
}));

const memoryState = vi.hoisted(() => ({
  activeMemory: null as string | null,
}));

vi.mock('../memory-context', () => ({
  getActiveMemory: () => memoryState.activeMemory,
  getMemoryRoutingHeaderName: () => 'X-Memory-Route',
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Media tools API', () => {
  let api: ReturnType<typeof createMediaToolsApi>;

  beforeEach(() => {
    mockFetch.mockReset();
    memoryState.activeMemory = null;

    api = createMediaToolsApi({
      baseUrl: 'http://localhost:3000/api/v1',
    } as ApiClient);
  });

  it('posts image description requests as multipart without a manual content type', async () => {
    const response = {
      description: 'A whiteboard architecture sketch',
      model: 'llava:13b',
      image_size: 1024,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const file = new File(['image-bytes'], 'diagram.png', { type: 'image/png' });
    await expect(
      api.describeImage(file, { prompt: 'Summarize the diagram', model: 'llava:13b' }),
    ).resolves.toEqual(response);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/vision/describe',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toBeUndefined();

    const formData = init.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('prompt')).toBe('Summarize the diagram');
    expect(formData.get('model')).toBe('llava:13b');
  });

  it('posts audio transcription requests with optional language and model fields', async () => {
    const response = {
      text: 'hello world',
      segments: [{ start_secs: 0, end_secs: 1.4, text: 'hello world' }],
      language: 'en',
      duration_secs: 1.4,
      model: 'Systran/faster-whisper-large-v3',
      audio_size: 2048,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const file = new File(['audio-bytes'], 'call.wav', { type: 'audio/wav' });
    await expect(
      api.transcribeAudio(file, {
        language: 'en',
        model: 'Systran/faster-whisper-large-v3',
      }),
    ).resolves.toEqual(response);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/audio/transcribe',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toBeUndefined();

    const formData = init.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('language')).toBe('en');
    expect(formData.get('model')).toBe('Systran/faster-whisper-large-v3');
  });

  it('omits blank optional fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ description: 'ok', model: 'llava', image_size: 5 }),
    });

    const file = new File(['image'], 'image.png', { type: 'image/png' });
    await api.describeImage(file, { prompt: ' ', model: '' });

    const formData = mockFetch.mock.calls[0][1].body as FormData;
    expect(formData.get('prompt')).toBeNull();
    expect(formData.get('model')).toBeNull();
  });

  it('adds memory routing without setting multipart content type', async () => {
    memoryState.activeMemory = 'archive-a';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: '', segments: [], model: 'whisper', audio_size: 5 }),
    });

    const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
    await api.transcribeAudio(file);

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual({ 'X-Memory-Route': 'archive-a' });
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('rejects missing or empty files before making a request', async () => {
    await expect(api.describeImage(null as unknown as File)).rejects.toThrow('Image file is required');
    await expect(api.transcribeAudio(new File([], 'empty.wav'))).rejects.toThrow(
      'Audio file must not be empty',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('extracts Fortemi problem messages from media errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({
        error: {
          code: 'PROVIDER_FAILURE',
          message: 'Vision analysis backend failed. Check server logs for diagnostics.',
        },
      }),
    });

    const file = new File(['image'], 'image.png', { type: 'image/png' });
    await expect(api.describeImage(file)).rejects.toThrow(
      'Image description failed: Vision analysis backend failed. Check server logs for diagnostics.',
    );
  });

  it('falls back to response text and HTTP status for media errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve('Missing file in multipart form'),
    });

    const file = new File(['audio'], 'audio.wav', { type: 'audio/wav' });
    await expect(api.transcribeAudio(file)).rejects.toThrow(
      'Audio transcription failed: Missing file in multipart form',
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.reject(new Error('not text')),
    });

    await expect(api.transcribeAudio(file)).rejects.toThrow('Audio transcription failed: HTTP 400');
  });
});
