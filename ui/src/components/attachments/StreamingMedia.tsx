/**
 * Streaming Media Components
 *
 * Video and audio players that fetch content via the API client
 * (which includes memory routing headers) and create blob URLs
 * for native playback. When Fortemi adds HTTP Range request support
 * (fortemi#493), these can switch to direct URL streaming.
 */

import { useState, useEffect } from 'react';
import { Music, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/api';

/**
 * Hook that downloads an attachment as a blob and creates an object URL.
 * Uses the API client (which includes routing headers) rather than
 * relying on the browser to fetch a direct URL.
 */
function useMediaBlobUrl(attachmentId: string): { url: string | null; error: string | null } {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let currentUrl: string | null = null;

    api.attachments
      .downloadAttachment(attachmentId)
      .then((blob) => {
        if (revoked) return;
        currentUrl = URL.createObjectURL(blob);
        setUrl(currentUrl);
      })
      .catch((err) => {
        if (revoked) return;
        console.error('Media download failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load media');
      });

    return () => {
      revoked = true;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [attachmentId]);

  return { url, error };
}

interface StreamingVideoPlayerProps {
  attachmentId: string;
  className?: string;
}

export function StreamingVideoPlayer({ attachmentId, className }: StreamingVideoPlayerProps) {
  const { url, error } = useMediaBlobUrl(attachmentId);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-[400px] rounded border text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load video</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-[400px] rounded border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <video
      src={url}
      controls
      preload="metadata"
      className={className ?? 'w-full max-h-[500px] rounded border bg-black'}
      data-testid="attachment-video-preview"
    >
      Your browser does not support video playback.
    </video>
  );
}

interface StreamingAudioPlayerProps {
  attachmentId: string;
  className?: string;
}

export function StreamingAudioPlayer({ attachmentId, className }: StreamingAudioPlayerProps) {
  const { url, error } = useMediaBlobUrl(attachmentId);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-[120px] rounded border text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load audio</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-[120px] rounded border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={className ?? 'flex flex-col items-center gap-4 py-8'} data-testid="attachment-audio-preview">
      <Music className="w-16 h-16 text-muted-foreground" />
      <audio src={url} controls preload="metadata" className="w-full max-w-md">
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}
