import * as React from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { api } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ledger from '@/api/contracts/fortemi-operation-dispositions.json';

type Surface = 'ui_workflow' | 'agent_workflow' | 'operator_diagnostic' | 'documented_exclusion';
type CompatibilityState = 'checking' | 'compatible' | 'blocked';

const surfaceLabels: Record<Surface, string> = {
  ui_workflow: 'UI workflow',
  agent_workflow: 'Agent workflow',
  operator_diagnostic: 'Operator diagnostic',
  documented_exclusion: 'Excluded',
};

function methodVariant(method: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'outline';
  if (method === 'DELETE') return 'destructive';
  return 'secondary';
}

export function OperationCatalogPanel() {
  const [query, setQuery] = React.useState('');
  const [surface, setSurface] = React.useState<Surface | 'all'>('all');
  const [compatibility, setCompatibility] = React.useState<CompatibilityState>('checking');

  const checkCompatibility = React.useCallback(async () => {
    setCompatibility('checking');
    try {
      await api.systemCompatibility.get();
      setCompatibility('compatible');
    } catch {
      setCompatibility('blocked');
    }
  }, []);

  React.useEffect(() => {
    checkCompatibility();
  }, [checkCompatibility]);

  const operations = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ledger.operations.filter((operation) => {
      if (surface !== 'all' && operation.surface !== surface) return false;
      if (!normalized) return true;
      return [operation.operation_id, operation.method, operation.path, operation.family]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [query, surface]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Server Operations</h2>
          <p className="text-sm text-muted-foreground">
            {ledger.operation_count} pinned operations with explicit privilege and product disposition
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={compatibility === 'compatible' ? 'default' : compatibility === 'blocked' ? 'destructive' : 'secondary'}>
            {compatibility === 'compatible' ? 'Compatible' : compatibility === 'blocked' ? 'Incompatible' : 'Checking'}
          </Badge>
          <Button type="button" variant="outline" size="icon" onClick={checkCompatibility} aria-label="Retry compatibility check">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operations" className="pl-9" />
        </div>
        <Select value={surface} onValueChange={(value) => setSurface(value as Surface | 'all')}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter operation disposition">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dispositions</SelectItem>
            {Object.entries(surfaceLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {compatibility === 'blocked' && (
        <div className="border-l-2 border-destructive px-3 py-2 text-sm text-destructive">
          Remote operation compatibility is not established. Local workflows remain available.
        </div>
      )}

      <div className="max-h-[32rem] overflow-auto border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b">
              <th className="px-3 py-2 font-medium">Operation</th>
              <th className="px-3 py-2 font-medium">Family</th>
              <th className="px-3 py-2 font-medium">Privilege</th>
              <th className="px-3 py-2 font-medium">Disposition</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => (
              <tr key={operation.key} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={methodVariant(operation.method)}>{operation.method}</Badge>
                    <span className="font-mono text-xs">{operation.path}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{operation.operation_id}</div>
                </td>
                <td className="px-3 py-2">{operation.family.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2"><Badge variant="outline">{operation.privilege}</Badge></td>
                <td className="px-3 py-2" title={operation.rationale}>{surfaceLabels[operation.surface as Surface]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {operations.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No operations match this filter.</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{ledger.evidence_boundary}</p>
    </div>
  );
}
