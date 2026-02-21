/**
 * Subtitle utility tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  segmentsToVtt,
  segmentsToSrt,
  createVttBlobUrl,
  downloadSubtitles,
  findActiveSegmentIndex,
  formatSegmentTime,
} from '../subtitle-utils';
import type { TranscriptSegment } from '../subtitle-utils';

// jsdom does not implement URL.createObjectURL/revokeObjectURL
let blobCounter = 0;
beforeEach(() => {
  blobCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++blobCounter}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const sampleSegments: TranscriptSegment[] = [
  { start_secs: 0, end_secs: 5.5, text: 'Hello world' },
  { start_secs: 5.5, end_secs: 12, text: 'Second segment' },
  { start_secs: 12, end_secs: 20.123, text: 'Third segment' },
];

const speakerSegments: TranscriptSegment[] = [
  { start_secs: 0, end_secs: 4, text: 'Good morning', speaker_id: 'Alice' },
  { start_secs: 4, end_secs: 8, text: 'Hello Alice', speaker_id: 'Bob' },
];

describe('segmentsToVtt', () => {
  it('generates valid WebVTT header', () => {
    const vtt = segmentsToVtt(sampleSegments);
    expect(vtt).toMatch(/^WEBVTT\n\n/);
  });

  it('formats timestamps as HH:MM:SS.mmm', () => {
    const vtt = segmentsToVtt(sampleSegments);
    expect(vtt).toContain('00:00:00.000 --> 00:00:05.500');
    expect(vtt).toContain('00:00:05.500 --> 00:00:12.000');
    expect(vtt).toContain('00:00:12.000 --> 00:00:20.123');
  });

  it('includes cue numbers', () => {
    const vtt = segmentsToVtt(sampleSegments);
    expect(vtt).toContain('\n1\n');
    expect(vtt).toContain('\n2\n');
    expect(vtt).toContain('\n3\n');
  });

  it('includes segment text', () => {
    const vtt = segmentsToVtt(sampleSegments);
    expect(vtt).toContain('Hello world');
    expect(vtt).toContain('Second segment');
    expect(vtt).toContain('Third segment');
  });

  it('uses <v> voice tags for speaker_id', () => {
    const vtt = segmentsToVtt(speakerSegments);
    expect(vtt).toContain('<v Alice>Good morning</v>');
    expect(vtt).toContain('<v Bob>Hello Alice</v>');
  });

  it('handles empty segments array', () => {
    const vtt = segmentsToVtt([]);
    expect(vtt).toBe('WEBVTT\n\n');
  });

  it('handles hour-long timestamps', () => {
    const segments: TranscriptSegment[] = [
      { start_secs: 3661.5, end_secs: 3670, text: 'Over an hour in' },
    ];
    const vtt = segmentsToVtt(segments);
    expect(vtt).toContain('01:01:01.500 --> 01:01:10.000');
  });
});

describe('segmentsToSrt', () => {
  it('does not include WEBVTT header', () => {
    const srt = segmentsToSrt(sampleSegments);
    expect(srt).not.toContain('WEBVTT');
  });

  it('uses comma as millisecond separator', () => {
    const srt = segmentsToSrt(sampleSegments);
    expect(srt).toContain('00:00:00,000 --> 00:00:05,500');
  });

  it('includes cue numbers', () => {
    const srt = segmentsToSrt(sampleSegments);
    expect(srt.startsWith('1\n')).toBe(true);
  });

  it('prefixes speaker_id with bracket notation', () => {
    const srt = segmentsToSrt(speakerSegments);
    expect(srt).toContain('[Alice]: Good morning');
    expect(srt).toContain('[Bob]: Hello Alice');
  });

  it('handles empty segments array', () => {
    const srt = segmentsToSrt([]);
    expect(srt).toBe('');
  });
});

describe('createVttBlobUrl', () => {
  it('returns a blob URL string', () => {
    const url = createVttBlobUrl(sampleSegments);
    expect(url).toMatch(/^blob:/);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });
});

describe('downloadSubtitles', () => {
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });
  });

  it('triggers download for VTT format', () => {
    downloadSubtitles(sampleSegments, 'vtt', 'test-video.mp4');
    expect(clickSpy).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  it('triggers download for SRT format', () => {
    downloadSubtitles(sampleSegments, 'srt', 'test-video.mp4');
    expect(clickSpy).toHaveBeenCalled();
  });
});

describe('findActiveSegmentIndex', () => {
  it('returns index of segment containing current time', () => {
    expect(findActiveSegmentIndex(sampleSegments, 0)).toBe(0);
    expect(findActiveSegmentIndex(sampleSegments, 3)).toBe(0);
    expect(findActiveSegmentIndex(sampleSegments, 5.5)).toBe(1);
    expect(findActiveSegmentIndex(sampleSegments, 15)).toBe(2);
  });

  it('returns -1 when no segment is active', () => {
    expect(findActiveSegmentIndex(sampleSegments, -1)).toBe(-1);
    expect(findActiveSegmentIndex(sampleSegments, 25)).toBe(-1);
  });

  it('returns -1 for empty segments', () => {
    expect(findActiveSegmentIndex([], 5)).toBe(-1);
  });

  it('handles exact boundary between segments', () => {
    // At exactly end_secs of first segment (5.5), should match second segment
    expect(findActiveSegmentIndex(sampleSegments, 5.5)).toBe(1);
  });

  it('returns -1 at exact end of last segment', () => {
    // end_secs is exclusive: currentTime < end_secs
    expect(findActiveSegmentIndex(sampleSegments, 20.123)).toBe(-1);
  });
});

describe('formatSegmentTime', () => {
  it('formats seconds as M:SS', () => {
    expect(formatSegmentTime(0)).toBe('0:00');
    expect(formatSegmentTime(5)).toBe('0:05');
    expect(formatSegmentTime(65)).toBe('1:05');
    expect(formatSegmentTime(125.7)).toBe('2:05');
  });

  it('handles large values', () => {
    expect(formatSegmentTime(3661)).toBe('61:01');
  });
});
