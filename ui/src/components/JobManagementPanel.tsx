import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pause, Play, RefreshCw, Loader2 } from 'lucide-react';

import { api } from '@/api';
import type { MemoryArchive } from '@/api';
import { useJobStore } from '@/hooks/useJobStore';
import { jobEventStore } from '@/services/jobEventStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ArchiveJobCounts {
  pending: number;
  running: number;
  completedLastHour: number;
  failedLastHour: number;
  total: number;
}

interface JobManagementPanelProps {
  archives: MemoryArchive[];
}

export function JobManagementPanel({ archives }: JobManagementPanelProps) {
  const { pauseState } = useJobStore();
  const [selectedArchive, setSelectedArchive] = useState<string>('');
  const [archiveCounts, setArchiveCounts] = useState<Record<string, ArchiveJobCounts>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const globalState = pauseState.global;
  const archivePauseStates = pauseState.archives;

  const archiveNames = useMemo(() => {
    return archives
      .map((archive) => archive.name)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b));
  }, [archives]);

  const selectedArchiveState = selectedArchive
    ? (archivePauseStates[selectedArchive] ?? 'running')
    : 'running';

  const refreshCounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const countsByArchive = await Promise.all(
        archiveNames.map(async (archiveName) => {
          const stats = await api.jobs.getArchiveJobCounts(archiveName);
          return [
            archiveName,
            {
              pending: stats.pending ?? 0,
              running: stats.processing ?? 0,
              completedLastHour: stats.completed_last_hour ?? 0,
              failedLastHour: stats.failed_last_hour ?? 0,
              total: stats.total ?? 0,
            } satisfies ArchiveJobCounts,
          ] as const;
        })
      );

      setArchiveCounts(Object.fromEntries(countsByArchive));
    } catch (err) {
      console.error('Failed to refresh job management state:', err);
      setError('Unable to load job management data');
    } finally {
      setIsLoading(false);
    }
  }, [archiveNames]);

  useEffect(() => {
    if (!selectedArchive && archiveNames.length > 0) {
      setSelectedArchive(archiveNames[0]);
    }
  }, [archiveNames, selectedArchive]);

  useEffect(() => {
    // Refresh pause state from API on mount
    void jobEventStore.refreshPauseState();
    void refreshCounts();
  }, [refreshCounts]);

  const refresh = useCallback(async () => {
    await jobEventStore.refreshPauseState();
    await refreshCounts();
  }, [refreshCounts]);

  const mutate = useCallback(async (action: () => Promise<unknown>) => {
    setIsMutating(true);
    setError(null);
    try {
      await action();
      await jobEventStore.refreshPauseState();
      await refreshCounts();
    } catch (err) {
      console.error('Job management action failed:', err);
      setError('Action failed. Verify server supports job pause controls.');
    } finally {
      setIsMutating(false);
    }
  }, [refreshCounts]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Job Management</CardTitle>
            <CardDescription>
              Pause or resume processing globally or per archive, with per-archive queue counts.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isLoading || isMutating}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Global:</span>
          <Badge variant={globalState === 'paused' ? 'destructive' : 'secondary'}>{globalState}</Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={isMutating || globalState === 'paused'}
            onClick={() => void mutate(() => api.jobs.pauseGlobal())}
          >
            <Pause className="mr-2 h-4 w-4" />
            Pause All
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isMutating || globalState !== 'paused'}
            onClick={() => void mutate(() => api.jobs.resumeGlobal())}
          >
            <Play className="mr-2 h-4 w-4" />
            Resume All
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Archive:</span>
          <div className="min-w-[220px]">
            <Select value={selectedArchive} onValueChange={setSelectedArchive}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select archive" />
              </SelectTrigger>
              <SelectContent>
                {archiveNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedArchive && (
            <Badge variant={selectedArchiveState === 'paused' ? 'destructive' : 'secondary'}>
              {selectedArchiveState}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={isMutating || !selectedArchive || selectedArchiveState === 'paused'}
            onClick={() => selectedArchive && void mutate(() => api.jobs.pauseArchive(selectedArchive))}
          >
            <Pause className="mr-2 h-4 w-4" />
            Pause Archive
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isMutating || !selectedArchive || selectedArchiveState !== 'paused'}
            onClick={() => selectedArchive && void mutate(() => api.jobs.resumeArchive(selectedArchive))}
          >
            <Play className="mr-2 h-4 w-4" />
            Resume Archive
          </Button>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Archive</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Pending</th>
                <th className="px-3 py-2">Running</th>
                <th className="px-3 py-2">Completed (1h)</th>
                <th className="px-3 py-2">Failed (1h)</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {archiveNames.map((name) => {
                const counts = archiveCounts[name] ?? {
                  pending: 0,
                  running: 0,
                  completedLastHour: 0,
                  failedLastHour: 0,
                  total: 0,
                };
                const state = archivePauseStates[name] ?? 'running';
                return (
                  <tr key={name} className="border-t">
                    <td className="px-3 py-2 font-medium">{name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={state === 'paused' ? 'destructive' : 'secondary'}>{state}</Badge>
                    </td>
                    <td className="px-3 py-2">{counts.pending}</td>
                    <td className="px-3 py-2">{counts.running}</td>
                    <td className="px-3 py-2">{counts.completedLastHour}</td>
                    <td className="px-3 py-2">{counts.failedLastHour}</td>
                    <td className="px-3 py-2">{counts.total}</td>
                  </tr>
                );
              })}
              {archiveNames.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={7}>
                    No archives available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
