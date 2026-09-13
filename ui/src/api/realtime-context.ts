import type { ArchivesApi } from './archives';
import { ContractDecodeError } from './errors';

export interface RealtimeArchive {
  memory: string;
  memorySchema: string;
}

function decodeArchive(value: unknown): RealtimeArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractDecodeError('realtimeArchive', 'Invalid archive context');
  }
  const archive = value as Record<string, unknown>;
  if (Object.keys(archive).length !== 2
    || typeof archive.name !== 'string' || !archive.name.trim()
    || archive.name !== archive.name.trim() || [...archive.name].length > 255
    || typeof archive.schema_name !== 'string'
    || !/^[a-z_][a-z0-9_]{0,62}$/.test(archive.schema_name)) {
    throw new ContractDecodeError('realtimeArchive', 'Invalid archive context');
  }
  return { memory: archive.name, memorySchema: archive.schema_name };
}

/** Resolve names through the server; never derive a schema from a name. */
export async function resolveRealtimeArchive(
  archives: Pick<ArchivesApi, 'context'>,
  selectedName: string | null,
): Promise<RealtimeArchive> {
  const resolved = decodeArchive(await archives.context());
  // The producer's explicit legacy "default" alias may resolve to public.
  const publicAlias = selectedName === 'default'
    && resolved.memory === 'public' && resolved.memorySchema === 'public';
  if (selectedName !== null && resolved.memory !== selectedName && !publicAlias) {
    throw new ContractDecodeError('realtimeArchive', 'Invalid archive context');
  }
  return resolved;
}
