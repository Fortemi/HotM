import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createIngestApi, parseIngestSseChunk, parseIngestSseFrame } from '../ingest';
import type { ApiClient } from '../client';

vi.mock('@/lib/tauri', () => ({
  getHostAdapter: vi.fn(() => null),
  getTauriFetch: () => global.fetch,
}));

vi.mock('../memory-context', () => ({
  getActiveMemory: vi.fn(() => null),
  getMemoryRoutingHeaderName: vi.fn(() => 'X-Fortemi-Memory'),
}));

describe('Ingest API', () => {
  let mockClient: ApiClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      baseUrl: 'http://localhost:3000/api/v1',
    } as unknown as ApiClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mints stream tokens with the Fortemi rate_limit query parameter', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      token: 'secret-token',
      token_id: 'tok_123',
      rate_limit: 25,
      expires_in: 3600,
    });

    const result = await createIngestApi(mockClient).mintToken({ rateLimit: 25 });

    expect(mockClient.post).toHaveBeenCalledWith(
      '/ingest/tokens',
      undefined,
      undefined,
      { rate_limit: '25' },
    );
    expect(result.token_id).toBe('tok_123');
  });

  it('revokes stream tokens by token id', async () => {
    await createIngestApi(mockClient).revokeToken('tok 123');

    expect(mockClient.delete).toHaveBeenCalledWith('/ingest/tokens/tok%20123');
  });

  it('parses ack, progress, warning, error, and done SSE frames', () => {
    expect(parseIngestSseFrame('event: ack\ndata: {"line":1,"status":"ok","note_id":"n1","cursor":"s-1"}\n')).toEqual({
      event: 'ack',
      line: 1,
      status: 'ok',
      note_id: 'n1',
      cursor: 's-1',
      error: undefined,
    });
    expect(parseIngestSseFrame('event: progress\ndata: {"processed":2}\n')).toEqual({
      event: 'progress',
      processed: 2,
    });
    expect(parseIngestSseFrame('event: warning\ndata: {"message":"buffer high","advisory_rate":1000}\n')).toEqual({
      event: 'warning',
      message: 'buffer high',
      advisory_rate: 1000,
    });
    expect(parseIngestSseFrame('event: error\ndata: {"status":429,"code":"INGEST_BACKPRESSURE","retry_after_ms":500}\n')).toEqual({
      event: 'error',
      status: 429,
      title: undefined,
      detail: undefined,
      error: undefined,
      code: 'INGEST_BACKPRESSURE',
      retry_after_ms: 500,
    });
    expect(parseIngestSseFrame('event: done\ndata: {"total":2,"success":1,"errors":1}\n')).toEqual({
      event: 'done',
      total: 2,
      success: 1,
      errors: 1,
    });
  });

  it('keeps a partial SSE frame as carry until the next chunk arrives', () => {
    const first = parseIngestSseChunk('event: ack\ndata: {"line":1,');
    expect(first.events).toEqual([]);
    expect(first.carry).toBe('event: ack\ndata: {"line":1,');

    const second = parseIngestSseChunk('"status":"error","error":"bad","cursor":"s-1"}\n\n', first.carry);
    expect(second.carry).toBe('');
    expect(second.events).toEqual([
      {
        event: 'ack',
        line: 1,
        status: 'error',
        cursor: 's-1',
        note_id: undefined,
        error: 'bad',
      },
    ]);
  });

  it('streams an NDJSON file with bearer token and returns summary without persisting the secret', async () => {
    const frames = [
      'event: ack\ndata: {"line":1,"status":"ok","note_id":"n1","cursor":"stream-1"}\n\n',
      'event: progress\ndata: {"processed":1}\n\n',
      'event: done\ndata: {"total":1,"success":1,"errors":0}\n\n',
    ].join('');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new TextEncoder().encode(frames), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onEvent = vi.fn();

    const file = new File(['{"type":"note","data":{"content":"hello"}}\n'], 'notes.ndjson', {
      type: 'application/x-ndjson',
    });
    const summary = await createIngestApi(mockClient).streamNotes(file, {
      token: 'secret-token',
      onEvent,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/ingest/stream',
      expect.objectContaining({
        method: 'POST',
        body: file,
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/x-ndjson',
        }),
      }),
    );
    expect(summary).toMatchObject({
      total: 1,
      success: 1,
      errors: 0,
      lastCursor: 'stream-1',
    });
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'ack', cursor: 'stream-1' }));
  });
});
