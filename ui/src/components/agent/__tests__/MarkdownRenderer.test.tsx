import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from '../MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders plain text', () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders headings', () => {
    render(<MarkdownRenderer content={"# Title\n\nSome text"} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
  });

  it('renders bold and italic', () => {
    render(<MarkdownRenderer content="**bold** and *italic*" />);
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
  });

  it('renders unordered lists', () => {
    render(<MarkdownRenderer content={"- item 1\n- item 2"} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('renders ordered lists', () => {
    render(<MarkdownRenderer content={"1. first\n2. second"} />);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
  });

  it('renders code blocks', () => {
    render(<MarkdownRenderer content={'```js\nconsole.log("hi")\n```'} />);
    expect(screen.getByText('console.log("hi")')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    render(<MarkdownRenderer content="Use `npm install` to install" />);
    const code = screen.getByText('npm install');
    expect(code.tagName).toBe('CODE');
  });

  it('renders links with target="_blank"', () => {
    render(<MarkdownRenderer content="[Visit](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'Visit' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders GFM tables', () => {
    const table = '| A | B |\n|---|---|\n| 1 | 2 |';
    render(<MarkdownRenderer content={table} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders GFM strikethrough', () => {
    render(<MarkdownRenderer content="~~deleted~~" />);
    const del = screen.getByText('deleted');
    expect(del.tagName).toBe('DEL');
  });

  it('applies prose classes', () => {
    const { container } = render(<MarkdownRenderer content="test" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('prose');
  });

  it('applies custom className', () => {
    const { container } = render(<MarkdownRenderer content="test" className="custom" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('custom');
  });
});
