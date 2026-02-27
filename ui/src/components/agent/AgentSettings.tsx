/**
 * AgentSettings — settings panel for AI assistant configuration.
 *
 * Allows users to:
 * - Select provider (Fortemi, Ollama, Anthropic, OpenAI)
 * - Choose model per provider (dynamic list for Fortemi, text input for others)
 * - Adjust temperature and max tool steps
 * - View connection status
 * - Reset to defaults
 *
 * API keys are NOT stored in the browser — cloud providers are configured
 * via the agent-proxy environment variables.
 */

import { useState } from 'react';
import { Settings2, X, RotateCcw, Wifi, WifiOff, Brain, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  type AgentProvider,
  DEFAULT_MODELS,
  requiresProxy,
} from './providers';
import { useAgentConfig } from './useAgentConfig';
import { useChatModels } from './useChatModels';
import { api } from '@/api';

interface AgentSettingsProps {
  onClose: () => void;
}

const PROVIDER_OPTIONS: Array<{
  value: AgentProvider;
  label: string;
  description: string;
}> = [
  {
    value: 'fortemi',
    label: 'Fortemi (Native)',
    description: 'Built-in Fortemi chat endpoint — no external deps',
  },
  {
    value: 'ollama',
    label: 'Ollama (Local)',
    description: 'Local inference via Ollama',
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    description: 'Cloud provider — requires API key on agent-proxy',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'Cloud provider — requires API key on agent-proxy',
  },
];

/** Format parameter size for display (e.g., "8B", "14.8B") */
function formatSize(size: string): string {
  return size;
}

/** Format context window for display (e.g., "32K") */
function formatContext(tokens: number): string {
  if (tokens >= 1024) return `${Math.round(tokens / 1024)}K`;
  return `${tokens}`;
}

export function AgentSettings({ onClose }: AgentSettingsProps) {
  const { config, setConfig, resetConfig } = useAgentConfig();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const { models, defaultModel, isLoading: modelsLoading, error: modelsError, refresh: refreshModels } = useChatModels(config.provider);

  const handleProviderChange = (provider: string) => {
    const p = provider as AgentProvider;
    setConfig({
      provider: p,
      // Clear model so provider default is used
      model: undefined,
    });
    setTestStatus('idle');
  };

  const handleModelChange = (model: string) => {
    setConfig({ model: model || undefined });
  };

  const handleTemperatureChange = (values: number[]) => {
    setConfig({ temperature: values[0] });
  };

  const handleMaxStepsChange = (value: string) => {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= 1 && n <= 20) {
      setConfig({ maxSteps: n });
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      if (config.provider === 'fortemi') {
        // Fortemi-native talks directly to the Fortemi API
        await api.chat.sendMessage('ping');
        setTestStatus('ok');
      } else {
        // Ollama/Anthropic/OpenAI route through the agent-proxy
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'ping' }],
            provider: config.provider,
            model: config.model,
          }),
        });
        setTestStatus(res.ok ? 'ok' : 'error');
      }
    } catch {
      setTestStatus('error');
    }
  };

  const handleReset = () => {
    resetConfig();
    setTestStatus('idle');
  };

  // Resolve the effective model for display
  const effectiveModel = config.model ?? defaultModel ?? DEFAULT_MODELS[config.provider];
  const isFortemi = config.provider === 'fortemi';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI Assistant Settings</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Provider Selection */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Provider</h3>
          <Select value={config.provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {requiresProxy(config.provider) && (
            <p className="text-xs text-muted-foreground">
              Cloud providers require API keys configured on the agent-proxy server
              (via environment variables). Keys are never stored in the browser.
            </p>
          )}
        </section>

        <Separator className="my-4" />

        {/* Model Selection */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Model</h3>
            {isFortemi && (
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshModels}
                disabled={modelsLoading}
                className="h-6 px-2"
                title="Refresh models"
              >
                {modelsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          {isFortemi && models.length > 0 ? (
            <>
              <Select
                value={config.model ?? ''}
                onValueChange={handleModelChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`${defaultModel ?? 'Select model'} (default)`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <span className="text-muted-foreground">Use server default ({defaultModel})</span>
                  </SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.model} value={m.model}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.model}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(m.parameter_size)}
                        </span>
                        {m.supports_thinking && (
                          <Brain className="h-3 w-3 text-purple-500" />
                        )}
                        {m.context_window > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatContext(m.context_window)} ctx
                          </span>
                        )}
                        {m.speed_tok_s > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ~{Math.round(m.speed_tok_s)} tok/s
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelsError && (
                <p className="text-xs text-destructive">{modelsError}</p>
              )}
            </>
          ) : isFortemi && modelsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading models...
            </div>
          ) : isFortemi && modelsError ? (
            <div className="space-y-2">
              <p className="text-xs text-destructive">{modelsError}</p>
              <Input
                value={config.model ?? ''}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder={DEFAULT_MODELS[config.provider]}
              />
            </div>
          ) : (
            <>
              <Input
                value={config.model ?? ''}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder={DEFAULT_MODELS[config.provider]}
              />
              <p className="text-xs text-muted-foreground">
                Default: {DEFAULT_MODELS[config.provider]}
              </p>
            </>
          )}

          {isFortemi && config.model && (
            <p className="text-xs text-muted-foreground">
              Using: {effectiveModel}
            </p>
          )}
        </section>

        <Separator className="my-4" />

        {/* Advanced Settings */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium">Advanced</h3>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Temperature</label>
              <span className="text-sm font-mono">{config.temperature?.toFixed(1) ?? '0.7'}</span>
            </div>
            <Slider
              value={[config.temperature ?? 0.7]}
              onValueChange={handleTemperatureChange}
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          {/* Max Steps */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Max tool steps per message</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={config.maxSteps ?? 5}
              onChange={(e) => handleMaxStepsChange(e.target.value)}
              className="w-24"
            />
          </div>
        </section>

        <Separator className="my-4" />

        {/* Connection Test */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Connection</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
            >
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            {testStatus === 'ok' && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Wifi className="mr-1 h-3 w-3" /> Connected
              </Badge>
            )}
            {testStatus === 'error' && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                <WifiOff className="mr-1 h-3 w-3" /> Failed
              </Badge>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
