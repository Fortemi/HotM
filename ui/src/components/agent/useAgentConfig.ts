/**
 * useAgentConfig — React hook for managing agent provider configuration.
 * Persists settings to localStorage and notifies subscribers on change.
 */

import { useState, useCallback } from 'react';
import {
  type AgentProvider,
  type ProviderConfig,
  DEFAULT_PROVIDER_CONFIG,
  loadProviderConfig,
  saveProviderConfig,
} from './providers';

export function useAgentConfig() {
  const [config, setConfigState] = useState<ProviderConfig>(loadProviderConfig);

  const setConfig = useCallback((updates: Partial<ProviderConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...updates };
      saveProviderConfig(next);
      return next;
    });
  }, []);

  const setProvider = useCallback((provider: AgentProvider) => {
    setConfig({ provider });
  }, [setConfig]);

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_PROVIDER_CONFIG);
    saveProviderConfig(DEFAULT_PROVIDER_CONFIG);
  }, []);

  return {
    config,
    setConfig,
    setProvider,
    resetConfig,
  };
}
