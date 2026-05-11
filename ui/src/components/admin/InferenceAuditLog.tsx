/**
 * InferenceAuditLog Component (Issue #207)
 *
 * Read-only viewer over `GET /api/v1/inference/config/audit` (Fortemi #656).
 * Lists every config change with actor, action, source IP, and a before/after
 * diff. API keys in the snapshots are pre-redacted server-side via
 * `redact_api_key()` — never reconstructed client-side.
 */

import * as React from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import type { AuditAction, AuditEntry } from '@/api/inference';
import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';

const ACTION_STYLES: Record<AuditAction, { label: string; className: string }> = {
  set: { label: 'set', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  reset: { label: 'reset', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  set_archive: { label: 'set_archive', className: 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800' },
  reset_archive: { label: 'reset_archive', className: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
};

function ActionBadge({ action }: { action: AuditAction }) {
  const style = ACTION_STYLES[action] ?? { label: action, className: '' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const delta = Date.now() - then;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

interface AuditRowProps {
  entry: AuditEntry;
}

function AuditRow({ entry }: AuditRowProps) {
  const [expanded, setExpanded] = React.useState(false);

  const hasDiff = entry.before_json !== undefined || entry.after_json !== undefined;

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="w-20 shrink-0 text-xs text-muted-foreground" title={entry.changed_at}>
          {formatRelative(entry.changed_at)}
        </span>
        <ActionBadge action={entry.action} />
        <span className="flex-1 truncate text-sm">{entry.changed_by}</span>
        {entry.source_ip && (
          <span className="hidden text-xs text-muted-foreground sm:inline-block">
            {entry.source_ip}
          </span>
        )}
      </button>
      {expanded && hasDiff && (
        <div className="grid grid-cols-1 gap-3 border-t bg-muted/20 px-3 py-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Before
            </p>
            <pre className="max-h-64 overflow-auto rounded bg-card p-2 text-[11px] leading-relaxed">
              {entry.before_json !== undefined
                ? JSON.stringify(entry.before_json, null, 2)
                : '(none)'}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              After
            </p>
            <pre className="max-h-64 overflow-auto rounded bg-card p-2 text-[11px] leading-relaxed">
              {entry.after_json !== undefined
                ? JSON.stringify(entry.after_json, null, 2)
                : '(none)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export interface InferenceAuditLogProps {
  className?: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

export function InferenceAuditLog({ className }: InferenceAuditLogProps) {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState<number>(DEFAULT_LIMIT);
  const [filterActor, setFilterActor] = React.useState<string>('');
  const [filterAction, setFilterAction] = React.useState<AuditAction | ''>('');

  const fetchEntries = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.inference.getAuditLog({
        limit,
        changedBy: filterActor || undefined,
        action: filterAction || undefined,
      });
      setEntries(result.entries);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit log';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [limit, filterActor, filterAction]);

  React.useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Auto-refresh on inference.config.changed (optional, per Issue #207 §5).
  // Cheap: another GET against the audit endpoint with current filters.
  React.useEffect(() => {
    const handler = (event: RealtimeEvent) => {
      if (event.type === 'InferenceConfigChanged') {
        void fetchEntries();
      }
    };
    return realtimeEventBus.subscribe(handler);
  }, [fetchEntries]);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Inference Config Audit</CardTitle>
            <CardDescription>
              Every change to inference config — global and per-archive. API keys are redacted.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchEntries()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium">Actor</label>
            <input
              type="text"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              placeholder="user-id or 'anonymous'"
              className="block w-full rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium">Action</label>
            <Select
              value={filterAction || 'all'}
              onValueChange={(v) => setFilterAction(v === 'all' ? '' : (v as AuditAction))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="set">set</SelectItem>
                <SelectItem value="reset">reset</SelectItem>
                <SelectItem value="set_archive">set_archive</SelectItem>
                <SelectItem value="reset_archive">reset_archive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-xs font-medium">Limit</label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200 (max)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && (
          <div className="rounded-md border">
            {entries.length === 0 && !loading ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No audit entries match the current filters.
              </p>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Load-more hint when we hit the limit */}
        {entries.length === limit && limit < MAX_LIMIT && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit((l) => Math.min(l * 2, MAX_LIMIT))}
          >
            Load more (next {Math.min(limit, MAX_LIMIT - limit)} entries)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
