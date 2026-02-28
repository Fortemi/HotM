import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton } from '../CopyButton';

// jsdom doesn't provide navigator.clipboard — polyfill with a spy
const writeTextSpy = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: { writeText: writeTextSpy },
  writable: true,
  configurable: true,
});

afterEach(() => {
  vi.useRealTimers();
  writeTextSpy.mockClear();
  writeTextSpy.mockResolvedValue(undefined);
});

describe('CopyButton', () => {
  it('renders with Copy aria-label', () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeInTheDocument();
  });

  it('shows Copied feedback after click', async () => {
    const user = userEvent.setup();
    render(<CopyButton text="test message" />);

    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });
  });

  it('reverts to Copy after 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CopyButton text="test" />);

    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<CopyButton text="test" className="custom-class" />);
    const button = screen.getByRole('button', { name: 'Copy message' });
    expect(button.className).toContain('custom-class');
  });
});
