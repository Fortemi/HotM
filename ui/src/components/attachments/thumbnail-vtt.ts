/**
 * Thumbnail VTT Parser
 *
 * Parses WebVTT files that map timestamps to sprite sheet regions.
 * Used for YouTube/Netflix-style thumbnail preview on the video seek bar.
 *
 * VTT format expected:
 * ```
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:10.000
 * /api/v1/attachments/{id}/sprites/1.jpg#xywh=0,0,160,90
 * ```
 *
 * The `#xywh=x,y,w,h` media fragment specifies the pixel rectangle
 * within the sprite sheet image (per W3C Media Fragments URI spec).
 */

export interface ThumbnailCue {
  startTime: number;
  endTime: number;
  imageUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Parse a timestamp string to seconds.
 * Supports HH:MM:SS.mmm and MM:SS.mmm formats.
 */
function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    return m * 60 + s;
  }
  return parseFloat(parts[0]) || 0;
}

/**
 * Parse a WebVTT thumbnail file into an array of cues.
 *
 * Each cue maps a time range to a region within a sprite sheet image.
 * Lines that don't contain valid timestamp ranges or `#xywh=` fragments
 * are silently skipped.
 */
export function parseThumbnailVtt(vttText: string): ThumbnailCue[] {
  const cues: ThumbnailCue[] = [];
  const lines = vttText.split('\n');

  let i = 0;
  // Skip the WEBVTT header and any metadata
  while (i < lines.length) {
    if (lines[i].trim().includes('-->')) break;
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for timestamp line: "00:00:00.000 --> 00:00:10.000"
    const arrowIdx = line.indexOf('-->');
    if (arrowIdx === -1) {
      i++;
      continue;
    }

    const startStr = line.substring(0, arrowIdx).trim();
    const endStr = line.substring(arrowIdx + 3).trim();
    const startTime = parseTimestamp(startStr);
    const endTime = parseTimestamp(endStr);

    // Next non-empty line should be the image URL with fragment
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;

    if (i >= lines.length) break;

    const urlLine = lines[i].trim();
    i++;

    // Parse the #xywh= fragment
    const hashIdx = urlLine.indexOf('#xywh=');
    if (hashIdx === -1) continue;

    const imageUrl = urlLine.substring(0, hashIdx);
    const coords = urlLine.substring(hashIdx + 6);
    const [xStr, yStr, wStr, hStr] = coords.split(',');
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);
    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);

    if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) continue;

    cues.push({ startTime, endTime, imageUrl, x, y, w, h });
  }

  return cues;
}

/**
 * Find the cue that covers the given time.
 * Uses binary search for efficiency with large VTT files.
 */
export function getCueForTime(
  cues: ThumbnailCue[],
  time: number,
): ThumbnailCue | undefined {
  if (cues.length === 0) return undefined;

  // Binary search for the cue containing `time`
  let lo = 0;
  let hi = cues.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cue = cues[mid];

    if (time < cue.startTime) {
      hi = mid - 1;
    } else if (time >= cue.endTime) {
      lo = mid + 1;
    } else {
      return cue;
    }
  }

  // If no exact match, return the nearest cue
  if (lo < cues.length && time >= cues[lo].startTime) return cues[lo];
  if (hi >= 0 && time < cues[hi].endTime) return cues[hi];
  return undefined;
}
