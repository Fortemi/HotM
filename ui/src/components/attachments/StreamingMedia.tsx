/**
 * Streaming Media Components
 *
 * Video and audio players that use direct URLs for progressive playback.
 * In browser mode, the direct URL enables native buffering and seeking
 * (when the server supports HTTP Range requests).
 * In Tauri mode, useBlobUrl fetches via the HTTP plugin and returns a blob: URL.
 */

import { Music, Loader2 } from 'lucide-react';
import { useBlobUrl } from '@/lib/tauri';
import { api } from '@/api';

interface StreamingVideoPlayerProps {
  attachmentId: string;
  className?: string;
}

export function StreamingVideoPlayer({ attachmentId, className }: StreamingVideoPlayerProps) {
  const directUrl = api.attachments.getDownloadUrl(attachmentId);
  const streamUrl = useBlobUrl(directUrl);

  if (!streamUrl) {
    return (
      <div className="flex items-center justify-center h-[400px] rounded border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <video
      src={streamUrl}
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
  const directUrl = api.attachments.getDownloadUrl(attachmentId);
  const streamUrl = useBlobUrl(directUrl);

  if (!streamUrl) {
    return (
      <div className="flex items-center justify-center h-[120px] rounded border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={className ?? 'flex flex-col items-center gap-4 py-8'} data-testid="attachment-audio-preview">
      <Music className="w-16 h-16 text-muted-foreground" />
      <audio src={streamUrl} controls preload="metadata" className="w-full max-w-md">
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}
