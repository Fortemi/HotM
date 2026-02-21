/**
 * AttachmentsPanel Component
 * File attachment management with upload, preview, and metadata display
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Upload,
  Grid,
  List,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Image as ImageIcon,
  FileText,
  File,
  MapPin,
  Calendar,
  Loader2,
  Sparkles,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileCode,
  Music,
  Video,
  Box,
  FileSpreadsheet,
  Presentation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { api } from '@/api';
import { realtimeEventBus } from '@/services/realtimeEventBus';
import { useBlobUrl } from '@/lib/tauri';
import type { Attachment, AttachmentMetadata, ExtractionStatus, AttachmentStatus } from '@/api/types-extended';
import { getPreviewMode, shouldDownloadBlob, getDocTypeLabel, getLanguageFromType } from './preview-utils';
import type { PreviewMode } from './preview-utils';
import { StreamingVideoPlayer, StreamingAudioPlayer } from './StreamingMedia';
import { getMediaType, extractMediaInfo, formatMediaDuration, getThumbnailUrl } from './media-utils';

const ModelPreview = lazy(() => import('./ModelPreview').then((m) => ({ default: m.ModelPreview })));

interface AttachmentsPanelProps {
  noteId: string;
  className?: string;
}

type ViewMode = 'grid' | 'list';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) {
    return <ImageIcon className="w-8 h-8 text-blue-500" />;
  }
  if (contentType.startsWith('model/')) {
    return <Box className="w-8 h-8 text-purple-500" />;
  }
  if (contentType.startsWith('audio/')) {
    return <Music className="w-8 h-8 text-green-500" />;
  }
  if (contentType.startsWith('video/')) {
    return <Video className="w-8 h-8 text-orange-500" />;
  }
  if (contentType === 'application/pdf') {
    return <FileText className="w-8 h-8 text-red-500" />;
  }
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv') {
    return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
  }
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) {
    return <Presentation className="w-8 h-8 text-orange-600" />;
  }
  if (contentType.includes('word') || contentType.includes('document') || contentType === 'application/rtf') {
    return <FileText className="w-8 h-8 text-blue-600" />;
  }
  if (contentType.startsWith('text/') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) {
    return <FileCode className="w-8 h-8 text-cyan-500" />;
  }
  return <File className="w-8 h-8 text-gray-500" />;
}

/**
 * Map API attachment status to UI extraction status.
 * Uses the authoritative `status` field from the API when available,
 * falling back to field-presence inference for older payloads.
 */
