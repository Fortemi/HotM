import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentPrivileges } from '../useAgentPrivileges';

describe('useAgentPrivileges', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default assisted mode', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    expect(result.current.mode).toBe('assisted');
  });

  it('changes mode and persists', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    act(() => {
      result.current.setMode('full');
    });
    expect(result.current.mode).toBe('full');
    // Verify persisted
    const stored = JSON.parse(localStorage.getItem('hotm:agent-privileges') ?? '{}');
    expect(stored.mode).toBe('full');
  });

  it('checkPermission reflects current mode', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    // Default is assisted
    expect(result.current.checkPermission('search_notes')).toBe('allowed');
    expect(result.current.checkPermission('create_note')).toBe('confirm');

    act(() => {
      result.current.setMode('full');
    });
    expect(result.current.checkPermission('create_note')).toBe('allowed');

    act(() => {
      result.current.setMode('read-only');
    });
    expect(result.current.checkPermission('create_note')).toBe('denied');
  });

  it('allowForSession adds tool to session allowlist', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    // create_note requires confirmation in assisted mode
    expect(result.current.checkPermission('create_note')).toBe('confirm');

    act(() => {
      result.current.allowForSession('create_note');
    });
    expect(result.current.checkPermission('create_note')).toBe('allowed');
  });

  it('allowForSession is idempotent', () => {
    const { result } = renderHook(() => useAgentPrivileges());
    act(() => {
      result.current.allowForSession('create_note');
      result.current.allowForSession('create_note');
    });
    expect(result.current.settings.sessionAllowlist).toEqual(['create_note']);
  });

  it('requestConfirmation creates pending state', async () => {
    const { result } = renderHook(() => useAgentPrivileges());
    expect(result.current.pending).toBeNull();

    let decision: string | undefined;
    act(() => {
      result.current
        .requestConfirmation('create_note', { content: 'test' })
        .then((d) => { decision = d; });
    });
    expect(result.current.pending).not.toBeNull();
    expect(result.current.pending?.toolName).toBe('create_note');
    expect(result.current.pending?.args).toEqual({ content: 'test' });

    // Resolve the confirmation
    act(() => {
      result.current.resolveConfirmation('allow');
    });
    // Wait for microtask
    await new Promise((r) => setTimeout(r, 0));
    expect(decision).toBe('allow');
    expect(result.current.pending).toBeNull();
  });

  it('resolveConfirmation with allow-remember adds to session allowlist', async () => {
    const { result } = renderHook(() => useAgentPrivileges());

    act(() => {
      result.current.requestConfirmation('create_note', { content: 'test' });
    });

    act(() => {
      result.current.resolveConfirmation('allow-remember');
    });

    expect(result.current.settings.sessionAllowlist).toContain('create_note');
    expect(result.current.checkPermission('create_note')).toBe('allowed');
  });

  it('reset restores defaults and clears pending', () => {
    const { result } = renderHook(() => useAgentPrivileges());

    act(() => {
      result.current.setMode('full');
      result.current.allowForSession('create_note');
    });
    expect(result.current.mode).toBe('full');

    act(() => {
      result.current.reset();
    });
    expect(result.current.mode).toBe('assisted');
    expect(result.current.settings.sessionAllowlist).toEqual([]);
    expect(result.current.pending).toBeNull();
  });

  it('loads persisted mode on mount', () => {
    localStorage.setItem(
      'hotm:agent-privileges',
      JSON.stringify({ mode: 'read-only', overrides: {} }),
    );
    const { result } = renderHook(() => useAgentPrivileges());
    expect(result.current.mode).toBe('read-only');
  });
});
