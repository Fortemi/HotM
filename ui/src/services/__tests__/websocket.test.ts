import { describe, expect, it } from 'vitest';
import { canUseLegacyWebSocket } from '../websocket';

describe('legacy WebSocket admission', () => {
  const local = {
    authorization: null,
    memory: null,
    tenantId: null,
    anonymousLocalAdvertised: true,
  };

  it('allows only the explicitly advertised unscoped local profile', () => {
    expect(canUseLegacyWebSocket(local)).toBe(true);
    expect(canUseLegacyWebSocket({ ...local, anonymousLocalAdvertised: false })).toBe(false);
  });

  it.each([
    ['authorization', 'token'],
    ['memory', 'memory-a'],
    ['tenantId', '11111111-1111-4111-8111-111111111111'],
  ] as const)('rejects a scoped %s context', (field, value) => {
    expect(canUseLegacyWebSocket({ ...local, [field]: value })).toBe(false);
  });
});
