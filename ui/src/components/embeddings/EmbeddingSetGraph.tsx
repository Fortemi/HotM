import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import type { EmbeddingSet } from '@/api';
import { GraphExplorer } from '@/components/graph';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterOverrides {
  selectedTags?: string[];
  selectedCollection?: string;
  archiveFilter?: 'all' | 'active' | 'archived';
}

interface EmbeddingSetGraphProps {
  set: EmbeddingSet;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true for "real" sets that have an explicit member list managed
 * by the API (manual or mixed mode). Virtual / criteria-driven sets use
 * GraphExplorer's built-in filters instead.
 */
function isRealSet(set: EmbeddingSet): boolean {
  return set.mode === 'manual' || set.mode === 'mixed';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmbeddingSetGraph({ set, isOpen, onClose }: EmbeddingSetGraphProps) {
  const [loading, setLoading] = useState(false);

  // Real-set state: explicit member filter
  const [nodeFilter, setNodeFilter] = useState<Set<string> | null>(null);

  // Shared state: root note to centre the graph on
  const [initialNoteId, setInitialNoteId] = useState<string | undefined>(undefined);

  // Virtual-set state: criteria mapped to GraphExplorer filter overrides
  const [filterOverrides, setFilterOverrides] = useState<FilterOverrides | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;

    // Reset state on each open / set change
    setNodeFilter(null);
    setInitialNoteId(undefined);
    setFilterOverrides(undefined);

    let cancelled = false;

    async function loadReal() {
      setLoading(true);
      try {
        const members = await api.embeddings.listSetMembers(set.slug);
        if (cancelled) return;

        if (members.length > 0) {
          setNodeFilter(new Set(members.map((m) => m.id)));
          setInitialNoteId(members[0].id);
        }
        // Empty member list → leave nodeFilter null so GraphExplorer shows all
      } catch (err) {
        if (!cancelled) {
          console.error('[EmbeddingSetGraph] Failed to load set members:', err);
        }
        // Gracefully degrade: render explorer without node filter
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadVirtual() {
      setLoading(true);

      // Build filter overrides from set criteria
      const criteria = set.criteria ?? {};
      const overrides: FilterOverrides = {};

      if (criteria.tags && criteria.tags.length > 0) {
        overrides.selectedTags = criteria.tags;
      }
      if (criteria.collections && criteria.collections.length > 0) {
        overrides.selectedCollection = criteria.collections[0];
      }
      if (criteria.exclude_archived) {
        overrides.archiveFilter = 'active';
      }

      setFilterOverrides(overrides);

      // Find a root note via search so GraphExplorer has a meaningful starting point
      try {
        const query = criteria.fts_query?.trim() || '*';
        const results = await api.search.search(query, { limit: 1 });
        if (!cancelled && results.length > 0) {
          setInitialNoteId(results[0].note_id);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[EmbeddingSetGraph] Failed to find root note for virtual set:', err);
        }
        // Continue without a root note — GraphExplorer handles the empty case
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (isRealSet(set)) {
      void loadReal();
    } else {
      void loadVirtual();
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, set.slug, set.mode]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-4 gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle>{set.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 h-full">
            <GraphExplorer
              className="h-full"
              initialNoteId={initialNoteId}
              externalNodeFilter={nodeFilter}
              initialFilterOverrides={filterOverrides}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
