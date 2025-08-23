import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../button';

describe('Button', () => {
  it('renders button with default variant and size', () => {
    render(<Button>Default Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Default Button' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(button).toHaveClass('h-9', 'px-4', 'py-2');
  });

  it('renders button with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('bg-destructive', 'text-white');
  });

  it('renders button with outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    
    const button = screen.getByRole('button', { name: 'Outline' });
    expect(button).toHaveClass('border', 'bg-background');
  });

  it('renders button with secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground');
  });

  it('renders button with ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    
    const button = screen.getByRole('button', { name: 'Ghost' });
    expect(button).toHaveClass('hover:bg-accent');
  });

  it('renders button with link variant', () => {
    render(<Button variant="link">Link</Button>);
    
    const button = screen.getByRole('button', { name: 'Link' });
    expect(button).toHaveClass('text-primary', 'underline-offset-4');
  });

  it('renders button with small size', () => {
    render(<Button size="sm">Small</Button>);
    
    const button = screen.getByRole('button', { name: 'Small' });
    expect(button).toHaveClass('h-8', 'px-3');
  });

  it('renders button with large size', () => {
    render(<Button size="lg">Large</Button>);
    
    const button = screen.getByRole('button', { name: 'Large' });
    expect(button).toHaveClass('h-10', 'px-6');
  });

  it('renders button with icon size', () => {
    render(<Button size="icon">🔥</Button>);
    
    const button = screen.getByRole('button', { name: '🔥' });
    expect(button).toHaveClass('size-9');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    
    const button = screen.getByRole('button', { name: 'Clickable' });
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    
    const button = screen.getByRole('button', { name: 'Custom' });
    expect(button).toHaveClass('custom-class');
  });

  it('passes through additional props', () => {
    render(<Button data-testid="test-button" type="submit">Submit</Button>);
    
    const button = screen.getByTestId('test-button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('has consistent base classes', () => {
    render(<Button>Base Classes</Button>);
    
    const button = screen.getByRole('button', { name: 'Base Classes' });
    expect(button).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'gap-2',
      'whitespace-nowrap',
      'rounded-md',
      'text-sm',
      'font-medium',
      'transition-all',
      'outline-none'
    );
  });

  it('has data-slot attribute', () => {
    render(<Button>Slot Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Slot Button' });
    expect(button).toHaveAttribute('data-slot', 'button');
  });

  // Note: Testing asChild prop would require more complex setup with Radix Slot
  // and is primarily integration-level functionality
});