/**
 * AttachmentsBrowser Component
 * Global attachment browser showing all attachments across all notes.
 * Tries GET /api/v1/attachments first; falls back to per-note fetching.
 */

import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  Grid,
  List,
  Download,
  Trash2,
  Eye,
  Image as ImageIcon,
  FileText,
  File,
  MapPin,
  Calendar,
  Loader2,
  MoreVertical,
  Search,
  Paperclip,
  StickyNote,
  RefreshCw,
  Filter,
  Music,
  Video,
  Box,
  FileCode,
  FileSpreadsheet,
  Presentation,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Clock,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/api';
import { ApiError } from '@/api';
import { getAuthorizationHeader, hasApiBearerToken } from '@/api/auth-context';
import { getActiveMemory, getMemoryRoutingHeaderName } from '@/api/memory-context';
import { useBlobUrl } from '@/lib/tauri';
import type { Attachment, AttachmentMetadata, ExtractionStatus, AttachmentStatus } from '@/api/types-extended';
import { getPreviewMode, shouldDownloadBlob, getDocTypeLabel, getLanguageFromType } from './preview-utils';
import type { PreviewMode } from './preview-utils';
import { StreamingVideoPlayer, StreamingAudioPlayer } from './StreamingMedia';
import { getThumbnailUrl, getAttachmentDedupeKey } from './media-utils';
import { LinkedNotesTab } from './LinkedNotesTab';
import type { LinkedNote } from './LinkedNotesTab';
import { useMediaPlayerOptional, type MediaSessionInfo } from '@/components/player';

const ModelPreview = lazy(() => import('./ModelPreview').then((m) => ({ default: m.ModelPreview })));

// ── Types ──────────────────────────────────────────────────────────────

/** Attachment enriched with parent note context */
interface NoteAttachment extends Attachment {
  note_title: string;
}

type ViewMode = 'grid' | 'list';
type SortField = 'created_at' | 'filename' | 'size_bytes' | 'note_title';
type ContentTypeFilter = 'all' | 'image' | 'pdf' | 'video' | 'audio' | 'document' | 'other';

interface AttachmentsBrowserProps {
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
  if (contentType.startsWith('model/')) return <Box className="w-8 h-8 text-purple-500" />;
  if (contentType.startsWith('audio/')) return <Music className="w-8 h-8 text-green-500" />;
  if (contentType.startsWith('video/')) return <Video className="w-8 h-8 text-orange-500" />;
  if (contentType === 'application/pdf') return <FileText className="w-8 h-8 text-red-500" />;
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv') return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return <Presentation className="w-8 h-8 text-orange-600" />;
  if (contentType.includes('word') || contentType.includes('document') || contentType === 'application/rtf') return <FileText className="w-8 h-8 text-blue-600" />;
  if (contentType.startsWith('text/') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) return <FileCode className="w-8 h-8 text-cyan-500" />;
  return <File className="w-8 h-8 text-gray-500" />;
}

function matchesTypeFilter(contentType: string, filter: ContentTypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'image') return contentType.startsWith('image/');
  if (filter === 'pdf') return contentType === 'application/pdf';
  if (filter === 'video') return contentType.startsWith('video/');
  if (filter === 'audio') return contentType.startsWith('audio/');
  if (filter === 'document') {
    return contentType.startsWith('text/') ||
      contentType.includes('word') || contentType.includes('document') ||
      contentType.includes('spreadsheet') || contentType.includes('excel') ||
      contentType.includes('presentation') || contentType.includes('powerpoint') ||
      contentType === 'application/rtf' || contentType === 'application/epub+zip' ||
      contentType.includes('json') || contentType.includes('xml') ||
      contentType.includes('javascript');
  }
  // 'other' — everything that doesn't match above
  return !contentType.startsWith('image/') && contentType !== 'application/pdf' &&
    !contentType.startsWith('video/') && !contentType.startsWith('audio/') &&
    !contentType.startsWith('text/') && !contentType.includes('word') &&
    !contentType.includes('document') && !contentType.includes('spreadsheet') &&
    !contentType.includes('excel') && !contentType.includes('presentation') &&
    !contentType.includes('powerpoint') && contentType !== 'application/rtf';
}

