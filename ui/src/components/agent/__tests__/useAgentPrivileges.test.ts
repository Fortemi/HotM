import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentPrivileges } from '../useAgentPrivileges';

const mockFetch = vi.fn();

describe('useAgentPrivileges', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns default assisted mode and a stable session ID', () => {
    const { result, rerender } = renderHook(() => useAgentPrivileges());
    const sessionId = result.current.sessionId;
    expect(result.current.mode).toBe('assisted');
    expect(sessionId).toMatch(/^agent_/);
    rerender();
    expect(result.current.sessionId).toBe(sessionId);
  });

  it('changes mode, persists it, and synchronizes the server policy', async () => {
    const { result } = renderHook(() => useAgentPrivileges());
    act(() => result.current.setMode('full'));
    expect(result.current.mode).toBe('full');
    expect(JSON.parse(localStorage.getItem('hotm:agent-privileges') ?? '{}').mode).toBe('full');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        '/api/agent/chat/privileges',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"mode":"full"'),
        }),
      );
    });
  });

  it('supports persisted per-tool overrides', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    act(() => result.current.setOverride('create_note', 'denied'));
    expect(result.current.checkPermission('create_note')).toBe('denied');
    expect(JSON.parse(localStorage.getItem('hotm:agent-privileges') ?? '{}').overrides)
      .toEqual({ create_note: 'denied' });

    act(() => result.current.setOverride('create_note'));
    expect(result.current.checkPermission('create_note')).toBe('confirm');
  });

  it('checkPermission reflects the current mode and fails closed', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    expect(result.current.checkPermission('search_notes')).toBe('allowed');
    expect(result.current.checkPermission('create_note')).toBe('confirm');
    expect(result.current.checkPermission('unknown_tool')).toBe('denied');

    act(() => result.current.setMode('read-only'));
    expect(result.current.checkPermission('create_note')).toBe('denied');
  });

  it('reset restores defaults', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    act(() => {
      result.current.setMode('full');
      result.current.setOverride('create_note', 'denied');
    });
    act(() => result.current.reset());
    expect(result.current.mode).toBe('assisted');
    expect(result.current.settings.overrides).toEqual({});
  });

  it('loads persisted mode on mount', () => {
    localStorage.setItem(
      'hotm:agent-privileges',
      JSON.stringify({ mode: 'read-only', overrides: {} }),
    );
    const { result } = renderHook(() => useAgentPrivileges());
    expect(result.current.mode).toBe('read-only');
  });

  it('surfaces policy synchronization errors without changing local restrictions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Policy rejected' }),
    });
    const { result } = renderHook(() => useAgentPrivileges());
    await waitFor(() => expect(result.current.policyError?.message).toBe('Policy rejected'));
    expect(result.current.mode).toBe('assisted');
  });
});
