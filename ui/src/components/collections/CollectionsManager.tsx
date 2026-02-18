/**
 * CollectionsManager Component
 * CRUD interface for note collections with drag-drop and filtering
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { api } from '@/api';
import { getActiveMemory, MEMORY_CHANGED_EVENT } from '@/api/memory-context';
import { realtimeEventBus } from '@/services/realtimeEventBus';
import type { Collection, CreateCollectionRequest } from '@/api/types-extended';
import type { NoteSummary } from '@/api/types';

export interface CollectionsManagerProps {
  className?: string;
  onSelectCollection?: (collectionId: string | null) => void;
  selectedNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
}

interface CollectionTreeItemProps {
  collection: Collection;
  depth?: number;
  isExpanded: boolean;
  isSelected: boolean;
  noteCount?: number;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}

function CollectionTreeItem({
  collection,
  depth = 0,
  isExpanded,
  isSelected,
  noteCount = 0,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
}: CollectionTreeItemProps) {
  const hasChildren = false; // Note: hierarchy support can be added later

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-accent hover:text-accent-foreground'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(collection.id)}
      >
        {/* Expand/Collapse Toggle */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(collection.id);
            }}
            className="w-4 h-4 flex items-center justify-center hover:bg-accent/50 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        )}

        {/* Folder Icon */}
        <div className={cn('flex-shrink-0', !hasChildren && 'ml-4')}>
          {isExpanded ? (
            <FolderOpen className="w-4 h-4" />
          ) : (
            <Folder className="w-4 h-4" />
          )}
        </div>

        {/* Collection Name */}
        <span className="flex-1 text-sm truncate">{collection.name}</span>

        {/* Note Count Badge */}
        {noteCount > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {noteCount}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(collection);
            }}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(collection);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CollectionEditorDialogProps {
  collection?: Collection | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateCollectionRequest) => void;
}