function getExtractionStatus(attachment: Attachment): ExtractionStatus {
  if (attachment.status) {
    const statusMap: Record<AttachmentStatus, ExtractionStatus> = {
      completed: 'complete',
      failed: 'failed',
      processing: 'pending',
      uploaded: 'pending',
    };
    return statusMap[attachment.status] ?? 'pending';
  }
  if (attachment.ai_description || attachment.extracted_text) return 'complete';
  const meta = attachment.extracted_metadata;
  if (meta && typeof meta === 'object' && 'error' in meta) return 'failed';
  return 'pending';
}

function ExtractionStatusBadge({ status }: { status: ExtractionStatus }) {
  switch (status) {
    case 'complete':
      return (
        <Badge variant="secondary" className="text-xs px-1 gap-0.5 bg-green-500/10 text-green-700 dark:text-green-400">
          <Sparkles className="w-3 h-3" />
          <span className="sr-only">Extraction complete</span>
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary" className="text-xs px-1 gap-0.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <Clock className="w-3 h-3" />
          <span className="sr-only">Extraction pending</span>
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="secondary" className="text-xs px-1 gap-0.5 bg-red-500/10 text-red-700 dark:text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span className="sr-only">Extraction failed</span>
        </Badge>
      );
    default:
      return null;
  }
}

function browserHasAiContent(attachment: Attachment): boolean {
  if (attachment.ai_description) return true;
  if (attachment.extracted_text) return true;
  const meta = attachment.extracted_metadata;
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  if (Array.isArray(m.transcript_segments) && m.transcript_segments.length > 0) return true;
  if (Array.isArray(m.keyframe_descriptions) && m.keyframe_descriptions.length > 0) return true;
  return false;
}

// ── Attachment Card ────────────────────────────────────────────────────

interface BrowserCardProps {
  attachment: NoteAttachment;
  noteCount: number;
  viewMode: ViewMode;
  onView: (att: NoteAttachment) => void;
  onDownload: (att: NoteAttachment) => void;
  onDelete: (att: NoteAttachment) => void;
}

function BrowserCard({ attachment, noteCount, viewMode, onView, onDownload, onDelete }: BrowserCardProps) {
  const isImage = attachment.content_type.startsWith('image/');
  const selectedMemory = getActiveMemory();
  const useHeaderFetch = hasApiBearerToken() || !!selectedMemory;
  const thumbnailHeaders = useMemo(() => {
    const headers: HeadersInit = { ...getAuthorizationHeader() };
    if (selectedMemory) headers[getMemoryRoutingHeaderName()] = selectedMemory;
    return headers;
  }, [selectedMemory]);
  const thumbnailUrl = useBlobUrl(
    isImage ? api.attachments.getDownloadUrl(attachment.id) : undefined,
    { forceFetch: useHeaderFetch, headers: thumbnailHeaders },
  );

  if (viewMode === 'grid') {
    return (
      <div
        className="relative group border rounded-lg overflow-hidden bg-card hover:border-primary transition-colors cursor-pointer"
        onClick={() => onView(attachment)}
        data-testid={`browser-card-${attachment.id}`}
      >
        <div className="aspect-square bg-muted flex items-center justify-center">
          {isImage && thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={attachment.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : isImage ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : (
            getFileIcon(attachment.content_type)
          )}
        </div>

        <div className="p-2">
          <p className="text-sm font-medium truncate">{attachment.filename}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {noteCount > 1 ? (
              <>
                <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground truncate">{noteCount} notes</p>
              </>
            ) : (
              <>
                <StickyNote className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground truncate">{attachment.note_title}</p>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(attachment.size_bytes)}</p>
        </div>

        {(attachment.has_exif || attachment.has_location) && (
          <div className="absolute top-2 left-2 flex gap-1">
            {attachment.has_location && (
              <Badge variant="secondary" className="text-xs px-1">
                <MapPin className="w-3 h-3" />
              </Badge>
            )}
            {attachment.has_exif && (
              <Badge variant="secondary" className="text-xs px-1">
                <Calendar className="w-3 h-3" />
              </Badge>
            )}
          </div>
        )}

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="secondary" size="icon" className="h-6 w-6">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(attachment); }}>
                <Eye className="w-4 h-4 mr-2" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(attachment); }}>
                <Download className="w-4 h-4 mr-2" /> Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(attachment); }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer"
      onClick={() => onView(attachment)}
      data-testid={`browser-row-${attachment.id}`}
    >
      <div className="flex-shrink-0">
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={attachment.filename}
            className="w-12 h-12 object-cover rounded"
            loading="lazy"
          />
        ) : isImage ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : (
          getFileIcon(attachment.content_type)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.filename}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate max-w-[200px]">{noteCount > 1 ? `${noteCount} notes` : attachment.note_title}</span>
          <span>·</span>
          <span>{formatFileSize(attachment.size_bytes)}</span>
          <span>·</span>
          <span>{new Date(attachment.created_at).toLocaleDateString()}</span>
          {attachment.has_location && <MapPin className="w-3 h-3" />}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="more">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(attachment); }}>
            <Eye className="w-4 h-4 mr-2" /> View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(attachment); }}>
            <Download className="w-4 h-4 mr-2" /> Download
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete(attachment); }}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Preview Content ──────────────────────────────────────────────────────

