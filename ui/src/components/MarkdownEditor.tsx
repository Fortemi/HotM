import MDEditor from '@uiw/react-md-editor';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

export function MarkdownEditor({ value, onChange, height = 500 }: MarkdownEditorProps) {
  return (
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
  );
}