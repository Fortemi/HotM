/**
 * Inference Configuration API
 * Manages runtime inference backend settings (Ollama/OpenAI)
 * and connection testing for LLM endpoints.
 */

import type { ApiClient } from './client';

// ===========================
// Types
// ===========================

/** Source attribution for a config field */
export type ConfigSource = 'db_override' | 'env' | 'default';

/** A config value with its source attribution */
export interface AttributedValue<T = string> {
  value: T;
  source: ConfigSource;
}

/** Ollama provider configuration (GET response shape) */
export interface OllamaConfig {
  base_url: AttributedValue;
  generation_model: AttributedValue;
  embedding_model: AttributedValue;
}

/** OpenAI provider configuration (GET response shape) */
export interface OpenAIConfig {
  base_url: AttributedValue;
  api_key: AttributedValue;
  generation_model: AttributedValue;
  embedding_model: AttributedValue;
}

/** llama.cpp provider configuration (GET response shape) */
export interface LlamaCppConfig {
  base_url: AttributedValue;
  api_key: AttributedValue;
  generation_model: AttributedValue;
  embedding_model: AttributedValue;
}

/** Full inference config response from GET /inference/config */
export interface InferenceConfig {
  default_backend: string;
  ollama: OllamaConfig | null;
  openai: OpenAIConfig | null;
  llamacpp: LlamaCppConfig | null;
  providers: string[];
}

/** Partial update request for POST /inference/config */
export interface InferenceConfigUpdate {
  ollama?: {
    base_url?: string;
    generation_model?: string;
    embedding_model?: string;
  };
  openai?: {
    base_url?: string;
    api_key?: string;
    generation_model?: string;
    embedding_model?: string;
  };
  llamacpp?: {
    base_url?: string;
    api_key?: string;
    generation_model?: string;
    embedding_model?: string;
  };
}

/** Capabilities returned by connection test */
export interface ConnectionCapabilities {
  generation: boolean;
  embedding: boolean;
  vision: boolean;
}

/** Successful connection test result */
export interface ConnectionTestSuccess {
  reachable: true;
  detected_provider: string;
  ollama_version?: string;
  available_models: string[];
  latency_ms: number;
  capabilities: ConnectionCapabilities;
}

/** Failed connection test result */
export interface ConnectionTestFailure {
  reachable: false;
  detected_provider: null;
  error: string;
  suggestions: string[];
}

/** Connection test result (discriminated union) */
export type ConnectionTestResult = ConnectionTestSuccess | ConnectionTestFailure;

/** Connection test request */
export interface ConnectionTestRequest {
  base_url: string;
  provider?: 'auto' | 'ollama' | 'openai';
  api_key?: string | null;
  timeout_secs?: number;
}

// ===========================
// API Factory
// ===========================

export function createInferenceApi(client: ApiClient) {
  return {
    /** Get effective inference config with source attribution */
    async getConfig(): Promise<InferenceConfig> {
      return client.get<InferenceConfig>('/inference/config');
    },

    /** Apply partial config override (merge + hot-swap) */
    async updateConfig(update: InferenceConfigUpdate): Promise<InferenceConfig> {
      return client.post<InferenceConfig>('/inference/config', update);
    },

    /** Apply partial config override with optional validation query param */
    async updateConfigValidated(update: InferenceConfigUpdate): Promise<InferenceConfig> {
      // POST with ?validate=true
      const url = '/inference/config?validate=true';
      return client.post<InferenceConfig>(url, update);
    },

    /** Reset config to env/defaults (removes all DB overrides) */
    async resetConfig(): Promise<void> {
      await client.delete<void>('/inference/config');
    },

    /** Test connection to an inference endpoint */
    async testConnection(request: ConnectionTestRequest): Promise<ConnectionTestResult> {
      return client.post<ConnectionTestResult>('/inference/test-connection', request);
    },
  };
}

export type InferenceApi = ReturnType<typeof createInferenceApi>;
