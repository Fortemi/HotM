import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import {
  AGENT_TOOL_PRIVILEGES,
  AgentPrivilegeError,
  AgentPrivilegeStore,
  classifyTool,
  createPrivilegedTools,
  digestToolArguments,
  parsePrivilegeSettings,
  resolveFromMode,
  resolvePermission,
} from '../privileges.js';
import { agentTools } from '../tools.js';

const SESSION_A = 'agent_session_A_00000001';
const SESSION_B = 'agent_session_B_00000002';
const args = { content: 'private note body', tags: ['one'] };

describe('agent tool privilege classification', () => {
  it('classifies exactly every currently registered tool', () => {
    expect(Object.keys(AGENT_TOOL_PRIVILEGES).sort()).toEqual(Object.keys(agentTools).sort());
    expect(Object.values(AGENT_TOOL_PRIVILEGES)).toEqual(
      expect.arrayContaining(['read', 'write']),
    );
  });

  it('fails closed for unknown tools', () => {
    expect(classifyTool('future_unclassified_tool')).toBeUndefined();
    expect(resolvePermission('future_unclassified_tool', { mode: 'full', overrides: {} })).toBe('denied');
  });

  it('always confirms destructive and admin privileges in full mode', () => {
    expect(resolveFromMode('delete', 'full')).toBe('confirm');
    expect(resolveFromMode('admin', 'full')).toBe('confirm');
    expect(resolveFromMode('write', 'full')).toBe('allowed');
    expect(resolveFromMode('admin', 'read-only')).toBe('denied');
  });

  it('validates persisted policy overrides against the implemented registry', () => {
    expect(parsePrivilegeSettings({
      mode: 'assisted',
      overrides: { create_note: 'denied' },
    })).toEqual({ mode: 'assisted', overrides: { create_note: 'denied' } });
    expect(() => parsePrivilegeSettings({
      mode: 'full',
      overrides: { unknown_tool: 'allowed' },
    })).toThrow(AgentPrivilegeError);
  });

  it('canonicalizes argument object key order', () => {
    expect(digestToolArguments({ b: 2, a: { d: 4, c: 3 } })).toBe(
      digestToolArguments({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});

describe('AgentPrivilegeStore execution boundary', () => {
  it('binds an opaque session ID to one authenticated context', () => {
    const store = new AgentPrivilegeStore(() => {});
    store.updateSession(
      SESSION_A,
      { mode: 'assisted', overrides: {} },
      0,
      'tenant-a:principal-a:research',
    );
    expect(() => store.updateSession(
      SESSION_A,
      { mode: 'assisted', overrides: {} },
      1,
      'tenant-b:principal-a:research',
    )).toThrowError(expect.objectContaining({ code: 'session_context_mismatch' }));
  });

  it('does not let a request-level full mode elevate a stored read-only session', () => {
    const store = new AgentPrivilegeStore(() => undefined);
    store.updateSession(SESSION_A, { mode: 'read-only', overrides: {} }, 0);
    expect(store.decisionFor(SESSION_A, 'create_note', { mode: 'full', overrides: {} })).toBe('denied');
  });

  it('uses a request policy only as a further restriction', () => {
    const store = new AgentPrivilegeStore(() => undefined);
    store.updateSession(SESSION_A, { mode: 'full', overrides: {} }, 0);
    expect(store.decisionFor(SESSION_A, 'create_note', { mode: 'read-only', overrides: {} })).toBe('denied');
  });

  it('ignores replayed or stale policy revisions', () => {
    const store = new AgentPrivilegeStore(() => undefined);
    store.updateSession(SESSION_A, { mode: 'read-only', overrides: {} }, 2);
    expect(store.updateSession(SESSION_A, { mode: 'full', overrides: {} }, 2).mode).toBe('read-only');
    expect(store.updateSession(SESSION_A, { mode: 'full', overrides: {} }, 1).mode).toBe('read-only');
  });

  it('requires confirmation before the wrapped write execute function runs', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const store = new AgentPrivilegeStore(() => undefined);
    const tools = createPrivilegedTools({ create_note: { execute } } as unknown as ToolSet, store, {
      sessionId: SESSION_A,
    }) as unknown as Record<string, {
      needsApproval: (input: unknown, options: { toolCallId: string }) => boolean;
      execute: (input: unknown, options: { toolCallId: string }) => Promise<unknown>;
    }>;

    expect(tools.create_note.needsApproval(args, { toolCallId: 'call-1' })).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    await expect(tools.create_note.execute(args, { toolCallId: 'call-1' }))
      .rejects.toMatchObject({ code: 'confirmation_required' });

    store.resolveConfirmation({
      sessionId: SESSION_A,
      toolCallId: 'call-1',
      toolName: 'create_note',
      args,
      decision: 'allow',
    });
    await expect(tools.create_note.execute(args, { toolCallId: 'call-1' }))
      .resolves.toEqual({ ok: true });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rejects altered arguments after approval', () => {
    const store = new AgentPrivilegeStore(() => undefined);
    store.registerConfirmation(SESSION_A, 'call-altered', 'create_note', args);
    store.resolveConfirmation({
      sessionId: SESSION_A,
      toolCallId: 'call-altered',
      toolName: 'create_note',
      args,
      decision: 'allow',
    });
    expect(() => store.authorizeExecution({
      sessionId: SESSION_A,
      toolCallId: 'call-altered',
      toolName: 'create_note',
      args: { ...args, content: 'altered body' },
    })).toThrowError(expect.objectContaining({ code: 'confirmation_invalid' }));
  });

  it('rejects replay after a confirmation is consumed', () => {
    const store = new AgentPrivilegeStore(() => undefined);
    store.registerConfirmation(SESSION_A, 'call-replay', 'create_note', args);
    store.resolveConfirmation({
      sessionId: SESSION_A,
      toolCallId: 'call-replay',
      toolName: 'create_note',
      args,
      decision: 'allow',
    });
    store.authorizeExecution({
      sessionId: SESSION_A,
      toolCallId: 'call-replay',
      toolName: 'create_note',
      args,
    });
    expect(() => store.authorizeExecution({
      sessionId: SESSION_A,
      toolCallId: 'call-replay',
      toolName: 'create_note',
      args,
    })).toThrowError(expect.objectContaining({ code: 'confirmation_replayed' }));
  });

  it('cannot use another concurrent session confirmation', () => {
    const store = new AgentPrivilegeStore(() => undefined);
    store.registerConfirmation(SESSION_A, 'shared-call', 'create_note', args);
    store.registerConfirmation(SESSION_B, 'shared-call', 'create_note', args);
    store.resolveConfirmation({
      sessionId: SESSION_A,
      toolCallId: 'shared-call',
      toolName: 'create_note',
      args,
      decision: 'allow',
    });
    expect(() => store.authorizeExecution({
      sessionId: SESSION_B,
      toolCallId: 'shared-call',
      toolName: 'create_note',
      args,
    })).toThrowError(expect.objectContaining({ code: 'confirmation_required' }));
  });

  it('allows remembering write tools only after a bound confirmation', () => {
    const store = new AgentPrivilegeStore(() => undefined);
    store.registerConfirmation(SESSION_A, 'call-remember', 'create_note', args);
    store.resolveConfirmation({
      sessionId: SESSION_A,
      toolCallId: 'call-remember',
      toolName: 'create_note',
      args,
      decision: 'allow-remember',
    });
    store.authorizeExecution({
      sessionId: SESSION_A,
      toolCallId: 'call-remember',
      toolName: 'create_note',
      args,
    });
    expect(store.decisionFor(SESSION_A, 'create_note')).toBe('allowed');
    expect(store.decisionFor(SESSION_A, 'create_note', {
      mode: 'assisted',
      overrides: {},
    })).toBe('allowed');
  });

  it('audits outcomes without argument content', () => {
    const audit = vi.fn();
    const store = new AgentPrivilegeStore(audit);
    store.authorizeExecution({
      sessionId: SESSION_A,
      toolCallId: 'read-call',
      toolName: 'get_note',
      args: { note_id: 'sensitive-id' },
    });
    expect(audit).toHaveBeenCalledWith({
      outcome: 'allow',
      toolName: 'get_note',
      privilege: 'read',
      reason: 'policy_allowed',
    });
    expect(JSON.stringify(audit.mock.calls)).not.toContain('sensitive-id');
  });
});
