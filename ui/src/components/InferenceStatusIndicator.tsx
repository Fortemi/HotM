/**
 * InferenceStatusIndicator Component
 * Persistent header badge showing LLM provider health at a glance.
 *
 * Covers Issue #163: Provider status indicator
 *
 * States:
 * - Healthy: green dot + provider name
 * - Unknown: yellow dot + provider name
 * - Unhealthy: red dot + provider name
 * - Not configured: gray dot + "No LLM"
 *
 * Clicking navigates to the Inference Settings (admin view).
 */

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import type { InferenceConfig } from '@/api/inference';
import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';

type HealthState = 'healthy' | 'unknown' | 'unhealthy' | 'unconfigured' | 'loading';

interface IndicatorState {
  health: HealthState;
  providerName: string;
  tooltipText: string;
}

const DOT_COLORS: Record<HealthState, string> = {
  healthy: 'bg-green-500',
  unknown: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
  unconfigured: 'bg-gray-400',
  loading: 'bg-gray-300 animate-pulse',
};

const LABEL_COLORS: Record<HealthState, string> = {
  healthy: 'text-green-600 dark:text-green-400',
  unknown: 'text-yellow-600 dark:text-yellow-400',
  unhealthy: 'text-red-600 dark:text-red-400',
  unconfigured: 'text-muted-foreground',
  loading: 'text-muted-foreground',
};

function deriveState(config: InferenceConfig | null, reachable: boolean | null): IndicatorState {
  if (!config) {
    return { health: 'loading', providerName: '...', tooltipText: 'Loading inference status...' };
  }

  if (!config.providers || config.providers.length === 0) {
    return {
      health: 'unconfigured',
      providerName: 'No LLM',
      tooltipText: 'No inference backend configured \u2014 click to set up',
    };
  }

  const provider = config.providers[0];
  const providerConfig = provider === 'ollama' ? config.ollama : config.openai;
  const baseUrl = providerConfig?.base_url?.value ?? 'unknown';
  const displayName = provider.charAt(0).toUpperCase() + provider.slice(1);

  if (reachable === null) {
    return {
      health: 'unknown',
      providerName: displayName,
      tooltipText: `${displayName} status unknown \u2014 click to test`,
    };
  }

  if (reachable) {
    return {
      health: 'healthy',
      providerName: displayName,
      tooltipText: `${displayName} at ${baseUrl}`,
    };
  }

  return {
    health: 'unhealthy',
    providerName: displayName,
    tooltipText: `Cannot reach ${displayName} \u2014 click to configure`,
  };
}

export interface InferenceStatusIndicatorProps {
  onNavigateToSettings: () => void;
}

export function InferenceStatusIndicator({ onNavigateToSettings }: InferenceStatusIndicatorProps) {
  const [config, setConfig] = React.useState<InferenceConfig | null>(null);
  const [reachable, setReachable] = React.useState<boolean | null>(null);

  // Fetch config on mount and on a slow interval
  const fetchStatus = React.useCallback(async () => {
    try {
      const cfg = await api.inference.getConfig();
      setConfig(cfg);

      // Quick connection probe if a provider is configured
      if (cfg.providers?.length > 0) {
        const provider = cfg.providers[0];
        const providerConfig = provider === 'ollama' ? cfg.ollama : cfg.openai;
        if (providerConfig?.base_url?.value) {
          try {
            const result = await api.inference.testConnection({
              base_url: providerConfig.base_url.value,
              provider: 'auto',
              timeout_secs: 5,
            });
            setReachable(result.reachable);
          } catch {
            setReachable(false);
          }
        }
      }
    } catch {
      // API unreachable — leave config as null (loading state will show)
    }
  }, []);

  React.useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // SSE subscription (Issue #203). React in real time to:
  //   - inference.config.changed → full refetch so the dot+label reflect
  //     the new provider/backend without waiting 60s for the poll.
  //   - inference.availability.changed → flip just the reachable flag
  //     using the event's `available` field. No GET round-trip needed.
  React.useEffect(() => {
    const handler = (event: RealtimeEvent) => {
      if (event.type === 'InferenceConfigChanged') {
        void fetchStatus();
        return;
      }
      if (event.type === 'InferenceAvailabilityChanged') {
        if (typeof event.available === 'boolean') {
          setReachable(event.available);
        } else {
          // Server didn't include the flag — fall back to a probe.
          void fetchStatus();
        }
      }
    };
    return realtimeEventBus.subscribe(handler);
  }, [fetchStatus]);

  const state = deriveState(config, reachable);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            onClick={onNavigateToSettings}
          >
            <span className={cn('h-2 w-2 rounded-full', DOT_COLORS[state.health])} />
            <span className={cn('text-xs font-medium', LABEL_COLORS[state.health])}>
              {state.providerName}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{state.tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
