import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, SearchHit } from '@/services/api';
import { Search, Sparkles, FileText, Hash, Loader2 } from 'lucide-react';

interface EnhancedSearchProps {
  onSelectNote: (noteId: string) => void;
}

export function EnhancedSearch({ onSelectNote }: EnhancedSearchProps) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'fts' | 'vector'>('hybrid');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [llmContext, setLlmContext] = useState<string>('');
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string, mode: 'hybrid' | 'fts' | 'vector') => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLlmContext('');
      return;
    }

    setLoading(true);
    try {
      const response = await api.searchNotes(searchQuery, mode);
      setResults(response.hits);
      
      // If hybrid mode and we have results, generate LLM context
      if (mode === 'hybrid' && response.hits.length > 0) {
        // Generate a context summary using the LLM
        const topResults = response.hits.slice(0, 3);
        const contextPrompt = `Based on the search query "${searchQuery}", here are the top matching notes. 
        Provide a brief insight about what the user might be looking for and how these results relate to their query.`;
        
        // For now, we'll use a placeholder for LLM context
        // In production, this would call the LLM API
        setLlmContext(`Found ${response.hits.length} notes related to "${searchQuery}". 
        The results include notes about ${topResults.map(() => 'relevant topics').join(', ')}.`);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setLlmContext('');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      performSearch(query, searchMode);
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query, searchMode, performSearch]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Intelligent Search
        </CardTitle>
        <CardDescription>
          Search across all your notes with AI-enhanced relevance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Search your mind..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>

          {/* Search Mode Tabs */}
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="hybrid" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Hybrid AI
              </TabsTrigger>
              <TabsTrigger value="fts" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Text Search
              </TabsTrigger>
              <TabsTrigger value="vector" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                Semantic
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hybrid" className="mt-4">
              {llmContext && (
                <div className="mb-4 p-3 bg-primary/5 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                    <p className="text-sm text-muted-foreground">{llmContext}</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Search Results */}
          {results.length > 0 && (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {results.map((hit) => (
                  <button
                    key={hit.note_id}
                    onClick={() => onSelectNote(hit.note_id)}
                    className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          Note Result
                        </div>
                        {hit.snippet && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {hit.snippet}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-muted-foreground">
                            Relevance: {(hit.score * 100).toFixed(0)}%
                          </span>
                          {searchMode === 'hybrid' && (
                            <span className="text-xs text-primary">
                              AI-ranked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* No Results */}
          {!loading && query && results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notes found matching "{query}"</p>
              <p className="text-xs mt-1">Try different keywords or search modes</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}