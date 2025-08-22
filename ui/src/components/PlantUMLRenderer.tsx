import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PlantUMLRendererProps {
  code: string;
  className?: string;
}

export function PlantUMLRenderer({ code, className = '' }: PlantUMLRendererProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    renderPlantUML();
  }, [code]);

  const renderPlantUML = async () => {
    if (!code) {
      setSvg(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Call Tauri backend to render PlantUML
      console.log('Rendering PlantUML diagram:', code.substring(0, 100) + '...');
      const rendered = await invoke<string>('render_plantuml', { code });
      console.log('PlantUML rendered successfully');
      setSvg(rendered);
    } catch (err) {
      console.error('Failed to render PlantUML:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      setSvg(null);
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
    // Check if it's a PlantUML not found error
    if (error.includes('PlantUML JAR file not found') || error.includes('Java is not installed')) {
      return (
        <div className={`p-4 border border-warning/50 rounded-lg bg-warning/10 ${className}`}>
          <div className="text-sm text-warning mb-2">PlantUML is not configured</div>
          <div className="text-xs opacity-70">
            To render PlantUML diagrams, you need:
            <ul className="list-disc list-inside mt-1">
              <li>Java installed on your system</li>
              <li>PlantUML JAR file (will be downloaded automatically on first use)</li>
            </ul>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs">Show diagram source</summary>
            <pre className="mt-2 text-xs opacity-70 overflow-x-auto">{code}</pre>
          </details>
        </div>
      );
    }
    
    return (
      <div className={`p-4 border border-destructive/50 rounded-lg bg-destructive/10 ${className}`}>
        <div className="text-sm text-destructive">Failed to render diagram: {error}</div>
        <pre className="mt-2 text-xs opacity-70">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return null;
  }

  return (
    <div 
      className={`plantuml-diagram ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}