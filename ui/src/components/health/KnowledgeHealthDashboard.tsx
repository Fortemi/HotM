/**
 * KnowledgeHealthDashboard Component
 * Dashboard showing knowledge base health metrics and recommendations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  FileText,
  Link2,
  Tag,
  AlertTriangle,
  Clock,
  Activity,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import type { KnowledgeHealth } from '@/api/types-extended';

interface KnowledgeHealthDashboardProps {
  className?: string;
}

function HealthScoreGauge({ score, label, trend }: { score: number; label: string; trend?: number }) {
  // Calculate circle properties
  const size = 80;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  // Determine color based on score
  const getColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStrokeColor = () => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="flex flex-col items-center">
      <div
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${score} out of 100, ${label} health score`}
        className="relative"
      >
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-xl font-bold', getColor())}>{score}</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-1">{label}</span>
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 text-xs', trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-muted-foreground')}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
          <span>{trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {trend > 0 ? '+' : ''}{trend} pts</span>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  metric: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  recommendation?: string;
  onAction?: () => void;
  actionLabel?: string;
}

function MetricCard({
  title,
  metric,
  icon,
  description,
  recommendation,
  onAction,
  actionLabel,
}: MetricCardProps) {
  const id = `metric-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <article
      role="article"
      aria-labelledby={id}
      className="bg-card border rounded-lg p-4 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h4 id={id} className="text-sm font-medium">{title}</h4>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold">{metric}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {recommendation && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <span>💡</span>
          <span>{recommendation}</span>
        </div>
      )}
      {onAction && actionLabel && (
        <Button variant="outline" size="sm" onClick={onAction} className="w-full">
          {actionLabel}
        </Button>
      )}
    </article>
  );
}

export function KnowledgeHealthDashboard({ className }: KnowledgeHealthDashboardProps) {
  const [health, setHealth] = useState<KnowledgeHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.health.getKnowledgeHealth();
      setHealth(data);
    } catch (err) {
      setError('Failed to load health metrics');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // Calculate overall health score
  const calculateHealthScore = (h: KnowledgeHealth): number => {
    let score = 100;

    // Penalize orphan notes (max -20)
    const orphanRate = h.orphan_notes / Math.max(h.total_notes, 1);
    score -= Math.min(orphanRate * 100, 20);

    // Penalize stale notes (max -15)
    const staleRate = h.stale_notes / Math.max(h.total_notes, 1);
    score -= Math.min(staleRate * 75, 15);

    // Penalize unlinked notes (max -15)
    const unlinkedRate = h.unlinked_notes / Math.max(h.total_notes, 1);
    score -= Math.min(unlinkedRate * 50, 15);

    // Reward link density (up to +10)
    score += Math.min(h.avg_links_per_note * 2, 10);

    // Reward tag coverage (up to +10)
    score += h.tag_coverage * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getHealthLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading health metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-12', className)}>
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={loadHealth} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!health) return null;

  const healthScore = calculateHealthScore(health);
  const healthLabel = getHealthLabel(healthScore);
  const orphanPercent = ((health.orphan_notes / Math.max(health.total_notes, 1)) * 100).toFixed(1);
  const tagCoveragePercent = (health.tag_coverage * 100).toFixed(0);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Knowledge Health</h2>
        <Button variant="outline" size="sm" onClick={loadHealth} aria-label="refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Health Score */}
      <div className="flex items-center justify-center py-4 bg-card border rounded-lg">
        <HealthScoreGauge score={healthScore} label={healthLabel} trend={5} />
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="overview-grid">
        <MetricCard
          title="Total Notes"
          metric={health.total_notes.toLocaleString()}
          icon={<FileText className="w-5 h-5 text-blue-500" />}
          description="In your knowledge base"
        />
        <MetricCard
          title="Link Density"
          metric={health.avg_links_per_note.toFixed(1)}
          icon={<Link2 className="w-5 h-5 text-green-500" />}
          description="Average links per note"
          recommendation={health.avg_links_per_note < 2 ? 'Add more cross-references to improve discoverability' : undefined}
        />
        <MetricCard
          title="Tag Coverage"
          metric={`${tagCoveragePercent}%`}
          icon={<Tag className="w-5 h-5 text-purple-500" />}
          description="Notes with tags"
          recommendation={health.tag_coverage < 0.7 ? 'Tag more notes to improve organization' : undefined}
        />
        <MetricCard
          title="Last Activity"
          metric={new Date(health.last_activity).toLocaleDateString()}
          icon={<Activity className="w-5 h-5 text-orange-500" />}
          description={new Date(health.last_activity).toLocaleTimeString()}
        />
      </div>

      {/* Issues Grid */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          Issues to Address
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Orphan Notes"
            metric={`${health.orphan_notes} notes (${orphanPercent}%)`}
            icon={<span className="text-lg">⚠️</span>}
            description="Notes without any links"
            recommendation="Link these notes to improve discoverability"
            onAction={() => console.log('View orphans')}
            actionLabel="View Orphans"
          />
          <MetricCard
            title="Stale Content"
            metric={`${health.stale_notes} notes`}
            icon={<Clock className="w-5 h-5 text-yellow-500" />}
            description="Not updated in 90+ days"
            recommendation="Review and update stale content"
            onAction={() => console.log('Review stale')}
            actionLabel="Review Stale"
          />
          <MetricCard
            title="Unlinked Notes"
            metric={`${health.unlinked_notes} notes`}
            icon={<Link2 className="w-5 h-5 text-red-500" />}
            description="No incoming or outgoing links"
            recommendation="Connect isolated notes to related content"
            onAction={() => console.log('Find connections')}
            actionLabel="Find Connections"
          />
        </div>
      </div>
    </div>
  );
}
