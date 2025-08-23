import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from '../badge';

describe('Badge', () => {
  it('renders badge with default variant', () => {
    render(<Badge>Default Badge</Badge>);
    
    const badge = screen.getByText('Default Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('renders badge with secondary variant', () => {
    render(<Badge variant="secondary">Secondary Badge</Badge>);
    
    const badge = screen.getByText('Secondary Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-secondary', 'text-secondary-foreground');
  });

  it('renders badge with destructive variant', () => {
    render(<Badge variant="destructive">Error Badge</Badge>);
    
    const badge = screen.getByText('Error Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-destructive', 'text-destructive-foreground');
  });

  it('renders badge with outline variant', () => {
    render(<Badge variant="outline">Outline Badge</Badge>);
    
    const badge = screen.getByText('Outline Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-foreground');
    expect(badge).not.toHaveClass('border-transparent');
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom Badge</Badge>);
    
    const badge = screen.getByText('Custom Badge');
    expect(badge).toHaveClass('custom-class');
  });

  it('passes through additional props', () => {
    render(<Badge data-testid="test-badge" role="status">Props Badge</Badge>);
    
    const badge = screen.getByTestId('test-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('role', 'status');
  });

  it('renders as div element', () => {
    render(<Badge>Element Badge</Badge>);
    
    const badge = screen.getByText('Element Badge');
    expect(badge.tagName).toBe('DIV');
  });

  it('has consistent base classes', () => {
    render(<Badge>Base Classes Badge</Badge>);
    
    const badge = screen.getByText('Base Classes Badge');
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center',
      'rounded-md',
      'border',
      'px-2.5',
      'py-0.5',
      'text-xs',
      'font-semibold',
      'transition-colors',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-ring',
      'focus:ring-offset-2'
    );
  });
});