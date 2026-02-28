/**
 * SubAgentProgressPanel — visual indicators for sub-agent activity.
 *
 * Shows spawned sub-agents and their current status (pending, running,
 * completed, failed). Displayed inline in the chat when sub-agents are active.
 *
 * @see Issue #125 — Phase 4: Sub-Agent Orchestration
 */

import { Bot, CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';
import type { SubAgentProgress } from './sub-agent';

interface SubAgentProgressPanelProps {
  /** Current sub-agent progress items. */
  items: SubAgentProgress[];
}

const STATUS_ICON: Record<SubAgentProgress['status'], typeof Circle> = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

const STATUS_CLASSES: Record<SubAgentProgress['status'], string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-500 animate-spin',
  completed: 'text-green-500',
  failed: 'text-destructive',
};

const STATUS_LABEL: Record<SubAgentProgress['status'], string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
};

export function SubAgentProgressPanel({ items }: SubAgentProgressPanelProps) {
  if (items.length === 0) return null;

  const completed = items.filter(i => i.status === 'completed').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const total = items.length;

  return (
    <div className="mx-4 my-2 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Bot className="h-3 w-3" />
        <span>Sub-agents ({completed + failed}/{total})</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = STATUS_ICON[item.status];
          return (
            <div
              key={item.taskId}
              className="flex items-center gap-2 text-xs"
            >
              <Icon className={`h-3 w-3 shrink-0 ${STATUS_CLASSES[item.status]}`} />
              <span className="font-medium">{item.type}</span>
              <span className="text-muted-foreground">
                {item.summary
                  ? item.summary.slice(0, 80) + (item.summary.length > 80 ? '...' : '')
                  : STATUS_LABEL[item.status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
