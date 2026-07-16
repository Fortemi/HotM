/**
 * AI provider configuration for the embedded agent.
 *
 * Supports three provider modes:
 * - 'fortemi': Native Fortemi /chat endpoint (no external dependencies)
 * - 'ollama': Local Ollama via OpenAI-compatible API
 * - 'anthropic': Anthropic Claude via proxy
 * - 'openai': OpenAI via proxy
 *
 * Cloud providers (anthropic, openai) require the agent-proxy backend (#121).
 * Fortemi and Ollama work directly from the SPA.
 */

export type AgentProvider = 'fortemi' | 'ollama' | 'anthropic' | 'openai';

export interface ProviderConfig {
  provider: AgentProvider;
  /** Model identifier (e.g., 'llama3.2', 'claude-sonnet-4-6', 'gpt-4o') */
  model?: string;
  /** Base URL for the provider API (auto-detected for most providers) */
  baseUrl?: string;
  /** Max tool-use steps per message (default: 5) */
  maxSteps?: number;
  /** Temperature for generation (default: 0.7) */
  temperature?: number;
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  provider: 'fortemi',
  maxSteps: 5,
  temperature: 0.7,
};

/** Default model per provider (undefined = let server decide) */
export const DEFAULT_MODELS: Record<AgentProvider, string | undefined> = {
  fortemi: undefined,
  ollama: 'llama3.2',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
};

/** Whether a provider requires the agent-proxy backend */
export function requiresProxy(provider: AgentProvider): boolean {
  return provider === 'anthropic' || provider === 'openai';
}

/** Whether a provider supports streaming via AI SDK */
export function supportsStreaming(_provider: AgentProvider): boolean {
  return true;
}

const STORAGE_KEY = 'hotm:agent-provider';

export function loadProviderConfig(): ProviderConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ProviderConfig>;
      return { ...DEFAULT_PROVIDER_CONFIG, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PROVIDER_CONFIG;
}

export function saveProviderConfig(config: ProviderConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore write errors (e.g., private browsing)
  }
}
