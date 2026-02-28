/**
 * ContextBar — visual context window utilization indicator.
 *
 * Displays a compact progress bar showing how much of the model's context
 * window is consumed. Color-coded by severity:
 *   green  (<50%)  — plenty of room
 *   yellow (50-75%) — moderate usage
 *   orange (75-90%) — getting tight
 *   red    (>90%)  — critical, compaction needed
 *
 * Hover tooltip shows breakdown: system | history | free tokens.
 *
 * @see Issue #125 — Phase 1: Tokenization + Context Tracking
 */

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { ContextBreakdown, ContextSeverity } from './useContextTracking';

interface ContextBarProps {
  breakdown: ContextBreakdown;
}

const SEVERITY_COLORS: Record<ContextSeverity, string> = {
  low: 'bg-green-500',
  moderate: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const SEVERITY_TEXT: Record<ContextSeverity, string> = {
  low: 'text-green-600 dark:text-green-400',
  moderate: 'text-yellow-600 dark:text-yellow-400',
  high: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
};

export function ContextBar({ breakdown }: ContextBarProps) {
  const { utilizationPercent, severity, formatted } = breakdown;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default" role="meter" aria-label="Context window utilization" aria-valuenow={utilizationPercent} aria-valuemin={0} aria-valuemax={100}>
          <span className={`text-[10px] font-medium tabular-nums ${SEVERITY_TEXT[severity]}`}>
            {utilizationPercent}%
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all duration-300 ${SEVERITY_COLORS[severity]}`}
              style={{ width: `${utilizationPercent}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <span className="text-primary-foreground/70">System:</span>
          <span className="tabular-nums text-right">{formatted.system}</span>
          <span className="text-primary-foreground/70">History:</span>
          <span className="tabular-nums text-right">{formatted.history}</span>
          <span className="text-primary-foreground/70">Free:</span>
          <span className="tabular-nums text-right">{formatted.available}</span>
          <span className="text-primary-foreground/70 border-t border-primary-foreground/20 pt-0.5">Window:</span>
          <span className="tabular-nums text-right border-t border-primary-foreground/20 pt-0.5">{formatted.total}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
