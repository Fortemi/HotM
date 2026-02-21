/**
 * Interactive Transcript Panel
 *
 * Displays transcript segments synchronized with media playback:
 * - Currently-playing segment highlighted
 * - Click-to-seek on any segment
 * - Auto-scroll to keep active segment visible
 * - Copy-to-clipboard for individual segments or full transcript
 * - Subtitle file download (VTT/SRT)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Copy, Check, ChevronDown, ChevronRight, Subtitles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TranscriptSegment } from './subtitle-utils';
import { findActiveSegmentIndex, formatSegmentTime, downloadSubtitles } from './subtitle-utils';

interface TranscriptPanelProps {
  /** Transcript segments from extracted_metadata */
  segments: TranscriptSegment[];
  /** Current playback time in seconds (synced from video/audio element) */
  currentTime: number;
  /** Callback to seek the media player to a specific time */
  onSeek: (timeSecs: number) => void;
  /** Attachment filename (used for subtitle download naming) */
  filename?: string;
  /** Optional class for the panel container */
  className?: string;
}

export function TranscriptPanel({
  segments,
  currentTime,
  onSeek,
  filename = 'transcript',
  className,
}: TranscriptPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLButtonElement>(null);

  const activeIndex = findActiveSegmentIndex(segments, currentTime);

  // Auto-scroll to keep active segment visible
  useEffect(() => {
    if (activeIndex >= 0 && activeSegmentRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const el = activeSegmentRef.current;
      const elTop = el.offsetTop - container.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;

      // Only scroll if the active segment is not visible
      if (elTop < viewTop || elBottom > viewBottom) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [activeIndex]);

  // Copy a single segment's text
  const handleCopySegment = useCallback((index: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }, []);

  // Copy full transcript
  const handleCopyAll = useCallback(() => {
    const fullText = segments.map((seg) => {
      const prefix = seg.speaker_id ? `[${seg.speaker_id}] ` : '';
      return `${prefix}${seg.text}`;
    }).join('\n');

    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }, [segments]);

  if (segments.length === 0) return null;

  return (
    <div className={cn('rounded-lg border', className)} data-testid="transcript-panel">
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-medium hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Subtitles className="w-4 h-4 text-primary" />
        Interactive Transcript
        <span className="text-xs text-muted-foreground font-normal ml-auto">
          {segments.length} segments
        </span>
      </button>

      {isExpanded && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 pb-1 border-b">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCopyAll}
            >
              {copiedAll ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copiedAll ? 'Copied' : 'Copy all'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => downloadSubtitles(segments, 'vtt', filename)}
            >
              <Download className="w-3 h-3 mr-1" />
              .vtt
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => downloadSubtitles(segments, 'srt', filename)}
            >
              <Download className="w-3 h-3 mr-1" />
              .srt
            </Button>
          </div>

          {/* Scrollable segment list */}
          <div
            ref={scrollContainerRef}
            className="max-h-64 overflow-y-auto px-1 py-1"
          >
            {segments.map((seg, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={i}
                  ref={isActive ? activeSegmentRef : undefined}
                  type="button"
                  className={cn(
                    'flex items-start gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors group',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent/50 text-foreground',
                  )}
                  onClick={() => onSeek(seg.start_secs)}
                  data-testid={`transcript-segment-${i}`}
                >
                  <span className="shrink-0 w-10 text-right text-muted-foreground tabular-nums">
                    {formatSegmentTime(seg.start_secs)}
                  </span>
                  <span className="flex-1 leading-relaxed">
                    {seg.speaker_id && (
                      <span className="font-semibold text-muted-foreground mr-1">
                        {seg.speaker_id}:
                      </span>
                    )}
                    {seg.text}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 hover:text-primary transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopySegment(i, seg.text);
                    }}
                    title="Copy segment"
                  >
                    {copiedIndex === i ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
