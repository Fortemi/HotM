import { Badge } from "@/components/ui/badge";
import type { CommitResult } from "./useNoteCommit";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface SessionLogProps {
  notes: CommitResult[];
}

const MAX_VISIBLE = 10;

export function SessionLog({ notes }: SessionLogProps) {
  const visible = notes.slice(0, MAX_VISIBLE);
  const hasMore = notes.length > MAX_VISIBLE;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Committed notes this session
      </h3>
      <div className="space-y-2">
        {visible.map((note, i) => (
          <div
            key={`${note.noteId}-${i}`}
            className="bg-muted/30 border border-border/50 rounded-md px-3 py-2"
            role="article"
            aria-label={`Note: ${note.content.slice(0, 60)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-foreground truncate flex-1">
                {note.content.length > 80
                  ? note.content.slice(0, 80) + "..."
                  : note.content}
              </p>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                {timeAgo(note.timestamp)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {note.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  {tag}
                </Badge>
              ))}
              {note.collectionName && (
                <span className="text-[10px] text-muted-foreground">
                  {note.collectionName}
                </span>
              )}
              {note.conceptLabel && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {note.conceptLabel}
                </Badge>
              )}
              {note.warnings.length > 0 &&
                note.warnings.map((w, j) => (
                  <span
                    key={j}
                    className="text-[10px] text-amber-500"
                  >
                    {w}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Showing {MAX_VISIBLE} of {notes.length} notes
        </p>
      )}
    </div>
  );
}
