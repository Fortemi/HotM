/**
 * Preview Utils Tests
 * Tests content type detection and preview mode resolution.
 */

import { describe, it, expect } from 'vitest';
import {
  getPreviewMode,
  shouldDownloadBlob,
  isStreamingPreview,
  isTextBasedType,
  isOfficeDocType,
  getDocTypeLabel,
  getLanguageFromType,
} from '../preview-utils';

describe('getPreviewMode', () => {
  it('should return image for image types', () => {
    expect(getPreviewMode('image/jpeg')).toBe('image');
    expect(getPreviewMode('image/png')).toBe('image');
    expect(getPreviewMode('image/gif')).toBe('image');
    expect(getPreviewMode('image/webp')).toBe('image');
    expect(getPreviewMode('image/svg+xml')).toBe('image');
  });

  it('should return pdf for application/pdf', () => {
    expect(getPreviewMode('application/pdf')).toBe('pdf');
  });

  it('should return video for video types', () => {
    expect(getPreviewMode('video/mp4')).toBe('video');
    expect(getPreviewMode('video/webm')).toBe('video');
    expect(getPreviewMode('video/ogg')).toBe('video');
  });

  it('should return audio for audio types', () => {
    expect(getPreviewMode('audio/mpeg')).toBe('audio');
    expect(getPreviewMode('audio/ogg')).toBe('audio');
    expect(getPreviewMode('audio/wav')).toBe('audio');
  });

  it('should return model for model/ types', () => {
    expect(getPreviewMode('model/gltf-binary')).toBe('model');
    expect(getPreviewMode('model/gltf+json')).toBe('model');
    expect(getPreviewMode('model/stl')).toBe('model');
  });

  it('should detect 3D formats from filename for octet-stream', () => {
    expect(getPreviewMode('application/octet-stream', 'model.glb')).toBe('model');
    expect(getPreviewMode('application/octet-stream', 'mesh.stl')).toBe('model');
    expect(getPreviewMode('application/octet-stream', 'scene.obj')).toBe('model');
    expect(getPreviewMode('application/octet-stream', 'animation.fbx')).toBe('model');
  });

  it('should return text for text-based types', () => {
    expect(getPreviewMode('text/plain')).toBe('text');
    expect(getPreviewMode('text/html')).toBe('text');
    expect(getPreviewMode('text/css')).toBe('text');
    expect(getPreviewMode('text/csv')).toBe('text');
    expect(getPreviewMode('text/markdown')).toBe('text');
    expect(getPreviewMode('application/json')).toBe('text');
    expect(getPreviewMode('application/xml')).toBe('text');
    expect(getPreviewMode('application/javascript')).toBe('text');
  });

  it('should return office for office document types', () => {
    expect(getPreviewMode('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('office');
    expect(getPreviewMode('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('office');
    expect(getPreviewMode('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('office');
    expect(getPreviewMode('application/msword')).toBe('office');
    expect(getPreviewMode('application/rtf')).toBe('office');
    expect(getPreviewMode('application/epub+zip')).toBe('office');
  });

  it('should return none for unknown types', () => {
    expect(getPreviewMode('application/octet-stream')).toBe('none');
    expect(getPreviewMode('application/zip')).toBe('none');
  });
});

describe('shouldDownloadBlob', () => {
  it('should return true for types that need blob pre-download', () => {
    expect(shouldDownloadBlob('image/jpeg')).toBe(true);
    expect(shouldDownloadBlob('text/plain')).toBe(true);
    expect(shouldDownloadBlob('model/gltf-binary')).toBe(true);
    expect(shouldDownloadBlob('application/pdf')).toBe(true);
  });

  it('should return false for streaming types (audio/video)', () => {
    expect(shouldDownloadBlob('video/mp4')).toBe(false);
    expect(shouldDownloadBlob('audio/mpeg')).toBe(false);
    expect(shouldDownloadBlob('video/webm')).toBe(false);
    expect(shouldDownloadBlob('audio/wav')).toBe(false);
  });

  it('should return false for office docs and unknown types', () => {
    expect(shouldDownloadBlob('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
    expect(shouldDownloadBlob('application/zip')).toBe(false);
  });
});

describe('isStreamingPreview', () => {
  it('should return true for audio and video', () => {
    expect(isStreamingPreview('video/mp4')).toBe(true);
    expect(isStreamingPreview('audio/mpeg')).toBe(true);
    expect(isStreamingPreview('video/webm')).toBe(true);
    expect(isStreamingPreview('audio/wav')).toBe(true);
  });

  it('should return false for non-streaming types', () => {
    expect(isStreamingPreview('image/jpeg')).toBe(false);
    expect(isStreamingPreview('application/pdf')).toBe(false);
    expect(isStreamingPreview('text/plain')).toBe(false);
    expect(isStreamingPreview('model/gltf-binary')).toBe(false);
  });
});

describe('isTextBasedType', () => {
  it('should identify text/* types', () => {
    expect(isTextBasedType('text/plain')).toBe(true);
    expect(isTextBasedType('text/html')).toBe(true);
    expect(isTextBasedType('text/csv')).toBe(true);
  });

  it('should identify application types that are text-like', () => {
    expect(isTextBasedType('application/json')).toBe(true);
    expect(isTextBasedType('application/xml')).toBe(true);
    expect(isTextBasedType('application/javascript')).toBe(true);
    expect(isTextBasedType('application/sql')).toBe(true);
  });

  it('should not identify binary types as text', () => {
    expect(isTextBasedType('image/png')).toBe(false);
    expect(isTextBasedType('application/pdf')).toBe(false);
  });
});

describe('isOfficeDocType', () => {
  it('should identify Office formats', () => {
    expect(isOfficeDocType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(isOfficeDocType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    expect(isOfficeDocType('application/msword')).toBe(true);
  });

  it('should identify OpenDocument formats', () => {
    expect(isOfficeDocType('application/vnd.oasis.opendocument.text')).toBe(true);
    expect(isOfficeDocType('application/vnd.oasis.opendocument.spreadsheet')).toBe(true);
  });

  it('should not identify non-office types', () => {
    expect(isOfficeDocType('application/pdf')).toBe(false);
    expect(isOfficeDocType('text/plain')).toBe(false);
  });
});

describe('getDocTypeLabel', () => {
  it('should return human-readable labels', () => {
    expect(getDocTypeLabel('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Word Document');
    expect(getDocTypeLabel('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('Excel Spreadsheet');
    expect(getDocTypeLabel('application/rtf')).toBe('Rich Text Format');
  });

  it('should fallback to content type for unknown types', () => {
    expect(getDocTypeLabel('application/unknown')).toBe('application/unknown');
  });
});

describe('getLanguageFromType', () => {
  it('should detect language from file extension', () => {
    expect(getLanguageFromType('application/octet-stream', 'script.py')).toBe('python');
    expect(getLanguageFromType('text/plain', 'main.rs')).toBe('rust');
    expect(getLanguageFromType('text/plain', 'config.yaml')).toBe('yaml');
  });

  it('should detect language from content type', () => {
    expect(getLanguageFromType('application/json')).toBe('json');
    expect(getLanguageFromType('text/html')).toBe('html');
    expect(getLanguageFromType('text/css')).toBe('css');
    expect(getLanguageFromType('text/csv')).toBe('csv');
  });

  it('should fallback to plaintext', () => {
    expect(getLanguageFromType('text/plain')).toBe('plaintext');
    expect(getLanguageFromType('application/octet-stream')).toBe('plaintext');
  });
});
