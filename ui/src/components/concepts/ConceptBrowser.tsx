/**
 * ConceptBrowser Component
 * Main SKOS concept browsing panel with tree navigation and detail view
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConceptTree } from './ConceptTree';
import { ConceptCard } from './ConceptCard';
import { api } from '@/api';
import { realtimeEventBus } from '@/services/realtimeEventBus';
import type { Concept, ConceptFull, ConceptScheme } from '@/api/types-extended';

interface ConceptBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConcept?: (concept: Concept) => void;
  initialSchemeId?: string;
}

export function ConceptBrowser({
  isOpen,
  onClose,
  onSelectConcept,
  initialSchemeId,
}: ConceptBrowserProps) {
  // State
  const [schemes, setSchemes] = useState<ConceptScheme[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>(initialSchemeId || '');
  const [topConcepts, setTopConcepts] = useState<Concept[]>([]);
  const [childrenMap, setChildrenMap] = useState<Map<string, Concept[]>>(new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedConcept, setSelectedConcept] = useState<ConceptFull | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Concept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load schemes on mount
  useEffect(() => {
    if (isOpen) {
      loadSchemes();
    }
  }, [isOpen]);

  // Load top concepts when scheme changes
  useEffect(() => {
    if (selectedSchemeId) {
      loadTopConcepts(selectedSchemeId);
    } else {
      setTopConcepts([]);
      setChildrenMap(new Map());
      setExpandedIds(new Set());
    }
  }, [selectedSchemeId]);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.concepts.listConcepts({
          schemeId: selectedSchemeId || undefined,
          search: searchQuery,
          limit: 20,
        });
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedSchemeId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const unsubscribe = realtimeEventBus.subscribe((event) => {
      if (event.type === 'ConceptUpdated') {
        void loadSchemes();
        if (selectedSchemeId) {
          void loadTopConcepts(selectedSchemeId);
        }
      }
    });
    return () => unsubscribe();
  }, [isOpen, selectedSchemeId]);

  const loadSchemes = async () => {
    setError(null);
    try {
      const data = await api.concepts.listSchemes();
      setSchemes(data);
      if (data.length === 0) {
        setSelectedSchemeId('');
        setTopConcepts([]);
        setChildrenMap(new Map());
        setExpandedIds(new Set());
        setSelectedConcept(null);
        return;
      }

      if (!selectedSchemeId || !data.some((scheme) => scheme.id === selectedSchemeId)) {
        setSelectedSchemeId(data[0].id);
      }
    } catch (err) {
      setError('Failed to load concept schemes');
      console.error(err);
    }
  };

  const loadTopConcepts = async (schemeId: string) => {
    if (!schemeId) {
      setTopConcepts([]);
      setChildrenMap(new Map());
      setExpandedIds(new Set());
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const concepts = await api.concepts.getTopConcepts(schemeId);
      setTopConcepts(concepts);
      setChildrenMap(new Map());
      setExpandedIds(new Set());
    } catch (err) {
      setError('Failed to load concepts');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChildren = useCallback(async (conceptId: string): Promise<Concept[]> => {
    try {
      const children = await api.concepts.getNarrower(conceptId);
      setChildrenMap((prev) => {
        const next = new Map(prev);
        next.set(conceptId, children);
        return next;
      });
      return children;
    } catch (err) {
      console.error('Failed to load children:', err);
      return [];
    }
  }, []);

  const handleSelectConcept = useCallback(async (concept: Concept) => {
    try {
      const full = await api.concepts.getConceptFull(concept.id);
      setSelectedConcept(full);
      onSelectConcept?.(concept);
    } catch (err) {
      console.error('Failed to load concept details:', err);
    }
  }, [onSelectConcept]);

  const handleExpandCollapse = useCallback((conceptId: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(conceptId);
      } else {
        next.delete(conceptId);
      }
      return next;
    });
  }, []);

  const handleNavigateToConcept = useCallback((concept: Concept) => {
    handleSelectConcept(concept);
  }, [handleSelectConcept]);

  if (!isOpen) return null;

  const displayConcepts = searchQuery.trim() ? searchResults : topConcepts;

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-background border-l shadow-xl',
        'flex flex-col'
      )}
      role="dialog"
      aria-label="SKOS Concept Browser"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
        <h2 className="text-lg font-semibold">Concepts</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => loadSchemes()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scheme Selector */}
      <div className="px-4 py-2 border-b">
        <Select value={selectedSchemeId} onValueChange={setSelectedSchemeId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a concept scheme" />
          </SelectTrigger>
          <SelectContent>
            {schemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                {scheme.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Tree Panel */}
        <div className="w-1/2 border-r overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedSchemeId && loadTopConcepts(selectedSchemeId)}
                className="mt-2"
                disabled={!selectedSchemeId}
              >
                Retry
              </Button>
            </div>
          ) : !selectedSchemeId ? (
            <div className="text-center py-8 px-4 text-muted-foreground">
              <p className="text-sm">
                {schemes.length === 0
                  ? 'No concept schemes available'
                  : 'Select a concept scheme'}
              </p>
            </div>
          ) : (
            <ConceptTree
              concepts={displayConcepts}
              childrenMap={childrenMap}
              selectedId={selectedConcept?.id}
              expandedIds={expandedIds}
              onSelectConcept={handleSelectConcept}
              onExpandCollapse={handleExpandCollapse}
              onLoadChildren={loadChildren}
            />
          )}
        </div>

        {/* Detail Panel */}
        <div className="w-1/2 overflow-y-auto p-4">
          {selectedConcept ? (
            <ConceptCard
              concept={selectedConcept}
              onNavigateToConcept={handleNavigateToConcept}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Select a concept to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t bg-muted/30">
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          New Concept
        </Button>
      </div>
    </div>
  );
}
