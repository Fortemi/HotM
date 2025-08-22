import { useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownPreview } from './MarkdownPreview';
import { SplitSquareHorizontal, Code, Eye } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  defaultMode?: 'split' | 'raw' | 'preview';
}

export function MarkdownEditor({ 
  value, 
  onChange, 
  height = 500, 
  defaultMode = 'split' 
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'split' | 'raw' | 'preview'>(defaultMode);
  
  if (mode === 'split') {
    return (
      <div className="space-y-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList>
            <TabsTrigger value="split" className="gap-2">
              <SplitSquareHorizontal className="h-3 w-3" />
              Side by Side
            </TabsTrigger>
            <TabsTrigger value="raw" className="gap-2">
              <Code className="h-3 w-3" />
              Raw Markdown
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-3 w-3" />
              Preview Only
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div data-color-mode="dark">
          <MDEditor
            value={value}
            onChange={(val) => onChange(val || '')}
            height={height}
            preview="live"
            previewOptions={{
              remarkPlugins: [remarkGfm, remarkMath],
              rehypePlugins: [rehypeKatex],
            }}
            textareaProps={{
              placeholder: 'Start writing your thoughts... (Supports Markdown, LaTeX math, tables, and more)',
            }}
          />
        </div>
      </div>
    );
  }
  
  if (mode === 'raw') {
    return (
      <div className="space-y-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList>
            <TabsTrigger value="split" className="gap-2">
              <SplitSquareHorizontal className="h-3 w-3" />
              Side by Side
            </TabsTrigger>
            <TabsTrigger value="raw" className="gap-2">
              <Code className="h-3 w-3" />
              Raw Markdown
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-3 w-3" />
              Preview Only
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
          style={{ minHeight: height }}
          placeholder="Write in Markdown format..."
        />
      </div>
    );
  }
  
  // Preview mode
  return (
    <div className="space-y-2">
      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList>
          <TabsTrigger value="split" className="gap-2">
            <SplitSquareHorizontal className="h-3 w-3" />
            Side by Side
          </TabsTrigger>
          <TabsTrigger value="raw" className="gap-2">
            <Code className="h-3 w-3" />
            Raw Markdown
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-3 w-3" />
            Preview Only
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="border rounded-lg p-4" style={{ minHeight: height }}>
        <MarkdownPreview content={value} />
      </div>
    </div>
  );
}