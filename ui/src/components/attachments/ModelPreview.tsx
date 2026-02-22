/**
 * ModelPreview Component
 * 3D model viewer using Google's <model-viewer> web component.
 * Supports glTF/GLB with automatic Draco, meshopt, and KTX2 decoding.
 * Non-glTF formats show a download fallback.
 *
 * This component should be lazy-loaded to avoid bundling model-viewer
 * for users who don't have 3D attachments.
 */

import { useState, useEffect, useRef } from 'react';
import '@google/model-viewer';

type ModelFormat = 'gltf' | 'stl' | 'obj' | 'fbx' | 'ply' | 'unknown';

function detectFormat(filename: string, contentType: string): ModelFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf' || contentType === 'model/gltf-binary' || contentType === 'model/gltf+json') {
    return 'gltf';
  }
  if (ext === 'stl' || contentType === 'model/stl') return 'stl';
  if (ext === 'obj' || contentType === 'model/obj') return 'obj';
  if (ext === 'fbx') return 'fbx';
  if (ext === 'ply') return 'ply';
  return 'unknown';
}

interface ModelPreviewProps {
  url: string;
  filename: string;
  contentType: string;
  className?: string;
}

export function ModelPreview({ url, filename, contentType, className }: ModelPreviewProps) {
  const format = detectFormat(filename, contentType);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    const onError = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setError(detail?.message || 'Failed to load 3D model');
    };

    el.addEventListener('error', onError);
    return () => el.removeEventListener('error', onError);
  }, []);

  if (format === 'unknown') {
    return (
      <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg text-muted-foreground text-sm">
        Unsupported 3D format
      </div>
    );
  }

  // Non-glTF formats: model-viewer only supports glTF/GLB
  if (format !== 'gltf') {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-muted rounded-lg text-muted-foreground gap-3" data-testid="model-preview">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <p className="text-sm font-medium">{filename}</p>
        <p className="text-xs text-center max-w-xs">
          Inline preview is available for glTF/GLB files.
          Download this {format.toUpperCase()} file to view in a 3D application.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-[400px] bg-muted rounded-lg text-muted-foreground" data-testid="model-preview">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p className="text-sm font-medium">Failed to load 3D model</p>
        <p className="text-xs max-w-xs text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className={className ?? 'relative h-[400px] w-full rounded-lg overflow-hidden border bg-background'} data-testid="model-preview">
      <model-viewer
        ref={viewerRef}
        src={url}
        alt={`3D model: ${filename}`}
        camera-controls
        auto-rotate
        shadow-intensity="1"
        tone-mapping="neutral"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        Drag to rotate &middot; Scroll to zoom
      </div>
    </div>
  );
}
