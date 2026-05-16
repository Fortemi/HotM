import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  code: string;
  className?: string;
}

// Initialize mermaid with configuration (will be called on each component mount)
const initializeMermaid = () => {
  // Check if dark mode is enabled
  const isDarkMode = document.documentElement.classList.contains('dark') || 
                     (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  mermaid.initialize({
    startOnLoad: false,
    theme: isDarkMode ? 'dark' : 'default',
    // strict (default): sanitize all labels, no HTML / no script. The bundle
    // analysis (#219) confirmed no in-tree code requires HTML-in-labels;
    // tightening from 'loose' closes the actual XSS surface that #213's
    // npm-advisory patch addressed only at the library-version level.
    securityLevel: 'strict',
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
};

export function MermaidRenderer({ code, className = '' }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerHeight, setContainerHeight] = useState<string>('max-h-[32rem]');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // Function to clean up Mermaid error elements that get appended to the DOM
  const cleanupMermaidErrors = () => {
    // Remove any Mermaid error divs that may have been created
    const errorElements = document.querySelectorAll('div[id^="d"]');
    errorElements.forEach(element => {
      // Check if this looks like a Mermaid error element
      if (element.textContent?.includes('Syntax error in text') || 
          element.textContent?.includes('mermaid version') ||
          element.textContent?.includes('Parse error')) {
        element.remove();
      }
    });
    
    // Also remove any elements with Mermaid error classes if they exist
    const mermaidErrors = document.querySelectorAll('.mermaid-parse-error, .mermaid-error');
    mermaidErrors.forEach(element => element.remove());
    
    // Remove any script tags that Mermaid might have created for errors
    const errorScripts = document.querySelectorAll('script[id^="d"]');
    errorScripts.forEach(script => script.remove());
  };

  // Zoom control functions
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.2));
  const handleZoomReset = () => setZoom(1);
  const handleCenter = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
      const scrollTop = (container.scrollHeight - container.clientHeight) / 2;
      container.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'smooth' });
    }
  };
  
  const handleFitContent = () => {
    if (containerRef.current && scrollContainerRef.current) {
      const content = containerRef.current;
      
      // Get the natural size of the content
      const contentHeight = content.scrollHeight;
      
      // Determine optimal height (with some padding and reasonable limits)
      const minHeight = 200; // min-h-48 equivalent (12rem = 192px)
      const maxHeight = 600; // reasonable max for most screens
      const optimalHeight = Math.min(Math.max(contentHeight + 32, minHeight), maxHeight); // +32 for padding
      
      if (optimalHeight < maxHeight) {
        setContainerHeight(`h-[${optimalHeight}px]`);
      } else {
        setContainerHeight('max-h-[37.5rem]'); // 600px
      }
      
      // Reset zoom and center
      setZoom(1);
      setTimeout(handleCenter, 100);
    }
  };

  // Drag navigation functions
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scrollContainerRef.current && e.button === 0) { // Left mouse button only
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setScrollStart({
        x: scrollContainerRef.current.scrollLeft,
        y: scrollContainerRef.current.scrollTop
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scrollContainerRef.current) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      
      scrollContainerRef.current.scrollLeft = scrollStart.x - dx;
      scrollContainerRef.current.scrollTop = scrollStart.y - dy;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    // Initialize mermaid on mount
    initializeMermaid();
    renderMermaid();
    
    // Cleanup function to remove any lingering Mermaid elements
    return () => {
      cleanupMermaidErrors();
    };
  }, [code]);

  const renderMermaid = async () => {
    if (!code) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Generate a unique ID for this diagram
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      // Clean up any existing Mermaid error elements before rendering
      cleanupMermaidErrors();
      
      // Parse and render the diagram
      console.log('Rendering Mermaid diagram with code:', code.substring(0, 100));
      const { svg } = await mermaid.render(id, code);
      setRenderedSvg(svg);
      
      // Clean up any error elements that mermaid might have created during successful render
      cleanupMermaidErrors();
    } catch (err) {
      console.error('Failed to render Mermaid diagram:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      setRenderedSvg(null);
      
      // Clean up any partial renders and error elements
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      cleanupMermaidErrors();
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
      <div className={`border border-destructive/50 rounded-lg bg-destructive/10 ${className}`}>
        {/* Header with error info */}
        <div className="p-3 border-b border-destructive/20">
          <div className="text-sm text-destructive mb-1">Failed to render Mermaid diagram</div>
          <details>
            <summary className="cursor-pointer text-xs opacity-70 hover:opacity-100">Show error details</summary>
            <div className="mt-2 text-xs opacity-70 font-mono bg-muted/20 p-2 rounded">
              {error}
            </div>
          </details>
        </div>
        
        {/* Scrollable container with the raw code */}
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            className={`overflow-auto bg-muted/5 max-h-96 min-h-48 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ 
              scrollbarWidth: 'thin',
              maxWidth: '100%',
              userSelect: isDragging ? 'none' : 'auto'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <pre className="p-4 text-xs font-mono whitespace-pre min-w-max">{code}</pre>
          </div>
          
          {/* Controls */}
          <div className="absolute top-2 right-2 flex gap-1 bg-background/80 backdrop-blur-sm rounded border p-1">
            <button
              onClick={handleCenter}
              className="p-1 text-xs hover:bg-muted/50 rounded"
              title="Center content"
            >
              📍
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!renderedSvg) {
    return null;
  }

  return (
    <div className={`border rounded-lg bg-muted/5 ${className}`}>
      {/* Scrollable container with zoom controls */}
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className={`overflow-auto ${containerHeight} min-h-64 bg-background/50 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ 
            scrollbarWidth: 'thin',
            maxWidth: '100%',
            userSelect: isDragging ? 'none' : 'auto'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            ref={containerRef}
            className="mermaid-diagram inline-block min-w-max p-4"
            style={{ 
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              transition: 'transform 0.2s ease'
            }}
            dangerouslySetInnerHTML={{ __html: renderedSvg }}
          />
        </div>
        
        {/* Zoom and center controls */}
        <div className="absolute top-2 right-2 flex gap-1 bg-background/90 backdrop-blur-sm rounded border p-1 shadow-sm">
          <button
            onClick={handleZoomOut}
            className="p-1 text-xs hover:bg-muted/50 rounded"
            title="Zoom out"
            disabled={zoom <= 0.2}
          >
            🔍➖
          </button>
          <button
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs hover:bg-muted/50 rounded font-mono"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1 text-xs hover:bg-muted/50 rounded"
            title="Zoom in"
            disabled={zoom >= 3}
          >
            🔍➕
          </button>
          <button
            onClick={handleFitContent}
            className="p-1 text-xs hover:bg-muted/50 rounded"
            title="Fit to content"
          >
            📐
          </button>
          <button
            onClick={handleCenter}
            className="p-1 text-xs hover:bg-muted/50 rounded"
            title="Center diagram"
          >
            📍
          </button>
        </div>
      </div>
    </div>
  );
}