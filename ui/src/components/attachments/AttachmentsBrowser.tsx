/**
 * AttachmentsBrowser Component
 * Global attachment browser showing all attachments across all notes.
 * Tries GET /api/v1/attachments first; falls back to per-note fetching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/api';
import { ApiError } from '@/api';
import { useBlobUrl } from '@/lib/tauri';
import type { Attachment, AttachmentMetadata } from '@/api/types-extended';

// ── Types ──────────────────────────────────────────────────────────────

/** Attachment enriched with parent note context */
interface NoteAttachment extends Attachment {
  note_title: string;
}

type ViewMode = 'grid' | 'list';
type SortField = 'created_at' | 'filename' | 'size_bytes' | 'note_title';
type ContentTypeFilter = 'all' | 'image' | 'pdf' | 'other';

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
  if (contentType.startsWith('image/')) {
    return <ImageIcon className="w-8 h-8 text-blue-500" />;
  }
  if (contentType === 'application/pdf') {
    return <FileText className="w-8 h-8 text-red-500" />;
  }
  return <File className="w-8 h-8 text-gray-500" />;
}

function matchesTypeFilter(contentType: string, filter: ContentTypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'image') return contentType.startsWith('image/');
  if (filter === 'pdf') return contentType === 'application/pdf';
  return !contentType.startsWith('image/') && contentType !== 'application/pdf';
}

// ── Attachment Card ────────────────────────────────────────────────────

interface BrowserCardProps {
  attachment: NoteAttachment;
  viewMode: ViewMode;
  onView: (att: NoteAttachment) => void;
  onDownload: (att: NoteAttachment) => void;
  onDelete: (att: NoteAttachment) => void;
}

function BrowserCard({ attachment, viewMode, onView, onDownload, onDelete }: BrowserCardProps) {
  const isImage = attachment.content_type.startsWith('image/');
  const thumbnailUrl = useBlobUrl(
    isImage ? api.attachments.getDownloadUrl(attachment.id) : undefined,
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
            <StickyNote className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{attachment.note_title}</p>
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
          <span className="truncate max-w-[200px]">{attachment.note_title}</span>
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
      }>('/api/v1/attachments', { limit: '500' });

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

  // ── Filtering & sorting ────────────────────────────────────────────

  const filteredAttachments = attachments
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
    try {
      const [metadata, blob] = await Promise.all([
        api.attachments.getMetadata(attachment.id),
        (attachment.content_type.startsWith('image/') || attachment.content_type === 'application/pdf')
          ? api.attachments.downloadAttachment(attachment.id)
          : Promise.resolve<Blob | null>(null),
      ]);
      setPreviewMetadata(metadata);
      if (blob) {
        setPreviewObjectUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Failed to load attachment preview:', err);
    }
  };

  const handleDownload = useCallback(async (attachment: NoteAttachment) => {
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

  const totalSize = attachments.reduce((sum, a) => sum + a.size_bytes, 0);
  const imageCount = attachments.filter((a) => a.content_type.startsWith('image/')).length;
  const pdfCount = attachments.filter((a) => a.content_type === 'application/pdf').length;

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
            {filteredAttachments.length !== attachments.length && ` / ${attachments.length}`}
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
            <SelectItem value="pdf">PDFs</SelectItem>
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
      {!isLoading && attachments.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-1.5 text-xs text-muted-foreground border-b shrink-0">
          <span>{formatFileSize(totalSize)} total</span>
          {imageCount > 0 && <span>{imageCount} images</span>}
          {pdfCount > 0 && <span>{pdfCount} PDFs</span>}
          {attachments.length - imageCount - pdfCount > 0 && (
            <span>{attachments.length - imageCount - pdfCount} other</span>
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
        ) : filteredAttachments.length === 0 && attachments.length > 0 ? (
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
        ) : attachments.length === 0 ? (
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
            revokePreviewObjectUrl();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewAttachment?.filename}</DialogTitle>
            {previewAttachment && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" />
                {previewAttachment.note_title}
              </p>
            )}
          </DialogHeader>
          {previewAttachment && (
            <div className="space-y-4">
              {previewAttachment.content_type.startsWith('image/') && (
                previewObjectUrl ? (
                  <img
                    src={previewObjectUrl}
                    alt={previewAttachment.filename}
                    className="max-h-[400px] mx-auto object-contain"
                  />
                ) : (
                  <div className="flex h-[300px] items-center justify-center rounded border">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )
              )}
              {previewAttachment.content_type === 'application/pdf' && (
                previewObjectUrl ? (
                  <iframe
                    src={`${previewObjectUrl}#toolbar=1&navpanes=0&view=FitH`}
                    title={`PDF preview: ${previewAttachment.filename}`}
                    className="w-full h-[70vh] border rounded"
                    data-testid="attachment-pdf-preview"
                  />
                ) : (
                  <div className="flex h-[70vh] items-center justify-center rounded border">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )
              )}

              {previewMetadata && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Size</p>
                    <p>{formatFileSize(previewMetadata.size_bytes)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p>{previewMetadata.content_type}</p>
                  </div>
                  {previewMetadata.exif?.capture_time && (
                    <div>
                      <p className="text-muted-foreground">Captured</p>
                      <p>{new Date(previewMetadata.exif.capture_time).toLocaleString()}</p>
                    </div>
                  )}
                  {previewMetadata.exif?.camera_model && (
                    <div>
                      <p className="text-muted-foreground">Camera</p>
                      <p>{previewMetadata.exif.camera_make} {previewMetadata.exif.camera_model}</p>
                    </div>
                  )}
                  {previewMetadata.provenance?.location && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Location</p>
                      <p>
                        {previewMetadata.provenance.location.latitude.toFixed(6)},{' '}
                        {previewMetadata.provenance.location.longitude.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(previewAttachment)}
                >
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
