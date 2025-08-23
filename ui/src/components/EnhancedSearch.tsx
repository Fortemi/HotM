import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { api, SearchHit, NoteFull } from '@/services/api';
import { Search, Sparkles, FileText, Hash, Loader2, Star, Archive, Clock } from 'lucide-react';

interface EnhancedSearchProps {
  onSelectNote: (noteId: string) => void;
}

export function EnhancedSearch({ onSelectNote }: EnhancedSearchProps) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'fts' | 'semantic'>('hybrid');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [fullNotes, setFullNotes] = useState<Map<string, NoteFull>>(new Map());
  const [loading, setLoading] = useState(false);
  const [llmContext, setLlmContext] = useState<string>('');
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string, mode: 'hybrid' | 'fts' | 'semantic') => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLlmContext('');
      return;
    }

    setLoading(true);
    try {
      const results = await api.searchNotes(searchQuery, mode);
      setResults(results);
      
      // Fetch full note data for better display
      const notesMap = new Map<string, NoteFull>();
      await Promise.all(
        results.slice(0, 20).map(async (hit) => {
          try {
            const fullNote = await api.getNote(hit.note_id);
            notesMap.set(hit.note_id, fullNote);
          } catch (error) {
            console.error(`Failed to load note ${hit.note_id}:`, error);
          }
        })
      );
      setFullNotes(notesMap);
      
      // If hybrid mode and we have results, generate LLM context
      if (mode === 'hybrid' && results.length > 0) {
        try {
          const contextResponse = await api.generateSearchContext(searchQuery, results.slice(0, 5));
          setLlmContext(contextResponse.context);
        } catch (error) {
          console.error('Failed to generate LLM context:', error);
          // Fallback to simple context
          setLlmContext(`Found ${results.length} notes related to "${searchQuery}". Click to explore the results.`);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setFullNotes(new Map());
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
              <TabsTrigger value="semantic" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                Semantic
              </TabsTrigger>
            </TabsList>

            {/* Hybrid Tab Content */}
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
            
            {/* FTS Tab Content */}
            <TabsContent value="fts" className="mt-4">
              <div className="mb-4 p-3 bg-blue-500/5 rounded-lg">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Full-text search across all note content and metadata
                  </p>
                </div>
              </div>
            </TabsContent>
            
            {/* Semantic Tab Content */}
            <TabsContent value="semantic" className="mt-4">
              <div className="mb-4 p-3 bg-purple-500/5 rounded-lg">
                <div className="flex items-start gap-2">
                  <Hash className="h-4 w-4 text-purple-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    AI-powered semantic search using embeddings to find conceptually similar notes
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Search Results */}
          {results.length > 0 && (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 p-2">
                {results.map((hit) => {
                  const fullNote = fullNotes.get(hit.note_id);
                  const aiMetadata = (fullNote?.revised as any)?.ai_metadata;
                  const categories = aiMetadata?.categories || [];
                  const topics = aiMetadata?.topics || [];
                  const tags = fullNote?.tags || [];
                  
                  // Extract title from content
                  const title = fullNote?.original?.content?.split('\n')[0]?.replace(/^#+\s*/, '').substring(0, 100) || 
                                hit.snippet?.split('\n')[0]?.substring(0, 50) || 
                                'Untitled Note';
                  
                  return (
                    <button
                      key={hit.note_id}
                      onClick={() => onSelectNote(hit.note_id)}
                      className="w-full text-left p-4 rounded-lg bg-card hover:bg-accent/50 transition-colors border shadow-sm hover:shadow-md"
                    >
                      <div className="space-y-3">
                        {/* Title and badges */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm line-clamp-2 flex-1">
                            {title}
                          </h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {fullNote?.note?.starred && (
                              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                            )}
                            {fullNote?.note?.archived && (
                              <Archive className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        
                        {/* Content preview */}
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {fullNote?.revised?.content || fullNote?.original?.content || hit.snippet || ''}
                        </p>
                        
                        {/* Categories and Topics */}
                        {(categories.length > 0 || topics.length > 0) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {categories.slice(0, 2).map((category: string, idx: number) => (
                              <Badge 
                                key={`cat-${idx}`} 
                                variant="default" 
                                className="text-xs py-0 h-5 bg-blue-500/10 text-blue-700 border-blue-200"
                              >
                                📂 {category}
                              </Badge>
                            ))}
                            
                            {topics.slice(0, 2).map((topic: string, idx: number) => (
                              <Badge 
                                key={`topic-${idx}`} 
                                variant="secondary" 
                                className="text-xs py-0 h-5 bg-purple-500/10 text-purple-700 border-purple-200"
                              >
                                💡 {topic}
                              </Badge>
                            ))}
                            
                            {(categories.length > 2 || topics.length > 2) && (
                              <span className="text-xs text-muted-foreground">
                                +{Math.max(0, categories.length - 2) + Math.max(0, topics.length - 2)} more
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Tags and metadata */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Date */}
                          {fullNote?.note?.created_at_utc && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(fullNote.note.created_at_utc).toLocaleDateString()}
                            </div>
                          )}
                          
                          {/* Tags */}
                          {tags.length > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              {tags.slice(0, 3).map((tag, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant="outline" 
                                  className="text-xs py-0 h-5"
                                >
                                  #{tag}
                                </Badge>
                              ))}
                              {tags.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{tags.length - 3} tags
                                </span>
                              )}
                            </>
                          )}
                          
                          {/* Relevance score */}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {(hit.score * 100).toFixed(0)}% match
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
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