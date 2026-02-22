/**
 * Subtitle generation and format conversion utilities.
 *
 * Converts transcript segments from Fortemi's JSON format into
 * industry-standard subtitle formats (WebVTT, SRT) for use with
 * HTML5 <track> elements and external player software.
 *
 * Interim solution: generates VTT client-side from existing JSON data.
 * When fortemi#501 ships a server-side subtitle endpoint, the video player
 * can switch to using <track src="..."> directly from the API.
 */

/**
 * A transcript segment from Fortemi's extraction pipeline.
 * Stored in attachment.extracted_metadata.transcript_segments
 */
export interface TranscriptSegment {
  start_secs: number;
  end_secs: number;
  text: string;
  speaker_id?: string;
  words?: Array<{ word: string; start: number; end: number; confidence?: number }>;
}

/**
 * Format seconds as WebVTT timestamp: HH:MM:SS.mmm
 */
function formatVttTime(secs: number): string {
  const totalMs = Math.round(secs * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds as SRT timestamp: HH:MM:SS,mmm (comma separator)
 */
function formatSrtTime(secs: number): string {
  return formatVttTime(secs).replace('.', ',');
}

/**
 * Generate WebVTT content from transcript segments.
 *
 * When speaker_id is present, uses WebVTT <v> voice tags
 * for speaker attribution (per W3C WebVTT spec).
 */
export function segmentsToVtt(segments: TranscriptSegment[]): string {
  let out = 'WEBVTT\n\n';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const start = formatVttTime(seg.start_secs);
    const end = formatVttTime(seg.end_secs);
    const text = seg.speaker_id
      ? `<v ${seg.speaker_id}>${seg.text}</v>`
      : seg.text;

    out += `${i + 1}\n${start} --> ${end}\n${text}\n\n`;
  }

  return out;
}

/**
 * Generate SRT content from transcript segments.
 *
 * When speaker_id is present, prefixes text with [Speaker]: format
 * since SRT doesn't support voice tags.
 */
export function segmentsToSrt(segments: TranscriptSegment[]): string {
  let out = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const start = formatSrtTime(seg.start_secs);
    const end = formatSrtTime(seg.end_secs);
    const text = seg.speaker_id
      ? `[${seg.speaker_id}]: ${seg.text}`
      : seg.text;

    out += `${i + 1}\n${start} --> ${end}\n${text}\n\n`;
  }

  return out;
}

/**
 * Create a blob URL for a WebVTT track from transcript segments.
 * This is used as the `src` for an HTML5 <track> element.
 */
export function createVttBlobUrl(segments: TranscriptSegment[]): string {
  const vtt = segmentsToVtt(segments);
  const blob = new Blob([vtt], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

/**
 * Trigger a file download for subtitle content.
 */
export function downloadSubtitles(
  segments: TranscriptSegment[],
  format: 'vtt' | 'srt',
  filename: string,
): void {
  const content = format === 'vtt' ? segmentsToVtt(segments) : segmentsToSrt(segments);
  const mimeType = format === 'vtt' ? 'text/vtt' : 'application/x-subrip';
  const ext = format === 'vtt' ? '.vtt' : '.srt';

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, '') + ext;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse a VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) into seconds.
 */
function parseVttTimestamp(ts: string): number {
  const parts = ts.trim().split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 0;
}

/**
 * Parse WebVTT content into TranscriptSegment objects.
 * Used as a fallback when transcript_segments aren't embedded in metadata.
 */
export function parseVttToSegments(vttContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vttContent.split('\n');
  let i = 0;

  // Skip past WEBVTT header and any metadata blocks
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map((s) => s.trim());
      const start = parseVttTimestamp(startStr);
      const end = parseVttTimestamp(endStr);

      // Collect text lines until empty line or end of content
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      // Strip VTT voice tags <v Speaker>...</v> but extract speaker
      let text = textLines.join(' ');
      let speaker_id: string | undefined;
      const voiceMatch = text.match(/^<v\s+([^>]+)>(.*?)<\/v>$/);
      if (voiceMatch) {
        speaker_id = voiceMatch[1];
        text = voiceMatch[2];
      }
      // Also strip any remaining HTML-like tags
      text = text.replace(/<[^>]+>/g, '').trim();

      if (text) {
        segments.push({ start_secs: start, end_secs: end, text, speaker_id });
      }
    }
    i++;
  }

  return segments;
}

/**
 * Find the segment index that is active at the given playback time.
 * Returns -1 if no segment is active.
 */
export function findActiveSegmentIndex(
  segments: TranscriptSegment[],
  currentTime: number,
): number {
  for (let i = 0; i < segments.length; i++) {
    if (currentTime >= segments[i].start_secs && currentTime < segments[i].end_secs) {
      return i;
    }
  }
  return -1;
}

/**
 * Format a segment timestamp for display: M:SS
 */
export function formatSegmentTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
