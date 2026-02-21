/**
 * Media utilities for attachment type detection, metadata extraction,
 * and thumbnail/badge rendering helpers.
 */

import type { Attachment } from '@/api/types-extended';

/**
 * Media type classification for an attachment
 */
export type MediaType = 'video' | 'audio' | 'image' | 'document' | 'other';

/**
 * Extracted media metadata from attachment's extracted_metadata field
 */
export interface MediaInfo {
  durationSecs?: number;
  width?: number;
  height?: number;
  codec?: string;
  frameRate?: number;
  audioCodec?: string;
  audioSampleRate?: number;
  bitrateKbps?: number;
  hasTranscript: boolean;
  hasThumbnail: boolean;
  hasPreview: boolean;
  thumbnailAttachmentId?: string;
}

/**
 * Classify an attachment's media type from its content_type
 */
export function getMediaType(contentType: string): MediaType {
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('image/')) return 'image';
  if (
    contentType === 'application/pdf' ||
    contentType.includes('document') ||
    contentType.includes('spreadsheet') ||
    contentType.includes('presentation') ||
    contentType.startsWith('text/')
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Check if an attachment is a media type (video or audio)
 */
export function isMediaAttachment(attachment: Attachment): boolean {
  const type = getMediaType(attachment.content_type);
  return type === 'video' || type === 'audio';
}

/**
 * Extract media metadata from an attachment's extracted_metadata field.
 * The Fortemi extraction pipeline stores duration, dimensions, transcript
 * segments, and keyframe descriptions in this field.
 */
export function extractMediaInfo(attachment: Attachment): MediaInfo {
  const meta = attachment.extracted_metadata;
  if (!meta || typeof meta !== 'object') {
    return {
      hasTranscript: false,
      hasThumbnail: false,
      hasPreview: !!attachment.has_preview,
    };
  }

  // media_info sub-object from newer Fortemi versions
  const mediaInfoObj = meta.media_info as Record<string, unknown> | undefined;

  // Duration may come from various fields depending on extraction strategy
  const durationSecs =
    (meta.duration_secs as number | undefined) ??
    (meta.duration as number | undefined) ??
    undefined;

  // Dimensions: prefer media_info sub-object, fall back to top-level
  const width = (mediaInfoObj?.width as number | undefined) ?? (meta.width as number | undefined);
  const height = (mediaInfoObj?.height as number | undefined) ?? (meta.height as number | undefined);
  const codec = (mediaInfoObj?.codec as string | undefined) ?? (meta.codec as string | undefined);

  // New media_info fields
  const frameRate = mediaInfoObj?.frame_rate as number | undefined;
  const audioCodec = mediaInfoObj?.audio_codec as string | undefined;
  const audioSampleRate = mediaInfoObj?.audio_sample_rate as number | undefined;
  const bitrateKbps = mediaInfoObj?.bitrate_kbps as number | undefined;

  // Transcript availability
  const transcriptSegments = meta.transcript_segments as unknown[] | undefined;
  const hasTranscript = Array.isArray(transcriptSegments) && transcriptSegments.length > 0;

  // Thumbnail availability (legacy: thumbnail_attachment_id in metadata)
  const thumbnailAttachmentId = meta.thumbnail_attachment_id as string | undefined;
  const hasThumbnail = !!thumbnailAttachmentId;

  // Dedicated preview flag from attachment object
  const hasPreview = !!attachment.has_preview;

  return {
    durationSecs,
    width,
    height,
    codec,
    frameRate,
    audioCodec,
    audioSampleRate,
    bitrateKbps,
    hasTranscript,
    hasThumbnail,
    hasPreview,
    thumbnailAttachmentId,
  };
}

/**
 * Format duration in seconds to a human-readable string.
 * - Under 1 hour: "M:SS" (e.g. "2:05")
 * - 1 hour+: "H:MM:SS" (e.g. "1:01:01")
 */
export function formatMediaDuration(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Build a thumbnail URL for an attachment if one is available.
 *
 * Priority:
 * 1. Dedicated thumbnail endpoint (has_preview + getCanonicalThumbnailUrl)
 * 2. Legacy thumbnail attachment (thumbnailAttachmentId via download URL)
 * 3. undefined (no thumbnail)
 */
export function getThumbnailUrl(
  attachment: Attachment,
  getDownloadUrl: (id: string) => string,
  getCanonicalThumbnailUrl?: (id: string) => string,
): string | undefined {
  const info = extractMediaInfo(attachment);

  // Prefer dedicated thumbnail endpoint when available
  if (info.hasPreview && getCanonicalThumbnailUrl) {
    return getCanonicalThumbnailUrl(attachment.id);
  }

  // Legacy path: thumbnail stored as separate attachment
  if (info.thumbnailAttachmentId) {
    return getDownloadUrl(info.thumbnailAttachmentId);
  }

  return undefined;
}
