import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reinitializeApi } from '../index';
import { captureDataContext, getDataContextRevision, subscribeDataContextChanges } from '../data-context';
beforeEach(() => { localStorage.clear(); reinitializeApi('https://api-a.example/api/v1'); });
describe('default API endpoint context', () => {
  it('invalidates pending work and notifies exactly once on origin change', () => {
    const scope=captureDataContext(), listener=vi.fn(), close=subscribeDataContextChanges(listener);
    try { reinitializeApi('https://api-b.example/api/v1');
      expect(scope.signal.aborted).toBe(true); expect(listener).toHaveBeenCalledTimes(1);
      expect(() => scope.assertCurrent()).toThrowError('active data context changed');
    } finally { scope.close(); close(); }
  });
  it('invalidates a changed API path on the same origin', () => {
    const before=getDataContextRevision(); reinitializeApi('https://api-a.example/other/api/v1');
    expect(getDataContextRevision()).not.toBe(before);
  });
  it('does not reset context for the same normalized endpoint', () => {
    const before=getDataContextRevision(); reinitializeApi('https://api-a.example/api/v1/');
    expect(getDataContextRevision()).toBe(before);
  });
});
