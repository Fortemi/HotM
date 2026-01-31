/**
 * MarkdownEditor Component Tests
 *
 * Tests the markdown editor with multiple view modes (split, raw, preview).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownEditor } from '../MarkdownEditor';

// Mock the MDEditor component
vi.mock('@uiw/react-md-editor', () => ({
  default: ({ value, onChange, height, preview, textareaProps }: any) => (
    <div data-testid="md-editor">
      <textarea
        data-testid="md-editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={textareaProps?.placeholder}
        style={{ height }}
      />
      <div data-testid="md-editor-preview">{preview}</div>
    </div>
  ),
}));

// Mock MarkdownPreview
vi.mock('../MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => (
    <div data-testid="markdown-preview">{content}</div>
  ),
}));

describe('MarkdownEditor', () => {
  describe('Rendering', () => {
    it('should render with default split mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      expect(screen.getByTestId('md-editor')).toBeInTheDocument();
    });

    it('should render with custom height', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} height={600} />);

      const textarea = screen.getByTestId('md-editor-textarea');
      expect(textarea).toBeInTheDocument();
    });

    it('should render all mode tabs', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      expect(screen.getByText('Side by Side')).toBeInTheDocument();
      expect(screen.getByText('Raw Markdown')).toBeInTheDocument();
      expect(screen.getByText('Preview Only')).toBeInTheDocument();
    });
  });

  describe('Mode Switching', () => {
    it('should switch to raw mode', () => {
      const onChange = vi.fn();
      const { rerender } = render(<MarkdownEditor value="# Test" onChange={onChange} />);

      const rawTab = screen.getByText('Raw Markdown');
      fireEvent.click(rawTab);

      // Should render raw textarea
      const textareas = screen.getAllByRole('textbox');
      expect(textareas.length).toBeGreaterThan(0);
    });

    it('should switch to preview mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test Content" onChange={onChange} />);

      const previewTab = screen.getByText('Preview Only');
      fireEvent.click(previewTab);

      // Should show preview
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
      expect(screen.getByText('# Test Content')).toBeInTheDocument();
    });

    it('should maintain value across mode switches', () => {
      const onChange = vi.fn();
      const testValue = '# Header\n\nContent';
      render(<MarkdownEditor value={testValue} onChange={onChange} />);

      // Switch to raw mode
      fireEvent.click(screen.getByText('Raw Markdown'));

      const textarea = screen.getAllByRole('textbox')[0];
      expect(textarea).toHaveValue(testValue);

      // Switch to preview mode
      fireEvent.click(screen.getByText('Preview Only'));

      expect(screen.getByText(testValue)).toBeInTheDocument();
    });
  });

  describe('Value Changes', () => {
    it('should call onChange in split mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      const textarea = screen.getByTestId('md-editor-textarea');
      fireEvent.change(textarea, { target: { value: '# Updated' } });

      expect(onChange).toHaveBeenCalledWith('# Updated');
    });

    it('should call onChange in raw mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      // Switch to raw mode
      fireEvent.click(screen.getByText('Raw Markdown'));

      const textarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(textarea, { target: { value: '# Updated Raw' } });

      expect(onChange).toHaveBeenCalledWith('# Updated Raw');
    });

    it('should handle empty value', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const textarea = screen.getByTestId('md-editor-textarea');
      expect(textarea).toHaveValue('');
    });

    it('should handle multiline content', () => {
      const onChange = vi.fn();
      const multilineContent = '# Header\n\nParagraph 1\n\nParagraph 2';
      render(<MarkdownEditor value={multilineContent} onChange={onChange} />);

      const textarea = screen.getByTestId('md-editor-textarea');
      expect(textarea).toHaveValue(multilineContent);
    });
  });

  describe('Default Mode', () => {
    it('should start in split mode by default', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      expect(screen.getByTestId('md-editor')).toBeInTheDocument();
    });

    it('should start in raw mode when specified', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} defaultMode="raw" />);

      // Should show raw textarea immediately
      const textareas = screen.getAllByRole('textbox');
      expect(textareas.length).toBeGreaterThan(0);
    });

    it('should start in preview mode when specified', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} defaultMode="preview" />);

      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    });
  });

  describe('Placeholder Text', () => {
    it('should show placeholder in split mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="" onChange={onChange} />);

      const textarea = screen.getByTestId('md-editor-textarea');
      expect(textarea).toHaveAttribute(
        'placeholder',
        'Start writing your thoughts... (Supports Markdown, LaTeX math, tables, and more)'
      );
    });

    it('should show placeholder in raw mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="" onChange={onChange} defaultMode="raw" />);

      const textarea = screen.getAllByRole('textbox')[0];
      expect(textarea).toHaveAttribute('placeholder', 'Write in Markdown format...');
    });
  });

  describe('Styling', () => {
    it('should accept custom height prop', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} height={800} />);

      // Should render without error
      expect(screen.getByTestId('md-editor')).toBeInTheDocument();
    });

    it('should render with height in raw mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} defaultMode="raw" height={700} />);

      // Should render without error
      expect(screen.getAllByRole('textbox')[0]).toBeInTheDocument();
    });

    it('should render with height in preview mode', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} defaultMode="preview" height={600} />);

      // Should render without error
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    });

    it('should use dark color mode in split view', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      const darkModeContainer = screen.getByTestId('md-editor').parentElement;
      expect(darkModeContainer).toHaveAttribute('data-color-mode', 'dark');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content', () => {
      const onChange = vi.fn();
      const longContent = 'A'.repeat(10000);
      render(<MarkdownEditor value={longContent} onChange={onChange} />);

      const textarea = screen.getByTestId('md-editor-textarea');
      expect(textarea).toHaveValue(longContent);
    });

    it('should handle special characters', () => {
      const onChange = vi.fn();
      const specialContent = '# Header\n\n```js\nconst x = "<>&";\n```';
      render(<MarkdownEditor value={specialContent} onChange={onChange} />);

      const textarea = screen.getByTestId('md-editor-textarea');
      expect(textarea).toHaveValue(specialContent);
    });

    it('should handle rapid mode switching', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      // Rapidly switch modes
      fireEvent.click(screen.getByText('Raw Markdown'));
      fireEvent.click(screen.getByText('Preview Only'));
      fireEvent.click(screen.getByText('Side by Side'));

      // Should not crash
      expect(screen.getByTestId('md-editor')).toBeInTheDocument();
    });

    it('should handle onChange returning undefined', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      const textarea = screen.getByTestId('md-editor-textarea');

      // Simulate MDEditor passing undefined
      fireEvent.change(textarea, { target: { value: '' } });

      // Should convert undefined to empty string
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible tab controls', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(3);
    });

    it('should have accessible textarea', () => {
      const onChange = vi.fn();
      render(<MarkdownEditor value="# Test" onChange={onChange} defaultMode="raw" />);

      const textarea = screen.getAllByRole('textbox')[0];
      expect(textarea).toBeInTheDocument();
    });
  });
});
