import { useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiBearerToken, setActiveTenantId, setApiBearerToken } from '@/api/auth-context';
import { getActiveMemory, setActiveMemory } from '@/api/memory-context';
import App from '../App';

const pending = vi.hoisted(() => ({ setters: [] as Array<(value: string) => void> }));
function ContextView() {
  const [value, setValue] = useState(() => getApiBearerToken() + ':' + getActiveMemory());
  pending.setters.push(setValue);
  return <div data-testid="context-view">{value}</div>;
}
vi.mock('../components/HallOfMind', () => ({ HallOfMind: () => <ContextView /> }));
vi.mock('../components/mobile/MobileReadView', () => ({ MobileReadView: () => <ContextView /> }));

beforeEach(() => {
  localStorage.clear();
  setActiveTenantId(null);
  setApiBearerToken('session-a');
  pending.setters = [];
});
afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
describe.each(['/', '/mobile'])('application context on %s', path => {
  it.each(['token', 'memory', 'tenant', 'storage-token', 'storage-memory', 'storage-clear', 'logout'])('discards old component state on %s', change => {
    window.history.replaceState({}, '', path);
    render(<App />);
    const previous = pending.setters[pending.setters.length - 1]!;
    act(() => previous('previous context note'));
    act(() => {
      if (change === 'token') setApiBearerToken('session-b');
      if (change === 'memory') setActiveMemory('archive-b');
      if (change === 'tenant') setActiveTenantId('tenant-b');
      if (change === 'logout') setApiBearerToken(null);
      if (change.startsWith('storage-')) {
        const key = change === 'storage-token' ? 'hotm_api_bearer_token'
          : change === 'storage-memory' ? 'hotm_active_memory' : null;
        if (key) localStorage.setItem(key, 'replacement'); else localStorage.clear();
        window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
      }
    });
    expect(screen.getByTestId('context-view')).not.toHaveTextContent('previous context note');
    act(() => previous('late previous context response'));
    expect(screen.getByTestId('context-view')).not.toHaveTextContent('late previous context response');
  });
  it('keeps current component state on no-op token selection', () => {
    window.history.replaceState({}, '', path);
    render(<App />);
    act(() => pending.setters[pending.setters.length - 1]!('current note'));
    act(() => setApiBearerToken('session-a'));
    expect(screen.getByTestId('context-view')).toHaveTextContent('current note');
  });
});
