/**
 * SearchPage Component
 * Full-featured search with mode selection, tag filtering, date ranges, and result display
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Hash,
  Star,
  Archive,
  Loader2,
  X,
  FileText,
  AlertCircle,
  Database,
  Network,
  Calendar,
  MapPin,
  Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { api } from '@/api';
import { getActiveMemory, MEMORY_CHANGED_EVENT } from '@/api/memory-context';
import type { MemoryArchive, SearchResult, SearchMode, Tag } from '@/api';

interface SearchPageProps {
  className?: string;
  onSelectResult?: (noteId: string) => void;
  initialQuery?: string;
  initialMode?: SearchMode;
}

export function SearchPage({ className, onSelectResult, initialQuery, initialMode }: SearchPageProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [mode, setMode] = useState<SearchMode | 'federated'>('hybrid');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [filterStarred, setFilterStarred] = useState<boolean | undefined>(undefined);
  const [filterArchived, setFilterArchived] = useState<boolean | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Available tags for filter
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagSearch, setTagSearch] = useState('');

  // Concept filter
  const [selectedConcepts, setSelectedConcepts] = useState<Array<{ id: string; label: string }>>([]);
  const [conceptSearch, setConceptSearch] = useState('');
  const [conceptSuggestions, setConceptSuggestions] = useState<Array<{ id: string; pref_label: string; scheme_id: string }>>([]);

  // Temporal filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Location filter
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [availableMemories, setAvailableMemories] = useState<MemoryArchive[]>([]);
  const [selectedMemories, setSelectedMemories] = useState<string[]>([]);
  const [searchAllMemories, setSearchAllMemories] = useState(true);
  const [activeMemory, setActiveMemory] = useState<string | null>(getActiveMemory());
  const [resultTitles, setResultTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    api.tags.list({ sortBy: 'count' }).then(setAvailableTags).catch(console.error);
    api.archives.list().then(setAvailableMemories).catch(console.error);
  }, []);

  // Concept autocomplete
  useEffect(() => {
    if (!conceptSearch.trim()) {
      setConceptSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.concepts.autocompleteConcepts(conceptSearch.trim());
        const filtered = response.suggestions.filter(
          (s) => !selectedConcepts.some((c) => c.id === s.id)
        );
        setConceptSuggestions(filtered);
      } catch {
        setConceptSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [conceptSearch, selectedConcepts]);

  useEffect(() => {
    const onMemoryChanged = () => {
      setActiveMemory(getActiveMemory());
    };
    window.addEventListener(MEMORY_CHANGED_EVENT, onMemoryChanged as EventListener);
    return () => {
      window.removeEventListener(MEMORY_CHANGED_EVENT, onMemoryChanged as EventListener);
    };
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        setIsGettingLocation(false);
      },
      () => {
        setIsGettingLocation(false);
      }
    );
  }, []);

  const defaultMemory = availableMemories.find((m) => m.is_default)?.name ?? null;

  const filteredAvailableTags = availableTags.filter(
    (t) =>
      t.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
      !selectedTags.includes(t.name)
  );

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      if (mode === 'federated') {
        const scopedMemories = searchAllMemories
          ? ['all']
          : selectedMemories.length > 0
            ? selectedMemories
            : activeMemory
              ? [activeMemory]
              : defaultMemory
                ? [defaultMemory]
                : ['all'];
        const federatedResults = await api.search.federatedSearch(
          trimmed,
          scopedMemories,
          50
        );
        const mappedResults = federatedResults.map((hit) => ({
          note_id: hit.note_id,
          score: hit.score,
          snippet: `[${hit.memory}] ${hit.snippet ?? ''}`.trim(),
        }));
        setResults(mappedResults);
        setResultTitles(
          new Map(
            federatedResults
              .filter((hit) => typeof hit.title === 'string' && hit.title.trim().length > 0)
              .map((hit) => [hit.note_id, hit.title!.trim()])
          )
        );
      } else {
        const conceptIds = selectedConcepts.length > 0 ? selectedConcepts.map((c) => c.id) : undefined;
        const searchResults = await api.search.search(trimmed, {
          mode,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          concepts: conceptIds,
          starred: filterStarred,
          archived: filterArchived,
          before: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
          after: dateFrom ? new Date(dateFrom + 'T00:00:00').toISOString() : undefined,
          limit: 50,
        });

        // If location filter is active, also search memory API and merge results
        if (location) {
          try {
            const memoryQuery = {
              lat: location.lat,
              lon: location.lon,
              radius_meters: radius,
              ...(dateFrom && dateTo ? {
                start: new Date(dateFrom + 'T00:00:00').toISOString(),
                end: new Date(dateTo + 'T23:59:59').toISOString(),
              } : {}),
            };
            const memoryResults = dateFrom && dateTo
              ? await api.memory.searchCombined(memoryQuery as Parameters<typeof api.memory.searchCombined>[0])
              : await api.memory.searchByLocation(memoryQuery);
            const existingIds = new Set(searchResults.map((r) => r.note_id));
            for (const mr of memoryResults) {
              if (!existingIds.has(mr.note_id)) {
                searchResults.push({
                  note_id: mr.note_id,
                  score: 0.5,
                  snippet: mr.snippet || mr.title || '',
                });
              }
            }
          } catch {
            // Memory search unavailable — continue with standard results
          }
        }

        setResults(searchResults);
        setResultTitles(new Map());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setResultTitles(new Map());
    } finally {
      setIsSearching(false);
    }
  }, [query, mode, selectedTags, selectedConcepts, filterStarred, filterArchived, dateFrom, dateTo, location, radius, searchAllMemories, selectedMemories, activeMemory, defaultMemory]);

  // Auto-execute search when initialQuery changes (e.g. navigating from quick search bar)
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setQuery(initialQuery);
      if (initialMode) {
        setMode(initialMode);
      }
    }
  }, [initialQuery, initialMode]);

  // Trigger search when query is set from initialQuery
  useEffect(() => {
    if (query.trim() && !hasSearched) {
      handleSearch();
    }
  }, [query, hasSearched, handleSearch]);

  useEffect(() => {
    let cancelled = false;
    if (results.length === 0) {
      return;
    }

    const loadTitles = async () => {
      const next = new Map<string, string>(resultTitles);
      await Promise.all(
        results.slice(0, 20).map(async (result) => {
          if (next.has(result.note_id)) {
            return;
          }
          try {
            const fullNote = await api.notes.get(result.note_id);
            const contentTitle = fullNote.original?.content
              ?.split('\n')[0]
              ?.replace(/^#+\s*/, '')
              ?.trim();
            const bestTitle =
              (typeof fullNote.note?.title === 'string' && fullNote.note.title.trim().length > 0
                ? fullNote.note.title.trim()
                : null) ??
              (contentTitle && contentTitle.length > 0 ? contentTitle : null);

            if (bestTitle) {
              next.set(result.note_id, bestTitle);
            }
          } catch {
            // Ignore individual title lookup failures; fallback title will be used.
          }
        })
      );

      if (!cancelled) {
        setResultTitles(next);
      }
    };

    void loadTitles();
    return () => {
      cancelled = true;
    };
  }, [results]);

  const getResultTitle = (result: SearchResult): string => {
    const mappedTitle = resultTitles.get(result.note_id);
    if (mappedTitle) {
      return mappedTitle;
    }

    const directTitle = (result as SearchResult & { title?: string }).title;
    if (typeof directTitle === 'string' && directTitle.trim().length > 0) {
      return directTitle.trim();
    }

    const snippetTitle = result.snippet
      ?.replace(/^\[[^\]]+\]\s*/, '')
      .split('\n')[0]
      .replace(/^#+\s*/, '')
      .trim();
    if (snippetTitle) {
      return snippetTitle;
    }

    return 'Untitled Note';
  };

  const addTag = (name: string) => {
    setSelectedTags((prev) => [...prev, name]);
    setTagSearch('');
  };

  const removeTag = (name: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== name));
  };

  const addConcept = (id: string, label: string) => {
    setSelectedConcepts((prev) => [...prev, { id, label }]);
    setConceptSearch('');
    setConceptSuggestions([]);
  };

  const removeConcept = (id: string) => {
    setSelectedConcepts((prev) => prev.filter((c) => c.id !== id));
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedConcepts([]);
    setFilterStarred(undefined);
    setFilterArchived(undefined);
    setDateFrom('');
    setDateTo('');
    setLocation(null);
    setRadius(1000);
  };

  const activeFilterCount =
    selectedTags.length +
    selectedConcepts.length +
    (filterStarred !== undefined ? 1 : 0) +
    (filterArchived !== undefined ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (location ? 1 : 0);

  return (
    <div className={cn('flex flex-col h-full', className)} role="region" aria-label="Search">
      {/* Header */}
      <div className="px-6 py-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Search</h2>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={!query.trim() || isSearching}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mode:</span>
          {(['hybrid', 'fts', 'semantic', 'federated'] as Array<SearchMode | 'federated'>).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMode(m)}
              className="capitalize"
            >
              {m === 'fts' ? 'Full Text' : m}
            </Button>
          ))}
          <div className="flex-1" />
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {mode === 'federated' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Scope:</span>
            <Button
              size="sm"
              variant={searchAllMemories ? 'secondary' : 'outline'}
              onClick={() => setSearchAllMemories(true)}
            >
              All memories
            </Button>
            <Button
              size="sm"
              variant={!searchAllMemories ? 'secondary' : 'outline'}
              onClick={() => {
                setSearchAllMemories(false);
                setSelectedMemories(activeMemory ? [activeMemory] : defaultMemory ? [defaultMemory] : []);
              }}
            >
              Loaded memory
            </Button>
            <span>
              loaded: {activeMemory ?? `default (${defaultMemory ?? 'server default'})`}
            </span>
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-3 border-b bg-muted/30 space-y-3">
          {/* Tag Filter */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <Hash className="w-3.5 h-3.5" /> Tags
            </label>
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative">
              <Input
                placeholder="Add tag filter..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="h-8 text-sm"
              />
              {tagSearch && filteredAvailableTags.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-32 overflow-y-auto">
                  {filteredAvailableTags.slice(0, 8).map((tag) => (
                    <button
                      key={tag.name}
                      onClick={() => addTag(tag.name)}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span>{tag.name}</span>
                      <span className="text-xs text-muted-foreground">{tag.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Concept Filter */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <Network className="w-3.5 h-3.5" /> Concepts
            </label>
            {selectedConcepts.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedConcepts.map((concept) => (
                  <Badge key={concept.id} variant="secondary" className="gap-1">
                    {concept.label}
                    <button onClick={() => removeConcept(concept.id)} aria-label={`Remove ${concept.label}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative">
              <Input
                placeholder="Search concepts..."
                value={conceptSearch}
                onChange={(e) => setConceptSearch(e.target.value)}
                className="h-8 text-sm"
              />
              {conceptSearch && conceptSuggestions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-32 overflow-y-auto">
                  {conceptSuggestions.slice(0, 8).map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => addConcept(suggestion.id, suggestion.pref_label)}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span>{suggestion.pref_label}</span>
                      <span className="text-xs text-muted-foreground truncate ml-2">{suggestion.scheme_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Temporal Filter */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5" /> Date Range
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { label: 'Today', days: 0 },
                { label: '7 days', days: 7 },
                { label: '30 days', days: 30 },
                { label: '1 year', days: 365 },
              ].map(({ label, days }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - days);
                    setDateFrom(start.toISOString().split('T')[0]);
                    setDateTo(end.toISOString().split('T')[0]);
                  }}
                >
                  {label}
                </Button>
              ))}
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          {/* Location Filter */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            {location ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                  <p className="text-xs font-mono">
                    {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setLocation(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Radius</span>
                    <span className="font-medium">
                      {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
                    </span>
                  </div>
                  <Slider
                    value={[radius]}
                    min={100}
                    max={50000}
                    step={100}
                    onValueChange={([v]) => setRadius(v)}
                    aria-label="Search radius"
                  />
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-sm"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 mr-1" />
                )}
                Use Current Location
              </Button>
            )}
          </div>

          {/* Boolean Filters */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filterStarred === true}
                onChange={() => setFilterStarred(filterStarred === true ? undefined : true)}
                className="rounded"
              />
              <Star className="w-3.5 h-3.5" />
              Starred only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filterArchived === true}
                onChange={() => setFilterArchived(filterArchived === true ? undefined : true)}
                className="rounded"
              />
              <Archive className="w-3.5 h-3.5" />
              Include archived
            </label>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
                Clear filters
              </Button>
            )}
          </div>

          {mode === 'federated' && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Memories
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchAllMemories}
                  onChange={() => setSearchAllMemories((v) => !v)}
                  className="rounded"
                />
                Search all memories
              </label>
              {!searchAllMemories && (
                <div className="flex flex-wrap gap-2">
                  {availableMemories.map((memory) => {
                    const selected = selectedMemories.includes(memory.name);
                    return (
                      <Button
                        key={memory.id}
                        size="sm"
                        variant={selected ? 'secondary' : 'outline'}
                        onClick={() =>
                          setSelectedMemories((prev) =>
                            selected ? prev.filter((m) => m !== memory.name) : [...prev, memory.name]
                          )
                        }
                      >
                        {memory.name}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-12">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Enter a query and click Search</p>
            <p className="text-xs mt-1">
              Use hybrid mode for best results, FTS for exact matches, or semantic for conceptual similarity
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No results found</p>
            <p className="text-xs mt-1">Try different keywords or adjust your filters</p>
          </div>
        ) : (
          <div className="divide-y">
            <div className="px-6 py-2 text-xs text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            {results.map((result) => (
              <button
                key={result.note_id}
                onClick={() => onSelectResult?.(result.note_id)}
                className="w-full text-left px-6 py-3 hover:bg-muted/50 transition-colors"
                title={`Note ID: ${result.note_id}`}
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{getResultTitle(result)}</span>
                      <Badge variant="outline" className="text-xs">
                        {(result.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    {result.snippet && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {result.snippet}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
