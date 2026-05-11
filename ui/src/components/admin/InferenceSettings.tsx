/**
 * InferenceSettings Component
 * Runtime inference backend configuration with source attribution badges,
 * connection testing, and model discovery.
 *
 * Covers:
 * - Issue #161: Inference Settings panel (config management + source badges)
 * - Issue #162: Connection test UI (test button, success/failure states, model discovery)
 */

import * as React from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Save,
  Wifi,
  ChevronDown,
  ChevronRight,
  Zap,
  Eye,
  Box,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';
import type {
  InferenceConfig,
  InferenceConfigUpdate,
  ConfigSource,
  ConnectionTestResult,
  AttributedValue,
  ProviderCapability,
} from '@/api/inference';
import { getProviderProfile, getEmbeddingCapableProviders, PROVIDER_PROFILES } from '@/api/inference';

// ===========================
// Source Attribution Badge
// ===========================

const SOURCE_STYLES: Record<ConfigSource, { label: string; className: string }> = {
  default: { label: 'default', className: 'bg-muted text-muted-foreground border-muted' },
  env: { label: 'env', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  db_override: { label: 'override', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800' },
};

function SourceBadge({ source }: { source: ConfigSource }) {
  const style = SOURCE_STYLES[source];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', style.className)}>
      {style.label}
    </span>
  );
}

/** Capability badges (Issue #204). Surfaces what a provider can do —
 *  Generation / Embedding / Vision — sourced from the profile catalog. */
function CapabilityBadges({ capabilities }: { capabilities: readonly ProviderCapability[] }) {
  const labelMap: Record<ProviderCapability, { label: string; className: string }> = {
    generation: { label: 'Generation', className: 'border-blue-300/50 bg-blue-50 text-blue-700 dark:border-blue-700/40 dark:bg-blue-950/30 dark:text-blue-300' },
    embedding: { label: 'Embedding', className: 'border-purple-300/50 bg-purple-50 text-purple-700 dark:border-purple-700/40 dark:bg-purple-950/30 dark:text-purple-300' },
    vision: { label: 'Vision', className: 'border-amber-300/50 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300' },
  };
  return (
    <div className="flex flex-wrap gap-1">
      {capabilities.map((cap) => (
        <span
          key={cap}
          className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium', labelMap[cap].className)}
          title={`${labelMap[cap].label} capability`}
        >
          {labelMap[cap].label}
        </span>
      ))}
    </div>
  );
}

// ===========================
// Config Field Input
// ===========================

interface ConfigFieldProps {
  label: string;
  attributed?: AttributedValue;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
  /** Discovered models to show as Select dropdown options */
  suggestions?: string[];
}

function ConfigField({ label, attributed, value, onChange, type = 'text', placeholder, suggestions }: ConfigFieldProps) {
  // Use a proper Select dropdown when models are available
  if (suggestions && suggestions.length > 0 && type !== 'password') {
    // Ensure current value is in the list (it may be a custom model not discovered)
    const options = suggestions.includes(value) ? suggestions : (value ? [value, ...suggestions] : suggestions);
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          {attributed && <SourceBadge source={attributed.source} />}
        </div>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder || 'Select a model...'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((m) => (
              <SelectItem key={m} value={m}>
                <span className="font-mono text-sm">{m}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Fallback to text input when no models discovered
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {attributed && <SourceBadge source={attributed.source} />}
      </div>
      <input
        type={type}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ===========================
// Connection Test Result Display
// ===========================

function ConnectionTestDisplay({ result }: { result: ConnectionTestResult }) {
  if (result.reachable) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">Connected</span>
          {result.detected_provider && (
            <Badge variant="outline" className="text-xs">
              {result.detected_provider}
              {result.ollama_version ? ` v${result.ollama_version}` : ''}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{result.latency_ms}ms</span>
        </div>

        {result.capabilities && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Capabilities:</span>
            {result.capabilities.generation && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1"><Zap className="h-3 w-3" />Generation</Badge>
            )}
            {result.capabilities.embedding && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1"><Box className="h-3 w-3" />Embedding</Badge>
            )}
            {result.capabilities.vision && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1"><Eye className="h-3 w-3" />Vision</Badge>
            )}
          </div>
        )}

        {result.available_models.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Models ({result.available_models.length}):
            </span>
            <div className="flex flex-wrap gap-1">
              {result.available_models.slice(0, 8).map((m) => (
                <Badge key={m} variant="outline" className="text-[10px] font-mono">{m}</Badge>
              ))}
              {result.available_models.length > 8 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{result.available_models.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-600" />
        <span className="text-sm font-medium text-red-700 dark:text-red-300">Connection Failed</span>
      </div>
      <p className="text-xs text-red-600 dark:text-red-400">{result.error}</p>
      {result.suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Suggestions:</span>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===========================
// Main Component
// ===========================

export interface InferenceSettingsProps {
  /**
   * Optional archive scope (Issue #208). When set, every getConfig /
   * updateConfig / resetConfig call sends the `X-Fortemi-Memory` header
   * and reads/writes go through the per-archive override path. When
   * absent, operates on the global config.
   */
  scope?: { archive: string };
}

export function InferenceSettings({ scope }: InferenceSettingsProps = {}) {
  // Config state
  const [config, setConfig] = React.useState<InferenceConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Form state — editable values (only changed fields get sent)
  const [ollamaUrl, setOllamaUrl] = React.useState('');
  const [ollamaGenModel, setOllamaGenModel] = React.useState('');
  const [ollamaEmbedModel, setOllamaEmbedModel] = React.useState('');
  const [openaiExpanded, setOpenaiExpanded] = React.useState(false);
  const [openaiUrl, setOpenaiUrl] = React.useState('');
  const [openaiKey, setOpenaiKey] = React.useState('');
  const [openaiGenModel, setOpenaiGenModel] = React.useState('');
  const [openaiEmbedModel, setOpenaiEmbedModel] = React.useState('');
  const [llamacppExpanded, setLlamacppExpanded] = React.useState(false);
  const [llamacppUrl, setLlamacppUrl] = React.useState('');
  const [llamacppKey, setLlamacppKey] = React.useState('');
  const [llamacppGenModel, setLlamacppGenModel] = React.useState('');
  const [llamacppEmbedModel, setLlamacppEmbedModel] = React.useState('');
  // OpenRouter — generation-only provider (Fortemi #654 PR 3, Issue #204).
  // Two extra headers (HTTP-Referer, X-Title) become http_referer + app_name fields.
  const [openrouterExpanded, setOpenrouterExpanded] = React.useState(false);
  const [openrouterUrl, setOpenrouterUrl] = React.useState('');
  const [openrouterKey, setOpenrouterKey] = React.useState('');
  const [openrouterGenModel, setOpenrouterGenModel] = React.useState('');
  const [openrouterHttpReferer, setOpenrouterHttpReferer] = React.useState('');
  const [openrouterAppName, setOpenrouterAppName] = React.useState('');

  // Routing controls (Fortemi #654 PR 2c, Issue #205).
  // default_backend: empty string means "no change" (we send only on diff).
  // embedding_backend: tri-state — false = no override (send null on save),
  //                                 true + selected = override (send string).
  const [defaultBackend, setDefaultBackend] = React.useState<string>('');
  const [embeddingOverrideEnabled, setEmbeddingOverrideEnabled] = React.useState(false);
  const [embeddingBackend, setEmbeddingBackend] = React.useState<string>('');

  // Save/reset state
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // SSE banner — server-side hot-swap notification when the user has unsaved edits.
  // Cleared on dismiss or manual refresh. Fortemi #654/#657 (#203).
  const [serverChangeBanner, setServerChangeBanner] = React.useState<{
    changedFields: string[];
    reset?: boolean;
  } | null>(null);

  // Connection test state (per provider)
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null);
  const [discoveredModels, setDiscoveredModels] = React.useState<string[]>([]);
  const [llamacppTesting, setLlamacppTesting] = React.useState(false);
  const [llamacppTestResult, setLlamacppTestResult] = React.useState<ConnectionTestResult | null>(null);
  const [llamacppDiscoveredModels, setLlamacppDiscoveredModels] = React.useState<string[]>([]);

  // Load config
  const fetchConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await api.inference.getConfig(scope);
      setConfig(cfg);
      // Populate routing state (Issue #205)
      setDefaultBackend(cfg.default_backend);
      if (cfg.embedding_backend) {
        setEmbeddingOverrideEnabled(true);
        setEmbeddingBackend(cfg.embedding_backend);
      } else {
        setEmbeddingOverrideEnabled(false);
        setEmbeddingBackend('');
      }
      // Populate form fields from attributed values
      if (cfg.ollama) {
        setOllamaUrl(cfg.ollama.base_url.value);
        setOllamaGenModel(cfg.ollama.generation_model.value);
        setOllamaEmbedModel(cfg.ollama.embedding_model.value);
      }
      if (cfg.openai) {
        setOpenaiExpanded(true);
        setOpenaiUrl(cfg.openai.base_url.value);
        setOpenaiKey(cfg.openai.api_key.value);
        setOpenaiGenModel(cfg.openai.generation_model.value);
        setOpenaiEmbedModel(cfg.openai.embedding_model.value);
      }
      if (cfg.llamacpp) {
        setLlamacppExpanded(true);
        setLlamacppUrl(cfg.llamacpp.base_url.value);
        setLlamacppKey(cfg.llamacpp.api_key.value);
        setLlamacppGenModel(cfg.llamacpp.generation_model.value);
        setLlamacppEmbedModel(cfg.llamacpp.embedding_model.value);
      }
      if (cfg.openrouter) {
        setOpenrouterExpanded(true);
        setOpenrouterUrl(cfg.openrouter.base_url.value);
        setOpenrouterKey(cfg.openrouter.api_key.value);
        setOpenrouterGenModel(cfg.openrouter.generation_model.value);
        setOpenrouterHttpReferer(cfg.openrouter.http_referer.value);
        setOpenrouterAppName(cfg.openrouter.app_name.value);
      }
    } catch (err) {
      setError('Failed to load inference configuration');
      console.error('Failed to fetch inference config:', err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  React.useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  // Track whether the form is dirty using a ref so the SSE handler can read
  // the current value without re-subscribing on every keystroke.
  const hasChangesRef = React.useRef(false);

  // Subscribe to inference config SSE events (Fortemi #654/#657, #203).
  // Auto-refresh when the form is clean; surface a banner instead of
  // blowing away unsaved edits.
  React.useEffect(() => {
    const handler = (event: RealtimeEvent) => {
      if (event.type !== 'InferenceConfigChanged') return;

      const changed = event.changed_fields ?? [];
      // Sentinels: __reset__ (global reset to env/defaults),
      //            __reset_archive__ (per-archive override cleared)
      const isReset = changed.includes('__reset__');
      const isResetArchive = changed.includes('__reset_archive__');

      // Scope filtering (Issue #208):
      // - When this form is GLOBAL scope: ignore __reset_archive__
      //   (archive resets don't affect what we're viewing).
      // - When this form is ARCHIVE scope: only react when the event
      //   either omits archive_name (best-effort, treated as global) OR
      //   names our archive explicitly.
      if (scope) {
        // Archive-scoped form
        if (event.archive_name && event.archive_name !== scope.archive) {
          // Event scoped to a different archive — ignore.
          return;
        }
      } else {
        // Global form — only ignore __reset_archive__ if it's the ONLY signal.
        if (isResetArchive && !isReset && changed.length === 1) {
          return;
        }
      }

      if (hasChangesRef.current) {
        setServerChangeBanner({ changedFields: changed, reset: isReset });
      } else {
        void fetchConfig();
        setSaveMessage({
          type: 'success',
          text: isReset
            ? 'Config reset to defaults by another client'
            : `Config updated by another client: ${changed.length > 0 ? changed.join(', ') : 'unknown fields'}`,
        });
      }
    };

    const unsubscribe = realtimeEventBus.subscribe(handler);
    return unsubscribe;
  }, [fetchConfig]);

  // Auto-discover models when config loads with an Ollama URL
  React.useEffect(() => {
    if (!config?.ollama?.base_url?.value || discoveredModels.length > 0) return;
    const discoverModels = async () => {
      try {
        const result = await api.inference.testConnection({
          base_url: config.ollama!.base_url.value,
          provider: 'auto',
          timeout_secs: 5,
        });
        if (result.reachable && result.available_models.length > 0) {
          setDiscoveredModels(result.available_models);
        }
      } catch {
        // Silent — models just won't be auto-populated
      }
    };
    void discoverModels();
  }, [config, discoveredModels.length]);

  // Detect if any fields have been changed from their server values
  const hasChanges = React.useMemo(() => {
    if (!config) return false;
    if (config.ollama) {
      if (ollamaUrl !== config.ollama.base_url.value) return true;
      if (ollamaGenModel !== config.ollama.generation_model.value) return true;
      if (ollamaEmbedModel !== config.ollama.embedding_model.value) return true;
    }
    if (config.openai) {
      if (openaiUrl !== config.openai.base_url.value) return true;
      if (openaiKey !== config.openai.api_key.value) return true;
      if (openaiGenModel !== config.openai.generation_model.value) return true;
      if (openaiEmbedModel !== config.openai.embedding_model.value) return true;
    }
    // If openai was expanded but no server config exists, check if user typed anything
    if (!config.openai && openaiExpanded) {
      if (openaiUrl || openaiKey || openaiGenModel || openaiEmbedModel) return true;
    }
    if (config.llamacpp) {
      if (llamacppUrl !== config.llamacpp.base_url.value) return true;
      if (llamacppKey !== config.llamacpp.api_key.value) return true;
      if (llamacppGenModel !== config.llamacpp.generation_model.value) return true;
      if (llamacppEmbedModel !== config.llamacpp.embedding_model.value) return true;
    }
    if (!config.llamacpp && llamacppExpanded) {
      if (llamacppUrl || llamacppKey || llamacppGenModel || llamacppEmbedModel) return true;
    }
    if (config.openrouter) {
      if (openrouterUrl !== config.openrouter.base_url.value) return true;
      if (openrouterKey !== config.openrouter.api_key.value) return true;
      if (openrouterGenModel !== config.openrouter.generation_model.value) return true;
      if (openrouterHttpReferer !== config.openrouter.http_referer.value) return true;
      if (openrouterAppName !== config.openrouter.app_name.value) return true;
    }
    if (!config.openrouter && openrouterExpanded) {
      if (openrouterUrl || openrouterKey || openrouterGenModel || openrouterHttpReferer || openrouterAppName) return true;
    }
    // Routing changes (Issue #205)
    if (defaultBackend && defaultBackend !== config.default_backend) return true;
    const serverEmbedding = config.embedding_backend ?? null;
    const formEmbedding = embeddingOverrideEnabled ? (embeddingBackend || null) : null;
    if (formEmbedding !== serverEmbedding) return true;
    return false;
  }, [config, ollamaUrl, ollamaGenModel, ollamaEmbedModel, openaiUrl, openaiKey, openaiGenModel, openaiEmbedModel, openaiExpanded, llamacppUrl, llamacppKey, llamacppGenModel, llamacppEmbedModel, llamacppExpanded, openrouterUrl, openrouterKey, openrouterGenModel, openrouterHttpReferer, openrouterAppName, openrouterExpanded, defaultBackend, embeddingOverrideEnabled, embeddingBackend]);

  // Mirror hasChanges into a ref so the SSE subscriber reads the current value
  // without re-binding on every keystroke (Issue #203).
  React.useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  // Build update payload with only changed fields
  const buildUpdate = (): InferenceConfigUpdate => {
    const update: InferenceConfigUpdate = {};

    if (config?.ollama) {
      const ollama: Record<string, string> = {};
      if (ollamaUrl !== config.ollama.base_url.value) ollama.base_url = ollamaUrl;
      if (ollamaGenModel !== config.ollama.generation_model.value) ollama.generation_model = ollamaGenModel;
      if (ollamaEmbedModel !== config.ollama.embedding_model.value) ollama.embedding_model = ollamaEmbedModel;
      if (Object.keys(ollama).length > 0) update.ollama = ollama;
    }

    if (config?.openai || openaiExpanded) {
      const openai: Record<string, string> = {};
      const serverOpenai = config?.openai;
      if (openaiUrl !== (serverOpenai?.base_url.value ?? '')) openai.base_url = openaiUrl;
      if (openaiKey !== (serverOpenai?.api_key.value ?? '')) openai.api_key = openaiKey;
      if (openaiGenModel !== (serverOpenai?.generation_model.value ?? '')) openai.generation_model = openaiGenModel;
      if (openaiEmbedModel !== (serverOpenai?.embedding_model.value ?? '')) openai.embedding_model = openaiEmbedModel;
      if (Object.keys(openai).length > 0) update.openai = openai;
    }

    if (config?.llamacpp || llamacppExpanded) {
      const llamacpp: Record<string, string> = {};
      const serverLlamacpp = config?.llamacpp;
      if (llamacppUrl !== (serverLlamacpp?.base_url.value ?? '')) llamacpp.base_url = llamacppUrl;
      if (llamacppKey !== (serverLlamacpp?.api_key.value ?? '')) llamacpp.api_key = llamacppKey;
      if (llamacppGenModel !== (serverLlamacpp?.generation_model.value ?? '')) llamacpp.generation_model = llamacppGenModel;
      if (llamacppEmbedModel !== (serverLlamacpp?.embedding_model.value ?? '')) llamacpp.embedding_model = llamacppEmbedModel;
      if (Object.keys(llamacpp).length > 0) update.llamacpp = llamacpp;
    }

    if (config?.openrouter || openrouterExpanded) {
      const openrouter: Record<string, string> = {};
      const serverOpenrouter = config?.openrouter;
      if (openrouterUrl !== (serverOpenrouter?.base_url.value ?? '')) openrouter.base_url = openrouterUrl;
      if (openrouterKey !== (serverOpenrouter?.api_key.value ?? '')) openrouter.api_key = openrouterKey;
      if (openrouterGenModel !== (serverOpenrouter?.generation_model.value ?? '')) openrouter.generation_model = openrouterGenModel;
      if (openrouterHttpReferer !== (serverOpenrouter?.http_referer.value ?? '')) openrouter.http_referer = openrouterHttpReferer;
      if (openrouterAppName !== (serverOpenrouter?.app_name.value ?? '')) openrouter.app_name = openrouterAppName;
      if (Object.keys(openrouter).length > 0) update.openrouter = openrouter;
    }

    // Routing — tri-state on embedding_backend (Issue #205, Fortemi #654 PR 2c).
    if (defaultBackend && config && defaultBackend !== config.default_backend) {
      update.default_backend = defaultBackend;
    }
    if (config) {
      const serverEmbedding = config.embedding_backend ?? null;
      const formEmbedding = embeddingOverrideEnabled ? (embeddingBackend || null) : null;
      if (formEmbedding !== serverEmbedding) {
        // formEmbedding null = clear override; string = set override.
        // Either case becomes a present key on the payload (tri-state).
        update.embedding_backend = formEmbedding;
      }
    }

    return update;
  };

  // Dry-run preview state (Issue #206). When set, opens a modal showing
  // the diff between the current effective config and the would-be config.
  const [dryRunPreview, setDryRunPreview] = React.useState<{
    current: InferenceConfig;
    would: InferenceConfig;
  } | null>(null);

  // Save handler — accepts save-mode options (Issue #206).
  const handleSave = async (mode: 'plain' | 'validate' | 'atomic' | 'dry_run' = 'plain') => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const update = buildUpdate();
      const options =
        mode === 'plain'
          ? undefined
          : mode === 'validate'
            ? { validate: true }
            : mode === 'atomic'
              ? { atomic: true }
              : { dryRun: true };

      const result = await api.inference.updateConfig(update, options, scope);

      if (mode === 'dry_run') {
        // Don't mutate form or current config. Show diff modal against the
        // current effective config in state.
        if (config) {
          setDryRunPreview({ current: config, would: result });
        }
        setSaveMessage({
          type: 'success',
          text: 'Dry-run complete — preview opened. No changes were applied.',
        });
        return;
      }

      // Real save (plain / validate / atomic) — adopt the new config.
      setConfig(result);
      setDefaultBackend(result.default_backend);
      if (result.embedding_backend) {
        setEmbeddingOverrideEnabled(true);
        setEmbeddingBackend(result.embedding_backend);
      } else {
        setEmbeddingOverrideEnabled(false);
        setEmbeddingBackend('');
      }
      if (result.ollama) {
        setOllamaUrl(result.ollama.base_url.value);
        setOllamaGenModel(result.ollama.generation_model.value);
        setOllamaEmbedModel(result.ollama.embedding_model.value);
      }
      if (result.openai) {
        setOpenaiUrl(result.openai.base_url.value);
        setOpenaiKey(result.openai.api_key.value);
        setOpenaiGenModel(result.openai.generation_model.value);
        setOpenaiEmbedModel(result.openai.embedding_model.value);
      }
      if (result.llamacpp) {
        setLlamacppUrl(result.llamacpp.base_url.value);
        setLlamacppKey(result.llamacpp.api_key.value);
        setLlamacppGenModel(result.llamacpp.generation_model.value);
        setLlamacppEmbedModel(result.llamacpp.embedding_model.value);
      }
      if (result.openrouter) {
        setOpenrouterUrl(result.openrouter.base_url.value);
        setOpenrouterKey(result.openrouter.api_key.value);
        setOpenrouterGenModel(result.openrouter.generation_model.value);
        setOpenrouterHttpReferer(result.openrouter.http_referer.value);
        setOpenrouterAppName(result.openrouter.app_name.value);
      }
      const modeLabel =
        mode === 'validate'
          ? 'Configuration updated (validated)'
          : mode === 'atomic'
            ? 'Configuration updated (atomic)'
            : 'Configuration updated';
      setSaveMessage({ type: 'success', text: modeLabel });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration';
      // Atomic mode returns 503 with per-provider failure detail. Surface it
      // verbatim from the error message so the user knows which provider
      // probe failed.
      const prefix = mode === 'atomic' ? 'Atomic save aborted: ' : '';
      setSaveMessage({ type: 'error', text: prefix + msg });
    } finally {
      setSaving(false);
    }
  };

  // Reset handler
  const handleReset = async () => {
    setResetting(true);
    setSaveMessage(null);
    try {
      await api.inference.resetConfig(scope);
      setShowResetConfirm(false);
      // Refetch to get env/default values
      await fetchConfig();
      setTestResult(null);
      setDiscoveredModels([]);
      setLlamacppTestResult(null);
      setLlamacppDiscoveredModels([]);
      setSaveMessage({ type: 'success', text: 'Configuration reset to defaults' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reset configuration';
      setSaveMessage({ type: 'error', text: msg });
    } finally {
      setResetting(false);
    }
  };

  // Test connection handler
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.inference.testConnection({
        base_url: ollamaUrl,
        provider: 'auto',
        timeout_secs: 10,
      });
      setTestResult(result);
      if (result.reachable && result.available_models.length > 0) {
        setDiscoveredModels(result.available_models);
      }
    } catch (err) {
      setTestResult({
        reachable: false,
        detected_provider: null,
        error: err instanceof Error ? err.message : 'Connection test failed',
        suggestions: ['Check that the API server is running', 'Verify network connectivity'],
      });
    } finally {
      setTesting(false);
    }
  };

  // Test connection handler for llama.cpp
  const handleTestLlamacpp = async () => {
    setLlamacppTesting(true);
    setLlamacppTestResult(null);
    try {
      const result = await api.inference.testConnection({
        base_url: llamacppUrl,
        provider: 'auto',
        api_key: llamacppKey || null,
        timeout_secs: 10,
      });
      setLlamacppTestResult(result);
      if (result.reachable && result.available_models.length > 0) {
        setLlamacppDiscoveredModels(result.available_models);
      }
    } catch (err) {
      setLlamacppTestResult({
        reachable: false,
        detected_provider: null,
        error: err instanceof Error ? err.message : 'Connection test failed',
        suggestions: ['Check that llama.cpp server is running', 'Verify the base URL and port'],
      });
    } finally {
      setLlamacppTesting(false);
    }
  };

  // Clear save message after timeout
  React.useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  if (loading) {
    return <div className="text-muted-foreground">Loading inference configuration...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-destructive">{error}</div>
        <Button variant="outline" size="sm" onClick={() => void fetchConfig()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Server-side hot-swap banner (Issue #203). Only shown when there
          are unsaved edits — otherwise the form auto-refreshes silently. */}
      {serverChangeBanner && (
        <div
          className="flex items-start gap-3 rounded-md border border-amber-300/40 bg-amber-50 p-3 dark:border-amber-700/30 dark:bg-amber-900/20"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              {serverChangeBanner.reset
                ? 'Server config was reset to defaults by another client.'
                : 'Server config changed since you opened this form.'}
            </p>
            {!serverChangeBanner.reset && serverChangeBanner.changedFields.length > 0 && (
              <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/70">
                Changed fields: <span className="font-mono">{serverChangeBanner.changedFields.join(', ')}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/70">
              Your unsaved edits are preserved. Refresh to discard them and load the latest server state.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => {
              setServerChangeBanner(null);
              void fetchConfig();
            }}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setServerChangeBanner(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Per-archive deferred-hot-swap warning (Issue #208).
          Per-archive overrides persist but do not yet hot-swap to the live
          runtime registry. The Fortemi PR description for #655 acknowledges
          this gap. Live archive-scoped routing is filed as a follow-up. */}
      {scope && (
        <div
          className="flex items-start gap-3 rounded-md border border-orange-300/40 bg-orange-50 p-3 dark:border-orange-700/30 dark:bg-orange-900/20"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-700 dark:text-orange-300" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-orange-900 dark:text-orange-200">
              Per-archive overrides for <span className="font-mono">{scope.archive}</span>
            </p>
            <p className="mt-1 text-xs text-orange-800/80 dark:text-orange-200/70">
              Settings here persist to the archive override table but are <strong>not yet routed
              in the live runtime</strong>. Subsequent reads scoped to this archive see the override;
              actual traffic still serves through the global registry until per-schema routing
              lands as a Fortemi follow-up.
            </p>
          </div>
        </div>
      )}

      {/* Routing panel (Fortemi #654 PR 2c, Issue #205).
          Default backend routes generation. Embedding override routes
          embeddings independently — only providers with the embedding
          capability appear in the dropdown. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Routing
            <Badge variant="outline" className="text-xs font-normal">runtime</Badge>
          </CardTitle>
          <CardDescription>
            Generation: <span className="font-mono">{defaultBackend || '—'}</span>
            {embeddingOverrideEnabled && embeddingBackend ? (
              <> — Embeddings: <span className="font-mono">{embeddingBackend}</span></>
            ) : (
              <> — Embeddings: <span className="font-mono">{defaultBackend || '—'}</span> (via default)</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Default backend</label>
            <Select value={defaultBackend} onValueChange={setDefaultBackend}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a default backend" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_PROFILES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName}
                    {p.capabilities.includes('embedding') ? '' : '  (generation only)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Routes both generation and (when no override is set) embeddings.
            </p>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={embeddingOverrideEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setEmbeddingOverrideEnabled(enabled);
                  if (!enabled) setEmbeddingBackend('');
                }}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <span className="font-medium">Route embeddings independently</span>
            </label>
            {embeddingOverrideEnabled && (
              <div className="ml-6 mt-2">
                <Select value={embeddingBackend} onValueChange={setEmbeddingBackend}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an embedding backend" />
                  </SelectTrigger>
                  <SelectContent>
                    {getEmbeddingCapableProviders().map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Only providers with the embedding capability are listed. Server-side validation
                  rejects mismatches with HTTP 400.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ollama Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ollama
            {config?.providers.includes('ollama') && (
              <Badge variant="outline" className="text-xs font-normal">active</Badge>
            )}
            <span className="ml-2">
              <CapabilityBadges capabilities={getProviderProfile('ollama')?.capabilities ?? []} />
            </span>
          </CardTitle>
          <CardDescription>Local LLM inference backend</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ConfigField
            label="Base URL"
            attributed={config?.ollama?.base_url}
            value={ollamaUrl}
            onChange={setOllamaUrl}
            placeholder="http://localhost:11434"
          />

          {/* Test Connection Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !ollamaUrl}
              className="gap-2"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>

          {testResult && <ConnectionTestDisplay result={testResult} />}

          <Separator />

          <ConfigField
            label="Generation Model"
            attributed={config?.ollama?.generation_model}
            value={ollamaGenModel}
            onChange={setOllamaGenModel}
            placeholder="qwen3.5:27b"
            suggestions={discoveredModels}
          />

          <ConfigField
            label="Embedding Model"
            attributed={config?.ollama?.embedding_model}
            value={ollamaEmbedModel}
            onChange={setOllamaEmbedModel}
            placeholder="nomic-embed-text"
            suggestions={discoveredModels}
          />
        </CardContent>
      </Card>

      {/* OpenAI Section (collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setOpenaiExpanded(!openaiExpanded)}
        >
          <CardTitle className="flex items-center gap-2">
            {openaiExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            OpenAI-compatible
            {config?.providers.includes('openai') && (
              <Badge variant="outline" className="text-xs font-normal">active</Badge>
            )}
            <span className="ml-2">
              <CapabilityBadges capabilities={getProviderProfile('openai')?.capabilities ?? []} />
            </span>
          </CardTitle>
          <CardDescription>
            {openaiExpanded ? 'Configure OpenAI or compatible API' : 'Click to expand'}
          </CardDescription>
        </CardHeader>
        {openaiExpanded && (
          <CardContent className="flex flex-col gap-4">
            <ConfigField
              label="Base URL"
              attributed={config?.openai?.base_url}
              value={openaiUrl}
              onChange={setOpenaiUrl}
              placeholder="https://api.openai.com/v1"
            />
            <ConfigField
              label="API Key"
              attributed={config?.openai?.api_key}
              value={openaiKey}
              onChange={setOpenaiKey}
              type="password"
              placeholder="sk-..."
            />
            <Separator />
            <ConfigField
              label="Generation Model"
              attributed={config?.openai?.generation_model}
              value={openaiGenModel}
              onChange={setOpenaiGenModel}
              placeholder="gpt-4o"
            />
            <ConfigField
              label="Embedding Model"
              attributed={config?.openai?.embedding_model}
              value={openaiEmbedModel}
              onChange={setOpenaiEmbedModel}
              placeholder="text-embedding-3-small"
            />
          </CardContent>
        )}
      </Card>

      {/* OpenRouter Section (collapsible) — Fortemi #654 PR 3, Issue #204.
          Generation-only provider; no embedding model field. Requires HTTP-Referer + X-Title headers. */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setOpenrouterExpanded(!openrouterExpanded)}
        >
          <CardTitle className="flex items-center gap-2">
            {openrouterExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            OpenRouter
            {config?.providers.includes('openrouter') && (
              <Badge variant="outline" className="text-xs font-normal">active</Badge>
            )}
            <span className="ml-2">
              <CapabilityBadges capabilities={getProviderProfile('openrouter')?.capabilities ?? []} />
            </span>
          </CardTitle>
          <CardDescription>
            Aggregated commercial-model gateway. Generation only — embeddings are not supported.
          </CardDescription>
        </CardHeader>
        {openrouterExpanded && (
          <CardContent className="flex flex-col gap-4">
            <ConfigField
              label="Base URL"
              attributed={config?.openrouter?.base_url}
              value={openrouterUrl}
              onChange={setOpenrouterUrl}
              placeholder="https://openrouter.ai/api/v1"
            />
            <ConfigField
              label="API Key"
              attributed={config?.openrouter?.api_key}
              value={openrouterKey}
              onChange={setOpenrouterKey}
              type="password"
              placeholder="sk-or-..."
            />
            <Separator />
            <ConfigField
              label="Generation Model"
              attributed={config?.openrouter?.generation_model}
              value={openrouterGenModel}
              onChange={setOpenrouterGenModel}
              placeholder="anthropic/claude-sonnet-4"
            />
            <Separator />
            <ConfigField
              label="HTTP-Referer header"
              attributed={config?.openrouter?.http_referer}
              value={openrouterHttpReferer}
              onChange={setOpenrouterHttpReferer}
              placeholder="https://your-app.example.com"
            />
            <ConfigField
              label="X-Title (App name) header"
              attributed={config?.openrouter?.app_name}
              value={openrouterAppName}
              onChange={setOpenrouterAppName}
              placeholder="HotM"
            />
          </CardContent>
        )}
      </Card>

      {/* llama.cpp Section (collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setLlamacppExpanded(!llamacppExpanded)}
        >
          <CardTitle className="flex items-center gap-2">
            {llamacppExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            llama.cpp
            {config?.providers.includes('llamacpp') && (
              <Badge variant="outline" className="text-xs font-normal">active</Badge>
            )}
            <span className="ml-2">
              <CapabilityBadges capabilities={getProviderProfile('llamacpp')?.capabilities ?? []} />
            </span>
          </CardTitle>
          <CardDescription>
            {llamacppExpanded ? 'Configure llama.cpp HTTP server' : 'Click to expand'}
          </CardDescription>
        </CardHeader>
        {llamacppExpanded && (
          <CardContent className="flex flex-col gap-4">
            <ConfigField
              label="Base URL"
              attributed={config?.llamacpp?.base_url}
              value={llamacppUrl}
              onChange={setLlamacppUrl}
              placeholder="http://127.0.0.1:8080"
            />
            <ConfigField
              label="API Key"
              attributed={config?.llamacpp?.api_key}
              value={llamacppKey}
              onChange={setLlamacppKey}
              type="password"
              placeholder="Optional"
            />

            {/* Test Connection Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestLlamacpp}
                disabled={llamacppTesting || !llamacppUrl}
                className="gap-2"
              >
                {llamacppTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                {llamacppTesting ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>

            {llamacppTestResult && <ConnectionTestDisplay result={llamacppTestResult} />}

            <Separator />

            <ConfigField
              label="Generation Model"
              attributed={config?.llamacpp?.generation_model}
              value={llamacppGenModel}
              onChange={setLlamacppGenModel}
              placeholder="default"
              suggestions={llamacppDiscoveredModels}
            />
            <ConfigField
              label="Embedding Model"
              attributed={config?.llamacpp?.embedding_model}
              value={llamacppEmbedModel}
              onChange={setLlamacppEmbedModel}
              placeholder="default"
              suggestions={llamacppDiscoveredModels}
            />
          </CardContent>
        )}
      </Card>

      {/* Source Attribution Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Source:</span>
        <span className="flex items-center gap-1"><SourceBadge source="default" /> compile-time default</span>
        <span className="flex items-center gap-1"><SourceBadge source="env" /> environment variable</span>
        <span className="flex items-center gap-1"><SourceBadge source="db_override" /> user-customized</span>
      </div>

      {/* Actions — Save split-button (Issue #206).
          Plain Save: hot-swap with no probe.
          Validate before save: probe touched providers, fail with reason.
          Atomic save: probe ALL touched providers; 503 if any fails (registry untouched).
          Preview changes: dry-run, returns the would-be effective config; opens a diff modal. */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md shadow-xs">
          <Button
            onClick={() => void handleSave('plain')}
            disabled={saving || !hasChanges}
            className="gap-2 rounded-r-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Select
            value=""
            onValueChange={(value) => {
              if (value === 'validate' || value === 'atomic' || value === 'dry_run') {
                void handleSave(value);
              }
            }}
            disabled={saving || !hasChanges}
          >
            <SelectTrigger className="w-auto rounded-l-none border-l-0 px-2" aria-label="Save mode">
              <ChevronDown className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="validate" title="Probe each touched provider's endpoint before persisting. Fails with a reason if any are unreachable.">
                Validate before save
              </SelectItem>
              <SelectItem value="atomic" title="Probe ALL touched providers before commit. Returns 503 if any probe fails, leaving the live registry unchanged.">
                Atomic save
              </SelectItem>
              <SelectItem value="dry_run" title="Return the would-be effective config WITHOUT persisting or hot-swapping. Opens a diff preview.">
                Preview changes (dry-run)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showResetConfirm ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-1.5">
            <span className="text-xs text-destructive">Remove all custom overrides?</span>
            <Button variant="destructive" size="sm" onClick={handleReset} disabled={resetting}>
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowResetConfirm(true)}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
        )}

        {saveMessage && (
          <span className={cn(
            'text-sm ml-2',
            saveMessage.type === 'success' ? 'text-green-600' : 'text-destructive'
          )}>
            {saveMessage.text}
          </span>
        )}
      </div>

      {/* Dry-run preview modal (Issue #206). Shows the diff between the
          current effective config and the would-be config returned by the
          ?dry_run=true save. Does NOT trigger an SSE event because the
          server doesn't persist on dry-run. */}
      {dryRunPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Dry-run preview"
        >
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">Preview: would-be config</h2>
                <p className="text-xs text-muted-foreground">
                  Dry-run only — nothing was persisted or hot-swapped on the server.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDryRunPreview(null)}>
                Close
              </Button>
            </div>
            <div className="grid max-h-[60vh] grid-cols-2 gap-0 overflow-auto">
              <div className="border-r p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Current</p>
                <pre className="overflow-auto rounded bg-muted/30 p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(dryRunPreview.current, null, 2)}
                </pre>
              </div>
              <div className="p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Would be</p>
                <pre className="overflow-auto rounded bg-muted/30 p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(dryRunPreview.would, null, 2)}
                </pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <Button variant="outline" onClick={() => setDryRunPreview(null)}>
                Close
              </Button>
              <Button
                onClick={async () => {
                  setDryRunPreview(null);
                  await handleSave('plain');
                }}
                disabled={saving}
              >
                Apply this change
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
