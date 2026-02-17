import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/api";
import type { NoteFull, NoteSummary, SearchResult } from "@/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MobileReadView() {
  const [recentNotes, setRecentNotes] = useState<NoteSummary[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteFull | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [askQuery, setAskQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingNote, setLoadingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecent = async () => {
      try {
        setLoadingRecent(true);
        const notes = await api.notes.list({
          sortBy: "updated_at",
          sortOrder: "desc",
          limit: 20,
          archived: false,
        });
        setRecentNotes(notes);
      } catch (err) {
        console.error("Failed to load recent notes:", err);
        setError("Failed to load recent notes");
      } finally {
        setLoadingRecent(false);
      }
    };

    void loadRecent();
  }, []);

  const runSearch = async (query: string, mode: "hybrid" | "semantic") => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    try {
      setLoadingSearch(true);
      setError(null);
      const results = await api.search.search(trimmed, { mode, limit: 20, archived: false });
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
      setError("Search failed");
    } finally {
      setLoadingSearch(false);
    }
  };

  const loadNote = async (noteId: string) => {
    try {
      setLoadingNote(true);
      const full = await api.notes.get(noteId);
      setSelectedNote(full);
    } catch (err) {
      console.error("Failed to load note:", err);
      setError("Failed to load note");
    } finally {
      setLoadingNote(false);
    }
  };

  const visibleSearchResults = useMemo(
    () => searchResults.filter((result) => typeof result.note_id === "string" && result.note_id.length > 0),
    [searchResults]
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-3 sm:p-4">
        <header className="rounded-xl border bg-card p-3">
          <h1 className="text-lg font-semibold">Mobile Read Access</h1>
          <p className="text-sm text-muted-foreground">Browse and search notes in read-only mode.</p>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search</CardTitle>
            <CardDescription>Find notes quickly from mobile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notes"
                aria-label="Search notes"
              />
              <Button onClick={() => void runSearch(searchQuery, "hybrid")} disabled={loadingSearch}>
                {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={askQuery}
                onChange={(event) => setAskQuery(event.target.value)}
                placeholder="Ask a question"
                aria-label="Ask a question"
              />
              <Button
                variant="secondary"
                onClick={() => void runSearch(askQuery, "semantic")}
                disabled={loadingSearch}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
            {visibleSearchResults.length > 0 && (
              <div className="space-y-2">
                {visibleSearchResults.map((result) => (
                  <button
                    key={result.note_id}
                    className="w-full rounded-lg border p-2 text-left hover:bg-accent"
                    onClick={() => void loadNote(result.note_id)}
                  >
                    <div className="text-sm">{result.snippet || "Open note"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">score {result.score.toFixed(3)}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recent notes...
              </div>
            ) : (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <button
                    key={note.id}
                    className="w-full rounded-lg border p-2 text-left hover:bg-accent"
                    onClick={() => void loadNote(note.id)}
                  >
                    <div className="line-clamp-1 text-sm font-medium">{note.title || "Untitled Note"}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{note.snippet || ""}</div>
                    {note.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {note.tags.slice(0, 3).map((tag) => (
                          <Badge key={`${note.id}-${tag}`} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selected Note</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingNote ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading note...
              </div>
            ) : selectedNote ? (
              <ScrollArea className="h-[40vh] rounded border p-3">
                <h2 className="mb-2 text-base font-semibold">{selectedNote.note.title || "Untitled Note"}</h2>
                <div className="whitespace-pre-wrap text-sm leading-6">{selectedNote.original.content}</div>
              </ScrollArea>
            ) : (
              <div className="text-sm text-muted-foreground">Select a recent or search result note to read.</div>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </main>
  );
}
