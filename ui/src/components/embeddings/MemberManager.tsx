/**
 * MemberManager Component
 * Dialog for managing manual/mixed embedding set members.
 * Allows viewing, removing, and adding notes to an embedding set.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '@/api';
import type { NoteSummary, SearchResult } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MemberManagerProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MemberRowProps {
  member: NoteSummary;
  onRemove: (noteId: string) => void;
  isRemoving: boolean;
}

function MemberRow({ member, onRemove, isRemoving }: MemberRowProps) {
  const displayTitle = member.title?.trim() || member.id.slice(0, 12) + '…';

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate" title={member.title || member.id}>
        {displayTitle}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Remove"
        disabled={isRemoving}
        onClick={() => onRemove(member.id)}
      >
        {isRemoving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

interface SearchResultRowProps {
  result: SearchResult & { title?: string };
  onAdd: (noteId: string) => void;
  isAdding: boolean;
}

function SearchResultRow({ result, onAdd, isAdding }: SearchResultRowProps) {
  const displayTitle = result.title?.trim() || result.note_id.slice(0, 12) + '…';

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate" title={result.title || result.note_id}>
        {displayTitle}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 shrink-0"
        disabled={isAdding}
        onClick={() => onAdd(result.note_id)}
      >
        {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MemberManager({ slug, isOpen, onClose }: MemberManagerProps) {
  // ---- Members state -------------------------------------------------------
  const [members, setMembers] = useState<NoteSummary[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Tracks which note id is currently being removed
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // ---- Search state --------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<SearchResult & { title?: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Tracks which note id is currently being added
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // ---- Load members --------------------------------------------------------
  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await api.embeddings.listSetMembers(slug);
      setMembers(data);
    } catch {
      setMembersError('Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, [slug]);

  // Reload whenever the dialog opens
  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, loadMembers]);

  // ---- Remove member -------------------------------------------------------
  const handleRemove = useCallback(
    async (noteId: string) => {
      setRemovingId(noteId);
      setRemoveError(null);
      try {
        await api.embeddings.removeSetMember(slug, noteId);
        await loadMembers();
      } catch {
        setRemoveError('Failed to remove member');
      } finally {
        setRemovingId(null);
      }
    },
    [slug, loadMembers]
  );

  // ---- Search notes --------------------------------------------------------
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const results = await api.search.search(trimmed, { limit: 20 });
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch {
        if (!cancelled) {
          setSearchError('Search failed');
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    };

    // Small debounce to avoid hammering the API on every keystroke
    const timer = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // ---- Add member ----------------------------------------------------------
  const handleAdd = useCallback(
    async (noteId: string) => {
      setAddingId(noteId);
      setAddError(null);
      try {
        await api.embeddings.addSetMembers(slug, { note_ids: [noteId] });
        await loadMembers();
      } catch {
        setAddError('Failed to add note to set');
      } finally {
        setAddingId(null);
      }
    },
    [slug, loadMembers]
  );

  // ---- Render --------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            Add or remove notes from the <strong>{slug}</strong> embedding set.
          </DialogDescription>
        </DialogHeader>

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-6 pt-2">
          {/* ----------------------------------------------------------------
              Left column: Current Members
          ---------------------------------------------------------------- */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              Current Members
              {!membersLoading && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({members.length})
                </span>
              )}
            </h3>

            {/* Members error */}
            {(membersError || removeError) && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {membersError ?? removeError}
              </p>
            )}

            {/* Members list */}
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No members in this set yet.
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="flex flex-col gap-1.5 pr-2">
                  {members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      onRemove={handleRemove}
                      isRemoving={removingId === member.id}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* ----------------------------------------------------------------
              Right column: Add Notes
          ---------------------------------------------------------------- */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Add Notes</h3>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Add / Search errors */}
            {(addError || searchError) && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {addError ?? searchError}
              </p>
            )}

            {/* Search results */}
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : searchQuery.trim() === '' ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Type to search for notes to add.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="flex flex-col gap-1.5 pr-2">
                  {searchResults.map((result) => (
                    <SearchResultRow
                      key={result.note_id}
                      result={result}
                      onAdd={handleAdd}
                      isAdding={addingId === result.note_id}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