function PreviewLoader({ height }: { height: string }) {
  return (
    <div className={`flex items-center justify-center ${height} rounded border`}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function BrowserPreviewContent({
  attachment,
  metadata,
  objectUrl,
  textContent,
  onDownload,
}: {
  attachment: Attachment;
  metadata: AttachmentMetadata | null;
  objectUrl: string | null;
  textContent: string | null;
  onDownload: () => void;
}) {
  const mode: PreviewMode = getPreviewMode(attachment.content_type, attachment.filename);
  const player = useMediaPlayerOptional();

  const makePopOut = (mediaType: 'video' | 'audio') => {
    if (!player) return undefined;
    return () => {
      const info: MediaSessionInfo = {
        attachmentId: attachment.id,
        noteId: attachment.note_id,
        mediaType,
        filename: attachment.filename,
        directUrl: api.attachments.getDownloadUrl(attachment.id),
        posterUrl: getThumbnailUrl(attachment, api.attachments.getDownloadUrl, api.attachments.getThumbnailUrl),
        sizeBytes: attachment.size_bytes,
      };
      player.startSession(info);
    };
  };

  switch (mode) {
    case 'image':
      return objectUrl ? (
        <img src={objectUrl} alt={attachment.filename} className="max-h-[400px] mx-auto object-contain" data-testid="attachment-image-preview" />
      ) : (
        <PreviewLoader height="h-[300px]" />
      );

    case 'pdf':
      return objectUrl ? (
        <iframe
          src={`${objectUrl}#toolbar=1&navpanes=0&view=FitH`}
          title={`PDF preview: ${attachment.filename}`}
          className="w-full h-[70vh] border rounded"
          data-testid="attachment-pdf-preview"
        />
      ) : (
        <PreviewLoader height="h-[70vh]" />
      );

    case 'video': {
      const posterUrl = getThumbnailUrl(attachment, api.attachments.getDownloadUrl, api.attachments.getThumbnailUrl);
      const videoMeta = (metadata?.extracted_metadata ?? attachment.extracted_metadata) as Record<string, unknown> | null;
      const segments = videoMeta && Array.isArray(videoMeta.transcript_segments)
        ? videoMeta.transcript_segments as import('./subtitle-utils').TranscriptSegment[]
        : undefined;
      return (
        <StreamingVideoPlayer
          attachmentId={attachment.id}
          posterUrl={posterUrl}
          sizeBytes={attachment.size_bytes}
          transcriptSegments={segments}
          filename={attachment.filename}
          onPopOut={makePopOut('video')}
        />
      );
    }

    case 'audio': {
      const audioPosterUrl = getThumbnailUrl(attachment, api.attachments.getDownloadUrl, api.attachments.getThumbnailUrl);
      const audioMeta = (metadata?.extracted_metadata ?? attachment.extracted_metadata) as Record<string, unknown> | null;
      const audioSegments = audioMeta && Array.isArray(audioMeta.transcript_segments)
        ? audioMeta.transcript_segments as import('./subtitle-utils').TranscriptSegment[]
        : undefined;
      return (
        <StreamingAudioPlayer
          attachmentId={attachment.id}
          sizeBytes={attachment.size_bytes}
          posterUrl={audioPosterUrl}
          transcriptSegments={audioSegments}
          filename={attachment.filename}
          onPopOut={makePopOut('audio')}
        />
      );
    }

    case 'model':
      return objectUrl ? (
        <Suspense fallback={<PreviewLoader height="h-[400px]" />}>
          <ModelPreview url={objectUrl} filename={attachment.filename} contentType={attachment.content_type} />
        </Suspense>
      ) : (
        <PreviewLoader height="h-[400px]" />
      );

    case 'text':
      return textContent !== null ? (
        <div className="rounded-lg border overflow-hidden" data-testid="attachment-text-preview">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 text-xs text-muted-foreground">
            <FileCode className="w-3.5 h-3.5" />
            <span>{getLanguageFromType(attachment.content_type, attachment.filename)}</span>
            <span className="ml-auto">{textContent.split('\n').length} lines</span>
          </div>
          <pre className="text-xs font-mono p-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words bg-muted/20">
            {textContent}
          </pre>
        </div>
      ) : (
        <PreviewLoader height="h-[300px]" />
      );

    case 'office':
      return (
        <div className="rounded-lg border p-6 text-center space-y-3" data-testid="attachment-office-preview">
          <div className="flex justify-center">
            {attachment.content_type.includes('spreadsheet') || attachment.content_type.includes('excel') ? (
              <FileSpreadsheet className="w-12 h-12 text-green-600" />
            ) : attachment.content_type.includes('presentation') || attachment.content_type.includes('powerpoint') ? (
              <Presentation className="w-12 h-12 text-orange-600" />
            ) : (
              <FileText className="w-12 h-12 text-blue-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{getDocTypeLabel(attachment.content_type)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Inline preview not available for this format.
              {attachment.extracted_text ? ' See extracted content below.' : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="w-4 h-4 mr-2" /> Download to view
          </Button>
        </div>
      );

    default:
      return (
        <div className="rounded-lg border p-6 text-center space-y-3" data-testid="attachment-no-preview">
          <File className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Preview not available</p>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>
      );
  }
}

// ── Extracted data types & sections ─────────────────────────────────────

interface BrowserTranscriptSegment {
  start_secs: number;
  end_secs: number;
  text: string;
}

interface BrowserKeyframeDesc {
  frame_index: number;
  timestamp_secs: number;
  description: string;
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function BrowserExtractedTextSection({ text, strategy }: { text: string; strategy?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const label = strategy?.includes('audio') ? 'Transcript'
    : strategy?.includes('video') ? 'Transcript & Visual Content'
    : 'Extracted Text';

  return (
    <div className="rounded-lg border p-3" data-testid="extracted-text">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <FileText className="w-4 h-4 text-primary" />
        {label}
        <span className="text-xs text-muted-foreground font-normal ml-auto">
          {text.length.toLocaleString()} chars
        </span>
      </button>
      {isOpen && (
        <pre className="mt-2 text-sm whitespace-pre-wrap bg-muted/50 rounded p-3 max-h-60 overflow-y-auto font-mono text-xs">
          {text}
        </pre>
      )}
    </div>
  );
}

function BrowserTranscriptSegments({ segments }: { segments: BrowserTranscriptSegment[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border p-3" data-testid="transcript-segments">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Timed Segments
        <span className="text-xs text-muted-foreground font-normal ml-auto">{segments.length} segments</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-2 text-xs py-1 border-b border-muted/50 last:border-0">
              <span className="text-muted-foreground font-mono shrink-0 w-20">
                {fmtTime(seg.start_secs)} – {fmtTime(seg.end_secs)}
              </span>
              <span>{seg.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BrowserKeyframeDescriptions({ keyframes }: { keyframes: BrowserKeyframeDesc[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border p-3" data-testid="keyframe-descriptions">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Eye className="w-4 h-4 text-primary" />
        Scene Descriptions
        <span className="text-xs text-muted-foreground font-normal ml-auto">{keyframes.length} frames</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
          {keyframes.map((kf, i) => (
            <div key={i} className="text-xs py-2 border-b border-muted/50 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs px-1.5">
                  {fmtTime(kf.timestamp_secs)}
                </Badge>
                <span className="text-muted-foreground">Frame {kf.frame_index}</span>
              </div>
              <p className="text-sm leading-relaxed">{kf.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function AttachmentsBrowser({ className }: AttachmentsBrowserProps) {
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [typeFilter, setTypeFilter] = useState<ContentTypeFilter>('all');
  const [previewAttachment, setPreviewAttachment] = useState<NoteAttachment | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<AttachmentMetadata | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const abortRef = useRef(false);

  const revokePreviewObjectUrl = useCallback(() => {
    setPreviewObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => { revokePreviewObjectUrl(); };
  }, [revokePreviewObjectUrl]);

  // ── Data fetching ──────────────────────────────────────────────────

  const fetchAllAttachments = useCallback(async () => {
    abortRef.current = false;
    setIsLoading(true);
    setError(null);
    setScanProgress(null);
    setAttachments([]);

    try {
      // Try the global endpoint first (Fortemi/fortemi#489)
      const globalResponse = await api.client.get<{
        attachments: (Attachment & { note_title?: string })[];
        total: number;
      }>('/attachments', { limit: '500' });

      const enriched: NoteAttachment[] = globalResponse.attachments.map((att) => ({
        ...att,
        note_title: att.note_title || 'Unknown note',
      }));
      setAttachments(enriched);
      setIsLoading(false);
      return;
    } catch (err) {
      // Expected: 404 means global endpoint not implemented yet
      if (!(err instanceof ApiError && err.statusCode === 404)) {
        // Unexpected error from global endpoint - still try fallback
        console.warn('Global attachments endpoint failed, falling back to per-note scan:', err);
      }
    }

    // Fallback: fetch notes then query each for attachments
    try {
      const notes = await api.notes.list({ limit: 500, sortBy: 'created_at', sortOrder: 'desc' });
      if (notes.length === 0) {
        setAttachments([]);
        setIsLoading(false);
        return;
      }

      setScanProgress({ current: 0, total: notes.length });

      const noteTitleMap = new Map<string, string>();
      for (const note of notes) {
        noteTitleMap.set(note.id, note.title || 'Untitled');
      }

      const allAttachments: NoteAttachment[] = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < notes.length; i += BATCH_SIZE) {
        if (abortRef.current) break;

        const batch = notes.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((note) => api.attachments.listAttachments(note.id)),
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          if (result.status === 'fulfilled' && result.value.length > 0) {
            const noteId = batch[j].id;
            const noteTitle = noteTitleMap.get(noteId) || 'Untitled';
            for (const att of result.value) {
              allAttachments.push({ ...att, note_title: noteTitle });
            }
          }
        }

        setScanProgress({ current: Math.min(i + BATCH_SIZE, notes.length), total: notes.length });
        // Yield to UI between batches
        setAttachments([...allAttachments]);
      }

      setAttachments(allAttachments);
    } catch (err) {
      setError('Failed to load attachments');
      console.error('Failed to fetch attachments:', err);
    } finally {
      setIsLoading(false);
      setScanProgress(null);
    }
  }, []);

  useEffect(() => {
    void fetchAllAttachments();
    return () => { abortRef.current = true; };
  }, [fetchAllAttachments]);

  // ── Deduplication ─────────────────────────────────────────────────

  const attachmentGroups = useMemo(() => {
    const groups = new Map<string, NoteAttachment[]>();
    for (const att of attachments) {
      const key = getAttachmentDedupeKey(att);
      const group = groups.get(key) ?? [];
      group.push(att);
      groups.set(key, group);
    }
    return groups;
  }, [attachments]);

  const uniqueAttachments = useMemo(() => {
    const reps: NoteAttachment[] = [];
    for (const group of attachmentGroups.values()) {
      const rep = group.reduce((a, b) =>
        new Date(b.created_at).getTime() > new Date(a.created_at).getTime() ? b : a
      );
      reps.push(rep);
    }
    return reps;
  }, [attachmentGroups]);

  // ── Filtering & sorting ────────────────────────────────────────────

  const filteredAttachments = uniqueAttachments
    .filter((att) => {
      if (!matchesTypeFilter(att.content_type, typeFilter)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          att.filename.toLowerCase().includes(q) ||
          att.note_title.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortField) {
        case 'filename':
          return a.filename.localeCompare(b.filename);
        case 'size_bytes':
          return b.size_bytes - a.size_bytes;
        case 'note_title':
          return a.note_title.localeCompare(b.note_title);
        case 'created_at':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // ── Actions ────────────────────────────────────────────────────────

  const handleView = async (attachment: NoteAttachment) => {
    revokePreviewObjectUrl();
    setPreviewAttachment(attachment);
    setPreviewMetadata(null);
    setPreviewTextContent(null);
    const needsBlob = shouldDownloadBlob(attachment.content_type, attachment.filename);
    try {
      const [metadata, blob] = await Promise.all([
        api.attachments.getMetadata(attachment.id),
        needsBlob
          ? api.attachments.downloadAttachment(attachment.id)
          : Promise.resolve<Blob | null>(null),
      ]);
      setPreviewMetadata(metadata);
      if (blob) {
        const mode = getPreviewMode(attachment.content_type, attachment.filename);
        if (mode === 'text') {
          const text = await blob.text();
          setPreviewTextContent(text);
        }
        setPreviewObjectUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Failed to load attachment preview:', err);
    }
  };

  const handleDownload = useCallback(async (attachment: NoteAttachment) => {
    try {
      const savedToLocalFile = await api.attachments.downloadAttachmentToLocalFile(
        attachment.id,
        attachment.filename,
      );
      if (savedToLocalFile) return;

      const blob = await api.attachments.downloadAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, []);

  const handleDelete = useCallback(async (attachment: NoteAttachment) => {
    if (!confirm(`Delete "${attachment.filename}"?`)) return;
    try {
      await api.attachments.deleteAttachment(attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────

  const totalSize = uniqueAttachments.reduce((sum, a) => sum + a.size_bytes, 0);
  const imageCount = uniqueAttachments.filter((a) => a.content_type.startsWith('image/')).length;
  const videoCount = uniqueAttachments.filter((a) => a.content_type.startsWith('video/')).length;
  const audioCount = uniqueAttachments.filter((a) => a.content_type.startsWith('audio/')).length;
  const pdfCount = uniqueAttachments.filter((a) => a.content_type === 'application/pdf').length;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col h-full bg-background', className)} role="region" aria-label="All Attachments">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Paperclip className="size-5" />
        <h1 className="text-lg font-semibold">Attachments</h1>
        {!isLoading && (
          <Badge variant="secondary" className="ml-1">
            {filteredAttachments.length}
            {filteredAttachments.length !== uniqueAttachments.length && ` / ${uniqueAttachments.length}`}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchAllAttachments}
            disabled={isLoading}
            aria-label="refresh"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ContentTypeFilter)}>
          <SelectTrigger className="w-[120px] h-8">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="pdf">PDFs</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Newest first</SelectItem>
            <SelectItem value="filename">Name</SelectItem>
            <SelectItem value="size_bytes">Size</SelectItem>
            <SelectItem value="note_title">Note</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
            aria-label="grid view"
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
            aria-label="list view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {!isLoading && uniqueAttachments.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-1.5 text-xs text-muted-foreground border-b shrink-0">
          <span>{formatFileSize(totalSize)} total</span>
          {imageCount > 0 && <span>{imageCount} images</span>}
          {videoCount > 0 && <span>{videoCount} videos</span>}
          {audioCount > 0 && <span>{audioCount} audio</span>}
          {pdfCount > 0 && <span>{pdfCount} PDFs</span>}
          {uniqueAttachments.length - imageCount - videoCount - audioCount - pdfCount > 0 && (
            <span>{uniqueAttachments.length - imageCount - videoCount - audioCount - pdfCount} other</span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && !scanProgress ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading attachments...</p>
          </div>
        ) : isLoading && scanProgress ? (
          <div className="flex flex-col gap-4">
            {/* Show progress + partial results */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Scanning notes for attachments... {scanProgress.current} / {scanProgress.total}
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                  <div
                    className="bg-primary rounded-full h-1.5 transition-all"
                    style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium">{attachments.length} found</span>
            </div>

            {/* Show partial results while scanning */}
            {attachments.length > 0 && viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="attachment-grid">
                {filteredAttachments.map((att) => (
                  <BrowserCard
                    key={att.id}
                    attachment={att}
                    noteCount={attachmentGroups.get(getAttachmentDedupeKey(att))?.length ?? 1}
                    viewMode="grid"
                    onView={handleView}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : attachments.length > 0 ? (
              <div className="space-y-2" data-testid="attachment-list">
                {filteredAttachments.map((att) => (
                  <BrowserCard
                    key={att.id}
                    attachment={att}
                    noteCount={attachmentGroups.get(getAttachmentDedupeKey(att))?.length ?? 1}
                    viewMode="list"
                    onView={handleView}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAllAttachments} aria-label="retry">
              Retry
            </Button>
          </div>
        ) : filteredAttachments.length === 0 && uniqueAttachments.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Search className="w-10 h-10" />
            <p className="text-sm">No attachments match your filters</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : uniqueAttachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Paperclip className="w-10 h-10" />
            <p className="text-sm">No attachments found</p>
            <p className="text-xs">Upload files to notes to see them here</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="attachment-grid">
            {filteredAttachments.map((att) => (
              <BrowserCard
                key={att.id}
                attachment={att}
                noteCount={attachmentGroups.get(getAttachmentDedupeKey(att))?.length ?? 1}
                viewMode="grid"
                onView={handleView}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2" data-testid="attachment-list">
            {filteredAttachments.map((att) => (
              <BrowserCard
                key={att.id}
                attachment={att}
                noteCount={attachmentGroups.get(getAttachmentDedupeKey(att))?.length ?? 1}
                viewMode="list"
                onView={handleView}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
            setPreviewMetadata(null);
            setPreviewTextContent(null);
            revokePreviewObjectUrl();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewAttachment?.filename}
              {previewAttachment && <ExtractionStatusBadge status={getExtractionStatus(previewAttachment)} />}
            </DialogTitle>
            {previewAttachment && (
              <>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" />
                  {previewAttachment.note_title}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap" data-testid="file-info-bar">
                  <span>{formatFileSize(previewAttachment.size_bytes)}</span>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{previewAttachment.content_type}</span>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{new Date(previewAttachment.created_at).toLocaleDateString()}</span>
                  {previewAttachment.has_location && (
                    <>
                      <span className="text-muted-foreground/40">|</span>
                      <MapPin className="w-3 h-3" />
                    </>
                  )}
                </div>
              </>
            )}
          </DialogHeader>
          {previewAttachment && (() => {
            const extractionStatus = getExtractionStatus(previewAttachment);
            const showAiTab = browserHasAiContent(previewAttachment) || extractionStatus === 'pending' || extractionStatus === 'failed';
            const meta = (previewAttachment.extracted_metadata ?? {}) as Record<string, unknown>;
            const transcriptSegments = Array.isArray(meta.transcript_segments) ? meta.transcript_segments as BrowserTranscriptSegment[] : null;
            const keyframeDescs = Array.isArray(meta.keyframe_descriptions) ? meta.keyframe_descriptions as BrowserKeyframeDesc[] : null;

            const linkedNotes: LinkedNote[] = (
              attachmentGroups.get(getAttachmentDedupeKey(previewAttachment)) ?? [previewAttachment]
            ).map(att => ({
              noteId: att.note_id,
              noteTitle: att.note_title,
              attachmentId: att.id,
              createdAt: att.created_at,
            }));

            return (
              <Tabs defaultValue="preview" className="flex-1 min-h-0 flex flex-col">
                <TabsList className="w-full">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  {showAiTab && <TabsTrigger value="ai-content">AI Content</TabsTrigger>}
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="linked-notes">
                    Linked Notes
                    {linkedNotes.length > 1 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{linkedNotes.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="overflow-y-auto flex-1">
                  <div className="space-y-4 py-2">
                    <BrowserPreviewContent
                      attachment={previewAttachment}
                      metadata={previewMetadata}
                      objectUrl={previewObjectUrl}
                      textContent={previewTextContent}
                      onDownload={() => handleDownload(previewAttachment)}
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(previewAttachment)}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {showAiTab && (
                  <TabsContent value="ai-content" className="overflow-y-auto flex-1">
                    <div className="space-y-4 py-2">
                      {getExtractionStatus(previewAttachment) === 'pending' && (
                        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm" data-testid="extraction-pending">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-yellow-600" />
                            <span className="font-medium text-yellow-700 dark:text-yellow-400">Processing...</span>
                          </div>
                          <p className="text-muted-foreground mt-1">Content extraction is in progress.</p>
                        </div>
                      )}
                      {getExtractionStatus(previewAttachment) === 'failed' && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm" data-testid="extraction-failed">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-700 dark:text-red-400">Extraction Failed</span>
                          </div>
                          {meta && 'error' in meta && (
                            <p className="text-muted-foreground mt-1">{String(meta.error)}</p>
                          )}
                        </div>
                      )}

                      {previewAttachment.ai_description && (
                        <div className="rounded-lg border bg-muted/30 p-4" data-testid="ai-description">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">AI Description</span>
                            {previewAttachment.ai_model && (
                              <span className="text-xs text-muted-foreground ml-auto">by {previewAttachment.ai_model}</span>
                            )}
                          </div>
                          <p className="text-sm">{previewAttachment.ai_description}</p>
                        </div>
                      )}

                      {previewAttachment.extracted_text && (
                        <BrowserExtractedTextSection
                          text={previewAttachment.extracted_text}
                          strategy={previewAttachment.extraction_strategy}
                        />
                      )}

                      {transcriptSegments && <BrowserTranscriptSegments segments={transcriptSegments} />}
                      {keyframeDescs && <BrowserKeyframeDescriptions keyframes={keyframeDescs} />}
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="details" className="overflow-y-auto flex-1">
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Filename</p>
                        <p className="break-all">{previewAttachment.filename}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Size</p>
                        <p>{formatFileSize(previewAttachment.size_bytes)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p>{previewAttachment.content_type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <div className="flex items-center gap-1.5">
                          <ExtractionStatusBadge status={getExtractionStatus(previewAttachment)} />
                          <span className="capitalize">{previewAttachment.status || 'unknown'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p>{new Date(previewAttachment.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Note</p>
                        <p className="truncate">{previewAttachment.note_title}</p>
                      </div>
                      {previewAttachment.extraction_strategy && (
                        <div>
                          <p className="text-muted-foreground">Extraction</p>
                          <p>{previewAttachment.extraction_strategy}</p>
                        </div>
                      )}
                    </div>

                    {previewMetadata?.exif?.capture_time && (
                      <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                        <div>
                          <p className="text-muted-foreground">Captured</p>
                          <p>{new Date(previewMetadata.exif.capture_time).toLocaleString()}</p>
                        </div>
                        {previewMetadata.exif.camera_model && (
                          <div>
                            <p className="text-muted-foreground">Camera</p>
                            <p>{previewMetadata.exif.camera_make} {previewMetadata.exif.camera_model}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {previewMetadata?.provenance?.location && (
                      <div className="text-sm border-t pt-4">
                        <p className="text-muted-foreground">Location</p>
                        <p>
                          {previewMetadata.provenance.location.latitude.toFixed(6)},{' '}
                          {previewMetadata.provenance.location.longitude.toFixed(6)}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="linked-notes" className="overflow-y-auto flex-1">
                  <LinkedNotesTab
                    linkedNotes={linkedNotes}
                    currentNoteId={previewAttachment.note_id}
                  />
                </TabsContent>
              </Tabs>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
