/**
 * React hook for managing agent privilege state.
 *
 * Provides reactive privilege mode with persistence, session allowlist
 * management, and tool permission checking.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  type PrivilegeMode,
  type PermissionDecision,
  type AgentPrivilegeSettings,
  canExecute,
  loadPrivilegeSettings,
  savePrivilegeSettings,
  DEFAULT_PRIVILEGE_SETTINGS,
} from './privileges';

export interface PendingConfirmation {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (decision: 'allow' | 'allow-remember' | 'deny') => void;
}

export interface UseAgentPrivilegesReturn {
  /** Current privilege mode */
  mode: PrivilegeMode;
  /** Set the privilege mode */
  setMode: (mode: PrivilegeMode) => void;
  /** Check if a tool can execute */
  checkPermission: (toolName: string) => PermissionDecision;
  /** Add a tool to the session allowlist ("Allow & Remember") */
  allowForSession: (toolName: string) => void;
  /** Current pending confirmation (if any) */
  pending: PendingConfirmation | null;
  /** Request confirmation for a tool call */
  requestConfirmation: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<'allow' | 'allow-remember' | 'deny'>;
  /** Resolve the current pending confirmation */
  resolveConfirmation: (decision: 'allow' | 'allow-remember' | 'deny') => void;
  /** Full settings object */
  settings: AgentPrivilegeSettings;
  /** Reset to defaults */
  reset: () => void;
}

export function useAgentPrivileges(): UseAgentPrivilegesReturn {
  const [settings, setSettings] = useState<AgentPrivilegeSettings>(
    loadPrivilegeSettings,
  );
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const setMode = useCallback((mode: PrivilegeMode) => {
    setSettings((prev) => {
      const next = { ...prev, mode };
      savePrivilegeSettings(next);
      return next;
    });
  }, []);

  const checkPermission = useCallback(
    (toolName: string): PermissionDecision => {
      return canExecute(toolName, settings);
    },
    [settings],
  );

  const allowForSession = useCallback((toolName: string) => {
    setSettings((prev) => ({
      ...prev,
      sessionAllowlist: prev.sessionAllowlist.includes(toolName)
        ? prev.sessionAllowlist
        : [...prev.sessionAllowlist, toolName],
    }));
  }, []);

  const requestConfirmation = useCallback(
    (
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<'allow' | 'allow-remember' | 'deny'> => {
      return new Promise((resolve) => {
        setPending({ toolName, args, resolve });
      });
    },
    [],
  );

  const resolveConfirmation = useCallback(
    (decision: 'allow' | 'allow-remember' | 'deny') => {
      if (pending) {
        if (decision === 'allow-remember') {
          allowForSession(pending.toolName);
        }
        pending.resolve(decision);
        setPending(null);
      }
    },
    [pending, allowForSession],
  );

  const reset = useCallback(() => {
    const defaults = { ...DEFAULT_PRIVILEGE_SETTINGS };
    setSettings(defaults);
    savePrivilegeSettings(defaults);
    setPending(null);
  }, []);

  return useMemo(
    () => ({
      mode: settings.mode,
      setMode,
      checkPermission,
      allowForSession,
      pending,
      requestConfirmation,
      resolveConfirmation,
      settings,
      reset,
    }),
    [
      settings,
      setMode,
      checkPermission,
      allowForSession,
      pending,
      requestConfirmation,
      resolveConfirmation,
      reset,
    ],
  );
}
