/**
 * useChatModels — fetches available chat models from the Fortemi API.
 *
 * Only fetches when the provider is 'fortemi' (since Fortemi proxies Ollama
 * and exposes the models endpoint). For other providers, returns empty state.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/api';
import type { ChatModelInfo } from '@/api';
import type { AgentProvider } from './providers';

export interface UseChatModelsReturn {
  models: ChatModelInfo[];
  defaultModel: string | undefined;
  isLoading: boolean;
  error: string | undefined;
  refresh: () => void;
}

export function useChatModels(provider: AgentProvider): UseChatModelsReturn {
  const [models, setModels] = useState<ChatModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const fetchModels = useCallback(async () => {
    if (provider !== 'fortemi') {
      setModels([]);
      setDefaultModel(undefined);
      setError(undefined);
      return;
    }

    setIsLoading(true);
    setError(undefined);
    try {
      const response = await api.chat.getModels();
      // Filter to chat-capable models (exclude embedding models with 0 context window)
      const chatModels = response.models.filter(m => m.context_window > 0);
      setModels(chatModels);
      setDefaultModel(response.default_model);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
      setModels([]);
      setDefaultModel(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, defaultModel, isLoading, error, refresh: fetchModels };
}
