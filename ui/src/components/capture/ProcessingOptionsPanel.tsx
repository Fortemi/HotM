import { useState } from "react";
import {
  Settings2,
  ChevronRight,
  ChevronDown,
  Info,
  AlertCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContextFilterInputs } from "./ContextFilterInputs";
import type { RevisionMode, ContextFilter, ProcessingOptions } from "@/api/types";
import type { Collection, Tag } from "@/api";

const REVISION_MODES: {
  value: RevisionMode;
  label: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "None",
    description: "Keep original, no AI processing",
  },
  {
    value: "light",
    label: "Light",
    description: "Formatting cleanup only",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Revise for clarity (content only)",
  },
  {
    value: "contextual",
    label: "Contextual",
    description: "Revise with related knowledge base context",
  },
  {
    value: "contextual_filtered",
    label: "Filtered Context",
    description: "Revise with context from matching notes only",
  },
];

const PROCESSING_TOGGLES: {
  key: keyof ProcessingOptions;
  label: string;
  description: string;
}[] = [
  {
    key: "autoTagConcepts",
    label: "Auto-tag concepts",
    description: "Extract and apply SKOS concept tags",
  },
  {
    key: "generateEmbeddings",
    label: "Generate embeddings",
    description: "Create semantic embeddings for search",
  },
  {
    key: "autoLinkRelated",
    label: "Auto-link related",
    description: "Find and link semantically similar notes",
  },
  {
    key: "extractMedia",
    label: "Extract media content",
    description: "Run extraction pipeline on attachments",
  },
  {
    key: "generateTitle",
    label: "Generate title",
    description: "AI-generate title from content",
  },
];

function getModeSummary(mode: RevisionMode): string {
  const m = REVISION_MODES.find((r) => r.value === mode);
  return m ? m.label : mode;
}

function getProcessingSummary(processing: ProcessingOptions): string {
  const allOn = Object.values(processing).every(Boolean);
  if (allOn) return "all features";
  const noneOn = Object.values(processing).every((v) => !v);
  if (noneOn) return "no features";
  const count = Object.values(processing).filter(Boolean).length;
  return `${count}/${PROCESSING_TOGGLES.length} features`;
}

interface ProcessingOptionsPanelProps {
  revisionMode: RevisionMode;
  contextFilter: ContextFilter;
  processing: ProcessingOptions;
  collections: Collection[];
  allTags: Tag[];
  onRevisionModeChange: (mode: RevisionMode) => void;
  onContextFilterChange: (filter: ContextFilter) => void;
  onProcessingOptionChange: <K extends keyof ProcessingOptions>(
    key: K,
    value: ProcessingOptions[K]
  ) => void;
}

export function ProcessingOptionsPanel({
  revisionMode,
  contextFilter,
  processing,
  collections,
  allTags,
  onRevisionModeChange,
  onContextFilterChange,
  onProcessingOptionChange,
}: ProcessingOptionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const showContextFilters = revisionMode === "contextual_filtered";

  // Validation: contextual_filtered requires at least one filter
  const filterValid =
    !showContextFilters ||
    (contextFilter.tags && contextFilter.tags.length > 0) ||
    contextFilter.collection_id ||
    (contextFilter.query && contextFilter.query.trim().length > 0);

  const currentModeInfo = REVISION_MODES.find((m) => m.value === revisionMode);

  const summaryText = `${getModeSummary(revisionMode)} revision, ${getProcessingSummary(processing)}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-4">
      {/* Collapsed summary / toggle header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-muted/40 transition-colors"
        aria-expanded={isOpen}
        aria-controls="processing-options-panel"
      >
        <Settings2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground flex-shrink-0">Processing:</span>
        <span className="truncate">{summaryText}</span>
        {!filterValid && (
          <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
        )}
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
        )}
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div
          id="processing-options-panel"
          className="border-t border-border px-4 py-3 space-y-4 bg-muted/20"
        >
          {/* Revision Mode Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              AI Revision
            </label>
            <Select
              value={revisionMode}
              onValueChange={(v) => onRevisionModeChange(v as RevisionMode)}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="AI revision mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVISION_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    <span className="flex items-center gap-2">
                      <span>{mode.label}</span>
                      <span className="text-muted-foreground text-xs">
                        — {mode.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentModeInfo && (
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {currentModeInfo.description}
              </p>
            )}
          </div>

          {/* Context Filters (conditional on contextual_filtered) */}
          {showContextFilters && (
            <ContextFilterInputs
              contextFilter={contextFilter}
              onContextFilterChange={onContextFilterChange}
              collections={collections}
              allTags={allTags}
              filterValid={!!filterValid}
            />
          )}

          {/* Processing Toggles */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">
              Pipeline Features
            </label>
            <div className="space-y-1.5">
              {PROCESSING_TOGGLES.map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-muted/40 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={processing[key]}
                    onChange={(e) =>
                      onProcessingOptionChange(key, e.target.checked)
                    }
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span className="flex-1">
                    {label}
                    <span className="text-xs text-muted-foreground ml-1.5">
                      — {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
