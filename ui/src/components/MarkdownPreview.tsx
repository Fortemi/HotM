import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { PlantUMLRenderer } from './PlantUMLRenderer';
import { MermaidRenderer } from './MermaidRenderer';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className = "" }: MarkdownPreviewProps) {
  return (
    <div className={`prose prose-slate prose-sm max-w-none dark:prose-invert 
                     prose-headings:font-bold prose-headings:text-foreground
                     prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                     prose-p:text-foreground prose-p:leading-relaxed
                     prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                     prose-strong:text-foreground prose-strong:font-semibold
                     prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                     prose-pre:bg-muted prose-pre:text-foreground
                     prose-ol:text-foreground prose-ul:text-foreground
                     prose-blockquote:text-muted-foreground prose-blockquote:border-primary
                     ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom rendering for code blocks
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const inline = !className || !className.includes('language-');
            
            if (!inline && language) {
              // Handle PlantUML blocks
              if (language === 'plantuml' || language === 'puml') {
                const code = String(children).replace(/\n$/, '');
                return <PlantUMLRenderer code={code} className="my-4" />;
              }
              
              // Handle Mermaid blocks
              if (language === 'mermaid') {
                const code = String(children).replace(/\n$/, '');
                return <MermaidRenderer code={code} className="my-4" />;
              }
              
              return (
                <div className="relative">
                  <div className="absolute top-2 right-2 text-xs text-gray-500 dark:text-gray-400">
                    {language}
                  </div>
                  <pre className={`language-${language} rounded-lg overflow-x-auto`}>
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }
            
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Custom rendering for tables
          table({ children }: any) {
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  {children}
                </table>
              </div>
            );
          },
          // Enhanced blockquote styling
          blockquote({ children }: any) {
            return (
              <blockquote className="border-l-4 border-purple-500 pl-4 italic bg-purple-50 dark:bg-purple-950/20 py-2 my-4">
                {children}
              </blockquote>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}