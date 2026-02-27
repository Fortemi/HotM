/**
 * ConfirmationCard — inline confirmation UI for privilege-gated tool calls.
 *
 * When the agent attempts a write/delete/admin operation in assisted mode,
 * this card appears inline in the chat to let the user approve or deny.
 */

import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getToolPrivilege, type OperationPrivilege } from './privileges';
import type { PendingConfirmation } from './useAgentPrivileges';

interface ConfirmationCardProps {
  confirmation: PendingConfirmation;
  onResolve: (decision: 'allow' | 'allow-remember' | 'deny') => void;
}

const PRIVILEGE_STYLES: Record<OperationPrivilege, {
  icon: typeof ShieldCheck;
  badge: string;
  border: string;
}> = {
  read: {
    icon: ShieldCheck,
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    border: 'border-green-200 dark:border-green-800',
  },
  write: {
    icon: ShieldAlert,
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  delete: {
    icon: ShieldX,
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    border: 'border-red-200 dark:border-red-800',
  },
  admin: {
    icon: ShieldX,
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    border: 'border-purple-200 dark:border-purple-800',
  },
};

/** Format a tool name for display: "create_note" -> "Create Note" */
function formatToolName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Format tool args for preview, showing key-value pairs */
function formatArgs(args: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, value]) => {
      let display: string;
      if (typeof value === 'string') {
        display = value.length > 80 ? value.slice(0, 77) + '...' : value;
      } else if (Array.isArray(value)) {
        display = value.join(', ');
      } else {
        display = String(value);
      }
      return { key, value: display };
    });
}

export function ConfirmationCard({ confirmation, onResolve }: ConfirmationCardProps) {
  const privilege = getToolPrivilege(confirmation.toolName);
  const style = PRIVILEGE_STYLES[privilege];
  const Icon = style.icon;
  const args = formatArgs(confirmation.args);

  return (
    <div className={`mx-4 my-2 rounded-lg border ${style.border} bg-card p-4`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Agent wants to: {formatToolName(confirmation.toolName)}
            </span>
            <Badge className={`text-xs ${style.badge}`}>
              {privilege}
            </Badge>
          </div>

          {args.length > 0 && (
            <div className="mt-2 space-y-1">
              {args.map(({ key, value }) => (
                <div key={key} className="flex text-xs">
                  <span className="w-24 shrink-0 font-medium text-muted-foreground">
                    {key}:
                  </span>
                  <span className="break-words text-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => onResolve('allow')}
              className="h-7 text-xs"
            >
              Allow
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onResolve('allow-remember')}
              className="h-7 text-xs"
            >
              Allow & Remember
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onResolve('deny')}
              className="h-7 text-xs"
            >
              Deny
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
