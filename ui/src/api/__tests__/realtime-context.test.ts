import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRealtimeArchive } from '../realtime-context';
import { ApiError, ContractDecodeError } from '../errors';
import { createArchivesApi, MAX_MEMORY_CONTEXT_BYTES } from '../archives';
import { createApiClient } from '../client';
import { clearActiveMemory, setActiveMemory } from '../memory-context';
import { setApiBearerToken } from '../auth-context';

vi.mock('@/lib/tauri', () => ({ getTauriFetch: () => fetch }));
const selected = { name: 'research', schema_name: 'custom_notes_42' };
function api(value: unknown = selected) {
  return { context: vi.fn(async () => value) };
}

describe('hosted realtime archive resolution', () => {
  it('preserves request name and returned schema without inventory access', async () => {
    const archives = api();
    expect(await resolveRealtimeArchive(archives, 'research')).toEqual({
      memory: 'research', memorySchema: 'custom_notes_42',
    });
    expect(archives.context).toHaveBeenCalledExactlyOnceWith();
  });

  it('pins the server-resolved default to its explicit name and schema', async () => {
    expect(await resolveRealtimeArchive(api(), null)).toEqual({
      memory: 'research', memorySchema: 'custom_notes_42',
    });
  });

  it.each([null, 'public', 'default'])('accepts public only from the server for %s', async selection => {
    expect(await resolveRealtimeArchive(api({ name: 'public', schema_name: 'public' }), selection))
      .toEqual({ memory: 'public', memorySchema: 'public' });
  });

  it('accepts a real archive named default without deriving its schema', async () => {
    expect(await resolveRealtimeArchive(api({ name: 'default', schema_name: 'custom' }), 'default'))
      .toEqual({ memory: 'default', memorySchema: 'custom' });
  });

  it.each([
    null, [], {}, { name: 'other', schema_name: 'notes' },
    { ...selected, schema_name: '' }, { ...selected, schema_name: 'notes,public' },
    { ...selected, schema_name: 'MixedCase' }, { ...selected, schema_name: 'x'.repeat(64) },
    { ...selected, is_default: true }, { ...selected, name: ' research' },
    { ...selected, name: 'research ' }, { ...selected, name: '' },
    { ...selected, name: 'x'.repeat(256) },
  ])('rejects malformed, mismatched or extended context %j', async value => {
    await expect(resolveRealtimeArchive(api(value), 'research')).rejects.toBeInstanceOf(ContractDecodeError);
  });

  it.each([
    { name: 'other', schema_name: 'notes' },
    { name: 'public', schema_name: 'private_schema' },
  ])('does not extend the legacy default alias to %j', async value => {
    await expect(resolveRealtimeArchive(api(value), 'default')).rejects.toBeInstanceOf(ContractDecodeError);
  });

  it('counts Unicode code points consistently with the producer schema', async () => {
    const name = '\u{1f600}'.repeat(255);
    expect(await resolveRealtimeArchive(api({ name, schema_name: 'notes' }), name))
      .toEqual({ memory: name, memorySchema: 'notes' });
  });

  it.each([401, 403, 404, 500, 503])('propagates lookup failure %s without fallback', async status => {
    const archives = api();
    archives.context.mockRejectedValue(new ApiError('private upstream detail', status));
    await expect(resolveRealtimeArchive(archives, null)).rejects.toHaveProperty('statusCode', status);
    expect(archives.context).toHaveBeenCalledOnce();
  });
});

describe('selected-memory real HTTP client boundary', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  beforeEach(() => {
    clearActiveMemory();
    setApiBearerToken('synthetic-session');
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    clearActiveMemory();
    setApiBearerToken(null);
    vi.unstubAllGlobals();
  });
  const resolve = (name: string | null = null) =>
    resolveRealtimeArchive(createArchivesApi(createApiClient('http://fixture.invalid/api/v1')), name);

  it.each([null, 'research'])('sends one read request with the active selection %s', async name => {
    setActiveMemory(name);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(selected)));
    expect(await resolve(name)).toEqual({ memory: 'research', memorySchema: 'custom_notes_42' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://fixture.invalid/api/v1/memory/context');
    expect(options?.method).toBe('GET');
    const headers = new Headers(options?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-session');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-Fortemi-Memory')).toBe(name);
  });

  it.each([401, 403, 404, 500, 503])('does not retry HTTP %s or fetch inventory', async status => {
    fetchMock.mockResolvedValue(new Response('private detail', { status }));
    await expect(resolve()).rejects.toHaveProperty('statusCode', status);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['{private upstream detail', 'null', '[]', '{}', JSON.stringify({ ...selected, extra: true })])
    ('rejects invalid payload without exposing its text', async text => {
      fetchMock.mockResolvedValue(new Response(text));
      await expect(resolve()).rejects.toThrow('Invalid archive context');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

  it.each([true, false])('bounds oversized responses (advertised=%s)', async advertised => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_MEMORY_CONTEXT_BYTES + 1)); },
      cancel,
    });
    fetchMock.mockResolvedValue(new Response(body, {
      headers: advertised ? { 'Content-Length': String(MAX_MEMORY_CONTEXT_BYTES + 1) } : {},
    }));
    await expect(resolve()).rejects.toBeInstanceOf(ContractDecodeError);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('accepts a valid response exactly at the byte ceiling', async () => {
    const json = JSON.stringify(selected);
    fetchMock.mockResolvedValue(new Response(json.padEnd(MAX_MEMORY_CONTEXT_BYTES, ' ')));
    expect(await resolve()).toEqual({ memory: 'research', memorySchema: 'custom_notes_42' });
  });
});
