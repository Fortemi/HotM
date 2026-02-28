import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInputHistory, isCursorOnFirstLine, isCursorOnLastLine } from '../useInputHistory';

describe('useInputHistory', () => {
  it('returns expected interface', () => {
    const { result } = renderHook(() => useInputHistory());
    expect(result.current).toHaveProperty('push');
    expect(result.current).toHaveProperty('navigateBack');
    expect(result.current).toHaveProperty('navigateForward');
    expect(result.current).toHaveProperty('resetNavigation');
    expect(result.current).toHaveProperty('isNavigating');
    expect(result.current).toHaveProperty('clear');
  });

  it('navigateBack returns undefined when history is empty', () => {
    const { result } = renderHook(() => useInputHistory());
    let entry: string | undefined;
    act(() => {
      entry = result.current.navigateBack('current');
    });
    expect(entry).toBeUndefined();
  });

  it('push + navigateBack returns previous message', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('hello');
    });
    let entry: string | undefined;
    act(() => {
      entry = result.current.navigateBack('');
    });
    expect(entry).toBe('hello');
  });

  it('navigates backward through multiple entries', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('first');
      result.current.push('second');
      result.current.push('third');
    });

    const entries: (string | undefined)[] = [];
    act(() => {
      entries.push(result.current.navigateBack('')); // third
      entries.push(result.current.navigateBack('')); // second
      entries.push(result.current.navigateBack('')); // first
    });
    expect(entries).toEqual(['third', 'second', 'first']);
  });

  it('returns undefined when at oldest entry', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('only');
    });
    let first: string | undefined;
    let second: string | undefined;
    act(() => {
      first = result.current.navigateBack('');
      second = result.current.navigateBack('');
    });
    expect(first).toBe('only');
    expect(second).toBeUndefined();
  });

  it('navigateForward returns newer entries then draft', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('first');
      result.current.push('second');
    });

    act(() => {
      result.current.navigateBack('my draft'); // second
      result.current.navigateBack('my draft'); // first
    });

    let fwd1: string | undefined;
    let fwd2: string | undefined;
    act(() => {
      fwd1 = result.current.navigateForward(); // second
      fwd2 = result.current.navigateForward(); // draft
    });
    expect(fwd1).toBe('second');
    expect(fwd2).toBe('my draft');
  });

  it('preserves draft when entering history mode', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('old message');
    });

    act(() => {
      result.current.navigateBack('unsaved text');
    });

    let restored: string | undefined;
    act(() => {
      restored = result.current.navigateForward();
    });
    expect(restored).toBe('unsaved text');
  });

  it('navigateForward returns undefined when not navigating', () => {
    const { result } = renderHook(() => useInputHistory());
    let entry: string | undefined;
    act(() => {
      entry = result.current.navigateForward();
    });
    expect(entry).toBeUndefined();
  });

  it('resetNavigation exits history mode', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('msg');
      result.current.navigateBack('');
    });
    expect(result.current.isNavigating).toBe(true);

    act(() => {
      result.current.resetNavigation();
    });
    expect(result.current.isNavigating).toBe(false);
  });

  it('deduplicates consecutive identical entries', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('same');
      result.current.push('same');
      result.current.push('same');
    });

    const entries: (string | undefined)[] = [];
    act(() => {
      entries.push(result.current.navigateBack(''));
      entries.push(result.current.navigateBack(''));
    });
    // Should only have one "same" entry
    expect(entries[0]).toBe('same');
    expect(entries[1]).toBeUndefined();
  });

  it('caps history at 50 entries', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.push(`msg-${i}`);
      }
    });

    // Navigate all the way back to count entries
    let count = 0;
    act(() => {
      while (result.current.navigateBack('') !== undefined) {
        count++;
      }
    });
    expect(count).toBe(50);
  });

  it('clear removes all history', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => {
      result.current.push('a');
      result.current.push('b');
      result.current.clear();
    });

    let entry: string | undefined;
    act(() => {
      entry = result.current.navigateBack('');
    });
    expect(entry).toBeUndefined();
  });
});

describe('cursor position helpers', () => {
  function makeTextarea(value: string, selectionStart: number): HTMLTextAreaElement {
    return { value, selectionStart } as HTMLTextAreaElement;
  }

  describe('isCursorOnFirstLine', () => {
    it('returns true for single-line input', () => {
      expect(isCursorOnFirstLine(makeTextarea('hello', 3))).toBe(true);
    });

    it('returns true when cursor is before first newline', () => {
      expect(isCursorOnFirstLine(makeTextarea('line1\nline2', 3))).toBe(true);
    });

    it('returns false when cursor is after first newline', () => {
      expect(isCursorOnFirstLine(makeTextarea('line1\nline2', 7))).toBe(false);
    });
  });

  describe('isCursorOnLastLine', () => {
    it('returns true for single-line input', () => {
      expect(isCursorOnLastLine(makeTextarea('hello', 3))).toBe(true);
    });

    it('returns true when cursor is after last newline', () => {
      expect(isCursorOnLastLine(makeTextarea('line1\nline2', 8))).toBe(true);
    });

    it('returns false when cursor is before last newline', () => {
      expect(isCursorOnLastLine(makeTextarea('line1\nline2', 3))).toBe(false);
    });
  });
});