function CollectionEditorDialog({
  collection,
  isOpen,
  onClose,
  onSave,
}: CollectionEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription(collection.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [collection, isOpen]);

  const handleSave = () => {
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {collection ? 'Edit Collection' : 'Create Collection'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium">Collection Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Work Notes"
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this collection is for..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {collection ? 'Save Changes' : 'Create Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NoteListProps {
  collectionId: string | null;
  selectedNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
  onRemoveNote?: (noteId: string) => void;
}

function NoteList({ collectionId, selectedNoteId, onNoteSelect, onRemoveNote }: NoteListProps) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!collectionId) {
      setNotes([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.collections.getNotes(collectionId);
      setNotes(data);
    } catch (err) {
      setError('Failed to load notes');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    const unsubscribe = realtimeEventBus.subscribe((event) => {
      if (event.type === 'CollectionUpdated' || event.type === 'NoteUpdated' || event.type === 'NoteCreated' || event.type === 'NoteDeleted') {
        void loadNotes();
      }
    });
    return () => unsubscribe();
  }, [loadNotes]);

  if (!collectionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a collection to view its notes
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No notes in this collection
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto">
      {notes.map((note) => (
        <div
          key={note.id}
          className={cn(
            'group flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors',
            selectedNoteId === note.id
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-accent hover:text-accent-foreground'
          )}
          onClick={() => onNoteSelect?.(note.id)}
        >
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">{note.title}</h4>
            {note.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {note.snippet}
              </p>
            )}
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {note.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {onRemoveNote && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveNote(note.id);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function CollectionsManager({
  className,
  onSelectCollection,
  selectedNoteId,
  onNoteSelect,
}: CollectionsManagerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeMemory, setActiveMemory] = useState<string | null>(getActiveMemory());
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Collection counts (simplified - can be enhanced with API support)
  const [collectionCounts, setCollectionCounts] = useState<Map<string, number>>(new Map());

  // Dialogs
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);

  const loadCollections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.collections.list();
      const collections = Array.isArray(data) ? data : [];
      setCollections(collections);

      // Load note counts for each collection
      const counts = new Map<string, number>();
      await Promise.all(
        collections.map(async (collection) => {
          try {
            const notes = await api.collections.getNotes(collection.id);
            counts.set(collection.id, (notes || []).length);
          } catch (err) {
            console.error(`Failed to load count for collection ${collection.id}:`, err);
          }
        })
      );
      setCollectionCounts(counts);
    } catch (err) {
      setError('Failed to load collections');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    const onMemoryChanged = () => {
      setActiveMemory(getActiveMemory());
      setSelectedCollectionId(null);
      onSelectCollection?.(null);
      void loadCollections();
    };

    window.addEventListener(MEMORY_CHANGED_EVENT, onMemoryChanged as EventListener);
    return () => {
      window.removeEventListener(MEMORY_CHANGED_EVENT, onMemoryChanged as EventListener);
    };
  }, [loadCollections, onSelectCollection]);

  useEffect(() => {
    const unsubscribe = realtimeEventBus.subscribe((event) => {
      if (event.type === 'CollectionUpdated' || event.type === 'NoteUpdated' || event.type === 'NoteCreated' || event.type === 'NoteDeleted') {
        void loadCollections();
      }
    });
    return () => unsubscribe();
  }, [loadCollections]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const query = searchQuery.toLowerCase();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
    );
  }, [collections, searchQuery]);

  const handleCreate = () => {
    setEditingCollection(null);
    setEditorOpen(true);
  };

  const handleEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setEditorOpen(true);
  };

  const handleSave = async (data: CreateCollectionRequest) => {
    try {
      if (editingCollection) {
        await api.collections.update(editingCollection.id, data);
      } else {
        await api.collections.create(data);
      }
      await loadCollections();
      setEditorOpen(false);
    } catch (err) {
      console.error('Failed to save collection:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingCollection) return;
    try {
      await api.collections.delete(deletingCollection.id);
      setCollections((prev) => prev.filter((c) => c.id !== deletingCollection.id));
      if (selectedCollectionId === deletingCollection.id) {
        setSelectedCollectionId(null);
        onSelectCollection?.(null);
      }
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Failed to delete collection:', err);
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectCollection = (id: string) => {
    setSelectedCollectionId(id);
    onSelectCollection?.(id);
  };

  const handleRemoveNote = async (noteId: string) => {
    if (!selectedCollectionId) return;
    try {
      // Remove note from collection (move to null)
      await api.collections.moveNote(noteId, { collection_id: null });
      // Reload collections to update counts
      await loadCollections();
    } catch (err) {
      console.error('Failed to remove note from collection:', err);
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderPlus className="w-5 h-5" />
          Collections
        </h2>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-1" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <p className="text-xs text-muted-foreground mb-2">
          Active memory: {activeMemory ?? 'default'}
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Collections List */}
        <div className="w-1/2 border-r overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={loadCollections} className="mt-4">
                Retry
              </Button>
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No collections match your search' : 'No collections yet'}
              </p>
              {!searchQuery && (
                <Button variant="outline" size="sm" onClick={handleCreate} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first collection
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredCollections.map((collection) => (
                <CollectionTreeItem
                  key={collection.id}
                  collection={collection}
                  isExpanded={expandedIds.has(collection.id)}
                  isSelected={selectedCollectionId === collection.id}
                  noteCount={collectionCounts.get(collection.id) || 0}
                  onToggle={handleToggleExpand}
                  onSelect={handleSelectCollection}
                  onEdit={handleEdit}
                  onDelete={(c) => {
                    setDeletingCollection(c);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notes in Selected Collection */}
        <div className="w-1/2 p-2">
          <NoteList
            collectionId={selectedCollectionId}
            selectedNoteId={selectedNoteId}
            onNoteSelect={onNoteSelect}
            onRemoveNote={handleRemoveNote}
          />
        </div>
      </div>

      {/* Editor Dialog */}
      <CollectionEditorDialog
        collection={editingCollection}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCollection?.name}"? Notes in this
              collection will not be deleted, only unlinked from the collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
