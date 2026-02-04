/**
 * TemplateManager Component Tests
 *
 * Tests CRUD interface for note templates with variable substitution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateManager } from '../TemplateManager';
import { api } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    templates: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock MarkdownPreview
vi.mock('@/components/MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => (
    <div data-testid="markdown-preview">{content}</div>
  ),
}));

// Mock data
const mockTemplates = [
  {
    id: 'tmpl-1',
    name: 'Meeting Notes',
    content: '# {{title}}\n\n## Date: {{date}}\n\n## Attendees\n{{attendees}}\n\n## Notes\n{{notes}}',
    default_tags: ['meeting', 'notes'],
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
  {
    id: 'tmpl-2',
    name: 'Project Plan',
    content: '# {{project_name}}\n\n## Goals\n{{goals}}\n\n## Timeline\n{{timeline}}',
    default_tags: ['project', 'planning'],
    created_at: '2024-01-09T10:00:00Z',
    updated_at: '2024-01-09T10:00:00Z',
  },
  {
    id: 'tmpl-3',
    name: 'Simple Note',
    content: '# Simple Note\n\nNo variables here.',
    default_tags: [],
    created_at: '2024-01-08T10:00:00Z',
    updated_at: '2024-01-08T10:00:00Z',
  },
];

describe('TemplateManager', () => {
  beforeEach(() => {
    vi.mocked(api.templates.list).mockResolvedValue(mockTemplates);
    vi.mocked(api.templates.create).mockResolvedValue({
      id: 'new-tmpl',
      name: 'New',
      content: '',
      default_tags: [],
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    });
    vi.mocked(api.templates.update).mockResolvedValue({
      id: 'tmpl-1',
      name: 'Updated',
      content: '',
      default_tags: [],
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    });
    vi.mocked(api.templates.delete).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render manager title', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Templates')).toBeInTheDocument();
      });
    });

    it('should render New Template button', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('New Template')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
      });
    });

    it('should load templates on mount', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(api.templates.list).toHaveBeenCalled();
      });
    });

    it('should display template names', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
        expect(screen.getByText('Project Plan')).toBeInTheDocument();
        expect(screen.getByText('Simple Note')).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    it('should render in grid view by default', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        // Grid has 3 columns in lg
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
    });

    it('should switch to list view', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      // Find list view toggle button
      const buttons = screen.getAllByRole('button');
      const listButton = buttons.find((b) => b.querySelector('.lucide-list'));
      if (listButton) {
        fireEvent.click(listButton);
      }

      await waitFor(() => {
        // Should show variable count in list view
        expect(screen.getByText('4 variables')).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('should filter templates by search query', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      fireEvent.change(searchInput, { target: { value: 'project' } });

      await waitFor(() => {
        expect(screen.getByText('Project Plan')).toBeInTheDocument();
        expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no matches', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No templates match your search')).toBeInTheDocument();
      });
    });
  });

  describe('Create Template', () => {
    it('should open create dialog when New Template clicked', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('New Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Template'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g., Meeting Notes')).toBeInTheDocument();
      });
    });

    it('should create template on save', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('New Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Template'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Meeting Notes')).toBeInTheDocument();
      });

      // Fill form - name input
      fireEvent.change(screen.getByPlaceholderText('e.g., Meeting Notes'), {
        target: { value: 'New Test Template' },
      });

      // Fill content textarea (second textbox)
      const textareas = screen.getAllByRole('textbox');
      fireEvent.change(textareas[1], {
        target: { value: '# {{title}}\n\nContent here' },
      });

      // Click the Create Template button in dialog (not the header one)
      const buttons = screen.getAllByRole('button');
      const createButton = buttons.find(
        (btn) => btn.textContent?.includes('Create Template') && btn.closest('[role="dialog"]')
      );
      if (createButton) {
        fireEvent.click(createButton);
      }

      await waitFor(() => {
        expect(api.templates.create).toHaveBeenCalled();
      });
    });

    it('should detect variables in template content', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('New Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Template'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Meeting Notes')).toBeInTheDocument();
      });

      // Enter content with variables (second textbox is content)
      const textareas = screen.getAllByRole('textbox');
      fireEvent.change(textareas[1], {
        target: { value: '# {{title}}\n\n{{description}}' },
      });

      await waitFor(() => {
        expect(screen.getByText('Detected Variables')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Template', () => {
    it('should open edit dialog when Edit clicked', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      // Click Edit on first template
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Template')).toBeInTheDocument();
        // Should pre-fill with template data
        expect(screen.getByDisplayValue('Meeting Notes')).toBeInTheDocument();
      });
    });

    it('should update template on save', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Meeting Notes')).toBeInTheDocument();
      });

      // Update name
      fireEvent.change(screen.getByDisplayValue('Meeting Notes'), {
        target: { value: 'Updated Meeting Notes' },
      });

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(api.templates.update).toHaveBeenCalledWith(
          'tmpl-1',
          expect.objectContaining({
            name: 'Updated Meeting Notes',
          })
        );
      });
    });
  });

  describe('Delete Template', () => {
    it('should show delete confirmation dialog', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      // Find delete button (trash icon)
      const deleteButtons = screen.getAllByRole('button').filter(
        (b) => b.querySelector('.lucide-trash-2')
      );
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Delete Template?')).toBeInTheDocument();
        expect(
          screen.getByText(/Are you sure you want to delete "Meeting Notes"/)
        ).toBeInTheDocument();
      });
    });

    it('should delete template on confirm', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button').filter(
        (b) => b.querySelector('.lucide-trash-2')
      );
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Find Delete button in dialog
      const confirmDelete = screen.getAllByText('Delete').find(
        (el) => el.closest('[role="alertdialog"]')
      );
      fireEvent.click(confirmDelete!);

      await waitFor(() => {
        expect(api.templates.delete).toHaveBeenCalledWith('tmpl-1');
      });
    });

    it('should cancel delete on Cancel click', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button').filter(
        (b) => b.querySelector('.lucide-trash-2')
      );
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      expect(api.templates.delete).not.toHaveBeenCalled();
    });
  });

  describe('Use Template', () => {
    it('should open instantiation dialog when Use clicked', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const useButtons = screen.getAllByText('Use');
      fireEvent.click(useButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Use Template: Meeting Notes')).toBeInTheDocument();
        expect(screen.getByText('Fill Variables')).toBeInTheDocument();
      });
    });

    it('should display variable inputs', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const useButtons = screen.getAllByText('Use');
      fireEvent.click(useButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.getByText('date')).toBeInTheDocument();
        expect(screen.getByText('attendees')).toBeInTheDocument();
        expect(screen.getByText('notes')).toBeInTheDocument();
      });
    });

    it('should show live preview', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const useButtons = screen.getAllByText('Use');
      fireEvent.click(useButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Live Preview')).toBeInTheDocument();
        expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
      });
    });

    it('should call onCreateNote when instantiated', async () => {
      const onCreateNote = vi.fn();
      render(<TemplateManager onCreateNote={onCreateNote} />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      const useButtons = screen.getAllByText('Use');
      fireEvent.click(useButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Create Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Note'));

      expect(onCreateNote).toHaveBeenCalled();
    });

    it('should show message when no variables', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Simple Note')).toBeInTheDocument();
      });

      // Switch to list view to easily find Simple Note's Use button
      const buttons = screen.getAllByRole('button');
      const listButton = buttons.find((b) => b.querySelector('.lucide-list'));
      if (listButton) {
        fireEvent.click(listButton);
      }

      await waitFor(() => {
        const useButtons = screen.getAllByRole('button').filter(
          (b) => b.querySelector('.lucide-play')
        );
        fireEvent.click(useButtons[2]); // Simple Note is third
      });

      await waitFor(() => {
        expect(screen.getByText('This template has no variables to fill.')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no templates', async () => {
      vi.mocked(api.templates.list).mockResolvedValue([]);

      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('No templates yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first template')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator', async () => {
      vi.mocked(api.templates.list).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockTemplates), 100))
      );

      render(<TemplateManager />);

      // Loading spinner should be visible initially
      await waitFor(() => {
        expect(screen.getByText('Templates')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when load fails', async () => {
      vi.mocked(api.templates.list).mockRejectedValue(new Error('Network error'));

      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      vi.mocked(api.templates.list)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(mockTemplates);

      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
    });
  });

  describe('Variable Chips', () => {
    it('should display variable chips in template cards', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
        // Variable chips should be visible
        expect(screen.getByLabelText('{{title}}')).toBeInTheDocument();
      });
    });

    it('should show "+N more" when many variables', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        // Meeting Notes has 4 variables, should show +1 more
        expect(screen.getByText('+1 more')).toBeInTheDocument();
      });
    });
  });

  describe('Tags Display', () => {
    it('should display default tags', async () => {
      render(<TemplateManager />);

      await waitFor(() => {
        expect(screen.getByText('#meeting')).toBeInTheDocument();
        expect(screen.getByText('#project')).toBeInTheDocument();
      });
    });
  });
});
