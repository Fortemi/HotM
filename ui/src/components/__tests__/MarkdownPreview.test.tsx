/**
 * MarkdownPreview Component Tests
 *
 * Tests markdown rendering with GFM, math, PlantUML, and Mermaid support.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../MarkdownPreview';

// Mock PlantUML and Mermaid renderers
vi.mock('../PlantUMLRenderer', () => ({
  PlantUMLRenderer: ({ code, className }: { code: string; className: string }) => (
    <div data-testid="plantuml-renderer" className={className}>
      {code}
    </div>
  ),
}));

vi.mock('../MermaidRenderer', () => ({
  MermaidRenderer: ({ code, className }: { code: string; className: string }) => (
    <div data-testid="mermaid-renderer" className={className}>
      {code}
    </div>
  ),
}));

describe('MarkdownPreview', () => {
  describe('Basic Markdown', () => {
    it('should render headings', () => {
      render(<MarkdownPreview content="# H1\n## H2\n### H3" />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('H1');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('H2');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('H3');
    });

    it('should render paragraphs', () => {
      render(<MarkdownPreview content="This is a paragraph.\n\nThis is another paragraph." />);

      const paragraphs = screen.getAllByText(/This is/);
      expect(paragraphs).toHaveLength(2);
    });

    it('should render links', () => {
      render(<MarkdownPreview content="[Link Text](https://example.com)" />);

      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('Link Text');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('should render strong text', () => {
      render(<MarkdownPreview content="**bold text**" />);

      const strong = screen.getByText('bold text');
      expect(strong.tagName).toBe('STRONG');
    });

    it('should render emphasis text', () => {
      render(<MarkdownPreview content="_italic text_" />);

      const em = screen.getByText('italic text');
      expect(em.tagName).toBe('EM');
    });

    it('should render inline code', () => {
      render(<MarkdownPreview content="This is `inline code` in text." />);

      const code = screen.getByText('inline code');
      expect(code.tagName).toBe('CODE');
    });
  });

  describe('GFM Features', () => {
    it('should render tables', () => {
      const tableMarkdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
      `.trim();

      render(<MarkdownPreview content={tableMarkdown} />);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 4')).toBeInTheDocument();
    });

    it('should render strikethrough', () => {
      render(<MarkdownPreview content="~~strikethrough~~" />);

      const del = screen.getByText('strikethrough');
      expect(del.tagName).toBe('DEL');
    });

    it('should render task lists', () => {
      const taskList = `
- [x] Completed task
- [ ] Incomplete task
      `.trim();

      render(<MarkdownPreview content={taskList} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe('Code Blocks', () => {
    it('should render code blocks with language', () => {
      const codeBlock = '```javascript\nconst x = 1;\n```';
      render(<MarkdownPreview content={codeBlock} />);

      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('should render code blocks without language', () => {
      const codeBlock = '```\nplain code\n```';
      render(<MarkdownPreview content={codeBlock} />);

      expect(screen.getByText('plain code')).toBeInTheDocument();
    });

    it('should render PlantUML code blocks', () => {
      const plantuml = '```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```';
      render(<MarkdownPreview content={plantuml} />);

      expect(screen.getByTestId('plantuml-renderer')).toBeInTheDocument();
      expect(screen.getByTestId('plantuml-renderer')).toHaveTextContent('@startuml');
    });

    it('should render PlantUML with puml language tag', () => {
      const plantuml = '```puml\n@startuml\nAlice -> Bob\n@enduml\n```';
      render(<MarkdownPreview content={plantuml} />);

      expect(screen.getByTestId('plantuml-renderer')).toBeInTheDocument();
    });

    it('should render Mermaid diagrams', () => {
      const mermaid = '```mermaid\ngraph TD\nA --> B\n```';
      render(<MarkdownPreview content={mermaid} />);

      expect(screen.getByTestId('mermaid-renderer')).toBeInTheDocument();
      expect(screen.getByTestId('mermaid-renderer')).toHaveTextContent('graph TD');
    });
  });

  describe('Blockquotes', () => {
    it('should render blockquotes with custom styling', () => {
      render(<MarkdownPreview content="> This is a quote" />);

      const blockquote = screen.getByText('This is a quote').closest('blockquote');
      expect(blockquote).toBeInTheDocument();
      expect(blockquote).toHaveClass('border-l-4');
    });

    it('should render nested blockquotes', () => {
      const nested = '> Level 1\n> > Level 2';
      render(<MarkdownPreview content={nested} />);

      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });
  });

  describe('Lists', () => {
    it('should render unordered lists', () => {
      const list = `
- Item 1
- Item 2
- Item 3
      `.trim();

      render(<MarkdownPreview content={list} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should render ordered lists', () => {
      const list = `
1. First
2. Second
3. Third
      `.trim();

      render(<MarkdownPreview content={list} />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('should render nested lists', () => {
      const nested = `
- Parent 1
  - Child 1.1
  - Child 1.2
- Parent 2
      `.trim();

      render(<MarkdownPreview content={nested} />);

      expect(screen.getByText('Parent 1')).toBeInTheDocument();
      expect(screen.getByText('Child 1.1')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <MarkdownPreview content="# Test" className="custom-class" />
      );

      const prose = container.querySelector('.prose');
      expect(prose).toHaveClass('custom-class');
    });

    it('should apply dark mode classes', () => {
      const { container } = render(<MarkdownPreview content="# Test" />);

      const prose = container.querySelector('.prose');
      expect(prose).toHaveClass('dark:prose-invert');
    });

    it('should have responsive typography classes', () => {
      const { container } = render(<MarkdownPreview content="# Test" />);

      const prose = container.querySelector('.prose');
      expect(prose).toHaveClass('prose-slate');
      expect(prose).toHaveClass('prose-sm');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const { container } = render(<MarkdownPreview content="" />);

      const prose = container.querySelector('.prose');
      expect(prose).toBeInTheDocument();
      expect(prose).toBeEmptyDOMElement();
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      render(<MarkdownPreview content={longContent} />);

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should handle mixed content', () => {
      const mixed = `
# Header

This is a **bold** paragraph with \`code\`.

- List item 1
- List item 2

| Col 1 | Col 2 |
|-------|-------|
| A     | B     |

> Quote

\`\`\`javascript
const x = 1;
\`\`\`
      `.trim();
    it('should handle special characters', () => {
      render(<MarkdownPreview content={'< > & " \''} />);

      expect(screen.getByText(/< > &/)).toBeInTheDocument();
    });
      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('code')).toBeInTheDocument();
      expect(screen.getByText('List item 1')).toBeInTheDocument();
      expect(screen.getByText('Col 1')).toBeInTheDocument();
      expect(screen.getByText('Quote')).toBeInTheDocument();
      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('should handle malformed markdown gracefully', () => {
      const malformed = '# Unclosed **bold\n[Unclosed link(';
      render(<MarkdownPreview content={malformed} />);

      // Should render without crashing
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const content = '# H1\n## H2\n### H3\n#### H4';
      render(<MarkdownPreview content={content} />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument();
    });

    it('should render links with proper href', () => {
      render(<MarkdownPreview content="[Click here](https://example.com)" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('should render tables with proper structure', () => {
      const table = '| H1 | H2 |\n|----|----|---|\n| C1 | C2 |';
      render(<MarkdownPreview content={table} />);

      expect(screen.getByText('H1')).toBeInTheDocument();
    });
  });
});
