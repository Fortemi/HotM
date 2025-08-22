import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { api, RelatedNotesResponse, SearchHit } from '@/services/api';
import { Link2, Sparkles, FileText } from 'lucide-react';

interface RelatedNotesProps {
  noteId: string;
  onSelectNote?: (noteId: string) => void;
}

export function RelatedNotes({ noteId, onSelectNote }: RelatedNotesProps) {
  const [relatedData, setRelatedData] = useState<RelatedNotesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!noteId) return;
    
    const fetchRelated = async () => {
      setLoading(true);
      try {
        const data = await api.getRelatedNotes(noteId);
        setRelatedData(data);
      } catch (error) {
        console.error('Failed to fetch related notes:', error);
        setRelatedData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRelated();
  }, [noteId]);

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

  if (!relatedData || relatedData.related.length === 0) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Related Notes
        </CardTitle>
        {relatedData.context_summary && (
          <CardDescription className="flex items-start gap-2 mt-2">
            <Sparkles className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
            <span className="text-xs">{relatedData.context_summary}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {relatedData.related.map((hit: SearchHit, index: number) => (
              <div key={hit.note_id}>
                <button
                  onClick={() => onSelectNote?.(hit.note_id)}
                  className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="h-3 w-3 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        Note {index + 1}
                      </div>
                      {hit.snippet && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {hit.snippet}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Relevance: {(hit.score * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </button>
                {index < relatedData.related.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}