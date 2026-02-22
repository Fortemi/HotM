/**
 * Shared utilities for attachment preview rendering.
 * Determines what types can be previewed inline and how.
 */

export type PreviewMode =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'model'
  | 'text'
  | 'office'
  | 'archive'
  | 'email'
  | 'diagram'
  | 'none';

/**
 * Determine the best preview mode for a given content type.
 */
export function getPreviewMode(contentType: string, filename?: string): PreviewMode {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('model/')) return 'model';

  // Archive types
  if (isArchiveType(contentType)) return 'archive';
  // Email types
  if (isEmailType(contentType)) return 'email';
  // Diagram types
  if (isDiagramType(contentType, filename)) return 'diagram';

  // 3D formats that may arrive as application/octet-stream
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && ['glb', 'gltf', 'stl', 'obj', 'fbx', 'ply'].includes(ext)) {
      return 'model';
    }
    // Subtitle files that may arrive as application/octet-stream
    if (ext && ['srt', 'vtt', 'ass', 'ssa', 'sub'].includes(ext)) {
      return 'text';
    }
  }

  // Text-based types renderable in <pre>
  if (isTextBasedType(contentType)) return 'text';

  // Office documents — show extracted content + download
  if (isOfficeDocType(contentType)) return 'office';

  return 'none';
}

/**
 * Types that can be fetched as text and displayed in a monospace block.
 */
export function isTextBasedType(contentType: string): boolean {
  if (contentType.startsWith('text/')) return true;
  const textLikeTypes = [
    'application/json',
    'application/xml',
    'application/javascript',
    'application/typescript',
    'application/x-yaml',
    'application/yaml',
    'application/toml',
    'application/x-sh',
    'application/x-shellscript',
    'application/sql',
    'application/graphql',
    'application/x-subrip',       // .srt
    'text/vtt',                    // .vtt (WebVTT)
  ];
  return textLikeTypes.includes(contentType);
}

/**
 * Office document types that can't be rendered inline but may have
 * extracted content from the Fortemi pipeline.
 */
export function isOfficeDocType(contentType: string): boolean {
  const officeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/msword',           // .doc
    'application/vnd.ms-excel',     // .xls
    'application/vnd.ms-powerpoint', // .ppt
    'application/rtf',              // .rtf
    'application/epub+zip',         // .epub
    'application/vnd.oasis.opendocument.text',         // .odt
    'application/vnd.oasis.opendocument.spreadsheet',  // .ods
    'application/vnd.oasis.opendocument.presentation', // .odp
  ];
  return officeTypes.includes(contentType);
}

/**
 * Archive content types that Fortemi extracts file listings from.
 */
export function isArchiveType(contentType: string): boolean {
  const archiveTypes = [
    'application/zip',
    'application/x-tar',
    'application/gzip',
    'application/x-gzip',
    'application/x-7z-compressed',
    'application/x-rar-compressed',
    'application/x-bzip2',
    'application/x-xz',
  ];
  return archiveTypes.includes(contentType);
}

/**
 * Email content types that Fortemi extracts headers and body from.
 */
export function isEmailType(contentType: string): boolean {
  const emailTypes = [
    'message/rfc822',           // .eml
    'application/vnd.ms-outlook', // .msg
  ];
  return emailTypes.includes(contentType);
}

/**
 * Diagram content types that may have extracted SVG or metadata.
 */
export function isDiagramType(contentType: string, filename?: string): boolean {
  if (contentType === 'application/xml' || contentType === 'application/json') {
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext && ['drawio', 'excalidraw', 'mermaid'].includes(ext)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Whether the parent handleView should pre-download the blob.
 *
 * Audio and video are excluded — they use streaming URLs via useBlobUrl
 * in their own components, enabling progressive playback in browser mode
 * instead of waiting for the full file to download.
 */
export function shouldDownloadBlob(contentType: string, filename?: string): boolean {
  const mode = getPreviewMode(contentType, filename);
  // Audio/video handle their own URLs via useBlobUrl for streaming support.
  // Office, archive, email, diagram, and unknown types use extracted metadata instead of blobs.
  return mode !== 'office' && mode !== 'none' && mode !== 'audio' && mode !== 'video'
    && mode !== 'archive' && mode !== 'email' && mode !== 'diagram' && mode !== 'model';
}

/**
 * Whether a preview mode uses streaming via direct URL + useBlobUrl
 * instead of parent-provided blob URL.
 */
export function isStreamingPreview(contentType: string, filename?: string): boolean {
  const mode = getPreviewMode(contentType, filename);
  return mode === 'audio' || mode === 'video';
}

/**
 * Get a human-readable label for the document type.
 */
export function getDocTypeLabel(contentType: string): string {
  const labels: Record<string, string> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation',
    'application/msword': 'Word Document (Legacy)',
    'application/vnd.ms-excel': 'Excel Spreadsheet (Legacy)',
    'application/vnd.ms-powerpoint': 'PowerPoint (Legacy)',
    'application/rtf': 'Rich Text Format',
    'application/epub+zip': 'EPUB Book',
    'application/vnd.oasis.opendocument.text': 'OpenDocument Text',
    'application/vnd.oasis.opendocument.spreadsheet': 'OpenDocument Spreadsheet',
    'application/vnd.oasis.opendocument.presentation': 'OpenDocument Presentation',
  };
  return labels[contentType] || contentType;
}

/**
 * Infer a language hint from content type for syntax-highlighted display.
 */
export function getLanguageFromType(contentType: string, filename?: string): string {
  const ext = filename?.split('.').pop()?.toLowerCase();

  // Extension-based detection
  const extMap: Record<string, string> = {
    json: 'json',
    js: 'javascript',
    ts: 'typescript',
    jsx: 'jsx',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    cs: 'csharp',
    php: 'php',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    csv: 'csv',
    graphql: 'graphql',
    gql: 'graphql',
    srt: 'subrip',
    vtt: 'webvtt',
    ass: 'ass',
    ssa: 'ass',
  };
  if (ext && extMap[ext]) return extMap[ext];

  // MIME-based fallback
  if (contentType === 'application/json') return 'json';
  if (contentType === 'application/xml' || contentType === 'text/xml') return 'xml';
  if (contentType === 'application/javascript') return 'javascript';
  if (contentType === 'text/html') return 'html';
  if (contentType === 'text/css') return 'css';
  if (contentType === 'text/csv') return 'csv';
  if (contentType === 'text/markdown') return 'markdown';

  return 'plaintext';
}
