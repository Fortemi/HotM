/**
 * TimelineView Component
 * Displays notes in a vertical timeline with date-based grouping
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  ChevronUp,
  ChevronDown,
  Loader2,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/api';
import type { NoteSummary } from '@/api/types';
import { cn } from '@/lib/utils';

export interface TimelineViewProps {
  className?: string;
  onNoteSelect?: (noteId: string) => void;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'year';

interface DateGroup {
  label: string;
  date: Date;
  notes: NoteSummary[];
}

/**
 * Format date based on zoom level
 */
function formatDateByZoom(date: Date, zoom: ZoomLevel): string {
  switch (zoom) {
    case 'day':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'week': {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `Week of ${startOfWeek.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${endOfWeek.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    }
    case 'month':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      });
    case 'year':
      return date.toLocaleDateString('en-US', { year: 'numeric' });
  }
}

/**
 * Get group key for a date based on zoom level
 */
function getGroupKey(date: Date, zoom: ZoomLevel): string {
  switch (zoom) {
    case 'day':
      return date.toISOString().split('T')[0];
    case 'week': {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      return startOfWeek.toISOString().split('T')[0];
    }
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'year':
      return String(date.getFullYear());
  }
}

/**
 * Group notes by date based on zoom level
 */
function groupNotesByDate(notes: NoteSummary[], zoom: ZoomLevel): DateGroup[] {
  const groups = new Map<string, DateGroup>();

  notes.forEach((note) => {
    const noteDate = new Date(note.created_at_utc);
    const key = getGroupKey(noteDate, zoom);

    if (!groups.has(key)) {
      groups.set(key, {
        label: formatDateByZoom(noteDate, zoom),
        date: noteDate,
        notes: [],
      });
    }

    groups.get(key)!.notes.push(note);
  });

  // Sort groups by date descending
  return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Note card component for timeline
 */
interface NoteCardProps {
  note: NoteSummary;
  onClick: () => void;
}

function NoteCard({ note, onClick }: NoteCardProps) {
  const noteDate = new Date(note.created_at_utc);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-card"
    >
      <div className="space-y-2">
        {/* Title */}
        <h4 className="text-sm font-medium line-clamp-2">{note.title}</h4>

        {/* Snippet */}
        {note.snippet && (
          <p className="text-xs text-muted-foreground line-clamp-2">{note.snippet}</p>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {noteDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>

          {note.has_revision && (
            <Badge variant="secondary" className="text-xs">
              Revised
            </Badge>
          )}

          {note.starred && (
            <span className="text-yellow-500" title="Starred">
              ★
            </span>
          )}
        </div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Hash className="w-3 h-3 mr-0.5" />
                {tag}
              </Badge>
            ))}
            {note.tags.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{note.tags.length - 5}
              </Badge>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Date marker component
 */
interface DateMarkerProps {
  label: string;
  noteCount: number;
}

function DateMarker({ label, noteCount }: DateMarkerProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-px bg-border" />
      <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="text-xs">
          {noteCount}
        </Badge>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/**
 * Jump to date dialog
 */
interface JumpToDateProps {
  onJump: (date: Date) => void;
}

function JumpToDate({ onJump }: JumpToDateProps) {
  const [dateValue, setDateValue] = useState('');

  const handleJump = () => {
    if (dateValue) {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        onJump(date);
        setDateValue('');
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={dateValue}
        onChange={(e) => setDateValue(e.target.value)}
        placeholder="Select date"
        className="w-48"
      />
      <Button onClick={handleJump} disabled={!dateValue} size="sm">
        Jump
      </Button>
    </div>
  );
}

/**
 * Main Timeline View Component
 */
export function TimelineView({ className, onNoteSelect }: TimelineViewProps) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadTriggerRef = useRef<HTMLDivElement | null>(null);

  const ITEMS_PER_PAGE = 50;

  /**
   * Load notes from API
   */
  const loadNotes = useCallback(
    async (reset = false) => {
      if (!reset && !hasMore) return;

      setIsLoading(true);
      setError(null);

      try {
        const currentOffset = reset ? 0 : offset;
        const newNotes = await api.notes.list({
          sortBy: 'created_at',
          sortOrder: 'desc',
          limit: ITEMS_PER_PAGE,
          offset: currentOffset,
          archived: false,
        });

        if (reset) {
          setNotes(newNotes);
          setOffset(ITEMS_PER_PAGE);
        } else {
          setNotes((prev) => [...prev, ...newNotes]);
          setOffset((prev) => prev + ITEMS_PER_PAGE);
        }

        setHasMore(newNotes.length === ITEMS_PER_PAGE);
      } catch (err) {
        console.error('Failed to load notes:', err);
        setError('Failed to load timeline');
      } finally {
        setIsLoading(false);
      }
    },
    [offset, hasMore]
  );

  /**
   * Initial load
   */
  useEffect(() => {
    loadNotes(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Setup intersection observer for infinite scroll
   */
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoading) {
          loadNotes();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    if (loadTriggerRef.current) {
      observerRef.current.observe(loadTriggerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, loadNotes]);

  /**
   * Jump to date
   */
  const handleJumpToDate = useCallback((targetDate: Date) => {
    const targetKey = getGroupKey(targetDate, zoom);
    const element = document.querySelector(`[data-group-key="${targetKey}"]`);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [zoom]);

  /**
   * Scroll to top
   */
  const scrollToTop = useCallback(() => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /**
   * Scroll to bottom
   */
  const scrollToBottom = useCallback(() => {
    scrollAreaRef.current?.scrollTo({
      top: scrollAreaRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  // Group notes by date
  const dateGroups = groupNotesByDate(notes, zoom);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Timeline</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom Level */}
          <Select value={zoom} onValueChange={(value) => setZoom(value as ZoomLevel)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>

          {/* Jump to Date */}
          <JumpToDate onJump={handleJumpToDate} />

          {/* Scroll Controls */}
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={scrollToTop} title="Scroll to top">
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={scrollToBottom}
              title="Scroll to bottom"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <ScrollArea className="flex-1">
        <div ref={scrollAreaRef} className="p-6">
          {/* Error State */}
          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => loadNotes(true)} className="mt-4">
                Retry
              </Button>
            </div>
          )}

          {/* Timeline */}
          {!error && dateGroups.length > 0 && (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              {/* Date Groups */}
              <div className="space-y-8">
                {dateGroups.map((group) => (
                  <div
                    key={getGroupKey(group.date, zoom)}
                    data-group-key={getGroupKey(group.date, zoom)}
                  >
                    <DateMarker label={group.label} noteCount={group.notes.length} />

                    {/* Notes in this group */}
                    <div className="ml-8 space-y-3">
                      {group.notes.map((note) => (
                        <div key={note.id} className="relative">
                          {/* Connection dot */}
                          <div className="absolute -left-[1.65rem] top-3 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                          <NoteCard
                            note={note}
                            onClick={() => onNoteSelect?.(note.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Load trigger for infinite scroll */}
              {hasMore && (
                <div
                  ref={loadTriggerRef}
                  className="h-20 flex items-center justify-center"
                >
                  {isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading more...</span>
                    </div>
                  )}
                </div>
              )}

              {/* End of timeline */}
              {!hasMore && notes.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Beginning of timeline</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!error && !isLoading && notes.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No notes yet</p>
              <p className="text-sm">Create your first note to see it in the timeline</p>
            </div>
          )}

          {/* Initial Loading */}
          {isLoading && notes.length === 0 && (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading timeline...</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
