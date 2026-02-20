import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, RelatedNotesResponse, SearchHit } from '@/services/api';
import { Link2, Sparkles } from 'lucide-react';

interface RelatedNotesProps {
  noteId: string;
  onSelectNote?: (noteId: string) => void;
}

export function RelatedNotes({ noteId, onSelectNote }: RelatedNotesProps) {
  const [relatedData, setRelatedData] = useState<RelatedNotesResponse | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Cache for related notes data to prevent excessive API calls
  const relatedCache = useRef<Map<string, { data: RelatedNotesResponse; titles: Map<string, string>; timestamp: number }>>(new Map());

  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;

    const fetchRelated = async () => {
      // Check cache first
      const now = Date.now();
      const cachedData = relatedCache.current.get(noteId);
      const CACHE_DURATION = 60000;

      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        setRelatedData(cachedData.data);
        setTitles(cachedData.titles);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await api.getRelatedNotes(noteId);
        if (cancelled) return;
        setRelatedData(data);

        // Fetch titles for top 5 displayed results in parallel
        const top5 = (data.related || [])
          .filter((hit: SearchHit) => (hit?.score || 0) > 0.5)
          .slice(0, 5);

        const titleMap = new Map<string, string>();
        const titleResults = await Promise.allSettled(
          top5.map(async (hit: SearchHit) => {
            if (!hit?.note_id) return null;
            const full = await api.getNote(hit.note_id);
            const content = full.revised?.content || full.original?.content || '';
            const firstLine = content.split('\n')[0]?.replace(/^#+\s*/, '').trim();
            return { id: hit.note_id, title: firstLine?.substring(0, 80) || 'Untitled' };
          })
        );

        if (cancelled) return;
        for (const result of titleResults) {
          if (result.status === 'fulfilled' && result.value) {
            titleMap.set(result.value.id, result.value.title);
          }
        }
        setTitles(titleMap);

        // Cache both related data and titles
        relatedCache.current.set(noteId, { data, titles: titleMap, timestamp: now });
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch related notes:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load related notes';
        setError(errorMessage);
        setRelatedData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRelated();
    return () => { cancelled = true; };
  }, [noteId, retryCount]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Related Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading related notes...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Related Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Error loading related notes: {error}
          </div>
          <button
            onClick={() => {
              relatedCache.current.delete(noteId);
              setRetryCount((c) => c + 1);
            }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    );
  }

  // Filter related notes by similarity threshold (> 50%)
  const highQualityRelated = (relatedData?.related || []).filter((hit: SearchHit) => (hit?.score || 0) > 0.5);

  if (!relatedData || !relatedData.related || relatedData.related.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Related Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No related notes found yet.</div>
        </CardContent>
      </Card>
    );
  }

  if (highQualityRelated.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Related Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No high-quality matches found. ({relatedData.related.length} potential matches below 50% similarity)
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4" />
          Related Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="space-y-1 flex-shrink-0">
          {highQualityRelated.slice(0, 5).map((hit: SearchHit, index: number) => {
            // Generate a unique key based on note_id and index to avoid duplicates
            const uniqueKey = `${hit?.note_id || 'unknown'}-${index}`;
            
            return (
              <button
                key={uniqueKey}
                onClick={() => hit?.note_id && onSelectNote?.(hit.note_id)}
                className="w-full text-left px-2 py-1.5 rounded border border-transparent hover:border-border hover:bg-muted/50 transition-colors group cursor-pointer"
                disabled={!hit?.note_id}
              >
                <div className="flex items-start gap-2">
                  <div className="text-xs font-medium text-muted-foreground mt-0.5">
                    {index + 1}.
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate group-hover:text-primary">
                      {(hit?.note_id && titles.get(hit.note_id)) || 'Untitled'}
                    </div>
                    {hit?.snippet && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {hit.snippet}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="text-xs text-muted-foreground">
                        {hit?.score ? `${(hit.score * 100).toFixed(0)}% match` : 'Related'}
                      </div>
                      <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Open →
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {relatedData.context_summary && (
          <div className="mt-3 pt-3 border-t flex-1 min-h-[100px] max-h-[300px] flex flex-col">
            <div className="flex items-start gap-1.5 h-full">
              <Sparkles className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
              <ScrollArea className="flex-1 h-full">
                <p className="text-xs text-muted-foreground leading-relaxed pr-2">
                  {relatedData.context_summary}
                </p>
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}