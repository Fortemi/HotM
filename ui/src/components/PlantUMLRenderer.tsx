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
      const rendered = await invoke<string>('render_plantuml', { code });
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