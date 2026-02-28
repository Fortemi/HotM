/**
 * MarkdownRenderer — renders markdown content with Tailwind prose styling.
 *
 * Used for assistant messages. Supports GFM (tables, strikethrough, task lists),
 * code blocks with copy button, and safe link handling.
 */

import { useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/code:opacity-100"
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
      {...props}
    >
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => {
    // Extract code text for copy button
    let codeText = '';
    const child = children as React.ReactElement<{ children?: React.ReactNode }> | null;
    if (child && typeof child === 'object' && 'props' in child && child.props?.children) {
      codeText = String(child.props.children);
    }
    return (
      <div className="group/code relative">
        <pre
          className="overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono"
          {...props}
        >
          {children}
        </pre>
        {codeText && <CodeCopyButton code={codeText} />}
      </div>
    );
  },
  code: ({ className, children, ...props }) => {
    // Detect if this is an inline code (no language class = inline)
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code className={cn('text-xs', className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        // Override prose defaults for compact chat display
        'prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1',
        'prose-li:my-0 prose-pre:my-2 prose-blockquote:my-2',
        'prose-table:my-2 prose-hr:my-3',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
