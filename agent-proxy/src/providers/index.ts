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
  fortemi: process.env.FORTEMI_MODEL ?? 'qwen3:8b',
  ollama: 'qwen3:8b',
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
      // Ollama exposes an OpenAI-compatible Chat Completions API.
      // Fortemi embeds/proxies Ollama on the same URL.
      // IMPORTANT: Use .chat() — the default provider() uses the OpenAI
      // Responses API which generates `item_reference` parts that Ollama
      // doesn't understand (causes "unknown input item type" errors).
      const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
      const ollama = createOpenAI({
        baseURL: `${ollamaUrl}/v1`,
        apiKey: 'ollama', // Ollama doesn't require a real key
      });
      return ollama.chat(modelId);
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
      // Use .chat() for Chat Completions API — the default uses the
      // Responses API which may not work with all OpenAI-compatible providers.
      const openai = createOpenAI({ apiKey });
      return openai.chat(modelId);
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
