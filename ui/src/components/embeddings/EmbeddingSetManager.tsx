import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { api } from '@/api';
import type {
  Collection,
  EmbeddingConfig,
  EmbeddingSet,
  EmbeddingSetCriteria,
  EmbeddingSetMode,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CriteriaEditor } from './CriteriaEditor';
import { MemberManager } from './MemberManager';
import { EmbeddingSetGraph } from './EmbeddingSetGraph';

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

const MODE_OPTIONS: Array<{ value: EmbeddingSetMode; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Membership defined by criteria' },
  { value: 'manual', label: 'Manual', description: 'Explicit member management' },
  { value: 'mixed', label: 'Mixed', description: 'Criteria + manual overrides' },
];

function modeBadgeVariant(mode?: EmbeddingSetMode): 'default' | 'secondary' | 'outline' {
  if (mode === 'manual') return 'default';
  if (mode === 'mixed') return 'secondary';
  return 'outline';
}

function criteriaSummary(criteria?: EmbeddingSetCriteria): string {
  if (!criteria) return 'None';
  const parts: string[] = [];
  if (criteria.tags?.length) parts.push(`${criteria.tags.length} tag(s)`);
  if (criteria.collections?.length) parts.push(`${criteria.collections.length} collection(s)`);
  if (criteria.fts_query) parts.push(`query: "${criteria.fts_query}"`);
  if (criteria.exclude_archived) parts.push('no archived');
  return parts.length > 0 ? parts.join(', ') : 'None';
}

