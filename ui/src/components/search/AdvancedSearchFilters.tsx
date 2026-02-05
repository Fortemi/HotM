/**
 * AdvancedSearchFilters Component
 * Search with mode selection, tag filtering, date ranges, and result display
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/api';
import type { SearchResult, SearchMode, Tag } from '@/api';

interface AdvancedSearchFiltersProps {
  className?: string;
  onSelectResult?: (noteId: string) => void;
}

export function AdvancedSearchFilters({ className, onSelectResult }: AdvancedSearchFiltersProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
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

  useEffect(() => {
    api.tags.list({ sortBy: 'count' }).then(setAvailableTags).catch(console.error);
  }, []);

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
      const searchResults = await api.search.search(trimmed, {
        mode,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        starred: filterStarred,
        archived: filterArchived,
        limit: 50,
      });
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, mode, selectedTags, filterStarred, filterArchived]);

  const addTag = (name: string) => {
    setSelectedTags((prev) => [...prev, name]);
    setTagSearch('');
  };

  const removeTag = (name: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== name));
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setFilterStarred(undefined);
    setFilterArchived(undefined);
  };

  const activeFilterCount =
    selectedTags.length +
    (filterStarred !== undefined ? 1 : 0) +
    (filterArchived !== undefined ? 1 : 0);

  return (
    <div className={cn('flex flex-col h-full', className)} role="region" aria-label="Advanced Search">
      {/* Header */}
      <div className="px-6 py-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Advanced Search</h2>
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
          {(['hybrid', 'fts', 'semantic'] as SearchMode[]).map((m) => (
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
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{result.note_id.slice(0, 8)}...</span>
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
