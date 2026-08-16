import * as React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  DatabaseBackup,
  Loader2,
  Lock,
  Network,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Send,
} from 'lucide-react';
import { api } from '@/api';
import type {
  OperatorActionId,
  OperatorActionRequest,
  OperatorApi,
  OperatorDiagnostic,
  OperatorDiagnosticState,
  OperatorInspectionId,
  OperatorSnapshot,
} from '@/api';
import { isOperatorSnapshotStale } from '@/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OperatorConsoleProps {
  service?: Pick<OperatorApi, 'loadSnapshot' | 'inspect' | 'runAction'>;
  staleAfterMs?: number;
}

interface ControlDefinition {
  id: OperatorActionId;
  key?: string;
  label: string;
  confirmation: string;
  targetLabel?: string;
  secondaryTargetLabel?: string;
  valueLabel?: string;
  valueOptional?: boolean;
  numericLabel?: string;
  enabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const CONTROLS: readonly ControlDefinition[] = [
  {
    id: 'complete',
    label: 'Probe completion',
    confirmation: 'Run a fixed, eight-token inference completion probe?',
    targetLabel: 'Model',
    icon: Activity,
  },
  {
    id: 'stream',
    label: 'Probe stream',
    confirmation: 'Run a bounded fixed-prompt SSE inference probe?',
    targetLabel: 'Model',
    icon: Activity,
  },
  {
    id: 'pause_jobs_global',
    label: 'Pause jobs',
    confirmation: 'Pause global job processing?',
    icon: Pause,
  },
  {
    id: 'resume_jobs_global',
    label: 'Resume jobs',
    confirmation: 'Resume global job processing?',
    icon: Play,
  },
  {
    id: 'pause_jobs_archive',
    label: 'Pause archive',
    confirmation: 'Pause job processing for this archive?',
    targetLabel: 'Archive name',
    icon: Pause,
  },
  {
    id: 'resume_jobs_archive',
    label: 'Resume archive',
    confirmation: 'Resume job processing for this archive?',
    targetLabel: 'Archive name',
    icon: Play,
  },
  {
    id: 'backup_trigger',
    label: 'Run backup',
    confirmation: 'Queue a server backup now?',
    icon: DatabaseBackup,
  },
  {
    id: 'database_backup_snapshot',
    label: 'Snapshot database',
    confirmation: 'Create a named database snapshot?',
    targetLabel: 'Snapshot name',
    icon: DatabaseBackup,
  },
  {
    id: 'database_backup_restore',
    label: 'Restore database',
    confirmation: 'Restore this database backup? A safety snapshot will be retained.',
    targetLabel: 'Backup filename',
    icon: RotateCw,
  },
  {
    id: 'swap_backup',
    label: 'Swap database',
    confirmation: 'Replace the active database with this backup using wipe strategy?',
    targetLabel: 'Backup filename',
    icon: RotateCw,
  },
  {
    id: 'set_default_archive',
    label: 'Set default archive',
    confirmation: 'Make this archive the server default?',
    targetLabel: 'Archive name',
    icon: DatabaseBackup,
  },
  {
    id: 'trigger_graph_maintenance',
    label: 'Maintain graph',
    confirmation: 'Queue graph normalization, SNN, PFNET, and a diagnostics snapshot?',
    icon: Network,
  },
  {
    id: 'capture_diagnostics_snapshot',
    label: 'Capture graph snapshot',
    confirmation: 'Capture a bounded graph diagnostics snapshot?',
    targetLabel: 'Snapshot label',
    icon: Network,
  },
  {
    id: 'recompute_snn_scores',
    label: 'Recompute SNN',
    confirmation: 'Recompute shared-nearest-neighbor graph scores?',
    icon: Network,
  },
  {
    id: 'pfnet_sparsify',
    label: 'Run PFNET',
    confirmation: 'Apply PFNET graph sparsification?',
    icon: Network,
  },
  {
    id: 'coarse_community_detection',
    label: 'Detect communities',
    confirmation: 'Run coarse graph community detection?',
    icon: Network,
  },
  {
    id: 'refresh_embedding_set',
    label: 'Refresh set',
    confirmation: 'Regenerate embeddings for this set?',
    targetLabel: 'Embedding set slug',
    icon: RotateCw,
  },
  {
    id: 'create_embedding_config',
    label: 'Create embedding config',
    confirmation: 'Create this embedding configuration?',
    targetLabel: 'Config name',
    secondaryTargetLabel: 'Model',
    numericLabel: 'Dimension',
    icon: DatabaseBackup,
  },
  {
    id: 'update_embedding_config',
    label: 'Update embedding config',
    confirmation: 'Update this embedding configuration model and dimension?',
    targetLabel: 'Config ID',
    secondaryTargetLabel: 'Model',
    numericLabel: 'Dimension',
    icon: RotateCw,
  },
  {
    id: 'delete_embedding_config',
    label: 'Delete embedding config',
    confirmation: 'Permanently delete this embedding configuration?',
    targetLabel: 'Config ID',
    icon: CircleOff,
  },
  {
    id: 'create_embedding_set',
    label: 'Create embedding set',
    confirmation: 'Create this manual embedding set?',
    targetLabel: 'Set slug',
    secondaryTargetLabel: 'Config ID',
    valueLabel: 'Set name',
    icon: DatabaseBackup,
  },
  {
    id: 'update_embedding_set',
    label: 'Update embedding set',
    confirmation: 'Rename this embedding set?',
    targetLabel: 'Set slug',
    valueLabel: 'Set name',
    icon: RotateCw,
  },
  {
    id: 'delete_embedding_set',
    label: 'Delete embedding set',
    confirmation: 'Permanently delete this embedding set?',
    targetLabel: 'Set slug',
    icon: CircleOff,
  },
  {
    id: 'add_embedding_set_members',
    label: 'Add set member',
    confirmation: 'Add this note to the embedding set?',
    targetLabel: 'Set slug',
    secondaryTargetLabel: 'Note ID',
    icon: Play,
  },
  {
    id: 'remove_embedding_set_member',
    label: 'Remove set member',
    confirmation: 'Remove this note from the embedding set?',
    targetLabel: 'Set slug',
    secondaryTargetLabel: 'Note ID',
    icon: Pause,
  },
  {
    id: 'create_archive',
    label: 'Create archive',
    confirmation: 'Create this archive?',
    targetLabel: 'Archive name',
    valueLabel: 'Description',
    valueOptional: true,
    icon: DatabaseBackup,
  },
  {
    id: 'update_archive',
    label: 'Update archive',
    confirmation: 'Update this archive description?',
    targetLabel: 'Archive name',
    valueLabel: 'Description',
    icon: RotateCw,
  },
  {
    id: 'clone_archive',
    label: 'Clone archive',
    confirmation: 'Clone this archive under the new name?',
    targetLabel: 'Source archive',
    secondaryTargetLabel: 'New archive name',
    icon: DatabaseBackup,
  },
  {
    id: 'delete_archive',
    label: 'Delete archive',
    confirmation: 'Permanently delete this archive?',
    targetLabel: 'Archive name',
    icon: CircleOff,
  },
  {
    id: 'update_backup_metadata',
    label: 'Update backup title',
    confirmation: 'Update the title metadata for this backup?',
    targetLabel: 'Backup filename',
    valueLabel: 'Backup title',
    icon: RotateCw,
  },
  {
    id: 'delete_inbound_source',
    label: 'Delete inbound source',
    confirmation: 'Permanently deregister this inbound source?',
    targetLabel: 'Source name',
    icon: CircleOff,
  },
  {
    id: 'test_webhook',
    label: 'Test webhook',
    confirmation: 'Send a test event to this webhook?',
    targetLabel: 'Webhook ID',
    icon: Send,
  },
  {
    id: 'update_webhook',
    key: 'activate_webhook',
    label: 'Activate webhook',
    confirmation: 'Activate this webhook?',
    targetLabel: 'Webhook ID',
    enabled: true,
    icon: Play,
  },
  {
    id: 'update_webhook',
    key: 'deactivate_webhook',
    label: 'Deactivate webhook',
    confirmation: 'Deactivate this webhook?',
    targetLabel: 'Webhook ID',
    enabled: false,
    icon: Pause,
  },
  {
    id: 'delete_webhook',
    label: 'Delete webhook',
    confirmation: 'Permanently delete this webhook?',
    targetLabel: 'Webhook ID',
    icon: CircleOff,
  },
] as const;

const INSPECTIONS: readonly { id: OperatorInspectionId; label: string; target?: string; compare?: string }[] = [
  { id: 'job_detail', label: 'Job detail', target: 'Job ID' },
  { id: 'webhook_detail', label: 'Webhook detail', target: 'Webhook ID' },
  { id: 'webhook_deliveries', label: 'Webhook deliveries', target: 'Webhook ID' },
  { id: 'graph_compare', label: 'Graph snapshot comparison', target: 'Before snapshot ID', compare: 'After snapshot ID' },
  { id: 'archive_stats', label: 'Archive statistics', target: 'Archive name' },
  { id: 'backup_info', label: 'Backup information', target: 'Backup filename' },
  { id: 'backup_metadata', label: 'Backup metadata', target: 'Backup filename' },
  { id: 'archive_detail', label: 'Archive detail', target: 'Archive name' },
  { id: 'embedding_set', label: 'Embedding set', target: 'Embedding set slug' },
  { id: 'embedding_config', label: 'Embedding configuration', target: 'Config ID' },
  { id: 'provider_catalog', label: 'Inference providers' },
  { id: 'model_catalog', label: 'Model catalog' },
] as const;

function badgeVariant(state: OperatorDiagnosticState | OperatorSnapshot['state'] | 'stale'):
  'default' | 'secondary' | 'destructive' | 'outline' {
  if (state === 'available' || state === 'success') return 'default';
  if (state === 'degraded' || state === 'partial' || state === 'stale') return 'secondary';
  if (state === 'error' || state === 'unauthorized' || state === 'incompatible') return 'destructive';
  return 'outline';
}

function stateIcon(state: OperatorDiagnosticState) {
  if (state === 'available') return <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />;
  if (state === 'degraded') return <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />;
  if (state === 'unauthorized' || state === 'incompatible') return <Lock className="size-4 text-destructive" aria-hidden="true" />;
  return <CircleOff className="size-4 text-muted-foreground" aria-hidden="true" />;
}

function fixedLoadMessage(state: OperatorSnapshot['state']): string | null {
  if (state === 'incompatible') return 'Compatibility admission failed. Operator controls are locked.';
  if (state === 'unauthorized') return 'Operator diagnostics are not authorized for this session.';
  if (state === 'partial') return 'Some diagnostics are unavailable. Available summaries remain current.';
  if (state === 'degraded') return 'The server reported degraded operational conditions.';
  if (state === 'empty') return 'No operational records are currently reported.';
  return null;
}

function diagnosticDetail(state: OperatorDiagnosticState): string {
  switch (state) {
    case 'unauthorized': return 'Authorization required';
    case 'incompatible': return 'Contract not admitted';
    case 'unavailable': return 'Endpoint unavailable';
    case 'unknown': return 'State unknown';
    case 'error': return 'Diagnostic failed';
    case 'empty': return 'No records';
    default: return '';
  }
}

export function OperatorConsole({
  service = api.operator,
  staleAfterMs = 60_000,
}: OperatorConsoleProps) {
  const [snapshot, setSnapshot] = React.useState<OperatorSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [targets, setTargets] = React.useState<Record<string, string>>({});
  const [secondaryTargets, setSecondaryTargets] = React.useState<Record<string, string>>({});
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [numericValues, setNumericValues] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState<OperatorActionRequest | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [actionState, setActionState] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [actionMetrics, setActionMetrics] = React.useState<OperatorDiagnostic['metrics']>([]);
  const [inspectionId, setInspectionId] = React.useState<OperatorInspectionId>('job_detail');
  const [inspectionTarget, setInspectionTarget] = React.useState('');
  const [inspectionCompareTarget, setInspectionCompareTarget] = React.useState('');
  const [inspectionResult, setInspectionResult] = React.useState<OperatorDiagnostic | null>(null);
  const [inspectionState, setInspectionState] = React.useState<'idle' | 'loading' | 'error'>('idle');
  const [now, setNow] = React.useState(() => Date.now());

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setSnapshot(await service.loadSnapshot());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [service]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), Math.max(1_000, staleAfterMs / 2));
    return () => window.clearInterval(timer);
  }, [staleAfterMs]);

  const stale = snapshot ? isOperatorSnapshotStale(snapshot, now, staleAfterMs) : false;
  const mutationsAllowed = snapshot?.mutation.state === 'allowed' && !stale && !loading;
  const stateMessage = snapshot ? fixedLoadMessage(snapshot.state) : null;

  const requestControl = (control: ControlDefinition) => {
    const key = control.key ?? control.id;
    setActionState('idle');
    setActionMetrics([]);
    setPending({
      action: control.id,
      ...(control.targetLabel ? { target: targets[key]?.trim() } : {}),
      ...(control.secondaryTargetLabel ? { secondaryTarget: secondaryTargets[key]?.trim() } : {}),
      ...(control.valueLabel ? { value: values[key]?.trim() } : {}),
      ...(control.numericLabel ? { numericValue: Number(numericValues[key]) } : {}),
      ...(typeof control.enabled === 'boolean' ? { enabled: control.enabled } : {}),
    });
    setPendingConfirmation(control.confirmation);
  };

  const runInspection = async () => {
    const selected = INSPECTIONS.find((item) => item.id === inspectionId);
    if (!selected || (selected.target && !inspectionTarget.trim()) || (selected.compare && !inspectionCompareTarget.trim())) return;
    setInspectionState('loading');
    setInspectionResult(null);
    try {
      const result = await service.inspect({
        inspection: inspectionId,
        ...(selected.target ? { target: inspectionTarget.trim() } : {}),
        ...(selected.compare ? { compareTarget: inspectionCompareTarget.trim() } : {}),
      });
      setInspectionResult(result);
      setInspectionState('idle');
    } catch {
      setInspectionState('error');
    }
  };

  const runControl = async () => {
    if (!pending) return;
    setRunning(true);
    setActionState('idle');
    try {
      const result = await service.runAction(pending);
      setActionMetrics(result.metrics ?? []);
      setActionState('success');
      setPending(null);
      await load();
    } catch {
      setActionState('error');
      setPending(null);
    } finally {
      setRunning(false);
    }
  };

  const selectedInspection = INSPECTIONS.find((item) => item.id === inspectionId) ?? INSPECTIONS[0];

  return (
    <div className="flex flex-col gap-4" data-testid="operator-console">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="size-5" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Operator Console</h2>
            {snapshot && (
              <Badge variant={badgeVariant(stale ? 'stale' : snapshot.state)}>
                {stale ? 'stale' : snapshot.state}
              </Badge>
            )}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
          Refresh
        </Button>
      </div>

      {loading && !snapshot && (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading operator diagnostics...
        </div>
      )}

      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-destructive/40 bg-destructive/5 p-3" role="alert">
          <span className="text-sm text-destructive">Operator diagnostics could not be loaded.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Retry</Button>
        </div>
      )}

      {snapshot && (
        <>
          {(stateMessage || stale) && (
            <div className="flex items-start gap-2 border bg-muted/40 p-3 text-sm" role="status">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{stale ? 'Diagnostics are stale. Refresh before running controls.' : stateMessage}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Operational diagnostics">
            {snapshot.diagnostics.map((diagnostic) => (
              <section key={diagnostic.id} className="min-w-0 border bg-card p-3" data-state={diagnostic.state}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {stateIcon(diagnostic.state)}
                    <h3 className="truncate text-sm font-semibold">{diagnostic.label}</h3>
                  </div>
                  <Badge variant={badgeVariant(diagnostic.state)}>{diagnostic.state}</Badge>
                </div>
                {diagnostic.metrics.length > 0 ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {diagnostic.metrics.map((metric) => (
                      <React.Fragment key={metric.label}>
                        <dt className="truncate text-muted-foreground">{metric.label}</dt>
                        <dd className="truncate text-right font-medium">{typeof metric.value === 'boolean' ? (metric.value ? 'yes' : 'no') : metric.value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">{diagnosticDetail(diagnostic.state)}</p>
                )}
                {diagnostic.truncated && <p className="mt-2 text-xs text-muted-foreground">Summary limited</p>}
              </section>
            ))}
          </div>

          <section className="border-t pt-4" aria-label="Targeted inspection">
            <h3 className="mb-3 text-sm font-semibold">Targeted inspection</h3>
            <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto]">
              <label className="text-xs font-medium">
                <span className="mb-1 block">Inspection</span>
                <Select value={inspectionId} onValueChange={(value) => { setInspectionId(value as OperatorInspectionId); setInspectionResult(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSPECTIONS.map((inspection) => <SelectItem key={inspection.id} value={inspection.id}>{inspection.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              {selectedInspection.target ? (
                <label className="text-xs font-medium">
                  <span className="mb-1 block">{selectedInspection.target}</span>
                  <Input value={inspectionTarget} onChange={(event) => setInspectionTarget(event.target.value)} maxLength={128} autoComplete="off" />
                </label>
              ) : <div className="hidden sm:block" />}
              {selectedInspection.compare ? (
                <label className="text-xs font-medium">
                  <span className="mb-1 block">{selectedInspection.compare}</span>
                  <Input value={inspectionCompareTarget} onChange={(event) => setInspectionCompareTarget(event.target.value)} maxLength={128} autoComplete="off" />
                </label>
              ) : <div className="hidden lg:block" />}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void runInspection()}
                disabled={inspectionState === 'loading' || Boolean(selectedInspection.target && !inspectionTarget.trim()) || Boolean(selectedInspection.compare && !inspectionCompareTarget.trim())}
              >
                {inspectionState === 'loading' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Activity className="size-4" aria-hidden="true" />}
                Inspect
              </Button>
            </div>
            {inspectionResult && (
              <dl className="mt-3 grid gap-2 border p-3 text-xs sm:grid-cols-2 lg:grid-cols-4" data-testid="inspection-result">
                {inspectionResult.metrics.map((metric) => (
                  <div key={metric.label} className="flex min-w-0 justify-between gap-2">
                    <dt className="truncate text-muted-foreground">{metric.label}</dt>
                    <dd className="truncate font-medium">{typeof metric.value === 'boolean' ? (metric.value ? 'yes' : 'no') : metric.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {inspectionState === 'error' && <p className="mt-3 text-sm text-destructive" role="alert">Inspection failed.</p>}
          </section>

          <section className="border-t pt-4" aria-label="Operator controls">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Controls</h3>
              <Badge variant={mutationsAllowed ? 'default' : 'outline'}>
                {mutationsAllowed ? 'admitted' : snapshot.mutation.state}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {CONTROLS.map((control) => {
                const Icon = control.icon;
                const key = control.key ?? control.id;
                const inputMissing = Boolean(
                  (control.targetLabel && !targets[key]?.trim())
                  || (control.secondaryTargetLabel && !secondaryTargets[key]?.trim())
                  || (control.valueLabel && !control.valueOptional && !values[key]?.trim())
                  || (control.numericLabel && !numericValues[key]?.trim()),
                );
                return (
                  <div key={key} className="grid min-w-0 gap-2 border p-2 sm:grid-cols-2">
                    {control.targetLabel && (
                      <label className="min-w-0 flex-1 text-xs font-medium">
                        <span className="mb-1 block truncate">{control.targetLabel}</span>
                        <Input
                          value={targets[key] ?? ''}
                          onChange={(event) => setTargets((current) => ({ ...current, [key]: event.target.value }))}
                          maxLength={128}
                          autoComplete="off"
                        />
                      </label>
                    )}
                    {control.secondaryTargetLabel && (
                      <label className="min-w-0 text-xs font-medium">
                        <span className="mb-1 block truncate">{control.secondaryTargetLabel}</span>
                        <Input value={secondaryTargets[key] ?? ''} onChange={(event) => setSecondaryTargets((current) => ({ ...current, [key]: event.target.value }))} maxLength={128} autoComplete="off" />
                      </label>
                    )}
                    {control.valueLabel && (
                      <label className="min-w-0 text-xs font-medium">
                        <span className="mb-1 block truncate">{control.valueLabel}</span>
                        <Input value={values[key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} maxLength={256} autoComplete="off" />
                      </label>
                    )}
                    {control.numericLabel && (
                      <label className="min-w-0 text-xs font-medium">
                        <span className="mb-1 block truncate">{control.numericLabel}</span>
                        <Input type="number" min={1} max={65536} value={numericValues[key] ?? ''} onChange={(event) => setNumericValues((current) => ({ ...current, [key]: event.target.value }))} />
                      </label>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start self-end sm:col-span-2"
                      disabled={!mutationsAllowed || inputMissing || running}
                      onClick={() => requestControl(control)}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {control.label}
                    </Button>
                  </div>
                );
              })}
            </div>
            {actionState === 'success' && <p className="mt-3 text-sm text-primary" role="status">Control accepted. Diagnostics refreshed.</p>}
            {actionMetrics.length > 0 && (
              <dl className="mt-3 grid gap-2 border p-3 text-xs sm:grid-cols-2 lg:grid-cols-4" data-testid="action-receipt">
                {actionMetrics.map((metric) => (
                  <div key={metric.label} className="flex min-w-0 justify-between gap-2">
                    <dt className="truncate text-muted-foreground">{metric.label}</dt>
                    <dd className="truncate font-medium">{typeof metric.value === 'boolean' ? (metric.value ? 'yes' : 'no') : metric.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actionState === 'error' && <p className="mt-3 text-sm text-destructive" role="alert">The control was not accepted.</p>}
          </section>
        </>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !running && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm operator control</AlertDialogTitle>
            <AlertDialogDescription>{pendingConfirmation}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void runControl(); }} disabled={running}>
              {running && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
