import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgent } from '../useAgent';

// Mock the API module
vi.mock('@/api', () => ({
  api: {
    chat: {
      send: vi.fn(),
    },
  },
}));

import { api } from '@/api';

describe('useAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty messages and no loading', () => {
    const { result } = renderHook(() => useAgent());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sends a message and receives a response', async () => {
    vi.mocked(api.chat.send).mockResolvedValueOnce({
      messages: [{ role: 'assistant', content: 'Hello!', timestamp: '2026-02-27T00:00:00Z' }],
      actions: [],
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('hi');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Hello!');
    expect(result.current.isLoading).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(api.chat.send).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.sendMessage('test');
    });

    expect(result.current.messages).toHaveLength(1); // Only the user message
    expect(result.current.error).toBe('Network error');
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores empty input', async () => {
    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(result.current.messages).toEqual([]);
    expect(api.chat.send).not.toHaveBeenCalled();
  });

  it('clears messages', async () => {
    vi.mocked(api.chat.send).mockResolvedValueOnce({
      messages: [{ role: 'assistant', content: 'Done.' }],
      actions: [],
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.sendMessage('test');
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  it('clears error', async () => {
    vi.mocked(api.chat.send).mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.sendMessage('test');
    });

    expect(result.current.error).toBe('fail');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('passes context to the API request', async () => {
    vi.mocked(api.chat.send).mockResolvedValueOnce({
      messages: [{ role: 'assistant', content: 'Found it.' }],
      actions: [],
    });

    const { result } = renderHook(() =>
      useAgent({ context: { noteId: 'n-123', collectionId: 'c-1' } }),
    );

    await act(async () => {
      await result.current.sendMessage('find related');
    });

    const call = vi.mocked(api.chat.send).mock.calls[0][0];
    expect(call.context?.note_id).toBe('n-123');
    expect(call.context?.collection_id).toBe('c-1');
  });

  it('handles empty response with fallback message', async () => {
    vi.mocked(api.chat.send).mockResolvedValueOnce({
      messages: [],
      actions: [],
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.sendMessage('test');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('No response received.');
  });
});
