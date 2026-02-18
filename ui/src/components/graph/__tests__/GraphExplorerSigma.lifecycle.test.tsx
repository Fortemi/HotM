import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphExplorer } from '../GraphExplorerSigma';

let sigmaConstructorCalls = 0;
let sigmaKillCalls = 0;

vi.mock('sigma', () => {
  class SigmaMock {
    constructor() {
      sigmaConstructorCalls += 1;
    }
    on() {
      // no-op
    }
    kill() {
      sigmaKillCalls += 1;
    }
    getCamera() {
      return {
        getState: () => ({ x: 0, y: 0, ratio: 1, angle: 0 }),
        setState: () => {
          // no-op
        },
      };
    }
  }
  return { default: SigmaMock };
});

vi.mock('@/api', () => ({
  api: {
    collections: {
      list: vi.fn().mockResolvedValue([]),
    },
    links: {
      exploreGraph: vi.fn().mockResolvedValue({
        nodes: [
          { id: 'n1', title: 'Node 1', depth: 0 },
          { id: 'n2', title: 'Node 2', depth: 1 },
        ],
        edges: [{ from: 'n1', to: 'n2', score: 0.8 }],
      }),
    },
    notes: {
      get: vi.fn().mockResolvedValue({
        note: {
          collection_id: null,
          archived: false,
          created_at_utc: '2026-02-01T00:00:00Z',
          updated_at_utc: '2026-02-02T00:00:00Z',
        },
        tags: [],
      }),
    },
    concepts: {
      getNoteConcepts: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe('GraphExplorerSigma lifecycle', () => {
  beforeEach(() => {
    sigmaConstructorCalls = 0;
    sigmaKillCalls = 0;
  });

  it('does not recreate Sigma renderer on refresh updates', async () => {
    const user = userEvent.setup();
    render(<GraphExplorer initialNoteId="n1" />);

    await waitFor(() => {
      expect(screen.getByText(/^nodes:/i)).toBeInTheDocument();
    });
    expect(sigmaConstructorCalls).toBe(1);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(screen.getByText(/last render:/i)).toBeInTheDocument();
    });

    expect(sigmaConstructorCalls).toBe(1);
    expect(sigmaKillCalls).toBe(0);
  });
});
