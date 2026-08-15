/** React state and persistence for the server-enforced agent privilege policy. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type PrivilegeMode,
  type PermissionDecision,
  type AgentPrivilegeSettings,
  canExecute,
  loadPrivilegeSettings,
  savePrivilegeSettings,
  DEFAULT_PRIVILEGE_SETTINGS,
} from './privileges';

const DEFAULT_PROXY_URL = '/api/agent/chat';

function createPrivilegeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `agent_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}0000000000000000`.slice(0, 40);
}

export interface UseAgentPrivilegesOptions {
  proxyUrl?: string;
}

export interface UseAgentPrivilegesReturn {
  mode: PrivilegeMode;
  setMode: (mode: PrivilegeMode) => void;
  setOverride: (toolName: string, decision?: PermissionDecision) => void;
  checkPermission: (toolName: string) => PermissionDecision;
  settings: AgentPrivilegeSettings;
  sessionId: string;
  policyError: Error | null;
  clearPolicyError: () => void;
  reset: () => void;
}

export function useAgentPrivileges(
  options: UseAgentPrivilegesOptions = {},
): UseAgentPrivilegesReturn {
  const proxyUrl = options.proxyUrl ?? DEFAULT_PROXY_URL;
  const [settings, setSettings] = useState<AgentPrivilegeSettings>(loadPrivilegeSettings);
  const [sessionId] = useState(createPrivilegeSessionId);
  const [policyError, setPolicyError] = useState<Error | null>(null);
  const clientRevision = useRef(0);

  useEffect(() => {
    const revision = clientRevision.current++;
    const controller = new AbortController();
    void fetch(`${proxyUrl}/privileges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        clientRevision: revision,
        settings: { mode: settings.mode, overrides: settings.overrides },
      }),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Failed to synchronize agent privilege policy.');
      }
      setPolicyError(null);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setPolicyError(error instanceof Error ? error : new Error('Failed to synchronize agent privilege policy.'));
      }
    });
    return () => controller.abort();
  }, [proxyUrl, sessionId, settings.mode, settings.overrides]);

  const setMode = useCallback((mode: PrivilegeMode) => {
    setSettings((previous) => {
      const next = { ...previous, mode };
      savePrivilegeSettings(next);
      return next;
    });
  }, []);

  const setOverride = useCallback((toolName: string, decision?: PermissionDecision) => {
    setSettings((previous) => {
      const overrides = { ...previous.overrides };
      if (decision) overrides[toolName] = decision;
      else delete overrides[toolName];
      const next = { ...previous, overrides };
      savePrivilegeSettings(next);
      return next;
    });
  }, []);

  const checkPermission = useCallback(
    (toolName: string): PermissionDecision => canExecute(toolName, settings),
    [settings],
  );

  const reset = useCallback(() => {
    const defaults: AgentPrivilegeSettings = {
      ...DEFAULT_PRIVILEGE_SETTINGS,
      overrides: {},
      sessionAllowlist: [],
    };
    setSettings(defaults);
    savePrivilegeSettings(defaults);
  }, []);

  return useMemo(() => ({
    mode: settings.mode,
    setMode,
    setOverride,
    checkPermission,
    settings,
    sessionId,
    policyError,
    clearPolicyError: () => setPolicyError(null),
    reset,
  }), [settings, setMode, setOverride, checkPermission, sessionId, policyError, reset]);
}
