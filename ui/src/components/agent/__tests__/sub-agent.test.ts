import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runSubAgent,
  fanOut,
  chain,
  aggregateResults,
} from '../sub-agent';
import type { SubAgentTask, SubAgentResult, SubAgentProgress } from '../sub-agent';

// Mock the api module
vi.mock('@/api', () => ({
  api: {
    chat: {
      sendMessage: vi.fn(),
    },
  },
}));

import { api } from '@/api';

const mockSendMessage = vi.mocked(api.chat.sendMessage);

function makeTask(id: string, type: SubAgentTask['type'] = 'search'): SubAgentTask {
  return {
    id,
    type,
    instructions: `Task ${id} instructions`,
  };
}

describe('sub-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runSubAgent', () => {
    it('returns success result on successful API call', async () => {
      mockSendMessage.mockResolvedValue({
        messages: [{ content: 'Search found 3 notes about ML.' }],
      } as never);

      const task = makeTask('t1');
      const result = await runSubAgent(task);

      expect(result.taskId).toBe('t1');
      expect(result.success).toBe(true);
      expect(result.summary).toBe('Search found 3 notes about ML.');
      expect(result.data).toBeDefined();
    });

    it('returns failure result on API error', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const task = makeTask('t2');
      const result = await runSubAgent(task);

      expect(result.taskId).toBe('t2');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.summary).toContain('Sub-agent failed');
    });

    it('caps summary at 2000 characters', async () => {
      const longContent = 'x'.repeat(5000);
      mockSendMessage.mockResolvedValue({
        messages: [{ content: longContent }],
      } as never);

      const result = await runSubAgent(makeTask('t3'));
      expect(result.summary.length).toBe(2000);
    });

    it('handles empty response gracefully', async () => {
      mockSendMessage.mockResolvedValue({
        messages: [],
      } as never);

      const result = await runSubAgent(makeTask('t4'));
      expect(result.success).toBe(true);
      expect(result.summary).toBe('');
    });

    it('handles non-Error thrown values', async () => {
      mockSendMessage.mockRejectedValue('string error');

      const result = await runSubAgent(makeTask('t5'));
      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  describe('fanOut', () => {
    it('runs all tasks in parallel and returns results', async () => {
      mockSendMessage.mockResolvedValue({
        messages: [{ content: 'Result' }],
      } as never);

      const tasks = [makeTask('a'), makeTask('b'), makeTask('c')];
      const results = await fanOut(tasks);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      // All 3 should have been called
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
    });

    it('limits to MAX_CONCURRENT (5) tasks', async () => {
      mockSendMessage.mockResolvedValue({
        messages: [{ content: 'Result' }],
      } as never);

      const tasks = Array.from({ length: 8 }, (_, i) => makeTask(`t${i}`));
      const results = await fanOut(tasks);

      // Only first 5 should run
      expect(results).toHaveLength(5);
      expect(mockSendMessage).toHaveBeenCalledTimes(5);
    });

    it('reports progress via callback', async () => {
      mockSendMessage.mockResolvedValue({
        messages: [{ content: 'Done' }],
      } as never);

      const progress: SubAgentProgress[] = [];
      await fanOut([makeTask('p1')], (p) => progress.push(p));

      // Should get 'running' then 'completed'
      expect(progress).toHaveLength(2);
      expect(progress[0].status).toBe('running');
      expect(progress[1].status).toBe('completed');
    });

    it('reports failed status on error', async () => {
      mockSendMessage.mockRejectedValue(new Error('fail'));

      const progress: SubAgentProgress[] = [];
      await fanOut([makeTask('f1')], (p) => progress.push(p));

      expect(progress[1].status).toBe('failed');
    });

    it('handles empty task list', async () => {
      const results = await fanOut([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('chain', () => {
    it('runs tasks sequentially', async () => {
      const callOrder: string[] = [];
      mockSendMessage.mockImplementation(async (msg: string) => {
        // Extract task context to verify ordering
        callOrder.push(msg.slice(0, 20));
        return { messages: [{ content: `Result for ${msg.slice(0, 10)}` }] } as never;
      });

      const tasks = [makeTask('s1'), makeTask('s2'), makeTask('s3')];
      const results = await chain(tasks);

      expect(results).toHaveLength(3);
      expect(callOrder).toHaveLength(3);
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
    });

    it('injects previous results as context', async () => {
      let secondCallInstructions = '';
      mockSendMessage
        .mockResolvedValueOnce({
          messages: [{ content: 'First result summary' }],
        } as never)
        .mockImplementation(async (msg: string) => {
          secondCallInstructions = msg;
          return { messages: [{ content: 'Second result' }] } as never;
        });

      await chain([makeTask('c1'), makeTask('c2')]);

      // Second task should include first task's result as context
      expect(secondCallInstructions).toContain('Previous result from task c1');
      expect(secondCallInstructions).toContain('First result summary');
    });

    it('stops chain on failure', async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          messages: [{ content: 'OK' }],
        } as never)
        .mockRejectedValueOnce(new Error('Chain broken'));

      const tasks = [makeTask('x1'), makeTask('x2'), makeTask('x3')];
      const results = await chain(tasks);

      // Should stop after second task fails
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      // Third task should NOT have been called
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it('reports progress via callback', async () => {
      mockSendMessage.mockResolvedValue({
        messages: [{ content: 'Done' }],
      } as never);

      const progress: SubAgentProgress[] = [];
      await chain([makeTask('p1'), makeTask('p2')], (p) => progress.push(p));

      // Each task: running + completed = 4 total
      expect(progress).toHaveLength(4);
      expect(progress.map(p => p.status)).toEqual([
        'running', 'completed', 'running', 'completed',
      ]);
    });
  });

  describe('aggregateResults', () => {
    it('formats successful results', () => {
      const results: SubAgentResult[] = [
        { taskId: 'r1', summary: 'Found 3 notes', success: true },
        { taskId: 'r2', summary: 'Analyzed themes', success: true },
      ];

      const output = aggregateResults(results);
      expect(output).toContain('Results:');
      expect(output).toContain('[r1]: Found 3 notes');
      expect(output).toContain('[r2]: Analyzed themes');
      expect(output).not.toContain('Failed');
    });

    it('formats failed results', () => {
      const results: SubAgentResult[] = [
        { taskId: 'f1', summary: 'Sub-agent failed: timeout', success: false, error: 'timeout' },
      ];

      const output = aggregateResults(results);
      expect(output).toContain('Failed (1/1)');
      expect(output).toContain('[f1]: timeout');
    });

    it('formats mixed results', () => {
      const results: SubAgentResult[] = [
        { taskId: 'ok', summary: 'Success', success: true },
        { taskId: 'err', summary: 'Failed', success: false, error: 'Network error' },
      ];

      const output = aggregateResults(results);
      expect(output).toContain('Results:');
      expect(output).toContain('[ok]: Success');
      expect(output).toContain('Failed (1/2)');
      expect(output).toContain('[err]: Network error');
    });

    it('handles empty results', () => {
      const output = aggregateResults([]);
      expect(output).toBe('');
    });

    it('handles failed result with no error message', () => {
      const results: SubAgentResult[] = [
        { taskId: 'f1', summary: 'Failed', success: false },
      ];

      const output = aggregateResults(results);
      expect(output).toContain('Unknown error');
    });
  });
});
