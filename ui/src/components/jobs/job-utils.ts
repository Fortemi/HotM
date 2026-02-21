/**
 * Shared helpers for job queue UI components.
 */

export function getJobTypeColor(jobType: string): string {
  switch (jobType.toLowerCase()) {
    case 'airevision':
      return 'bg-purple-500';
    case 'embedding':
      return 'bg-blue-500';
    case 'linking':
      return 'bg-green-500';
    case 'contextupdate':
      return 'bg-orange-500';
    case 'titlegeneration':
      return 'bg-pink-500';
    default:
      return 'bg-gray-500';
  }
}

export function formatJobType(jobType: string): string {
  return jobType.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (str) => str.toUpperCase());
}

export function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
