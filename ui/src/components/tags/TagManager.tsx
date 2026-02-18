/**
 * TagManager Component
 * Full tag management: list, create, rename, delete, stats, bulk operations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Hash,
  Plus,
  Pencil,
  Trash2,
  Merge,
  BarChart3,
  Loader2,
  Search,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/api';
import { realtimeEventBus } from '@/services/realtimeEventBus';
import type { Tag, TagStats } from '@/api';

interface TagManagerProps {
  className?: string;
}

type SortMode = 'name' | 'count';

export function TagManager({ className }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [stats, setStats] = useState<TagStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('count');
  const [showStats, setShowStats] = useState(false);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Rename state
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Merge state
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');

  // Selection for bulk ops
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const loadTags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tagList, tagStats] = await Promise.all([
        api.tags.list({ sortBy }),
        api.tags.getStats(),
      ]);
      setTags(tagList);
      setStats(tagStats);
    } catch (err) {
      setError('Failed to load tags');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    const unsubscribe = realtimeEventBus.subscribe((event) => {
      if (event.type === 'TagUpdated' || event.type === 'NoteUpdated') {
        void loadTags();
      }
    });
    return () => unsubscribe();
  }, [loadTags]);

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreateError(null);
    try {
      await api.tags.create(name);
      setNewTagName('');
      setShowCreate(false);
      await loadTags();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const handleRename = async (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenamingTag(null);
      return;
    }
    try {
      await api.tags.rename(oldName, newName);
      setRenamingTag(null);
      setRenameValue('');
      await loadTags();
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete tag "${name}"? Notes will keep their content but lose this tag.`)) return;
    try {
      await api.tags.delete(name);
      setSelectedTags((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      await loadTags();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTags.size === 0) return;
    if (!confirm(`Delete ${selectedTags.size} selected tags?`)) return;
    try {
      await Promise.all(Array.from(selectedTags).map((name) => api.tags.delete(name)));
      setSelectedTags(new Set());
      await loadTags();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const handleMerge = async () => {
    const source = mergeSource.trim();
    const target = mergeTarget.trim();
    if (!source || !target || source === target) return;
    try {
      // Merge = rename source to target (Fortemi handles note re-tagging)
      await api.tags.rename(source, target);
      setShowMerge(false);
      setMergeSource('');
      setMergeTarget('');
      await loadTags();
    } catch (err) {
      console.error('Merge failed:', err);
    }
  };

  const toggleSelect = (name: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className={cn('flex flex-col h-full', className)} role="region" aria-label="Tag Management">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Tag Manager</h2>
          {stats && (
            <Badge variant="secondary">{stats.total_tags} tags</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}>
            <BarChart3 className="w-4 h-4 mr-1" />
            Stats
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMerge(true)}>
            <Merge className="w-4 h-4 mr-1" />
            Merge
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Tag
          </Button>
        </div>
      </div>

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b bg-muted/30">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.total_tags}</p>
            <p className="text-xs text-muted-foreground">Total Tags</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.total_tagged_notes}</p>
            <p className="text-xs text-muted-foreground">Tagged Notes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {typeof stats.avg_tags_per_note === 'number'
                ? stats.avg_tags_per_note.toFixed(1)
                : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Avg Tags/Note</p>
            {stats.stats_available === false && (
              <p className="text-xs text-muted-foreground">Unavailable</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.most_used?.[0]?.name || '-'}</p>
            <p className="text-xs text-muted-foreground">Most Used</p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={sortBy === 'count' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('count')}
          >
            By Count
          </Button>
          <Button
            variant={sortBy === 'name' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('name')}
          >
            A-Z
          </Button>
        </div>
        {selectedTags.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            Delete ({selectedTags.size})
          </Button>
        )}
      </div>

      {/* Tag List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading tags...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-12">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={loadTags} className="mt-3">
              Retry
            </Button>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Hash className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {searchQuery ? 'No tags match your filter' : 'No tags yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredTags.map((tag) => (
              <div
                key={tag.name}
                className={cn(
                  'flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors',
                  selectedTags.has(tag.name) && 'bg-primary/5'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedTags.has(tag.name)}
                  onChange={() => toggleSelect(tag.name)}
                  className="rounded border-muted-foreground/30"
                  aria-label={`Select ${tag.name}`}
                />

                {renamingTag === tag.name ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(tag.name);
                        if (e.key === 'Escape') setRenamingTag(null);
                      }}
                      autoFocus
                      className="h-8"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRename(tag.name)}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRenamingTag(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{tag.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {tag.count}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setRenamingTag(tag.name);
                          setRenameValue(tag.name);
                        }}
                        aria-label={`Rename ${tag.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(tag.name)}
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Tag Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTagName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Tags Dialog */}
      <Dialog open={showMerge} onOpenChange={setShowMerge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Tags</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Merge renames the source tag to the target. All notes with the source tag will be re-tagged with the target.
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">Source (will be removed)</label>
              <Input
                placeholder="Source tag name"
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
                list="merge-source-tags"
              />
              <datalist id="merge-source-tags">
                {tags.map((t) => <option key={t.name} value={t.name} />)}
              </datalist>
            </div>
            <div>
              <label className="text-sm font-medium">Target (will keep)</label>
              <Input
                placeholder="Target tag name"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                list="merge-target-tags"
              />
              <datalist id="merge-target-tags">
                {tags.map((t) => <option key={t.name} value={t.name} />)}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMerge(false)}>Cancel</Button>
            <Button
              onClick={handleMerge}
              disabled={!mergeSource.trim() || !mergeTarget.trim() || mergeSource === mergeTarget}
            >
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
