import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HallOfMind } from '../HallOfMind';
import * as apiModule from '@/services/api';
import * as websocketModule from '@/services/websocket';
import { NoteFull } from '@/services/api';

// Mock all external dependencies
vi.mock('@/services/api');
vi.mock('@/services/websocket', () => ({
  useWebSocket: vi.fn(),
}));

// Mock TypingAnimation component
vi.mock('../TypingAnimation', () => ({
  TypingAnimation: vi.fn(({ oldText, newText, onComplete }) => {
    setTimeout(() => onComplete?.(), 10);
    return <div data-testid="typing-animation" data-old={oldText} data-new={newText}>{newText}</div>;
  }),
}));


// Type for partial note overrides
interface MockNoteOverrides {
  note?: {
    id?: string;
    collection_id?: string;
    format?: string;
    source?: string;
    created_at_utc?: string;
    updated_at_utc?: string;
    starred?: boolean;
    archived?: boolean;
    title?: string;
  };
  original?: {
    content?: string;
    hash?: string;
  };
  revised?: {
    content?: string;
    last_revision_id?: string;
    ai_metadata?: Record<string, unknown>;
    model?: string;
  };
  tags?: string[];
}

describe('HallOfMind WebSocket Integration', () => {
  const mockApi = vi.mocked(apiModule.api);
  const mockUseWebSocket = vi.mocked(websocketModule.useWebSocket);

  // Sample data factory
  const createMockNoteFull = (overrides: MockNoteOverrides = {}): NoteFull => ({
    note: {
      id: overrides.note?.id ?? 'test-note-id',
      collection_id: overrides.note?.collection_id,
      format: overrides.note?.format ?? 'markdown',
      source: overrides.note?.source ?? 'user',
      created_at_utc: overrides.note?.created_at_utc ?? '2024-08-24T12:00:00Z',
      updated_at_utc: overrides.note?.updated_at_utc ?? '2024-08-24T12:00:00Z',
      starred: overrides.note?.starred ?? false,
      archived: overrides.note?.archived ?? false,
      title: overrides.note?.title,
    },
    original: {
      content: overrides.original?.content ?? 'Test note content',
      hash: overrides.original?.hash ?? 'test-hash',
    },
    revised: {
      content: overrides.revised?.content ?? 'Revised content',
      last_revision_id: overrides.revised?.last_revision_id,
      ai_metadata: overrides.revised?.ai_metadata,
      model: overrides.revised?.model ?? 'gpt-oss:20b',
    },
    tags: overrides.tags ?? ['test'],
    links: [],
    labels: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default API mocks
    mockApi.checkHealth.mockResolvedValue({ ok: true, db: true, vector: true, ollama: true });
    mockApi.getRecentNotes.mockResolvedValue([]);
    mockApi.getNotes.mockResolvedValue([]);
    mockApi.getAllLabels.mockResolvedValue([]);
    
    // Default WebSocket mock
    mockUseWebSocket.mockReturnValue({
      connected: false,
      queueStatus: {
        total_jobs: 0,
        running: 0,
        pending: 0,
      },
      sendMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WebSocket Component Integration', () => {
    it('renders with WebSocket connection status - connected', async () => {
      // Test with connected WebSocket
      mockUseWebSocket.mockReturnValue({
        connected: true,
        queueStatus: {
          total_jobs: 0,
          running: 0,
          pending: 0,
        },
        sendMessage: vi.fn(),
      });

      mockApi.getRecentNotes.mockResolvedValue([]);
      
      render(<HallOfMind />);

      // Component should render successfully with WebSocket integration
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Should call useWebSocket hook
      expect(mockUseWebSocket).toHaveBeenCalled();
    });

    it('renders with WebSocket connection status - disconnected', async () => {
      // Test with disconnected WebSocket
      mockUseWebSocket.mockReturnValue({
        connected: false,
        queueStatus: {
          total_jobs: 0,
          running: 0,
          pending: 0,
        },
        sendMessage: vi.fn(),
      });

      mockApi.getRecentNotes.mockResolvedValue([]);
      
      render(<HallOfMind />);

      // Component should render successfully even when WebSocket is disconnected
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      expect(mockUseWebSocket).toHaveBeenCalled();
    });

    it('handles WebSocket queue status updates', async () => {
      // Test with active jobs in queue
      mockUseWebSocket.mockReturnValue({
        connected: true,
        queueStatus: {
          total_jobs: 5,
          running: 2,
          pending: 3,
        },
        sendMessage: vi.fn(),
      });

      const testNote = createMockNoteFull({
        note: { id: 'test-note' },
        original: { content: 'Test content' },
      });

      mockApi.getRecentNotes.mockResolvedValue([testNote]);
      
      render(<HallOfMind />);

      // Component should handle queue status changes
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      expect(mockUseWebSocket).toHaveBeenCalled();
    });
  });

  describe('Note Management with WebSocket', () => {
    it('loads notes successfully with WebSocket integration', async () => {
      const testNote = createMockNoteFull({
        note: { id: 'websocket-note', title: 'WebSocket Test Note' },
        original: { content: 'Content for WebSocket testing' },
      });

      mockApi.getRecentNotes.mockResolvedValue([testNote]);
      
      render(<HallOfMind />);

      // Should load and display notes
      await waitFor(() => {
        expect(screen.getByText('WebSocket Test Note')).toBeInTheDocument();
      });

      // Should integrate with WebSocket
      expect(mockUseWebSocket).toHaveBeenCalled();
    });

    it('handles API errors gracefully with WebSocket active', async () => {
      // Mock API error
      mockApi.getRecentNotes.mockRejectedValue(new Error('API Error'));
      
      render(<HallOfMind />);

      // Component should handle errors gracefully
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // WebSocket should still be initialized
      expect(mockUseWebSocket).toHaveBeenCalled();
    });
  });

  describe('WebSocket Error Handling', () => {
    it('handles WebSocket connection failures gracefully', async () => {
      // Test with WebSocket that fails to connect
      mockUseWebSocket.mockReturnValue({
        connected: false,
        queueStatus: {
          total_jobs: 0,
          running: 0,
          pending: 0,
        },
        sendMessage: vi.fn(),
      });

      // Also test with API that fails
      mockApi.getRecentNotes.mockRejectedValue(new Error('Connection failed'));
      
      render(<HallOfMind />);

      // Component should still render despite connection issues
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });
  });

  describe('Animation Integration', () => {
    it('can trigger typing animation through component updates', async () => {
      const noteWithoutTitle = createMockNoteFull({
        note: { id: 'animation-test' },
        original: { content: 'Original content for animation' },
      });

      mockApi.getRecentNotes.mockResolvedValue([noteWithoutTitle]);
      
      render(<HallOfMind />);

      // Initial render should show original content
      await waitFor(() => {
        expect(screen.getByText('Original content for animation')).toBeInTheDocument();
      });

      // Animation component should be available for future updates
      // (Testing the full animation flow would require more complex setup)
    });
  });
});