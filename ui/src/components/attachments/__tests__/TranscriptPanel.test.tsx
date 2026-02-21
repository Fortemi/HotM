/**
 * TranscriptPanel component tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptPanel } from '../TranscriptPanel';
import type { TranscriptSegment } from '../subtitle-utils';

const segments: TranscriptSegment[] = [
  { start_secs: 0, end_secs: 5, text: 'Hello world' },
  { start_secs: 5, end_secs: 10, text: 'Second segment' },
  { start_secs: 10, end_secs: 15, text: 'Third segment' },
];

const speakerSegments: TranscriptSegment[] = [
  { start_secs: 0, end_secs: 4, text: 'Good morning', speaker_id: 'Alice' },
  { start_secs: 4, end_secs: 8, text: 'Hello Alice', speaker_id: 'Bob' },
];

// Mock clipboard API
beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

describe('TranscriptPanel', () => {
  it('renders nothing for empty segments', () => {
    const { container } = render(
      <TranscriptPanel segments={[]} currentTime={0} onSeek={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel with segment count', () => {
    render(<TranscriptPanel segments={segments} currentTime={0} onSeek={vi.fn()} />);
    expect(screen.getByTestId('transcript-panel')).toBeInTheDocument();
    expect(screen.getByText('3 segments')).toBeInTheDocument();
  });

  it('renders all segments with timestamps', () => {
    render(<TranscriptPanel segments={segments} currentTime={0} onSeek={vi.fn()} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('Second segment')).toBeInTheDocument();
    expect(screen.getByText('Third segment')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:05')).toBeInTheDocument();
    expect(screen.getByText('0:10')).toBeInTheDocument();
  });

  it('highlights the active segment based on currentTime', () => {
    render(<TranscriptPanel segments={segments} currentTime={7} onSeek={vi.fn()} />);
    const seg1 = screen.getByTestId('transcript-segment-1');
    expect(seg1.className).toContain('bg-primary/10');
  });

  it('does not highlight any segment when currentTime is outside all', () => {
    render(<TranscriptPanel segments={segments} currentTime={20} onSeek={vi.fn()} />);
    const seg0 = screen.getByTestId('transcript-segment-0');
    const seg1 = screen.getByTestId('transcript-segment-1');
    const seg2 = screen.getByTestId('transcript-segment-2');
    expect(seg0.className).not.toContain('bg-primary/10');
    expect(seg1.className).not.toContain('bg-primary/10');
    expect(seg2.className).not.toContain('bg-primary/10');
  });

  it('calls onSeek with start_secs when a segment is clicked', () => {
    const onSeek = vi.fn();
    render(<TranscriptPanel segments={segments} currentTime={0} onSeek={onSeek} />);
    fireEvent.click(screen.getByTestId('transcript-segment-1'));
    expect(onSeek).toHaveBeenCalledWith(5);
  });

  it('renders speaker_id labels', () => {
    render(<TranscriptPanel segments={speakerSegments} currentTime={0} onSeek={vi.fn()} />);
    expect(screen.getByText('Alice:')).toBeInTheDocument();
    expect(screen.getByText('Bob:')).toBeInTheDocument();
  });

  it('toggles expansion when header is clicked', () => {
    render(<TranscriptPanel segments={segments} currentTime={0} onSeek={vi.fn()} />);
    // Panel starts expanded — segments visible
    expect(screen.getByText('Hello world')).toBeInTheDocument();

    // Click the header to collapse
    fireEvent.click(screen.getByText('Interactive Transcript'));
    expect(screen.queryByText('Hello world')).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText('Interactive Transcript'));
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders Copy all button', () => {
    render(<TranscriptPanel segments={segments} currentTime={0} onSeek={vi.fn()} />);
    expect(screen.getByText('Copy all')).toBeInTheDocument();
  });

  it('copies full transcript when Copy all is clicked', async () => {
    render(<TranscriptPanel segments={segments} currentTime={0} onSeek={vi.fn()} />);
    fireEvent.click(screen.getByText('Copy all'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Hello world\nSecond segment\nThird segment'
    );
  });

  it('copies transcript with speaker prefixes', async () => {
    render(<TranscriptPanel segments={speakerSegments} currentTime={0} onSeek={vi.fn()} />);
    fireEvent.click(screen.getByText('Copy all'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      '[Alice] Good morning\n[Bob] Hello Alice'
    );
  });

  it('renders .vtt and .srt download buttons', () => {
    render(<TranscriptPanel segments={segments} currentTime={0} onSeek={vi.fn()} />);
    expect(screen.getByText('.vtt')).toBeInTheDocument();
    expect(screen.getByText('.srt')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <TranscriptPanel segments={segments} currentTime={0} onSeek={vi.fn()} className="mt-4" />
    );
    const panel = screen.getByTestId('transcript-panel');
    expect(panel.className).toContain('mt-4');
  });
});
