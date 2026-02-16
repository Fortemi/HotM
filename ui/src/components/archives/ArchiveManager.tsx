import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';
import { api, getActiveMemory } from '@/api';
import type { ArchiveStatsResponse, MemoryArchive } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

export function ArchiveManager() {
  const [archives, setArchives] = useState<MemoryArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMemory, setActiveMemoryState] = useState<string | null>(getActiveMemory());
  const [statsByArchive, setStatsByArchive] = useState<Record<string, ArchiveStatsResponse>>({});
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [cloneNameInput, setCloneNameInput] = useState('');
  const [cloneDescInput, setCloneDescInput] = useState('');

  const [busyArchive, setBusyArchive] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const sortedArchives = useMemo(
    () =>
      [...archives].sort((a, b) => {
        if (a.is_default) return -1;
        if (b.is_default) return 1;
        return a.name.localeCompare(b.name);
      }),
    [archives]
  );

  const loadArchives = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.archives.list();
      setArchives(data);
      setActiveMemoryState(getActiveMemory());
      const statsEntries = await Promise.all(
        data.map(async (archive) => {
          try {
            const stats = await api.archives.stats(archive.name);
            return [archive.name, stats] as const;
          } catch {
            return [archive.name, null] as const;
          }
        })
      );
      setStatsByArchive((prev) => {
        const next = { ...prev };
        for (const [name, stats] of statsEntries) {
          if (stats) {
            next[name] = stats;
          }
        }
        return next;
      });
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to load archives' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  const withAction = async (archiveName: string, actionLabel: string, fn: () => Promise<void>) => {
    setBusyArchive(archiveName);
    setBusyAction(actionLabel);
    try {
      await fn();
      await loadArchives();
    } finally {
      setBusyArchive(null);
      setBusyAction(null);
    }
  };

  const handleSelectMemory = async (archiveName: string) => {
    api.archives.select(archiveName);
    setActiveMemoryState(archiveName);
    setStatus({ type: 'success', message: `Switched active memory to "${archiveName}"` });
  };

  const handleUseDefaultRouting = async () => {
    api.archives.select(null);
    setActiveMemoryState(null);
    setStatus({ type: 'success', message: 'Using default archive routing' });
  };

  const handleSetDefault = async (archiveName: string) => {
    await withAction(archiveName, 'default', async () => {
      await api.archives.setDefault(archiveName);
      setStatus({ type: 'success', message: `"${archiveName}" set as default archive` });
    });
  };

  const handleRefreshStats = async (archiveName: string) => {
    await withAction(archiveName, 'stats', async () => {
      const stats = await api.archives.stats(archiveName);
      setStatsByArchive((prev) => ({ ...prev, [archiveName]: stats }));
      setStatus({ type: 'success', message: `Stats refreshed for "${archiveName}"` });
    });
  };

  const handleCreate = async () => {
    if (!nameInput.trim()) return;
    setBusyArchive(nameInput.trim());
    setBusyAction('create');
    try {
      await api.archives.create({
        name: nameInput.trim(),
        description: descInput.trim() || undefined,
      });
      setCreateOpen(false);
      setNameInput('');
      setDescInput('');
      setStatus({ type: 'success', message: 'Archive created successfully' });
      await loadArchives();
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to create archive' });
      console.error(error);
    } finally {
      setBusyArchive(null);
      setBusyAction(null);
    }
  };

  const handleClone = async () => {
    if (!cloneTarget || !cloneNameInput.trim()) return;
    setBusyArchive(cloneTarget);
    setBusyAction('clone');
    try {
      await api.archives.clone(cloneTarget, {
        new_name: cloneNameInput.trim(),
        description: cloneDescInput.trim() || undefined,
      });
      setCloneTarget(null);
      setCloneNameInput('');
      setCloneDescInput('');
      setStatus({ type: 'success', message: `Archive "${cloneTarget}" cloned successfully` });
      await loadArchives();
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to clone archive' });
      console.error(error);
    } finally {
      setBusyArchive(null);
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deleting = deleteTarget;
    setBusyArchive(deleting);
    setBusyAction('delete');
    try {
      await api.archives.delete(deleting);
      if (activeMemory === deleting) {
        api.archives.select(null);
        setActiveMemoryState(null);
      }
      setDeleteTarget(null);
      setStatus({ type: 'success', message: `Archive "${deleting}" deleted` });
      await loadArchives();
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to delete archive' });
      console.error(error);
    } finally {
      setBusyArchive(null);
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Database className="w-5 h-5" />
            Archive Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Fortemi memories and select the active archive for API requests.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadArchives} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Create Archive</Button>
        </div>
      </div>

      {status && (
        <div
          className={cn(
            'p-3 rounded-md text-sm flex items-center gap-2',
            status.type === 'success'
              ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
              : 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
          )}
        >
          {status.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{status.message}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Routing</CardTitle>
          <CardDescription>
            Current `X-Fortemi-Memory` header: {activeMemory ? `"${activeMemory}"` : 'not set (default archive)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleUseDefaultRouting}>
            Use Default Archive
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedArchives.map((archive) => {
            const stats = statsByArchive[archive.name];
            const isBusy = busyArchive === archive.name;
            return (
              <Card key={archive.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{archive.name}</p>
                        {archive.is_default && <Badge variant="secondary">default</Badge>}
                        {activeMemory === archive.name && <Badge>active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">schema: {archive.schema_name}</p>
                      {archive.description && (
                        <p className="text-sm text-muted-foreground">{archive.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        notes: {stats?.note_count ?? archive.note_count ?? 0} | size:{' '}
                        {stats?.size_bytes ?? archive.size_bytes ?? 0} bytes
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectMemory(archive.name)}
                        disabled={isBusy}
                      >
                        Use
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefault(archive.name)}
                        disabled={archive.is_default || isBusy}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Default
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRefreshStats(archive.name)}
                        disabled={isBusy}
                      >
                        Stats
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCloneTarget(archive.name);
                          setCloneNameInput(`${archive.name}-clone`);
                          setCloneDescInput(archive.description ?? '');
                        }}
                        disabled={isBusy}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Clone
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(archive.name)}
                        disabled={archive.is_default || isBusy}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {isBusy && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Running {busyAction}...
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Archive</DialogTitle>
            <DialogDescription>Create an isolated memory archive.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label htmlFor="archive-name" className="text-sm font-medium">Name</label>
              <Input
                id="archive-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="projecte"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="archive-description" className="text-sm font-medium">Description</label>
              <Textarea
                id="archive-description"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Optional archive purpose"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!nameInput.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneTarget !== null} onOpenChange={(open) => !open && setCloneTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Archive</DialogTitle>
            <DialogDescription>
              Create a full copy of {cloneTarget ? `"${cloneTarget}"` : 'selected archive'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label htmlFor="clone-name" className="text-sm font-medium">New Name</label>
              <Input
                id="clone-name"
                value={cloneNameInput}
                onChange={(e) => setCloneNameInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="clone-description" className="text-sm font-medium">Description</label>
              <Textarea
                id="clone-description"
                value={cloneDescInput}
                onChange={(e) => setCloneDescInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleClone} disabled={!cloneNameInput.trim()}>
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Archive</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget ? `"${deleteTarget}"` : 'the selected archive'}.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
