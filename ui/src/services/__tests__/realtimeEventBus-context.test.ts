import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeEventBus } from '../realtimeEventBus';
import { setApiBearerToken } from '@/api/auth-context';
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); setApiBearerToken('fixture-a'); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe('event publication context', () => {
  it('does not deliver a pending old coalesced event to new-context subscribers', () => {
    const bus=createRealtimeEventBus(), old=vi.fn(), next=vi.fn(), close=bus.subscribe(old);
    bus.publish({ type:'JobProgress', job_id:'same', progress_percent:12, event_id:'progress' });
    setApiBearerToken('fixture-b'); close(); const closeNext=bus.subscribe(next);
    vi.runAllTimers(); expect(next).not.toHaveBeenCalled();
    bus.publish({ type:'JobProgress', job_id:'same', progress_percent:24, event_id:'progress' });
    vi.runAllTimers(); expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].progress_percent).toBe(24); closeNext();
  });
  it('does not replay an in-flight event into listeners registered during dispatch', () => {
    const bus=createRealtimeEventBus(), next=vi.fn();
    let closeNext = () => {};
    const close=bus.subscribe(() => { setApiBearerToken('fixture-b'); closeNext = bus.subscribe(next); });
    bus.publish({ type:'JobCompleted',job_id:'old' }); expect(next).not.toHaveBeenCalled();close();
    bus.publish({ type:'JobCompleted',job_id:'new' }); expect(next).toHaveBeenCalledTimes(1); closeNext();
  });
});
