import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ChevronDown,
  Sparkles,
  PenLine,
  Brain,
  SlidersHorizontal,
  FileText,
  Database,
  Link,
  Type,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContextFilterInputs } from "@/components/capture/ContextFilterInputs";
import { useJobStore } from "@/hooks/useJobStore";
import { api } from "@/api";
import type { RegenerateAIRequest, ContextFilter } from "@/api/types";
import type { JobType } from "@/api/extended";

const ALL_JOB_TYPES: JobType[] = [
  'ai_revision',
  'embedding',
  'linking',
  'context_update',
  'title_generation',
];

interface RevisionModeItem {
  mode: RegenerateAIRequest['revision_mode'];
  label: string;
  description: string;
  icon: React.ReactNode;
}

const REVISION_MODES: RevisionModeItem[] = [
  {
    mode: 'standard',
    label: 'Standard',
    description: 'Default NLP revision',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    mode: 'light',
    label: 'Light',
    description: 'Formatting only',
    icon: <PenLine className="h-4 w-4" />,
  },
  {
    mode: 'contextual',
    label: 'Contextual',
    description: 'Full contextual expansion',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    mode: 'contextual_filtered',
    label: 'Contextual (Filtered)',
    description: 'Focused contextual enhancement',
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
];

interface JobItem {
  jobType: JobType;
  label: string;
  icon: React.ReactNode;
}

const JOB_ITEMS: JobItem[] = [
  { jobType: 'embedding', label: 'Re-embed', icon: <Database className="h-4 w-4" /> },
  { jobType: 'linking', label: 'Re-link', icon: <Link className="h-4 w-4" /> },
  { jobType: 'title_generation', label: 'Regenerate Title', icon: <Type className="h-4 w-4" /> },
];

export interface RegeneratePanelProps {
  noteId: string;
  isProcessing: boolean;
  onRegenerate: (request: RegenerateAIRequest) => Promise<void>;
  onQueueJob: (jobType: JobType) => Promise<void>;
  disabled?: boolean;
}

export function RegeneratePanel({
  noteId,
  isProcessing,
  onRegenerate,
  onQueueJob,
  disabled = false,
}: RegeneratePanelProps) {
  const [open, setOpen] = useState(false);
  const [showContextFilter, setShowContextFilter] = useState(false);
  const [contextFilter, setContextFilter] = useState<ContextFilter>({
    tags: [],
    collection_id: null,
    query: '',
  });
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const jobStore = useJobStore();
  const hasActiveJobs = Array.from(jobStore.activeJobs.values()).some(
    (j) => j.note_id === noteId
  );

  const isDisabled = disabled || isProcessing;

  // Lazy-load collections when context filter is shown
  useEffect(() => {
    if (showContextFilter && collections.length === 0) {
      api.collections.list().then((cols) => {
        setCollections(cols.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }).catch(() => {
        // Silently handle — user can still use tags and query
      });
    }
  }, [showContextFilter, collections.length]);

  const filterValid =
    (contextFilter.tags && contextFilter.tags.length > 0) ||
    !!contextFilter.collection_id ||
    (contextFilter.query ? contextFilter.query.trim().length > 0 : false);

  const handleModeClick = useCallback(
    async (mode: RegenerateAIRequest['revision_mode']) => {
      if (mode === 'contextual_filtered') {
        setShowContextFilter(true);
        return; // Don't close popover — user needs to fill filters
      }
      setOpen(false);
      await onRegenerate({ revision_mode: mode });
    },
    [onRegenerate]
  );

  const handleFilteredSubmit = useCallback(async () => {
    setOpen(false);
    setShowContextFilter(false);
    await onRegenerate({
      revision_mode: 'contextual_filtered',
      context_filter: contextFilter,
    });
  }, [contextFilter, onRegenerate]);

  const handleJobClick = useCallback(
    async (jobType: JobType) => {
      setOpen(false);
      await onQueueJob(jobType);
    },
    [onQueueJob]
  );

  const handleFullReprocess = useCallback(async () => {
    setOpen(false);
    for (const jobType of ALL_JOB_TYPES) {
      await onQueueJob(jobType);
    }
  }, [onQueueJob]);

  const handleResetConfirm = useCallback(async () => {
    setShowResetDialog(false);
    setOpen(false);
    await onRegenerate({ revision_mode: 'none' });
  }, [onRegenerate]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            disabled={isDisabled}
            size="sm"
            variant="outline"
            aria-label="Regenerate AI options"
          >
            {isProcessing || hasActiveJobs ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Regenerate AI</span>
            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          {/* Section 1: Revision Modes */}
          <div className="p-1">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Revision Mode
            </div>
            {REVISION_MODES.map((item) => (
              <button
                key={item.mode}
                onClick={() => handleModeClick(item.mode)}
                disabled={isDisabled}
                className="w-full flex items-start gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
                data-testid={`mode-${item.mode}`}
              >
                <span className="mt-0.5 text-muted-foreground">{item.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </button>
            ))}

            {/* Context Filter Expansion */}
            {showContextFilter && (
              <div className="px-2 py-2 space-y-2">
                <ContextFilterInputs
                  contextFilter={contextFilter}
                  onContextFilterChange={setContextFilter}
                  collections={collections}
                  filterValid={filterValid}
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!filterValid || isDisabled}
                  onClick={handleFilteredSubmit}
                  data-testid="submit-filtered"
                >
                  Apply Filtered Revision
                </Button>
              </div>
            )}

            {/* Reset to Original */}
            <button
              onClick={() => setShowResetDialog(true)}
              disabled={isDisabled}
              className="w-full flex items-start gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
              data-testid="mode-none"
            >
              <span className="mt-0.5 text-muted-foreground">
                <FileText className="h-4 w-4" />
              </span>
              <div className="text-left">
                <div className="font-medium">Reset to Original</div>
                <div className="text-xs text-muted-foreground">Revert to original content</div>
              </div>
            </button>
          </div>

          <Separator />

          {/* Section 2: Individual Jobs */}
          <div className="p-1">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Individual Jobs
            </div>
            {JOB_ITEMS.map((item) => (
              <button
                key={item.jobType}
                onClick={() => handleJobClick(item.jobType)}
                disabled={isDisabled}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
                data-testid={`job-${item.jobType}`}
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <Separator className="my-1" />

            <button
              onClick={handleFullReprocess}
              disabled={isDisabled}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none font-medium"
              data-testid="full-reprocess"
            >
              <span className="text-muted-foreground">
                <RefreshCcw className="h-4 w-4" />
              </span>
              <span>Full Reprocess</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Original?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert the note to its original content, removing all AI revisions.
              The original content is preserved and cannot be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfirm}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
