import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureDataContext, getDataContextRevision, subscribeDataContextChanges } from '../data-context';
import { setActiveTenantId, setApiBearerToken } from '../auth-context';
import { setActiveMemory } from '../memory-context';

beforeEach(() => { localStorage.clear(); setActiveTenantId(null); setApiBearerToken('a'); });
describe('data context ownership', () => {
  it('exposes only an opaque revision and ignores effective no-ops', () => {
    const before = getDataContextRevision(), changed = vi.fn();
    const close = subscribeDataContextChanges(changed);
    try {
      expect(typeof before).toBe('number');
      setApiBearerToken('a'); setActiveMemory('public');
      expect(getDataContextRevision()).toBe(before);
      expect(changed).not.toHaveBeenCalled();
      setApiBearerToken('b');
      expect(changed).toHaveBeenCalledTimes(1);
      expect(getDataContextRevision()).not.toBe(before);
    } finally { close(); }
  });
  it('owns storage subscriptions and releases them', () => {
    const scope = captureDataContext();
    scope.close();
    localStorage.setItem('hotm_api_bearer_token', 'b');
    window.dispatchEvent(new StorageEvent('storage', { key: 'hotm_api_bearer_token', storageArea: localStorage }));
    expect(scope.signal.aborted).toBe(false);
    expect(() => scope.assertCurrent()).toThrowError('active data context changed');
  });
  it('ignores unrelated storage and sessionStorage', () => {
    const scope = captureDataContext();
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', storageArea: localStorage }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'hotm_api_bearer_token', storageArea: sessionStorage }));
      scope.assertCurrent(); expect(scope.signal.aborted).toBe(false);
    } finally { scope.close(); }
  });
  it('aborts A-B-A even with no React subscriber', () => {
    const scope = captureDataContext();
    try {
      setApiBearerToken('b'); setApiBearerToken('a');
      expect(scope.signal.aborted).toBe(true);
      expect(() => scope.assertCurrent()).toThrowError('active data context changed');
    } finally { scope.close(); }
  });
});
