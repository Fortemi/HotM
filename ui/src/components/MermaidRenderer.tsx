import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  code: string;
  className?: string;
}

// Check if dark mode is enabled
const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Initialize mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: isDarkMode ? 'dark' : 'default',
  securityLevel: 'loose',
  themeVariables: isDarkMode ? {
    // Dark mode theme
    primaryColor: '#8b5cf6',
    primaryTextColor: '#e5e7eb',
    primaryBorderColor: '#7c3aed',
    lineColor: '#9ca3af',
    secondaryColor: '#4c1d95',
    tertiaryColor: '#2e1065',
    background: '#1f2937',
    mainBkg: '#4c1d95',
    secondBkg: '#2e1065',
    tertiaryBkg: '#1e1b4b',
    textColor: '#e5e7eb',
    labelColor: '#d1d5db',
    errorBkgColor: '#7f1d1d',
    errorTextColor: '#fca5a5',
  } : {
    // Light mode theme
    primaryColor: '#8b5cf6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#7c3aed',
    lineColor: '#6b7280',
    secondaryColor: '#f3e8ff',
    tertiaryColor: '#faf5ff',
    background: '#ffffff',
    mainBkg: '#8b5cf6',
    secondBkg: '#f3e8ff',
    tertiaryBkg: '#faf5ff',
    textColor: '#1f2937',
    labelColor: '#000',
    errorBkgColor: '#fee2e2',
    errorTextColor: '#dc2626',
  },
});

export function MermaidRenderer({ code, className = '' }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);

  useEffect(() => {
    renderMermaid();
  }, [code]);

  const renderMermaid = async () => {
    if (!code || !containerRef.current) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Generate a unique ID for this diagram
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      // Parse and render the diagram
      const { svg } = await mermaid.render(id, code);
      setRenderedSvg(svg);
      
      // Clean up any error elements that mermaid might have created
      const errorElement = document.getElementById('d' + id);
      if (errorElement) {
        errorElement.remove();
      }
    } catch (err) {
      console.error('Failed to render Mermaid diagram:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      setRenderedSvg(null);
      
      // Clean up any partial renders
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 border rounded-lg bg-muted/30 ${className}`}>
        <div className="text-muted-foreground">Rendering diagram...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 border border-destructive/50 rounded-lg bg-destructive/10 ${className}`}>
        <div className="text-sm text-destructive mb-2">Failed to render Mermaid diagram</div>
        <div className="text-xs opacity-70">{error}</div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs">Show diagram source</summary>
          <pre className="mt-2 text-xs opacity-70 overflow-x-auto">{code}</pre>
        </details>
      </div>
    );
  }

  if (!renderedSvg) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={`mermaid-diagram ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedSvg }}
    />
  );
}