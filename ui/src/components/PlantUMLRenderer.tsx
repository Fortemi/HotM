import { useState, useEffect } from 'react';
import pako from 'pako';

interface PlantUMLRendererProps {
  code: string;
  className?: string;
}

// PlantUML encoding function using deflate compression
function encode64(data: Uint8Array): string {
  let r = '';
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      r += append3bytes(data[i], data[i + 1], 0);
    } else if (i + 1 === data.length) {
      r += append3bytes(data[i], 0, 0);
    } else {
      r += append3bytes(data[i], data[i + 1], data[i + 2]);
    }
  }
  return r;
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3F;
  let r = '';
  r += encode6bit(c1 & 0x3F);
  r += encode6bit(c2 & 0x3F);
  r += encode6bit(c3 & 0x3F);
  r += encode6bit(c4 & 0x3F);
  return r;
}

function encode6bit(b: number): string {
  if (b < 10) {
    return String.fromCharCode(48 + b);
  }
  b -= 10;
  if (b < 26) {
    return String.fromCharCode(65 + b);
  }
  b -= 26;
  if (b < 26) {
    return String.fromCharCode(97 + b);
  }
  b -= 26;
  if (b === 0) {
    return '-';
  }
  if (b === 1) {
    return '_';
  }
  return '?';
}

function encodePlantUML(text: string): string {
  const data = unescape(encodeURIComponent(text));
  const compressed = pako.deflateRaw(data, { level: 9 });
  return encode64(compressed);
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
      
      // Encode the PlantUML code with deflate compression
      const encoded = encodePlantUML(code);
      
      // Use the PlantUML server API with the encoded text
      const url = `http://localhost:8080/svg/${encoded}`;
      
      console.log('Fetching PlantUML diagram from:', url.substring(0, 100) + '...');
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`PlantUML server returned ${response.status}`);
      }
      
      const svgText = await response.text();
      console.log('PlantUML rendered successfully');
      setSvg(svgText);
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
    // Check if it's a PlantUML server not available error
    if (error.includes('PlantUML server is not available') || error.includes('Failed to connect to PlantUML server')) {
      return (
        <div className={`p-4 border border-warning/50 rounded-lg bg-warning/10 ${className}`}>
          <div className="text-sm text-warning mb-2">PlantUML server is not running</div>
          <div className="text-xs opacity-70">
            To render PlantUML diagrams, the PlantUML server needs to be running on port 8080.
            <br />
            The server is usually started automatically when you run the API server.
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