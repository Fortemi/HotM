import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubAgentProgressPanel } from '../SubAgentProgressPanel';
import type { SubAgentProgress } from '../sub-agent';

describe('SubAgentProgressPanel', () => {
  it('renders nothing when items array is empty', () => {
    const { container } = render(<SubAgentProgressPanel items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders progress items with status labels', () => {
    const items: SubAgentProgress[] = [
      { taskId: 't1', type: 'search', status: 'completed', summary: 'Found 3 notes' },
      { taskId: 't2', type: 'analysis', status: 'running' },
    ];

    render(<SubAgentProgressPanel items={items} />);

    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('analysis')).toBeInTheDocument();
    expect(screen.getByText('Found 3 notes')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows completion counter', () => {
    const items: SubAgentProgress[] = [
      { taskId: 't1', type: 'search', status: 'completed' },
      { taskId: 't2', type: 'analysis', status: 'running' },
      { taskId: 't3', type: 'summarization', status: 'pending' },
    ];

    render(<SubAgentProgressPanel items={items} />);

    // 1 completed + 0 failed = 1 out of 3
    expect(screen.getByText('Sub-agents (1/3)')).toBeInTheDocument();
  });

  it('counts failed items in completion counter', () => {
    const items: SubAgentProgress[] = [
      { taskId: 't1', type: 'search', status: 'completed' },
      { taskId: 't2', type: 'analysis', status: 'failed' },
    ];

    render(<SubAgentProgressPanel items={items} />);

    // 1 completed + 1 failed = 2 out of 2
    expect(screen.getByText('Sub-agents (2/2)')).toBeInTheDocument();
  });

  it('truncates long summaries', () => {
    const longSummary = 'A'.repeat(100);
    const items: SubAgentProgress[] = [
      { taskId: 't1', type: 'search', status: 'completed', summary: longSummary },
    ];

    render(<SubAgentProgressPanel items={items} />);

    // Should truncate at 80 chars + "..."
    const truncated = screen.getByText(`${'A'.repeat(80)}...`);
    expect(truncated).toBeInTheDocument();
  });

  it('shows status label when no summary available', () => {
    const items: SubAgentProgress[] = [
      { taskId: 't1', type: 'search', status: 'pending' },
      { taskId: 't2', type: 'analysis', status: 'failed' },
    ];

    render(<SubAgentProgressPanel items={items} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
