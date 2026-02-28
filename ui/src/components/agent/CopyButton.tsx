/**
 * CopyButton — copies text to clipboard with visual feedback.
 *
 * Shows a Copy icon that transitions to a green Check icon for 2 seconds
 * after successful copy. Appears via group-hover in the parent container.
 */

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: noop if clipboard API unavailable
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className={cn(
        'h-6 w-6 opacity-0 transition-opacity group-hover/message:opacity-100',
        className,
      )}
      aria-label={copied ? 'Copied' : 'Copy message'}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  );
}
