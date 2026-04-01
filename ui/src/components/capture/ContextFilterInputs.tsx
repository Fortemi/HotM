import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContextFilter } from "@/api/types";

export interface ContextFilterInputsProps {
  contextFilter: ContextFilter;
  onContextFilterChange: (filter: ContextFilter) => void;
  collections: Array<{ id: string; name: string }>;
  allTags?: Array<{ name: string; count?: number }>;
  filterValid: boolean;
}

export function ContextFilterInputs({
  contextFilter,
  onContextFilterChange,
  collections,
  allTags = [],
  filterValid,
}: ContextFilterInputsProps) {
  const [filterTagInput, setFilterTagInput] = useState("");
  const [filterTagSuggestionsOpen, setFilterTagSuggestionsOpen] =
    useState(false);

  const handleAddFilterTag = useCallback(
    (tag: string) => {
      const current = contextFilter.tags ?? [];
      if (!current.includes(tag)) {
        onContextFilterChange({
          ...contextFilter,
          tags: [...current, tag],
        });
      }
    },
    [contextFilter, onContextFilterChange]
  );

  const handleRemoveFilterTag = useCallback(
    (tag: string) => {
      onContextFilterChange({
        ...contextFilter,
        tags: (contextFilter.tags ?? []).filter((t) => t !== tag),
      });
    },
    [contextFilter, onContextFilterChange]
  );

  const filteredFilterTags = allTags.filter(
    (t) =>
      !(contextFilter.tags ?? []).includes(t.name) &&
      t.name.toLowerCase().includes(filterTagInput.toLowerCase())
  );

  return (
    <div className="border border-border rounded-md p-3 space-y-3 bg-background">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Context Filters
        </span>
        {!filterValid && (
          <span className="text-xs text-destructive">
            — at least one filter required
          </span>
        )}
      </div>

      {/* Filter Tags */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Tags
        </label>
        <div className="flex flex-wrap items-center gap-1 p-1.5 border rounded-md bg-background min-h-[32px]">
          {(contextFilter.tags ?? []).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 rounded-full px-2 py-0.5 text-xs gap-1"
            >
              {tag}
              <button
                onClick={() => handleRemoveFilterTag(tag)}
                className="opacity-60 hover:opacity-100"
                aria-label={`Remove filter tag: ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <div className="relative flex-1 min-w-[80px]">
            <input
              type="text"
              value={filterTagInput}
              onChange={(e) => {
                setFilterTagInput(e.target.value);
                setFilterTagSuggestionsOpen(e.target.value.length > 0);
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === "Tab") &&
                  filterTagInput.trim()
                ) {
                  e.preventDefault();
                  handleAddFilterTag(filterTagInput.trim());
                  setFilterTagInput("");
                  setFilterTagSuggestionsOpen(false);
                }
                if (
                  e.key === "Backspace" &&
                  filterTagInput === "" &&
                  (contextFilter.tags ?? []).length > 0
                ) {
                  handleRemoveFilterTag(
                    (contextFilter.tags ?? [])[(contextFilter.tags ?? []).length - 1]
                  );
                }
              }}
              onFocus={() => {
                if (filterTagInput.length > 0)
                  setFilterTagSuggestionsOpen(true);
              }}
              onBlur={() =>
                setTimeout(() => setFilterTagSuggestionsOpen(false), 200)
              }
              placeholder="Add tag filter..."
              className="w-full border-0 bg-transparent text-xs h-6 focus:outline-none"
              aria-label="Add context filter tag"
            />
            {filterTagSuggestionsOpen &&
              filteredFilterTags.length > 0 && (
                <div className="absolute z-50 top-7 left-0 w-48 bg-popover border rounded-md shadow-md max-h-36 overflow-auto">
                  {filteredFilterTags.slice(0, 10).map((t) => (
                    <button
                      key={t.name}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddFilterTag(t.name);
                        setFilterTagInput("");
                        setFilterTagSuggestionsOpen(false);
                      }}
                    >
                      <span>{t.name}</span>
                      {t.count !== undefined && (
                        <span className="text-muted-foreground">
                          {t.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Filter Collection */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Collection
        </label>
        <Select
          value={contextFilter.collection_id ?? "__all__"}
          onValueChange={(v) =>
            onContextFilterChange({
              ...contextFilter,
              collection_id: v === "__all__" ? null : v,
            })
          }
        >
          <SelectTrigger className="h-8 text-xs" aria-label="Filter collection">
            <SelectValue placeholder="All Collections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Collections</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter Search Query */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Search
        </label>
        <input
          type="text"
          value={contextFilter.query ?? ""}
          onChange={(e) =>
            onContextFilterChange({
              ...contextFilter,
              query: e.target.value || undefined,
            })
          }
          placeholder="Optional search terms to scope context..."
          className="h-8 w-full px-2 border rounded-md text-xs bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Context filter search query"
        />
      </div>
    </div>
  );
}
