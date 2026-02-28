/**
 * session-export — pure formatting functions for exporting agent sessions.
 *
 * Supports Markdown, JSON, and plain text export formats.
 * Reuses extractMessageText from context-compaction for text extraction.
 */

import { isToolUIPart, getToolName } from 'ai';
import type { UIMessage } from '@ai-sdk/react';

export type ExportFormat = 'markdown' | 'json' | 'text';

export interface ExportOptions {
  includeToolResults?: boolean;
  sessionName?: string;
}

function formatToolPart(part: UIMessage['parts'][number]): string | null {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  if (part.state === 'output-available') {
    const output =
      typeof part.output === 'string'
        ? part.output
        : JSON.stringify(part.output, null, 2);
    const summary =
      output.length > 200 ? output.slice(0, 200) + '...' : output;
    return `[Tool: ${name}] ${summary}`;
  }
  if (part.state === 'output-error') {
    return `[Tool: ${name}] Error: ${part.errorText}`;
  }
  return `[Tool: ${name}] (in progress)`;
}

function getMessageTexts(msg: UIMessage, includeTools: boolean): string[] {
  const parts: string[] = [];
  for (const part of msg.parts) {
    if (part.type === 'text' && part.text) {
      parts.push(part.text);
    }
    if (includeTools) {
      const toolText = formatToolPart(part);
      if (toolText) parts.push(toolText);
    }
  }
  return parts;
}

export function formatSessionAsMarkdown(
  messages: UIMessage[],
  options: ExportOptions = {},
): string {
  const { includeToolResults = true, sessionName = 'Agent Session' } = options;
  const now = new Date().toLocaleString();
  const lines: string[] = [
    `# ${sessionName}`,
    `*Exported: ${now}*`,
    '',
    '---',
    '',
  ];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const texts = getMessageTexts(msg, includeToolResults);
    if (texts.length === 0) continue;

    lines.push(`**${role}**:`);
    for (const text of texts) {
      if (text.startsWith('[Tool:')) {
        lines.push(`> ${text}`);
      } else {
        lines.push(text);
      }
    }
    lines.push('', '---', '');
  }

  return lines.join('\n');
}

/** JSON replacer that handles BigInt and other non-serializable values */
function safeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function formatSessionAsJSON(
  messages: UIMessage[],
  options: ExportOptions = {},
): string {
  const { includeToolResults = true, sessionName = 'Agent Session' } = options;
  const data = {
    sessionName,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: getMessageTexts(msg, includeToolResults),
      parts: msg.parts,
    })),
  };
  return JSON.stringify(data, safeReplacer, 2);
}

export function formatSessionAsPlainText(
  messages: UIMessage[],
  options: ExportOptions = {},
): string {
  const { includeToolResults = true, sessionName = 'Agent Session' } = options;
  const now = new Date().toLocaleString();
  const lines: string[] = [
    sessionName,
    `Exported: ${now}`,
    '='.repeat(40),
    '',
  ];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const texts = getMessageTexts(msg, includeToolResults);
    if (texts.length === 0) continue;

    lines.push(`[${role}]`);
    for (const text of texts) {
      lines.push(text);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadExport(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function triggerPrint(): void {
  window.print();
}
