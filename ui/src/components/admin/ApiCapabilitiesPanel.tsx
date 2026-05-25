import * as React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw, Server } from 'lucide-react';
import { api } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type CapabilityValue = boolean | string | number | null | Record<string, unknown>;

interface ApiSurfaceHealth {
  status?: string;
  version?: string;
  git_sha?: string;
  build_date?: string;
  database?: string;
  ollama?: string;
  job_processing?: string;
  capabilities?: Record<string, CapabilityValue>;
  sse?: {
    active_connections?: number;
    connections_total?: number;
    events_delivered?: number;
    events_emitted?: number;
  };
}

const UI_FEATURES = [
  { label: 'Explicit titles', detail: 'Create note skips title generation when a title is supplied' },
  { label: 'Revision modes', detail: 'None, light, standard, contextual, and filtered contextual capture' },
  { label: 'Processing toggles', detail: 'Title, concepts, embeddings, links, and media extraction controls' },
  { label: 'Deferred import', detail: 'Backup import can defer inference until reprocess is queued' },
  { label: 'Bulk reprocess', detail: 'All-note or bounded reprocessing can be queued from backup workflows' },
  { label: 'Document types', detail: 'Admin can list, create, and delete custom document types' },
  { label: 'Webhooks', detail: 'Admin can list, register, test, and delete outbound event hooks' },
] as const;

function toTitle(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = status?.toLowerCase();
  if (!normalized) return 'outline';
  if (['healthy', 'ok', 'operational', 'running', 'connected', 'available'].includes(normalized)) return 'default';
  if (['degraded', 'unavailable', 'unknown'].includes(normalized)) return 'outline';
  if (['unhealthy', 'offline', 'failed', 'disconnected', 'shutdown'].includes(normalized)) return 'destructive';
  return 'secondary';
}

function capabilityState(value: CapabilityValue): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; detail?: string } {
  if (typeof value === 'boolean') {
    return value
      ? { label: 'available', variant: 'default' }
      : { label: 'unavailable', variant: 'outline' };
  }

  if (value && typeof value === 'object') {
    const available = value.available;
    const configured = value.configured;
    const enabled = value.enabled;
    const status = typeof value.status === 'string' ? value.status : undefined;
    const isUnavailable = available === false || configured === false || enabled === false;
    const label = status ?? (isUnavailable ? 'degraded' : 'available');
    const detail = Object.entries(value)
      .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
      .map(([key, item]) => key + ': ' + String(item))
      .join(', ');

    return {
      label,
      variant: isUnavailable ? 'outline' : statusVariant(label),
      detail: detail || undefined,
    };
  }

  if (value == null) return { label: 'unknown', variant: 'outline' };
  return { label: String(value), variant: statusVariant(String(value)) };
}

function isDegraded(health: ApiSurfaceHealth | null): boolean {
  if (!health) return false;
  const status = health.status?.toLowerCase();
  if (status === 'degraded') return true;
  if (health.ollama?.toLowerCase() === 'unavailable') return true;

  const capabilities = health.capabilities ?? {};
  return Object.values(capabilities).some((value) => {
    if (!value || typeof value !== 'object') return value === false;
    return value.available === false || value.configured === false || value.enabled === false;
  });
}

export function ApiCapabilitiesPanel() {
  const [health, setHealth] = React.useState<ApiSurfaceHealth | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadHealth = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await api.healthCheck() as ApiSurfaceHealth);
    } catch (err) {
      console.error('Failed to load API surface:', err);
      setError('Error loading API surface');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const capabilityEntries = Object.entries(health?.capabilities ?? {});
  const degraded = isDegraded(health);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5" />
              API Surface
            </CardTitle>
            <CardDescription>Fortemi sidecar endpoint, status, and advertised capabilities.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadHealth()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {loading && !health ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading API surface...
            </div>
          ) : (
            <>
              {degraded && (
                <div className="flex items-start gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>Fortemi is reachable, but one or more advertised capabilities are degraded.</span>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Endpoint</div>
                  <div className="mt-1 break-all font-mono text-sm">{api.client.baseUrl}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={statusVariant(health?.status)}>{health?.status ?? 'unknown'}</Badge>
                    {health?.version && <span className="text-sm text-muted-foreground">v{health.version}</span>}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Database</div>
                  <Badge className="mt-1" variant={statusVariant(health?.database)}>{health?.database ?? 'unknown'}</Badge>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Ollama</div>
                  <Badge className="mt-1" variant={statusVariant(health?.ollama)}>{health?.ollama ?? 'unknown'}</Badge>
                </div>
                {health?.job_processing && (
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Job processing</div>
                    <Badge className="mt-1" variant={statusVariant(health.job_processing)}>{health.job_processing}</Badge>
                  </div>
                )}
                {health?.sse && (
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Realtime events</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {health.sse.active_connections ?? 0} active, {health.sse.events_delivered ?? 0} delivered
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Advertised Capabilities
          </CardTitle>
          <CardDescription>Capability metadata reported by the active Fortemi sidecar.</CardDescription>
        </CardHeader>
        <CardContent>
          {capabilityEntries.length === 0 ? (
            <div className="rounded border p-4 text-sm text-muted-foreground">No capability metadata reported by this sidecar.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {capabilityEntries.map(([name, value]) => {
                const state = capabilityState(value);
                return (
                  <div key={name} className="rounded border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{toTitle(name)}</div>
                      <Badge variant={state.variant}>{state.label}</Badge>
                    </div>
                    {state.detail && <div className="mt-2 text-xs text-muted-foreground">{state.detail}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            HotM Compatibility Surface
          </CardTitle>
          <CardDescription>Fortemi API features wired into this UI build.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {UI_FEATURES.map((feature) => (
            <div key={feature.label} className="rounded border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{feature.label}</span>
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="mr-1 size-3" />
                  wired
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{feature.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
