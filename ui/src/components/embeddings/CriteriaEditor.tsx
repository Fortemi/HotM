import { useState } from 'react';
import { X } from 'lucide-react';
import type { EmbeddingSetCriteria } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CriteriaEditorProps {
  criteria: EmbeddingSetCriteria;
  onChange: (criteria: EmbeddingSetCriteria) => void;
  collections: Array<{ id: string; name: string }>;
}

export function CriteriaEditor({ criteria, onChange, collections }: CriteriaEditorProps) {
  const [tagInput, setTagInput] = useState('');

  const tags = criteria.tags ?? [];
  const selectedCollections = criteria.collections ?? [];

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const value = tagInput.trim();
    if (!value || tags.includes(value)) return;
    onChange({ ...criteria, tags: [...tags, value] });
    setTagInput('');
  }

  function removeTag(tag: string) {
    onChange({ ...criteria, tags: tags.filter((t) => t !== tag) });
  }

  function toggleCollection(id: string, checked: boolean) {
    const next = checked
      ? [...selectedCollections, id]
      : selectedCollections.filter((c) => c !== id);
    onChange({ ...criteria, collections: next });
  }

  function handleFtsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    onChange({ ...criteria, fts_query: value || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Tags</label>
        <div
          className={cn(
            'flex flex-wrap gap-1.5 rounded-md border border-input bg-transparent px-3 py-2',
            'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]'
          )}
        >
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${tag}`}
                className="size-3.5 shrink-0 rounded-sm p-0 hover:bg-transparent hover:text-foreground"
                onClick={() => removeTag(tag)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
          <input
            type="text"
            value={tagInput}
            placeholder="Add tag and press Enter"
            className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
          />
        </div>
      </div>

      {collections.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Collections</label>
          <div className="space-y-1.5 rounded-md border border-input p-3">
            {collections.map((col) => {
              const checked = selectedCollections.includes(col.id);
              return (
                <div key={col.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`col-${col.id}`}
                    checked={checked}
                    className="size-4 rounded border-input accent-primary"
                    onChange={(e) => toggleCollection(col.id, e.target.checked)}
                  />
                  <label
                    htmlFor={`col-${col.id}`}
                    className="cursor-pointer text-sm text-foreground"
                  >
                    {col.name}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Full-text query</label>
        <Input
          type="text"
          value={criteria.fts_query ?? ''}
          placeholder="Full-text search query"
          onChange={handleFtsChange}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-all"
            checked={criteria.include_all ?? false}
            className="size-4 rounded border-input accent-primary"
            onChange={(e) => onChange({ ...criteria, include_all: e.target.checked })}
          />
          <label htmlFor="include-all" className="cursor-pointer text-sm text-foreground">
            Include all matching
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="exclude-archived"
            checked={criteria.exclude_archived ?? false}
            className="size-4 rounded border-input accent-primary"
            onChange={(e) => onChange({ ...criteria, exclude_archived: e.target.checked })}
          />
          <label htmlFor="exclude-archived" className="cursor-pointer text-sm text-foreground">
            Exclude archived notes
          </label>
        </div>
      </div>
    </div>
  );
}