function getExtractionStatus(attachment: Attachment): ExtractionStatus {
  // Use authoritative API status when present
  if (attachment.status) {
    const statusMap: Record<AttachmentStatus, ExtractionStatus> = {
      completed: 'complete',
      failed: 'failed',
      processing: 'pending',
      uploaded: 'pending',
    };
    return statusMap[attachment.status] ?? 'pending';
  }

  // Fallback inference for older API payloads without status field
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

/** Get a short preview label for extracted content based on MIME type */
function getExtractionPreview(attachment: Attachment): string | null {
  if (attachment.ai_description) {
    return attachment.ai_description.length > 100
      ? attachment.ai_description.slice(0, 100) + '...'
      : attachment.ai_description;
  }
  if (attachment.extracted_text) {
    return attachment.extracted_text.length > 100
      ? attachment.extracted_text.slice(0, 100) + '...'
      : attachment.extracted_text;
  }
  return null;
}

interface AttachmentCardProps {
  attachment: Attachment;
  viewMode: ViewMode;
  onView: (att: Attachment) => void;
  onDownload: (att: Attachment) => void;
  onDelete: (att: Attachment) => void;
}

function AttachmentCard({ attachment, viewMode, onView, onDownload, onDelete }: AttachmentCardProps) {
  const isImage = attachment.content_type.startsWith('image/');
  const mediaType = getMediaType(attachment.content_type);
  const isMedia = mediaType === 'video' || mediaType === 'audio';
  const mediaInfo = isMedia ? extractMediaInfo(attachment) : null;
  // In Tauri, direct URLs can't be loaded as <img src> cross-origin.
  // useBlobUrl fetches via the HTTP plugin and returns a blob: URL.
  const thumbnailUrl = useBlobUrl(
    isImage ? api.attachments.getDownloadUrl(attachment.id) : undefined
  );
  const extractionStatus = getExtractionStatus(attachment);
  const extractionPreview = getExtractionPreview(attachment);

  if (viewMode === 'grid') {
    return (
      <div
        className="relative group border rounded-lg overflow-hidden bg-card hover:border-primary transition-colors cursor-pointer"
        onClick={() => onView(attachment)}
        data-testid={`attachment-card-${attachment.id}`}
      >
        {/* Preview */}
        <div className="relative aspect-square bg-muted flex items-center justify-center">
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

          {/* Media duration badge */}
          {isMedia && mediaInfo?.durationSecs != null && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
              {mediaType === 'video' ? '\u25B6' : '\u266B'} {formatMediaDuration(mediaInfo.durationSecs)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2">
          <p className="text-sm font-medium truncate">{attachment.filename}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size_bytes)}</p>
          {extractionPreview && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid="extraction-preview">
              {extractionPreview}
            </p>
          )}
        </div>

        {/* Metadata badges */}
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
          <ExtractionStatusBadge status={extractionStatus} />
        </div>

        {/* Actions */}
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
      data-testid={`attachment-row-${attachment.id}`}
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
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{attachment.filename}</p>
          <ExtractionStatusBadge status={extractionStatus} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(attachment.size_bytes)}</span>
          {isMedia && mediaInfo?.durationSecs != null && (
            <>
              <span>·</span>
              <span>{formatMediaDuration(mediaInfo.durationSecs)}</span>
            </>
          )}
          <span>·</span>
          <span>{new Date(attachment.created_at).toLocaleDateString()}</span>
          {attachment.has_location && <MapPin className="w-3 h-3" />}
        </div>
        {extractionPreview && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate" data-testid="extraction-preview">
            {extractionPreview}
          </p>
        )}
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

/**
 * Renders the appropriate inline preview for an attachment based on content type.
 */
function AttachmentPreviewContent({
  attachment,
  objectUrl,
  textContent,
  onDownload,
}: {
  attachment: Attachment;
  objectUrl: string | null;
  textContent: string | null;
  onDownload: () => void;
}) {
  const mode: PreviewMode = getPreviewMode(attachment.content_type, attachment.filename);

  switch (mode) {
    case 'image':
      return objectUrl ? (
        <img
          src={objectUrl}
          alt={attachment.filename}
          className="max-h-[400px] mx-auto object-contain"
          data-testid="attachment-image-preview"
        />
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
      const meta = attachment.extracted_metadata as Record<string, unknown> | null;
      const segments = meta && Array.isArray(meta.transcript_segments) ? meta.transcript_segments as import('./subtitle-utils').TranscriptSegment[] : undefined;
      const hasTranscript = segments && segments.length > 0;
      const subtitleUrl = hasTranscript ? api.attachments.getSubtitleUrl(attachment.id, 'vtt') : undefined;
      return (
        <StreamingVideoPlayer
          attachmentId={attachment.id}
          posterUrl={posterUrl}
          sizeBytes={attachment.size_bytes}
          transcriptSegments={segments}
          filename={attachment.filename}
          subtitleUrl={subtitleUrl}
        />
      );
    }

    case 'audio':
      return (
        <StreamingAudioPlayer
          attachmentId={attachment.id}
          sizeBytes={attachment.size_bytes}
        />
      );

    case 'model':
      return objectUrl ? (
        <Suspense fallback={<PreviewLoader height="h-[400px]" />}>
          <ModelPreview
            url={objectUrl}
            filename={attachment.filename}
            contentType={attachment.content_type}
          />
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

function PreviewLoader({ height }: { height: string }) {
  return (
    <div className={`flex items-center justify-center ${height} rounded border`}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

// ── Extracted data types ─────────────────────────────────────────────

interface TranscriptSegment {
  start_secs: number;
  end_secs: number;
  text: string;
}

interface KeyframeDescription {
  frame_index: number;
  timestamp_secs: number;
  description: string;
}

function formatTimestamp(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Extracted content display sections ──────────────────────────────

function ExtractedTextSection({ text, strategy }: { text: string; strategy?: string | null }) {
  const [isOpen, setIsOpen] = useState(true);
  const label = strategy?.includes('audio') ? 'Transcript'
    : strategy?.includes('video') ? 'Transcript & Visual Content'
    : 'Extracted Text';

  return (
    <div className="rounded-lg border p-4" data-testid="extracted-text">
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

function TranscriptSegmentsSection({ segments }: { segments: TranscriptSegment[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border p-3" data-testid="transcript-segments">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Clock className="w-4 h-4 text-primary" />
        Timed Segments
        <span className="text-xs text-muted-foreground font-normal ml-auto">{segments.length} segments</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-2 text-xs py-1 border-b border-muted/50 last:border-0">
              <span className="text-muted-foreground font-mono shrink-0 w-20">
                {formatTimestamp(seg.start_secs)} – {formatTimestamp(seg.end_secs)}
              </span>
              <span>{seg.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyframeDescriptionsSection({ keyframes }: { keyframes: KeyframeDescription[] }) {
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
                  {formatTimestamp(kf.timestamp_secs)}
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

function ExtractedMetadataSection({ metadata }: { metadata: Record<string, unknown> }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border p-3" data-testid="extracted-metadata">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Extraction Metadata
      </button>
      {isOpen && (
        <pre className="mt-2 text-xs bg-muted/50 rounded p-3 max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Tabbed preview dialog content ────────────────────────────────────

function hasAiContent(attachment: Attachment): boolean {
  if (attachment.ai_description) return true;
  if (attachment.extracted_text) return true;
  const meta = attachment.extracted_metadata;
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  if (Array.isArray(m.transcript_segments) && m.transcript_segments.length > 0) return true;
  if (Array.isArray(m.keyframe_descriptions) && m.keyframe_descriptions.length > 0) return true;
  return false;
}

function PreviewDialogTabs({
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
  const extractionStatus = getExtractionStatus(attachment);
  const showAiTab = hasAiContent(attachment) || extractionStatus === 'pending' || extractionStatus === 'failed';
  const meta = (attachment.extracted_metadata ?? {}) as Record<string, unknown>;
  const transcriptSegments = Array.isArray(meta.transcript_segments) ? meta.transcript_segments as TranscriptSegment[] : null;
  const keyframeDescs = Array.isArray(meta.keyframe_descriptions) ? meta.keyframe_descriptions as KeyframeDescription[] : null;

  return (
    <Tabs defaultValue="preview" className="flex-1 min-h-0 flex flex-col">
      <TabsList className="w-full">
        <TabsTrigger value="preview">Preview</TabsTrigger>
        {showAiTab && <TabsTrigger value="ai-content">AI Content</TabsTrigger>}
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>

      {/* Preview Tab */}
      <TabsContent value="preview" className="overflow-y-auto flex-1">
        <div className="space-y-4 py-2">
          <AttachmentPreviewContent
            attachment={attachment}
            objectUrl={objectUrl}
            textContent={textContent}
            onDownload={onDownload}
          />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          </div>
        </div>
      </TabsContent>

      {/* AI Content Tab */}
      {showAiTab && (
        <TabsContent value="ai-content" className="overflow-y-auto flex-1">
          <div className="space-y-4 py-2">
            {/* Extraction Pending/Failed States */}
            {getExtractionStatus(attachment) === 'pending' && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm" data-testid="extraction-pending">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-700 dark:text-yellow-400">Processing...</span>
                </div>
                <p className="text-muted-foreground mt-1">Content extraction is in progress. Results will appear here when complete.</p>
              </div>
            )}
            {getExtractionStatus(attachment) === 'failed' && (
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

            {/* AI Description */}
            {attachment.ai_description && (
              <div className="rounded-lg border bg-muted/30 p-4" data-testid="ai-description">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">AI Description</span>
                  {attachment.ai_model && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      by {attachment.ai_model}
                    </span>
                  )}
                </div>
                <p className="text-sm">{attachment.ai_description}</p>
              </div>
            )}

            {/* Extracted Text / Transcript */}
            {attachment.extracted_text && (
              <ExtractedTextSection
                text={attachment.extracted_text}
                strategy={attachment.extraction_strategy}
              />
            )}

            {/* Transcript Segments (timed) */}
            {transcriptSegments && <TranscriptSegmentsSection segments={transcriptSegments} />}

            {/* Keyframe / Scene Descriptions */}
            {keyframeDescs && <KeyframeDescriptionsSection keyframes={keyframeDescs} />}
          </div>
        </TabsContent>
      )}

      {/* Details Tab */}
      <TabsContent value="details" className="overflow-y-auto flex-1">
        <div className="space-y-4 py-2">
          {/* Core file info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Filename</p>
              <p className="break-all">{attachment.filename}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Size</p>
              <p>{formatFileSize(attachment.size_bytes)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p>{attachment.content_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <div className="flex items-center gap-1.5">
                <ExtractionStatusBadge status={getExtractionStatus(attachment)} />
                <span className="capitalize">{attachment.status || 'unknown'}</span>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{new Date(attachment.created_at).toLocaleString()}</p>
            </div>
            {attachment.extraction_strategy && (
              <div>
                <p className="text-muted-foreground">Extraction</p>
                <p>{attachment.extraction_strategy}</p>
              </div>
            )}
          </div>

          {/* EXIF / Provenance from metadata */}
          {metadata?.exif?.capture_time && (
            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
              <div>
                <p className="text-muted-foreground">Captured</p>
                <p>{new Date(metadata.exif.capture_time).toLocaleString()}</p>
              </div>
              {metadata.exif.camera_model && (
                <div>
                  <p className="text-muted-foreground">Camera</p>
                  <p>{metadata.exif.camera_make} {metadata.exif.camera_model}</p>
                </div>
              )}
            </div>
          )}

          {metadata?.provenance?.location && (
            <div className="text-sm border-t pt-4">
              <p className="text-muted-foreground">Location</p>
              <p>
                {metadata.provenance.location.latitude.toFixed(6)},{' '}
                {metadata.provenance.location.longitude.toFixed(6)}
              </p>
            </div>
          )}

          {/* Raw Extraction Metadata */}
          {attachment.extracted_metadata &&
            typeof attachment.extracted_metadata === 'object' &&
            !('error' in attachment.extracted_metadata) &&
            Object.keys(attachment.extracted_metadata).length > 0 && (
            <ExtractedMetadataSection metadata={attachment.extracted_metadata} />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function AttachmentsPanel({ noteId, className }: AttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<AttachmentMetadata | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const revokePreviewObjectUrl = useCallback(() => {
    setPreviewObjectUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      revokePreviewObjectUrl();
    };
  }, [revokePreviewObjectUrl]);

  const loadAttachments = useCallback(async () => {
    if (!noteId || noteId.trim() === '') {
      setAttachments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.attachments.listAttachments(noteId);
      setAttachments(data);
    } catch (err) {
      setError('Failed to load attachments');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  useEffect(() => {
    const unsubscribe = realtimeEventBus.subscribe((event) => {
      if (!noteId) {
        return;
      }
      const isSameNote = !event.note_id || event.note_id === noteId;
      if (!isSameNote) {
        return;
      }
      if (event.type === 'AttachmentUpdated' || event.type === 'NoteUpdated') {
        void loadAttachments();
      }
      if (event.type === 'NoteDeleted' && event.note_id === noteId) {
        setAttachments([]);
      }
    });
    return () => unsubscribe();
  }, [loadAttachments, noteId]);

  // When the attachment list refreshes and the preview is open, update preview data
  // if the attachment's status has changed (e.g. processing → completed)
  useEffect(() => {
    if (!previewAttachment) return;
    const fresh = attachments.find((a) => a.id === previewAttachment.id);
    if (!fresh || fresh.status === previewAttachment.status) return;
    // Status changed — update the preview attachment and re-fetch full detail
    setPreviewAttachment(fresh);
    if (fresh.status === 'completed') {
      // Re-fetch metadata to get extracted_text, ai_description, etc.
      api.attachments.getMetadata(fresh.id).then(setPreviewMetadata).catch(console.error);
    }
  }, [attachments, previewAttachment]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!noteId || noteId.trim() === '') {
      setError('Select a note before uploading attachments');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await api.attachments.uploadAttachment(noteId, file);
        setUploadProgress(((i + 1) / files.length) * 100);
      }
      await loadAttachments();
    } catch (err) {
      setError('Upload failed');
      console.error(err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleView = async (attachment: Attachment) => {
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
      console.error('Failed to load metadata:', err);
    }
  };

  const handleDownload = useCallback(async (attachment: Attachment) => {
    try {
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

  const handleDelete = useCallback(async (attachment: Attachment) => {
    if (!confirm(`Delete "${attachment.filename}"?`)) return;
    try {
      await api.attachments.deleteAttachment(attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      setError('Delete failed');
      console.error(err);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div
      className={cn('flex flex-col', className)}
      role="region"
      aria-label="Attachments"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Attachments</h3>
          <Badge variant="secondary">({attachments.length})</Badge>
        </div>
        <div className="flex items-center gap-1">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="more">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Download className="w-4 h-4 mr-2" /> Download All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        className={cn(
          'mx-4 mt-4 border-2 border-dashed rounded-lg p-4 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          isUploading && 'pointer-events-none opacity-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        {isUploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading... {Math.round(uploadProgress)}%</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop files here or{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>
            </p>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : !noteId || noteId.trim() === '' ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Select a note to view attachments</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={loadAttachments} className="mt-2" aria-label="retry">
              Retry
            </Button>
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No attachments yet</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3" data-testid="attachment-grid">
            {attachments.map((att) => (
              <AttachmentCard
                key={att.id}
                attachment={att}
                viewMode="grid"
                onView={handleView}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2" data-testid="attachment-list">
            {attachments.map((att) => (
              <AttachmentCard
                key={att.id}
                attachment={att}
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
            {/* File info bar — always visible */}
            {previewAttachment && (
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
            )}
          </DialogHeader>
          {previewAttachment && (
            <PreviewDialogTabs
              attachment={previewAttachment}
              metadata={previewMetadata}
              objectUrl={previewObjectUrl}
              textContent={previewTextContent}
              onDownload={() => handleDownload(previewAttachment)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
