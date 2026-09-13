import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../client';
import { setApiBearerToken, setActiveTenantId } from '../auth-context';
import { setActiveMemory } from '../memory-context';

vi.mock('@/lib/tauri', () => ({ getTauriFetch: () => globalThis.fetch }));
const fetchMock = vi.fn();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  localStorage.clear(); setActiveTenantId(null); setApiBearerToken('session-a');
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('HTTP context fencing', () => {
  it.each(['get','getText'] as const)('rejects %s response after context changes', async method => {
    const response = deferred<Response>(); fetchMock.mockReturnValueOnce(response.promise);
    const request = createApiClient('/api/v1')[method]('/notes');
    const rejected = expect(request).rejects.toMatchObject({ name: 'ContextChangedError' });
    setApiBearerToken('session-b');
    response.resolve(new Response('{"title":"old note"}'));
    await rejected; expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects late JSON decoding after archive replacement', async () => {
    const decoded = deferred<object>();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => decoded.promise });
    const request = createApiClient('/api/v1').get('/notes');
    const rejected = expect(request).rejects.toMatchObject({ name: 'ContextChangedError' });
    await Promise.resolve(); setActiveMemory('another-archive');
    decoded.resolve({ title: 'old note' }); await rejected;
  });
  it('does not submit a mutation after its admission waited across sessions', async () => {
    const gate = deferred<void>(), client = createApiClient('/api/v1');
    client.setMutationGate(() => gate.promise);
    fetchMock.mockResolvedValue(new Response('{}'));
    const request = client.post('/notes', { title: 'old intent' });
    const rejected = expect(request).rejects.toMatchObject({ name: 'ContextChangedError' });
    setApiBearerToken('session-b'); gate.resolve(); await rejected;
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['server','network'])('stops %s retries after context replacement', async failure => {
    vi.useFakeTimers();
    if (failure === 'server') fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    else fetchMock.mockRejectedValue(new Error('offline'));
    const request = createApiClient('/api/v1').get('/notes');
    const rejected = expect(request).rejects.toMatchObject({ name: 'ContextChangedError' });
    await vi.advanceTimersByTimeAsync(0);
    setApiBearerToken('session-b');
    await vi.runAllTimersAsync(); await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects a pending response even after token A-B-A', async () => {
    const response = deferred<Response>(); fetchMock.mockReturnValueOnce(response.promise);
    const request = createApiClient('/api/v1').get('/notes');
    const rejected = expect(request).rejects.toMatchObject({ name: 'ContextChangedError' });
    setApiBearerToken('session-b'); setApiBearerToken('session-a');
    response.resolve(new Response('{}')); await rejected;
  });
});
