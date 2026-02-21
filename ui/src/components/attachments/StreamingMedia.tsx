/**
 * Streaming Media Components
 *
 * Video and audio players that use direct API URLs for native browser
 * streaming with Range request support. The Fortemi download endpoint
 * returns Accept-Ranges: bytes, so the browser handles progressive
 * buffering and seeking natively.
 *
 * Falls back to blob download via the API client when direct URL
 * playback fails (e.g. when memory routing headers are required).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Music, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { getActiveMemory } from '@/api/memory-context';

interface StreamingVideoPlayerProps {
  attachmentId: string;
  className?: string;
}

export function StreamingVideoPlayer({ attachmentId, className }: StreamingVideoPlayerProps) {
  const [mode, setMode] = useState<'direct' | 'blob' | 'error'>('direct');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const directUrl = api.attachments.getDownloadUrl(attachmentId);

  // If a non-public memory is selected, skip direct URL and go straight to blob
  const activeMemory = getActiveMemory();
  const startWithBlob = !!activeMemory;

  useEffect(() => {
    if (startWithBlob) {
      setMode('blob');
    }
  }, [startWithBlob]);

  // Blob fallback: download via API client (includes routing headers)
  useEffect(() => {
    if (mode !== 'blob') return;
    let revoked = false;
    let currentUrl: string | null = null;

    api.attachments
      .downloadAttachment(attachmentId)
      .then((blob) => {
        if (revoked) return;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      })
      .catch((err) => {
        if (revoked) return;
        console.error('Video blob download failed:', err);
        setMode('error');
      });

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachmentId, mode]);

  const handleDirectError = useCallback(() => {
    // Direct URL failed — try blob fallback
    console.warn('Direct video URL failed, falling back to blob download');
    setMode('blob');
  }, []);

  const handleRetry = useCallback(() => {
    setBlobUrl(null);
    setMode(startWithBlob ? 'blob' : 'direct');
  }, [startWithBlob]);

  if (mode === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-[400px] rounded border bg-muted/20 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Failed to load video</p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (mode === 'blob' && !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-[400px] rounded border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading video...</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={mode === 'direct' ? directUrl : (blobUrl ?? undefined)}
      controls
      preload="metadata"
      className={className ?? 'w-full max-h-[500px] rounded border bg-black'}
      data-testid="attachment-video-preview"
      onError={mode === 'direct' ? handleDirectError : () => setMode('error')}
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
  const [mode, setMode] = useState<'direct' | 'blob' | 'error'>('direct');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const directUrl = api.attachments.getDownloadUrl(attachmentId);

  const activeMemory = getActiveMemory();
  const startWithBlob = !!activeMemory;

  useEffect(() => {
    if (startWithBlob) {
      setMode('blob');
    }
  }, [startWithBlob]);

  useEffect(() => {
    if (mode !== 'blob') return;
    let revoked = false;
    let currentUrl: string | null = null;

    api.attachments
      .downloadAttachment(attachmentId)
      .then((blob) => {
        if (revoked) return;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      })
      .catch((err) => {
        if (revoked) return;
        console.error('Audio blob download failed:', err);
        setMode('error');
      });

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachmentId, mode]);

  const handleDirectError = useCallback(() => {
    console.warn('Direct audio URL failed, falling back to blob download');
    setMode('blob');
  }, []);

  const handleRetry = useCallback(() => {
    setBlobUrl(null);
    setMode(startWithBlob ? 'blob' : 'direct');
  }, [startWithBlob]);

  if (mode === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-[120px] rounded border bg-muted/20 text-muted-foreground">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium">Failed to load audio</p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (mode === 'blob' && !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-[120px] rounded border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading audio...</p>
      </div>
    );
  }

  return (
    <div className={className ?? 'flex flex-col items-center gap-4 py-8'} data-testid="attachment-audio-preview">
      <Music className="w-16 h-16 text-muted-foreground" />
      <audio
        src={mode === 'direct' ? directUrl : (blobUrl ?? undefined)}
        controls
        preload="metadata"
        className="w-full max-w-md"
        onError={mode === 'direct' ? handleDirectError : () => setMode('error')}
      >
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}
