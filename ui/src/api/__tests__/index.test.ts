import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../index';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(body: unknown) {
  const text = JSON.stringify(body);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(text),
  };
}

function notFoundJson() {
  const text = JSON.stringify({ error: 'not found' });
  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    text: () => Promise.resolve(text),
  };
}

describe('api.healthCheck', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('normalizes legacy /health payload shape', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        ok: true,
        db: true,
        ollama: false,
      })
    );

    const api = createApi('http://localhost:3000');
    const result = await api.healthCheck();

    expect(result).toEqual({
      status: 'healthy',
      version: 'unknown',
      database: 'connected',
      ollama: 'unavailable',
    });
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/health');
  });

  it('falls back to alternate health endpoint when first is unavailable', async () => {
    mockFetch
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(
        okJson({
          status: 'healthy',
          version: '1.2.3',
          database: 'connected',
        })
      );

    const api = createApi('http://localhost:3000');
    const result = await api.healthCheck();

    expect(result).toEqual({
      status: 'healthy',
      version: '1.2.3',
      database: 'connected',
      ollama: undefined,
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/health'
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/health/live'
    );
  });

  it('throws when all health endpoints fail', async () => {
    mockFetch
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(notFoundJson());

    const api = createApi('http://localhost:3000');
    await expect(api.healthCheck()).rejects.toThrow();
  });

  it('handles plain text health responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('healthy\n'),
    });

    const api = createApi('http://localhost:3000');
    const result = await api.healthCheck();

    expect(result).toEqual({
      status: 'healthy',
      version: 'unknown',
      database: 'unknown',
      ollama: undefined,
    });
  });
});
