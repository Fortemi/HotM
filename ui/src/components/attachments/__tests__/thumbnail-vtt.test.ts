/**
 * Thumbnail VTT Parser Tests
 *
 * Tests the WebVTT thumbnail parser for video scrubbing preview:
 * - VTT parsing with #xywh= fragments
 * - Cue time lookup (binary search)
 * - Edge cases (empty input, malformed entries)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseThumbnailVtt, getCueForTime } from '../thumbnail-vtt';
import type { ThumbnailCue } from '../thumbnail-vtt';

const SAMPLE_VTT = `WEBVTT

00:00:00.000 --> 00:00:10.000
/api/v1/attachments/abc/sprites/1.jpg#xywh=0,0,160,90

00:00:10.000 --> 00:00:20.000
/api/v1/attachments/abc/sprites/1.jpg#xywh=160,0,160,90

00:00:20.000 --> 00:00:30.000
/api/v1/attachments/abc/sprites/1.jpg#xywh=320,0,160,90

00:00:30.000 --> 00:00:40.000
/api/v1/attachments/abc/sprites/1.jpg#xywh=480,0,160,90

00:00:40.000 --> 00:00:50.000
/api/v1/attachments/abc/sprites/2.jpg#xywh=0,0,160,90
`;

describe('parseThumbnailVtt', () => {
  it('parses a valid VTT file with multiple cues', () => {
    const cues = parseThumbnailVtt(SAMPLE_VTT);
    expect(cues).toHaveLength(5);
  });

  it('extracts correct timestamps', () => {
    const cues = parseThumbnailVtt(SAMPLE_VTT);
    expect(cues[0].startTime).toBe(0);
    expect(cues[0].endTime).toBe(10);
    expect(cues[1].startTime).toBe(10);
    expect(cues[1].endTime).toBe(20);
    expect(cues[4].startTime).toBe(40);
    expect(cues[4].endTime).toBe(50);
  });

  it('extracts correct image URLs', () => {
    const cues = parseThumbnailVtt(SAMPLE_VTT);
    expect(cues[0].imageUrl).toBe('/api/v1/attachments/abc/sprites/1.jpg');
    expect(cues[4].imageUrl).toBe('/api/v1/attachments/abc/sprites/2.jpg');
  });

  it('extracts correct xywh coordinates', () => {
    const cues = parseThumbnailVtt(SAMPLE_VTT);
    expect(cues[0]).toMatchObject({ x: 0, y: 0, w: 160, h: 90 });
    expect(cues[1]).toMatchObject({ x: 160, y: 0, w: 160, h: 90 });
    expect(cues[2]).toMatchObject({ x: 320, y: 0, w: 160, h: 90 });
    expect(cues[3]).toMatchObject({ x: 480, y: 0, w: 160, h: 90 });
    expect(cues[4]).toMatchObject({ x: 0, y: 0, w: 160, h: 90 });
  });

  it('returns empty array for empty input', () => {
    expect(parseThumbnailVtt('')).toEqual([]);
  });

  it('returns empty array for non-VTT input', () => {
    expect(parseThumbnailVtt('This is not a VTT file')).toEqual([]);
  });

  it('skips entries without #xywh= fragment', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:10.000
/sprites/1.jpg

00:00:10.000 --> 00:00:20.000
/sprites/1.jpg#xywh=0,0,160,90
`;
    const cues = parseThumbnailVtt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBe(10);
  });

  it('skips entries with invalid coordinates', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:10.000
/sprites/1.jpg#xywh=abc,0,160,90

00:00:10.000 --> 00:00:20.000
/sprites/1.jpg#xywh=0,0,160,90
`;
    const cues = parseThumbnailVtt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBe(10);
  });

  it('handles MM:SS.mmm format', () => {
    const vtt = `WEBVTT

01:30.000 --> 01:40.000
/sprites/1.jpg#xywh=0,0,160,90
`;
    const cues = parseThumbnailVtt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBe(90);
    expect(cues[0].endTime).toBe(100);
  });

  it('handles HH:MM:SS.mmm format', () => {
    const vtt = `WEBVTT

01:30:00.000 --> 01:30:10.000
/sprites/1.jpg#xywh=0,0,160,90
`;
    const cues = parseThumbnailVtt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBe(5400);
    expect(cues[0].endTime).toBe(5410);
  });

  it('handles multi-row sprite sheets', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:10.000
/sprites/1.jpg#xywh=0,0,160,90

00:00:10.000 --> 00:00:20.000
/sprites/1.jpg#xywh=0,90,160,90
`;
    const cues = parseThumbnailVtt(vtt);
    expect(cues[1]).toMatchObject({ x: 0, y: 90, w: 160, h: 90 });
  });
});

describe('getCueForTime', () => {
  let cues: ThumbnailCue[];

  beforeAll(() => {
    cues = parseThumbnailVtt(SAMPLE_VTT);
  });

  it('returns the correct cue for a time within a range', () => {
    const cue = getCueForTime(cues, 5);
    expect(cue).toBeDefined();
    expect(cue!.startTime).toBe(0);
    expect(cue!.endTime).toBe(10);
  });

  it('returns the correct cue at the exact start time', () => {
    const cue = getCueForTime(cues, 10);
    expect(cue).toBeDefined();
    expect(cue!.startTime).toBe(10);
  });

  it('returns the correct cue for the last range', () => {
    const cue = getCueForTime(cues, 45);
    expect(cue).toBeDefined();
    expect(cue!.startTime).toBe(40);
  });

  it('returns undefined for empty cue array', () => {
    expect(getCueForTime([], 5)).toBeUndefined();
  });

  it('returns undefined for time beyond all cues', () => {
    const result = getCueForTime(cues, 100);
    expect(result).toBeUndefined();
  });

  it('handles boundary between cues (returns the later cue)', () => {
    const cue = getCueForTime(cues, 20);
    expect(cue).toBeDefined();
    expect(cue!.startTime).toBe(20);
  });

  it('returns the first cue for time 0', () => {
    const cue = getCueForTime(cues, 0);
    expect(cue).toBeDefined();
    expect(cue!.startTime).toBe(0);
  });
});
