import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useContextTracking } from '../useContextTracking';

describe('useContextTracking', () => {
  const makeMessages = (count: number, charsEach: number) =>
    Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      parts: [{ type: 'text' as const, text: 'x'.repeat(charsEach) }],
    }));

  it('returns null when contextWindow is undefined', () => {
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'You are a test assistant.',
        messages: [],
        contextWindow: undefined,
      }),
    );
    expect(result.current).toBeNull();
  });

  it('returns null when contextWindow is 0', () => {
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'You are a test assistant.',
        messages: [],
        contextWindow: 0,
      }),
    );
    expect(result.current).toBeNull();
  });

  it('computes breakdown with empty messages', () => {
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'Hello', // ~2 tokens
        messages: [],
        contextWindow: 32768,
      }),
    );

    const breakdown = result.current!;
    expect(breakdown).not.toBeNull();
    expect(breakdown.systemTokens).toBeGreaterThan(0);
    expect(breakdown.historyTokens).toBe(0);
    expect(breakdown.reserveTokens).toBe(2048);
    expect(breakdown.contextWindow).toBe(32768);
    expect(breakdown.availableTokens).toBeGreaterThan(0);
    expect(breakdown.utilizationPercent).toBeLessThan(20);
    expect(breakdown.severity).toBe('low');
  });

  it('returns low severity for light usage', () => {
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'System prompt text.',
        messages: makeMessages(4, 100), // ~4 messages with ~29 tokens each + overhead
        contextWindow: 32768,
      }),
    );

    const breakdown = result.current!;
    expect(breakdown.severity).toBe('low');
    expect(breakdown.utilizationPercent).toBeLessThan(50);
  });

  it('returns moderate severity at 50-75%', () => {
    // system: 350/3.5 = 100 tokens
    // history: 10 msgs * (350/3.5 + 4 overhead) = 10*104 = 1040 tokens
    // reserve: 2048 tokens
    // total used: 100 + 1040 + 2048 = 3188
    // contextWindow 5000 -> 3188/5000 = ~64% -> moderate
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'x'.repeat(350), // ~100 tokens
        messages: makeMessages(10, 350), // ~10 messages * ~104 tokens each
        contextWindow: 5000,
      }),
    );

    const breakdown = result.current!;
    expect(breakdown.utilizationPercent).toBeGreaterThanOrEqual(50);
    expect(breakdown.utilizationPercent).toBeLessThan(75);
    expect(breakdown.severity).toBe('moderate');
  });

  it('returns critical severity at >90%', () => {
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'x'.repeat(3500), // ~1000 tokens
        messages: makeMessages(20, 700), // ~20 * 204 = ~4080 tokens
        contextWindow: 5500, // (1000 + 4080 + 2048) / 5500 > 90%
      }),
    );

    const breakdown = result.current!;
    expect(breakdown.utilizationPercent).toBeGreaterThanOrEqual(90);
    expect(breakdown.severity).toBe('critical');
  });

  it('caps utilizationPercent at 100', () => {
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'x'.repeat(3500), // ~1000 tokens
        messages: makeMessages(20, 700), // lots of tokens
        contextWindow: 1000, // way too small
      }),
    );

    const breakdown = result.current!;
    expect(breakdown.utilizationPercent).toBe(100);
    expect(breakdown.availableTokens).toBe(0);
  });

  it('provides formatted display strings', () => {
    const { result } = renderHook(() =>
      useContextTracking({
        systemPrompt: 'Hello world test prompt.',
        messages: makeMessages(2, 200),
        contextWindow: 32768,
      }),
    );

    const { formatted } = result.current!;
    expect(typeof formatted.system).toBe('string');
    expect(typeof formatted.history).toBe('string');
    expect(typeof formatted.available).toBe('string');
    expect(typeof formatted.total).toBe('string');
    expect(formatted.total).toBe('33K');
  });
});
