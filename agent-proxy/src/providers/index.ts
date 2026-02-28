/**
 * Provider factory — resolves the AI SDK language model for a given provider name.
 *
 * API keys are read from environment variables (never exposed to the browser).
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

export type ProviderName = 'fortemi' | 'ollama' | 'anthropic' | 'openai';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  fortemi: process.env.FORTEMI_MODEL ?? 'llama3.2',
  ollama: 'llama3.2',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
};

/**
 * Create a language model instance for the given provider and model.
 * Reads API keys from environment variables.
 */
export function getModel(provider: ProviderName, model?: string): LanguageModel {
  const modelId = model ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case 'fortemi':
    case 'ollama': {
      // Ollama exposes an OpenAI-compatible API.
      // Fortemi embeds/proxies Ollama on the same URL.
      const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
      const ollama = createOpenAI({
        baseURL: `${ollamaUrl}/v1`,
        apiKey: 'ollama', // Ollama doesn't require a real key
      });
      return ollama(modelId);
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
