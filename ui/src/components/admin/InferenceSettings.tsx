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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import type {
  InferenceConfig,
  InferenceConfigUpdate,
  ConfigSource,
  ConnectionTestResult,
  AttributedValue,
} from '@/api/inference';

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
  /** Discovered models to show as datalist suggestions */
  suggestions?: string[];
}

function ConfigField({ label, attributed, value, onChange, type = 'text', placeholder, suggestions }: ConfigFieldProps) {
  const listId = suggestions?.length ? `${label.replace(/\s/g, '-').toLowerCase()}-models` : undefined;
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
        list={listId}
      />
      {listId && suggestions && (
        <datalist id={listId}>
          {suggestions.map((m) => <option key={m} value={m} />)}
        </datalist>
      )}
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

export function InferenceSettings() {
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

  // Save/reset state
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // Connection test state
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null);
  const [discoveredModels, setDiscoveredModels] = React.useState<string[]>([]);

  // Load config
  const fetchConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await api.inference.getConfig();
      setConfig(cfg);
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
    } catch (err) {
      setError('Failed to load inference configuration');
      console.error('Failed to fetch inference config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchConfig(); }, [fetchConfig]);

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
    return false;
  }, [config, ollamaUrl, ollamaGenModel, ollamaEmbedModel, openaiUrl, openaiKey, openaiGenModel, openaiEmbedModel, openaiExpanded]);

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

    return update;
  };

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const update = buildUpdate();
      const newConfig = await api.inference.updateConfig(update);
      setConfig(newConfig);
      // Re-populate form with new server values
      if (newConfig.ollama) {
        setOllamaUrl(newConfig.ollama.base_url.value);
        setOllamaGenModel(newConfig.ollama.generation_model.value);
        setOllamaEmbedModel(newConfig.ollama.embedding_model.value);
      }
      if (newConfig.openai) {
        setOpenaiUrl(newConfig.openai.base_url.value);
        setOpenaiKey(newConfig.openai.api_key.value);
        setOpenaiGenModel(newConfig.openai.generation_model.value);
        setOpenaiEmbedModel(newConfig.openai.embedding_model.value);
      }
      setSaveMessage({ type: 'success', text: 'Configuration updated' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration';
      setSaveMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  // Reset handler
  const handleReset = async () => {
    setResetting(true);
    setSaveMessage(null);
    try {
      await api.inference.resetConfig();
      setShowResetConfirm(false);
      // Refetch to get env/default values
      await fetchConfig();
      setTestResult(null);
      setDiscoveredModels([]);
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
      {/* Ollama Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ollama
            {config?.providers.includes('ollama') && (
              <Badge variant="outline" className="text-xs font-normal">active</Badge>
            )}
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

      {/* Source Attribution Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Source:</span>
        <span className="flex items-center gap-1"><SourceBadge source="default" /> compile-time default</span>
        <span className="flex items-center gap-1"><SourceBadge source="env" /> environment variable</span>
        <span className="flex items-center gap-1"><SourceBadge source="db_override" /> user-customized</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save'}
        </Button>

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
    </div>
  );
}
