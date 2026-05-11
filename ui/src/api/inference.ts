/**
 * Inference Configuration API
 * Manages runtime inference backend settings (Ollama/OpenAI/OpenRouter/llama.cpp)
 * and connection testing for LLM endpoints.
 */

import type { ApiClient } from './client';

// ===========================
// Provider profiles
// ===========================

/** Provider capability declared in the profile catalog (Fortemi #654 PR 3). */
export type ProviderCapability = 'generation' | 'embedding' | 'vision';

/** Provider ID — matches Fortemi BackendKind serialization. */
export type ProviderId = 'ollama' | 'openai' | 'openrouter' | 'llamacpp';

/** Provider profile mirrors `ProviderProfile` from
 *  `Fortemi/crates/matric-inference/src/provider_profiles.rs:95-150`.
 *  Hand-mirrored here pending a `/api/v1/inference/providers` endpoint
 *  on the Fortemi side (filed as a follow-up under #202).
 */
export interface ProviderProfile {
  id: ProviderId;
  displayName: string;
  requiresApiKey: boolean;
  capabilities: ProviderCapability[];
  defaultBaseUrl?: string;
  defaultGenerationModel?: string;
  defaultEmbeddingModel?: string;
  /** Provider-specific extra config field IDs that the UI surfaces. */
  extraFields?: ('http_referer' | 'app_name')[];
}

/** The 4 providers Fortemi supports as of #654 PR 3.
 *  Ordered: local-first (Ollama), then commercial (OpenAI/OpenRouter), then llama.cpp.
 */
export const PROVIDER_PROFILES: readonly ProviderProfile[] = [
  {
    id: 'ollama',
    displayName: 'Ollama',
    requiresApiKey: false,
    capabilities: ['generation', 'embedding'],
    defaultBaseUrl: 'http://localhost:11434',
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    requiresApiKey: true,
    capabilities: ['generation', 'embedding', 'vision'],
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    requiresApiKey: true,
    capabilities: ['generation'],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    extraFields: ['http_referer', 'app_name'],
  },
  {
    id: 'llamacpp',
    displayName: 'llama.cpp',
    requiresApiKey: false,
    capabilities: ['generation'],
  },
] as const;

/** Lookup a profile by ID. Returns undefined when the ID is unknown
 *  (e.g., a Fortemi build added a new backend before HotM caught up). */
export function getProviderProfile(id: string): ProviderProfile | undefined {
  return PROVIDER_PROFILES.find((p) => p.id === id);
}

/** Providers that declare embedding capability. Used for the routing
 *  dropdown in #205 and to validate embedding_backend client-side. */
export function getEmbeddingCapableProviders(): readonly ProviderProfile[] {
  return PROVIDER_PROFILES.filter((p) => p.capabilities.includes('embedding'));
}

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

/** OpenRouter provider configuration (GET response shape).
 *  OpenRouter exposes a generation-only chat API and requires two extra
 *  headers (HTTP-Referer, X-Title) on every request. Embedding fields are
 *  absent from the type because the provider has no embedding capability.
 *  Added in Fortemi v2026.5+ #654 PR 3.
 */
export interface OpenRouterConfig {
  base_url: AttributedValue;
  api_key: AttributedValue;
  generation_model: AttributedValue;
  http_referer: AttributedValue;
  app_name: AttributedValue;
}

/** Full inference config response from GET /inference/config */
export interface InferenceConfig {
  default_backend: string;
  /**
   * Optional override that routes embedding calls to a separate provider
   * (Fortemi #654 PR 2c). When `null` (or absent) embeddings flow through
   * `default_backend`. When set, must reference a provider whose profile
   * includes the 'embedding' capability — the server validates and rejects
   * mismatches with HTTP 400.
   */
  embedding_backend?: string | null;
  ollama: OllamaConfig | null;
  openai: OpenAIConfig | null;
  openrouter: OpenRouterConfig | null;
  llamacpp: LlamaCppConfig | null;
  providers: string[];
}

/** Partial update request for POST /inference/config.
 *
 *  Field semantics:
 *  - Per-provider sub-objects: omit a field to leave it unchanged.
 *  - `default_backend`: omit to leave unchanged; set to switch routing.
 *  - `embedding_backend`: tri-state (Fortemi #654 PR 2c):
 *      - omit the key entirely → no change
 *      - explicit `null` → clear any override; embeddings flow through default_backend
 *      - string → route embeddings to that provider (server validates capability)
 */
