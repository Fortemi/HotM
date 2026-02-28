import { describe, it, expect, vi } from 'vitest';
import {
  formatSessionAsMarkdown,
  formatSessionAsJSON,
  formatSessionAsPlainText,
  downloadExport,
} from '../session-export';
import type { UIMessage } from '@ai-sdk/react';

const userMsg = (text: string): UIMessage => ({
  id: `u-${Date.now()}`,
  role: 'user',
  parts: [{ type: 'text' as const, text }],
});

const assistantMsg = (text: string): UIMessage => ({
  id: `a-${Date.now()}`,
  role: 'assistant',
  parts: [{ type: 'text' as const, text }],
});

describe('session-export', () => {
  describe('formatSessionAsMarkdown', () => {
    it('includes session name as heading', () => {
      const md = formatSessionAsMarkdown([], { sessionName: 'My Chat' });
      expect(md).toContain('# My Chat');
    });

    it('formats user and assistant messages', () => {
      const messages = [userMsg('Hello'), assistantMsg('Hi there')];
      const md = formatSessionAsMarkdown(messages);
      expect(md).toContain('**User**:');
      expect(md).toContain('Hello');
      expect(md).toContain('**Assistant**:');
      expect(md).toContain('Hi there');
    });

    it('includes separator between messages', () => {
      const messages = [userMsg('First'), assistantMsg('Second')];
      const md = formatSessionAsMarkdown(messages);
      expect(md).toContain('---');
    });

    it('skips messages with no text content', () => {
      const emptyMsg: UIMessage = {
        id: 'empty',
        role: 'assistant',
        parts: [],
      };
      const md = formatSessionAsMarkdown([emptyMsg]);
      expect(md).not.toContain('**Assistant**:');
    });
  });

  describe('formatSessionAsJSON', () => {
    it('produces valid JSON', () => {
      const messages = [userMsg('Hello')];
      const json = formatSessionAsJSON(messages, { sessionName: 'Test' });
      const parsed = JSON.parse(json);
      expect(parsed.sessionName).toBe('Test');
      expect(parsed.messageCount).toBe(1);
      expect(parsed.messages).toHaveLength(1);
    });

    it('includes exportedAt timestamp', () => {
      const json = formatSessionAsJSON([]);
      const parsed = JSON.parse(json);
      expect(parsed.exportedAt).toBeDefined();
      expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN();
    });

    it('includes message content array', () => {
      const messages = [userMsg('Test message')];
      const json = formatSessionAsJSON(messages);
      const parsed = JSON.parse(json);
      expect(parsed.messages[0].content).toContain('Test message');
    });
  });

  describe('formatSessionAsPlainText', () => {
    it('includes session name and export header', () => {
      const text = formatSessionAsPlainText([], { sessionName: 'My Session' });
      expect(text).toContain('My Session');
      expect(text).toContain('Exported:');
    });

    it('formats user and assistant messages', () => {
      const messages = [userMsg('Question'), assistantMsg('Answer')];
      const text = formatSessionAsPlainText(messages);
      expect(text).toContain('[User]');
      expect(text).toContain('Question');
      expect(text).toContain('[Assistant]');
      expect(text).toContain('Answer');
    });

    it('includes separator line', () => {
      const text = formatSessionAsPlainText([]);
      expect(text).toContain('='.repeat(40));
    });
  });

  describe('downloadExport', () => {
    it('creates blob URL and triggers download', () => {
      const createObjectURL = vi.fn(() => 'blob:test');
      const revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;

      const clickSpy = vi.fn();
      const appendSpy = vi.fn();
      const removeSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendSpy);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeSpy);

      downloadExport('content', 'file.md', 'text/markdown');

      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');

      vi.restoreAllMocks();
    });
  });
});
