/**
 * AttachmentsPanel Component
 * File attachment management with upload, preview, and metadata display
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { api } from '@/api';
import type { Attachment, AttachmentMetadata } from '@/api/types-extended';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function getAttachmentDownloadUrl(attachmentId: string): string {
  return `${apiBaseUrl}/api/v1/attachments/${attachmentId}/download`;
}

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
  if (contentType === 'application/pdf') {
    return <FileText className="w-8 h-8 text-red-500" />;
  }
  return <File className="w-8 h-8 text-gray-500" />;
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

  if (viewMode === 'grid') {
    return (
      <div
        className="relative group border rounded-lg overflow-hidden bg-card hover:border-primary transition-colors cursor-pointer"
        onClick={() => onView(attachment)}
        data-testid={`attachment-card-${attachment.id}`}
      >
        {/* Preview */}
        <div className="aspect-square bg-muted flex items-center justify-center">
          {isImage ? (
            <img
              src={getAttachmentDownloadUrl(attachment.id)}
              alt={attachment.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            getFileIcon(attachment.content_type)
          )}
        </div>

        {/* Info */}
        <div className="p-2">
          <p className="text-sm font-medium truncate">{attachment.filename}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size_bytes)}</p>
        </div>

        {/* Metadata badges */}
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
        {isImage ? (
          <img
            src={getAttachmentDownloadUrl(attachment.id)}
            alt={attachment.filename}
            className="w-12 h-12 object-cover rounded"
            loading="lazy"
          />
        ) : (
          getFileIcon(attachment.content_type)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.filename}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

export function AttachmentsPanel({ noteId, className }: AttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<AttachmentMetadata | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAttachments();
  }, [noteId]);

  const loadAttachments = async () => {
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
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

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
    setPreviewAttachment(attachment);
    try {
      const metadata = await api.attachments.getMetadata(attachment.id);
      setPreviewMetadata(metadata);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const handleDownload = useCallback(async (attachment: Attachment) => {
    try {
      const url = await api.attachments.getDownloadUrl(attachment.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      a.click();
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
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewAttachment?.filename}</DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            <div className="space-y-4">
              {/* Preview */}
              {previewAttachment.content_type.startsWith('image/') && (
                <img
                  src={getAttachmentDownloadUrl(previewAttachment.id)}
                  alt={previewAttachment.filename}
                  className="max-h-[400px] mx-auto object-contain"
                />
              )}

              {/* Metadata */}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
