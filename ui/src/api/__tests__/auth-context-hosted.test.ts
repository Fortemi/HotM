import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_CONTEXT_CHANGED_EVENT, getActiveTenantId, setActiveTenantId, setApiBearerToken, subscribeAuthContextChanges } from '@/api/auth-context';
const a = '966a97a7-f5ba-4bd4-a3a7-8c8353f318b1';
const b = 'd5cb3ddb-7da2-46a0-b2c2-82d94437ca52';
const jwt = (claims: unknown) => `e30.${btoa(JSON.stringify(claims)).replace(/=/g, '')}.synthetic`;
beforeEach(() => { localStorage.clear(); setActiveTenantId(null); });
describe('hosted realtime tenant hint', () => {
  it('reads the canonical hint after bearer injection and follows replacement', () => {
    localStorage.setItem('hotm_api_bearer_token', jwt({ 'fortemi:tenant_id': a }));
    expect(getActiveTenantId()).toBe(a);
    localStorage.setItem('hotm_api_bearer_token', jwt({ 'fortemi:tenant_id': b }));
    expect(getActiveTenantId()).toBe(b);
  });
  it.each([null, {}, { tenant_id: a }, { 'fortemi:tenant_id': 'invalid' }])('rejects absent or malformed canonical hints', (claims) => {
    setApiBearerToken(jwt(claims));
    expect(getActiveTenantId()).toBeNull();
  });
  it('clears explicit tenant state on token replacement and logout', () => {
    setActiveTenantId(a); setApiBearerToken(jwt({ 'fortemi:tenant_id': b }));
    expect(getActiveTenantId()).toBe(b);
    setApiBearerToken(null); expect(getActiveTenantId()).toBeNull();
    setApiBearerToken('opaque'); expect(getActiveTenantId()).toBeNull();
  });
});

describe('auth context notifications', () => {
  it('notifies replacement, tenant change and logout without publishing credentials', () => {
    const receive = vi.fn();
    const stop = subscribeAuthContextChanges(receive);
    const event = vi.fn();
    window.addEventListener(AUTH_CONTEXT_CHANGED_EVENT, event);
    try {
      setApiBearerToken(jwt({ 'fortemi:tenant_id': a }));
      setApiBearerToken(jwt({ 'fortemi:tenant_id': a }));
      expect(receive).toHaveBeenCalledTimes(1);
      setActiveTenantId(b);
      setApiBearerToken(null);
      expect(receive).toHaveBeenCalledTimes(3);
      expect(event.mock.calls.every(([value]) => !('detail' in value))).toBe(true);
    } finally { stop(); window.removeEventListener(AUTH_CONTEXT_CHANGED_EVENT, event); }
    setApiBearerToken('another');
    expect(receive).toHaveBeenCalledTimes(3);
  });

  it.each(['hotm_api_bearer_token', null])('clears stale tenant overrides on cross-tab %s', key => {
    setApiBearerToken(jwt({ 'fortemi:tenant_id': a }));
    setActiveTenantId(a);
    const receive = vi.fn();
    const stop = subscribeAuthContextChanges(receive);
    try {
      if (key) localStorage.setItem(key, jwt({ 'fortemi:tenant_id': b }));
      else localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
      expect(receive).toHaveBeenCalledOnce();
      expect(getActiveTenantId()).toBe(key ? b : null);
    } finally { stop(); }
  });

  it('ignores unrelated keys and session storage', () => {
    const receive = vi.fn();
    const stop = subscribeAuthContextChanges(receive);
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', storageArea: localStorage }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'hotm_api_bearer_token', storageArea: sessionStorage }));
      expect(receive).not.toHaveBeenCalled();
    } finally { stop(); }
  });
});
