import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import producerFixtures from '@/api/contracts/fortemi-producer-event-fixtures.json';
import type { ServerEvent } from '@/api/events';
import { setActiveMemory } from '@/api/memory-context';
import { setApiBearerToken, setActiveTenantId } from '@/api/auth-context';
import { setDataApiEndpoint } from '@/api/data-context';
import service, { useWebSocket } from '../websocket';

const mocks = vi.hoisted(() => ({ receive: undefined as undefined | ((event: ServerEvent) => void) }));
vi.mock('@/api', () => ({ api: { compatibilityGate: { preflight: vi.fn(async () => ({ auth: { required: false, mode: 'anonymous_local' } })) } } }));
vi.mock('@/api/events', async original => ({
  ...await original<typeof import('@/api/events')>(),
  createEventsClient: vi.fn(() => ({
    subscribe: (receive: (event: ServerEvent) => void) => { mocks.receive = receive; return () => undefined; },
    close: vi.fn(),
  })),
}));
vi.mock('@/lib/tauri', () => ({ getCachedConfig: () => null }));

afterEach(() => { service.close(); localStorage.clear(); setActiveTenantId(null); });

it.each(['memory', 'token', 'tenant', 'storage', 'endpoint'])('clears the rendered queue counters when %s changes', async change => {
  mocks.receive = undefined;
  localStorage.clear();
  setDataApiEndpoint('http://localhost:3000/api/v1');
  setActiveMemory('first');
  const view = renderHook(() => useWebSocket());
  await waitFor(() => expect(mocks.receive).toBeTypeOf('function'));
  const event = structuredClone(producerFixtures.cases.find(c => c.eventType === 'job.queued')!.envelope);
  event.event_id = '018f7d2d-0000-7000-8000-' +
    (['memory', 'token', 'tenant', 'storage', 'endpoint'].indexOf(change) + 1).toString(16).padStart(12, '0');
  act(() => mocks.receive!(event as unknown as ServerEvent));
  expect(view.result.current.queueStatus).toEqual({ total_jobs: 1, running: 0, pending: 1 });
  act(() => {
    if (change === 'memory') setActiveMemory('second');
    if (change === 'token') setApiBearerToken('another-session');
    if (change === 'tenant') setActiveTenantId('22222222-2222-4222-8222-222222222222');
    if (change === 'storage') {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
    }
    if (change === 'endpoint') setDataApiEndpoint('https://server-b.example/api/v1');
  });
  expect(view.result.current.queueStatus).toEqual({ total_jobs: 0, running: 0, pending: 0 });
  expect(view.result.current.lastResyncAt).toBeUndefined();
  view.unmount();
});
