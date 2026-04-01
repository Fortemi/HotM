import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContextFilterInputs } from '../ContextFilterInputs';

// Mock Radix Select with plain HTML select (jsdom compat)
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div data-testid="select-root">{children({ value, onValueChange })}</div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children, ...props }: any) => (
    <option value={value} {...props}>{children}</option>
  ),
}));

// Simpler approach: mock the entire select as a plain HTML select
vi.mock('@/components/ui/select', () => {
  return {
    Select: ({ value, onValueChange, children }: any) => {
      return (
        <select
          data-testid="collection-select"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ value, children }: any) => (
      <option value={value}>{children}</option>
    ),
  };
});

const defaultProps = {
  contextFilter: { tags: [], collection_id: null, query: '' },
  onContextFilterChange: vi.fn(),
  collections: [
    { id: 'col-1', name: 'Research' },
    { id: 'col-2', name: 'Projects' },
  ],
  allTags: [
    { name: 'react', count: 5 },
    { name: 'typescript', count: 3 },
  ],
  filterValid: true,
};

describe('ContextFilterInputs', () => {
  it('renders context filters header', () => {
    render(<ContextFilterInputs {...defaultProps} />);
    expect(screen.getByText('Context Filters')).toBeInTheDocument();
  });

  it('shows validation message when filterValid is false', () => {
    render(<ContextFilterInputs {...defaultProps} filterValid={false} />);
    expect(screen.getByText(/at least one filter required/)).toBeInTheDocument();
  });

  it('does not show validation message when filterValid is true', () => {
    render(<ContextFilterInputs {...defaultProps} filterValid={true} />);
    expect(screen.queryByText(/at least one filter required/)).not.toBeInTheDocument();
  });

  it('adds tag on Enter key', () => {
    const onChange = vi.fn();
    render(
      <ContextFilterInputs
        {...defaultProps}
        onContextFilterChange={onChange}
      />
    );

    const input = screen.getByLabelText('Add context filter tag');
    fireEvent.change(input, { target: { value: 'newtag' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({
      tags: ['newtag'],
      collection_id: null,
      query: '',
    });
  });

  it('removes tag on X button click', () => {
    const onChange = vi.fn();
    render(
      <ContextFilterInputs
        {...defaultProps}
        contextFilter={{ tags: ['react', 'typescript'], collection_id: null, query: '' }}
        onContextFilterChange={onChange}
      />
    );

    const removeButton = screen.getByLabelText('Remove filter tag: react');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith({
      tags: ['typescript'],
      collection_id: null,
      query: '',
    });
  });

  it('renders existing tags as badges', () => {
    render(
      <ContextFilterInputs
        {...defaultProps}
        contextFilter={{ tags: ['react', 'typescript'], collection_id: null, query: '' }}
      />
    );

    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('changes collection via select', () => {
    const onChange = vi.fn();
    render(
      <ContextFilterInputs
        {...defaultProps}
        onContextFilterChange={onChange}
      />
    );

    const select = screen.getByTestId('collection-select');
    fireEvent.change(select, { target: { value: 'col-1' } });

    expect(onChange).toHaveBeenCalledWith({
      tags: [],
      collection_id: 'col-1',
      query: '',
    });
  });

  it('updates query on input change', () => {
    const onChange = vi.fn();
    render(
      <ContextFilterInputs
        {...defaultProps}
        onContextFilterChange={onChange}
      />
    );

    const queryInput = screen.getByLabelText('Context filter search query');
    fireEvent.change(queryInput, { target: { value: 'machine learning' } });

    expect(onChange).toHaveBeenCalledWith({
      tags: [],
      collection_id: null,
      query: 'machine learning',
    });
  });

  it('does not add duplicate tags', () => {
    const onChange = vi.fn();
    render(
      <ContextFilterInputs
        {...defaultProps}
        contextFilter={{ tags: ['react'], collection_id: null, query: '' }}
        onContextFilterChange={onChange}
      />
    );

    const input = screen.getByLabelText('Add context filter tag');
    fireEvent.change(input, { target: { value: 'react' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });
});
