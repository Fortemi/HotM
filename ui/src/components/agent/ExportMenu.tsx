/**
 * ExportMenu — dropdown for exporting/printing agent sessions.
 *
 * Renders a Download icon button with dropdown options for Markdown,
 * JSON, plain text, and print. Disabled when no messages.
 */

import { Download, FileText, FileJson, FileType, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  formatSessionAsMarkdown,
  formatSessionAsJSON,
  formatSessionAsPlainText,
  downloadExport,
  triggerPrint,
} from './session-export';
import type { UIMessage } from '@ai-sdk/react';

interface ExportMenuProps {
  messages: UIMessage[];
  sessionName?: string;
  disabled?: boolean;
}

export function ExportMenu({
  messages,
  sessionName = 'Agent Session',
  disabled = false,
}: ExportMenuProps) {
  const isDisabled = disabled || messages.length === 0;
  const safeName = sessionName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');

  const handleMarkdown = () => {
    const content = formatSessionAsMarkdown(messages, { sessionName });
    downloadExport(content, `${safeName}.md`, 'text/markdown');
  };

  const handleJSON = () => {
    const content = formatSessionAsJSON(messages, { sessionName });
    downloadExport(content, `${safeName}.json`, 'application/json');
  };

  const handleText = () => {
    const content = formatSessionAsPlainText(messages, { sessionName });
    downloadExport(content, `${safeName}.txt`, 'text/plain');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDisabled}
          className="text-muted-foreground"
          title="Export session"
        >
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleMarkdown}>
          <FileText className="mr-2 h-3.5 w-3.5" />
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleJSON}>
          <FileJson className="mr-2 h-3.5 w-3.5" />
          JSON (.json)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleText}>
          <FileType className="mr-2 h-3.5 w-3.5" />
          Plain Text (.txt)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={triggerPrint}>
          <Printer className="mr-2 h-3.5 w-3.5" />
          Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
