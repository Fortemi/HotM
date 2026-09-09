import { beforeEach, describe, expect, it } from 'vitest';
import { getActiveTenantId, setActiveTenantId, setApiBearerToken } from '@/api/auth-context';
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