export function EmbeddingSetManager() {
  const [sets, setSets] = useState<EmbeddingSet[]>([]);
  const [configs, setConfigs] = useState<EmbeddingConfig[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createName, setCreateName] = useState('');
  const [createConfigId, setCreateConfigId] = useState('');
  const [createMode, setCreateMode] = useState<EmbeddingSetMode>('auto');
  const [createDescription, setCreateDescription] = useState('');
  const [createCriteria, setCreateCriteria] = useState<EmbeddingSetCriteria>({});

  // Edit dialog
  const [editTarget, setEditTarget] = useState<EmbeddingSet | null>(null);
  const [editName, setEditName] = useState('');
  const [editConfigId, setEditConfigId] = useState('');
  const [editMode, setEditMode] = useState<EmbeddingSetMode>('auto');
  const [editDescription, setEditDescription] = useState('');
  const [editCriteria, setEditCriteria] = useState<EmbeddingSetCriteria>({});

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<EmbeddingSet | null>(null);

  // Member manager
  const [memberTarget, setMemberTarget] = useState<string | null>(null);

  // Graph dialog
  const [graphTarget, setGraphTarget] = useState<EmbeddingSet | null>(null);

  const sortedSets = useMemo(
    () => [...sets].sort((a, b) => a.name.localeCompare(b.name)),
    [sets]
  );

  const collectionOptions = useMemo(
    () => collections.map((c) => ({ id: c.id, name: c.name })),
    [collections]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [setsData, configsData, collectionsData] = await Promise.all([
        api.embeddings.listSets(),
        api.embeddings.listConfigs().catch(() => [] as EmbeddingConfig[]),
        api.collections.list().catch(() => [] as Collection[]),
      ]);
      setSets(setsData);
      setConfigs(configsData);
      setCollections(collectionsData);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to load embedding sets' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const withAction = async (slug: string, action: string, fn: () => Promise<void>) => {
    setBusySlug(slug);
    setBusyAction(action);
    try {
      await fn();
      await loadData();
    } finally {
      setBusySlug(null);
      setBusyAction(null);
    }
  };

  // Create
  const resetCreateForm = () => {
    setCreateSlug('');
    setCreateName('');
    setCreateConfigId('');
    setCreateMode('auto');
    setCreateDescription('');
    setCreateCriteria({});
  };

  const handleCreate = async () => {
    if (!createSlug.trim() || !createName.trim() || !createConfigId) return;
    setBusySlug(createSlug.trim());
    setBusyAction('create');
    try {
      await api.embeddings.createSet({
        slug: createSlug.trim(),
        name: createName.trim(),
        embedding_config_id: createConfigId,
        mode: createMode,
        description: createDescription.trim() || undefined,
        criteria: createMode !== 'manual' ? createCriteria : undefined,
      });
      setCreateOpen(false);
      resetCreateForm();
      setStatus({ type: 'success', message: 'Embedding set created' });
      await loadData();
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to create embedding set' });
      console.error(error);
    } finally {
      setBusySlug(null);
      setBusyAction(null);
    }
  };

  // Edit
  const openEdit = (set: EmbeddingSet) => {
    setEditTarget(set);
    setEditName(set.name);
    setEditConfigId(set.embedding_config_id);
    setEditMode(set.mode ?? 'auto');
    setEditDescription(set.description ?? '');
    setEditCriteria(set.criteria ?? {});
  };

  const handleEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    await withAction(editTarget.slug, 'edit', async () => {
      await api.embeddings.updateSet(editTarget.slug, {
        name: editName.trim(),
        embedding_config_id: editConfigId,
        mode: editMode,
        description: editDescription.trim() || undefined,
        criteria: editMode !== 'manual' ? editCriteria : undefined,
      });
      setEditTarget(null);
      setStatus({ type: 'success', message: `"${editTarget.slug}" updated` });
    });
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const slug = deleteTarget.slug;
    await withAction(slug, 'delete', async () => {
      await api.embeddings.deleteSet(slug);
      setDeleteTarget(null);
      setStatus({ type: 'success', message: `"${slug}" deleted` });
    });
  };

  // Refresh
  const handleRefresh = async (slug: string) => {
    await withAction(slug, 'refresh', async () => {
      await api.embeddings.refreshSet(slug);
      setStatus({ type: 'success', message: `"${slug}" embeddings refreshed` });
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Network className="w-5 h-5" />
            Embedding Sets
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage isolated vector spaces for specialized search and graph exploration.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            Create Set
          </Button>
        </div>
      </div>

      {/* Status message */}
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

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedSets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No embedding sets found. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedSets.map((set) => {
            const isBusy = busySlug === set.slug;
            return (
              <Card key={set.slug} className={cn(isBusy && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{set.name}</CardTitle>
                      <CardDescription className="truncate">{set.slug}</CardDescription>
                    </div>
                    <Badge variant={modeBadgeVariant(set.mode)}>
                      {set.mode ?? 'auto'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {set.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{set.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {set.note_count != null && (
                      <span>{set.note_count} note{set.note_count !== 1 ? 's' : ''}</span>
                    )}
                    <span>Criteria: {criteriaSummary(set.criteria)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => openEdit(set)}
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    {(set.mode === 'manual' || set.mode === 'mixed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setMemberTarget(set.slug)}
                      >
                        <Users className="w-3.5 h-3.5 mr-1" />
                        Members
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => setGraphTarget(set)}
                    >
                      <Network className="w-3.5 h-3.5 mr-1" />
                      Graph
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleRefresh(set.slug)}
                    >
                      {isBusy && busyAction === 'refresh' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      )}
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(set)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Embedding Set</DialogTitle>
            <DialogDescription>
              Create a new isolated vector space for notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="my-embedding-set"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="My Embedding Set"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Embedding Config</label>
              <Select value={createConfigId} onValueChange={setCreateConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select config" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((cfg) => (
                    <SelectItem key={cfg.id} value={cfg.id}>
                      {cfg.name} ({cfg.model}, {cfg.dimensions}d)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <Select value={createMode} onValueChange={(v) => setCreateMode(v as EmbeddingSetMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} — {opt.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            {createMode !== 'manual' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Criteria</label>
                <CriteriaEditor
                  criteria={createCriteria}
                  onChange={setCreateCriteria}
                  collections={collectionOptions}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!createSlug.trim() || !createName.trim() || !createConfigId || busyAction === 'create'}
            >
              {busyAction === 'create' && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Embedding Set</DialogTitle>
            <DialogDescription>
              Update <strong>{editTarget?.slug}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input value={editTarget?.slug ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Embedding Config</label>
              <Select value={editConfigId} onValueChange={setEditConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select config" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((cfg) => (
                    <SelectItem key={cfg.id} value={cfg.id}>
                      {cfg.name} ({cfg.model}, {cfg.dimensions}d)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <Select value={editMode} onValueChange={(v) => setEditMode(v as EmbeddingSetMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} — {opt.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            {editMode !== 'manual' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Criteria</label>
                <CriteriaEditor
                  criteria={editCriteria}
                  onChange={setEditCriteria}
                  collections={collectionOptions}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={handleEdit}
              disabled={!editName.trim() || busyAction === 'edit'}
            >
              {busyAction === 'edit' && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Embedding Set</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.slug})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busyAction === 'delete'}
            >
              {busyAction === 'delete' && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Manager Dialog */}
      {memberTarget && (
        <MemberManager
          slug={memberTarget}
          isOpen={!!memberTarget}
          onClose={() => { setMemberTarget(null); void loadData(); }}
        />
      )}

      {/* Graph Dialog */}
      {graphTarget && (
        <EmbeddingSetGraph
          set={graphTarget}
          isOpen={!!graphTarget}
          onClose={() => setGraphTarget(null)}
        />
      )}
    </div>
  );
}