export interface InferenceConfigUpdate {
  default_backend?: string;
  embedding_backend?: string | null;
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
  openrouter?: {
    base_url?: string;
    api_key?: string;
    generation_model?: string;
    http_referer?: string;
    app_name?: string;
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
  provider?: 'auto' | 'ollama' | 'openai' | 'openrouter' | 'llamacpp';
  api_key?: string | null;
  timeout_secs?: number;
}

// ===========================
// Audit log (Fortemi #656 — Issue #207)
// ===========================

export type AuditAction = 'set' | 'reset' | 'set_archive' | 'reset_archive';

export interface AuditEntry {
  id: number;
  changed_at: string;
  changed_by: string;
  action: AuditAction;
  /** Effective config snapshot before the change. API keys are pre-redacted server-side. */
  before_json?: unknown;
  /** Effective config snapshot after the change. API keys are pre-redacted server-side. */
  after_json?: unknown;
  source_ip?: string | null;
}

export interface AuditLogResponse {
  entries: AuditEntry[];
}

export interface AuditLogQuery {
  limit?: number;
  changedBy?: string;
  action?: AuditAction;
}

// ===========================
// Save mode options (Fortemi #654 — Issue #206)
// ===========================

/** Save-mode flags accepted by POST /inference/config as query params.
 *  All three are independent and can be combined; the server applies
 *  them in this precedence: dry_run > atomic > validate.
 */
export interface UpdateConfigOptions {
  /** ?validate=true — probe touched providers before persisting; fail with reason on unreachable. */
  validate?: boolean;
  /** ?atomic=true — probe ALL touched backends before commit; 503 if any fails. */
  atomic?: boolean;
  /** ?dry_run=true — return the would-be effective config; do NOT persist or hot-swap. */
  dryRun?: boolean;
}

/** Per-request scope (Fortemi #655 — Issue #208).
 *  When `archive` is set, every method adds the `X-Fortemi-Memory` header
 *  so reads/writes go through the per-archive override path. The current
 *  Fortemi build persists archive overrides but does not yet hot-swap them
 *  to the live runtime — see the deferred-hot-swap warning in the per-archive UI.
 */
export interface RequestScope {
  archive?: string;
}

// ===========================
// API Factory
// ===========================

/** Build the `X-Fortemi-Memory` header when an archive scope is supplied. */
function scopeHeaders(scope?: RequestScope): Record<string, string> | undefined {
  if (!scope?.archive) return undefined;
  return { 'X-Fortemi-Memory': scope.archive };
}

/** Build the query string for save-mode flags. Returns an empty string when
 *  no flags are set so the request URL stays stable for the common path. */
function buildUpdateQuery(options?: UpdateConfigOptions): string {
  if (!options) return '';
  const params: string[] = [];
  if (options.validate) params.push('validate=true');
  if (options.atomic) params.push('atomic=true');
  if (options.dryRun) params.push('dry_run=true');
  return params.length > 0 ? `?${params.join('&')}` : '';
}

export function createInferenceApi(client: ApiClient) {
  return {
    /** Get effective inference config with source attribution.
     *  When `scope.archive` is set, returns the archive override merged
     *  over the global config (Fortemi #655). */
    async getConfig(scope?: RequestScope): Promise<InferenceConfig> {
      const headers = scopeHeaders(scope);
      return client.get<InferenceConfig>('/inference/config', undefined, headers);
    },

    /** Apply partial config override (merge + hot-swap).
     *  Pass `options` to choose a save mode (validate / atomic / dry_run).
     *  Pass `scope.archive` to persist to the archive override table. */
    async updateConfig(
      update: InferenceConfigUpdate,
      options?: UpdateConfigOptions,
      scope?: RequestScope,
    ): Promise<InferenceConfig> {
      const url = `/inference/config${buildUpdateQuery(options)}`;
      const headers = scopeHeaders(scope);
      return client.post<InferenceConfig>(url, update, headers);
    },

    /** @deprecated Use `updateConfig(update, { validate: true })` instead. */
    async updateConfigValidated(update: InferenceConfigUpdate): Promise<InferenceConfig> {
      return client.post<InferenceConfig>('/inference/config?validate=true', update);
    },

    /** Reset config to env/defaults (removes all DB overrides).
     *  When `scope.archive` is set, resets only that archive's overrides. */
    async resetConfig(scope?: RequestScope): Promise<void> {
      const headers = scopeHeaders(scope);
      await client.delete<void>('/inference/config', headers);
    },

    /** Test connection to an inference endpoint */
    async testConnection(request: ConnectionTestRequest): Promise<ConnectionTestResult> {
      return client.post<ConnectionTestResult>('/inference/test-connection', request);
    },

    /** Query the audit log (Fortemi #656).
     *  API keys in the snapshots are pre-redacted server-side. */
    async getAuditLog(query?: AuditLogQuery): Promise<AuditLogResponse> {
      const params: string[] = [];
      if (typeof query?.limit === 'number') params.push(`limit=${query.limit}`);
      if (query?.changedBy) params.push(`changed_by=${encodeURIComponent(query.changedBy)}`);
      if (query?.action) params.push(`action=${query.action}`);
      const qs = params.length > 0 ? `?${params.join('&')}` : '';
      return client.get<AuditLogResponse>(`/inference/config/audit${qs}`);
    },
  };
}

export type InferenceApi = ReturnType<typeof createInferenceApi>;
