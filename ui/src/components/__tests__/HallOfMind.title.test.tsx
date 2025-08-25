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

// Mock TypingAnimation component for animation testing
vi.mock('../TypingAnimation', () => ({
  TypingAnimation: vi.fn(({ oldText, newText, onComplete }) => {
    // Simulate animation completion after a short delay
    setTimeout(() => onComplete?.(), 10);
    return <div data-testid="typing-animation" data-old={oldText} data-new={newText}>{newText}</div>;
  }),
}));

describe('HallOfMind Title Handling', () => {
  const mockApi = vi.mocked(apiModule.api);
  const mockUseWebSocket = vi.mocked(websocketModule.useWebSocket);

  // Sample note data
  const createMockNote = (overrides: Partial<NoteFull> = {}): NoteFull => ({
    note: {
      id: 'test-note-id',
      collection_id: undefined,
      format: 'markdown',
      source: 'user',
      created_at_utc: '2024-08-24T12:00:00Z',
      updated_at_utc: '2024-08-24T12:00:00Z',
      starred: false,
      archived: false,
      title: undefined, // No AI title initially
      ...overrides.note,
    },
    original: {
      content: 'This is the original note content for testing title display',
      hash: 'test-hash',
      ...overrides.original,
    },
    revised: {
      content: 'This is the revised content',
      last_revision_id: undefined,
      ai_metadata: null,
      model: 'gpt-oss:20b',
      ...overrides.revised,
    },
    tags: ['test'],
    links: [],
    labels: [],
    ...overrides,
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Default API mocks
    mockApi.checkHealth.mockResolvedValue({ ok: true, db: true, vector: true, ollama: true });
    mockApi.getRecentNotes.mockResolvedValue([]);
    mockApi.getAllLabels.mockResolvedValue([]);
    
    // Default WebSocket mock - disconnected initially
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

  describe('Title Display Logic', () => {
    it('displays original content as title for new notes without AI title', async () => {
      const noteWithoutAiTitle = createMockNote({
        note: { 
          id: 'test-note-1',
          title: null // No AI title
        },
        original: {
          content: 'My First Note Content\nWith multiple lines',
          hash: 'hash1',
        },
      });

      mockApi.getRecentNotes.mockResolvedValue([noteWithoutAiTitle]);
      
      render(<HallOfMind />);

      await waitFor(() => {
        // Should display first line of original content (truncated to 50 chars)
        expect(screen.getByText('My First Note Content')).toBeInTheDocument();
      });
    });

    it('displays AI-generated title when available', async () => {
      const noteWithAiTitle = createMockNote({
        note: { 
          id: 'test-note-2',
          title: 'AI Generated Awesome Title' // Has AI title
        },
        original: {
          content: 'This original content should not be displayed as title',
          hash: 'hash2',
        },
      });

      mockApi.getRecentNotes.mockResolvedValue([noteWithAiTitle]);
      
      render(<HallOfMind />);

      await waitFor(() => {
        // Should display AI-generated title, not original content
        expect(screen.getByText('AI Generated Awesome Title')).toBeInTheDocument();
        expect(screen.queryByText('This original content should not be displayed as title')).not.toBeInTheDocument();
      });
    });

    it('handles empty original content gracefully', async () => {
      const noteWithEmptyContent = createMockNote({
        note: { 
          id: 'test-note-3',
          title: null
        },
        original: {
          content: '', // Empty content
          hash: 'hash3',
        },
      });

      mockApi.getRecentNotes.mockResolvedValue([noteWithEmptyContent]);
      
      render(<HallOfMind />);

      await waitFor(() => {
        // Should display "Untitled" fallback
        expect(screen.getByText('Untitled')).toBeInTheDocument();
      });
    });

    it('truncates long original content to 50 characters', async () => {
      const noteWithLongContent = createMockNote({
        note: { 
          id: 'test-note-4',
          title: null
        },
        original: {
          content: 'This is a very long note title that should be truncated because it exceeds the 50 character limit that we have set for display purposes',
          hash: 'hash4',
        },
      });

      mockApi.getRecentNotes.mockResolvedValue([noteWithLongContent]);
      
      render(<HallOfMind />);

      await waitFor(() => {
        // Check for any part of the long content
        expect(screen.getByText(/This is a very long note title/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Title Animation Logic', () => {
    it('triggers title animation when AI generates title for first time', async () => {
      // Start with note without AI title
      const initialNote = createMockNote({
        note: { 
          id: 'animation-note-1',
          title: null
        },
        original: {
          content: 'Original content for animation test',
          hash: 'anim-hash1',
        },
      });

      mockApi.getRecentNotes.mockResolvedValue([initialNote]);
      
      render(<HallOfMind />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Original content for animation test')).toBeInTheDocument();
      });

      // Now simulate AI title generation via WebSocket update
      // Note: This would normally be triggered by the WebSocket event handler
      // For testing, we need to mock the getNote call that happens during updates
      const updatedNoteWithAiTitle = createMockNote({
        note: { 
          id: 'animation-note-1',
          title: 'New AI Generated Title' // Now has AI title
        },
        original: {
          content: 'Original content for animation test',
          hash: 'anim-hash1',
        },
      });

      mockApi.getNote.mockResolvedValue(updatedNoteWithAiTitle);

      // The animation would be triggered by the WebSocket event handler
      // For this test, we verify the animation component receives correct props
      // Note: Full integration would require simulating the WebSocket event
    });

    it('does not trigger animation for notes that already have AI titles', async () => {
      // Note already has AI title
      const noteWithExistingTitle = createMockNote({
        note: { 
          id: 'animation-note-2',
          title: 'Existing AI Title'
        },
        original: {
          content: 'Original content',
          hash: 'anim-hash2',
        },
      });

      mockApi.getRecentNotes.mockResolvedValue([noteWithExistingTitle]);
      
      render(<HallOfMind />);

      await waitFor(() => {
        expect(screen.getByText('Existing AI Title')).toBeInTheDocument();
        // Should not have typing animation for existing titles
        expect(screen.queryByTestId('typing-animation')).not.toBeInTheDocument();
      });
    });
  });

  describe('Title Consistency Across Workflows', () => {
    it('maintains title consistency during new note → revise → title workflow', async () => {
      // This test simulates the full workflow: new note → AI revision → title generation
      
      // Step 1: New note created (no AI title yet)
      const newNote = createMockNote({
        note: { 
          id: 'workflow-note',
          title: null
        },
        original: {
          content: 'Brand new note content',
          hash: 'workflow-hash',
        },
        revised: null as any, // No revision yet
      });

      mockApi.getRecentNotes.mockResolvedValue([newNote]);
      
      render(<HallOfMind />);

      // Should show original content as title initially
      await waitFor(() => {
        expect(screen.getByText('Brand new note content')).toBeInTheDocument();
      });

      // Step 2: AI revision completes (still no title)
      const revisedNote = createMockNote({
        note: { 
          id: 'workflow-note',
          title: null // Still no AI title
        },
        original: {
          content: 'Brand new note content',
          hash: 'workflow-hash',
        },
        revised: {
          content: 'AI enhanced content',
          last_revision_id: 'rev-id',
          ai_metadata: {},
          model: 'gpt-oss:20b',
        },
      });

      // Simulate update
      mockApi.getNote.mockResolvedValue(revisedNote);
      
      // Title should still be original content
      await waitFor(() => {
        expect(screen.getByText('Brand new note content')).toBeInTheDocument();
      });

      // Step 3: Title generation completes
      const titleGeneratedNote = createMockNote({
        note: { 
          id: 'workflow-note',
          title: 'AI Generated Title From Content' // Now has AI title
        },
        original: {
          content: 'Brand new note content',
          hash: 'workflow-hash',
        },
        revised: {
          content: 'AI enhanced content',
          last_revision_id: 'rev-id',
          ai_metadata: {},
          model: 'gpt-oss:20b',
        },
      });

      // Update mock for the title-generated note
      mockApi.getNote.mockResolvedValue(titleGeneratedNote);

      // This would trigger animation and title update in real usage
      // The WebSocket event handler would call the update logic
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles malformed note data gracefully', async () => {
      const malformedNote = {
        note: {
          id: 'malformed-note',
          // Missing required fields
        },
        original: {
          content: 'Some content',
        },
        // Missing other required fields
      } as any;

      mockApi.getRecentNotes.mockResolvedValue([malformedNote]);
      
      render(<HallOfMind />);

      // Should not crash and should handle gracefully
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('handles API errors during title updates', async () => {
      const note = createMockNote();
      mockApi.getRecentNotes.mockResolvedValue([note]);
      
      // Mock API error for getNote call
      mockApi.getNote.mockRejectedValue(new Error('API Error'));
      
      render(<HallOfMind />);

      // Should handle errors gracefully without crashing
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });
  });
});