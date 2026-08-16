import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../client';
import { CORE_CONTENT_OPERATIONS } from '../core-content-operations';
import operationLedger from '../contracts/fortemi-operation-dispositions.json';
import { createNotesApi } from '../notes';
import { createProvenanceApi } from '../provenance';

type ClientMethod = 'get' | 'getText' | 'post' | 'patch' | 'delete';

interface EvidenceCase {
  operationId: string;
  method: Uppercase<ClientMethod extends 'getText' ? 'get' : ClientMethod>;
  contractPath: string;
  clientMethod: ClientMethod;
  clientPath: string;
  expectedArgs: unknown[];
  invoke: () => Promise<unknown>;
}

describe('core content operation evidence boundary', () => {
  let client: ApiClient;
  let notes: ReturnType<typeof createNotesApi>;
  let provenance: ReturnType<typeof createProvenanceApi>;

  beforeEach(() => {
    client = {
      get: vi.fn(async (path: string) => {
        if (path === '/notes/activity') {
          return { since: '2026-08-01T00:00:00Z', activity: [], created_count: 0, updated_count: 0 };
        }
        if (path === '/notes/timeline') {
          return { period: 'day', since: '2026-08-01T00:00:00Z', total_notes: 0, buckets: [] };
        }
        if (path === '/notes/note-1/full') {
          return {
            id: 'note-1', title: 'Full note', content: 'body', chunks: null, total_chunks: null,
            is_chunked: false, tags: [], created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
          };
        }
        throw new Error(`Unexpected GET ${path}`);
      }),
      getText: vi.fn(async () => '# exported'),
      post: vi.fn(async (path: string) => {
        if (path === '/notes/bulk') return { ids: ['note-1'], count: 1 };
        if (path === '/notes/reprocess') return { message: 'queued', notes_count: 1, jobs_queued: 1, revision_mode: 'light' };
        if (path === '/notes/note-1/purge') return { status: 'queued', job_id: 'job-1', note_id: 'note-1' };
        if (path === '/notes/note-1/restore') return { restored: true, id: 'note-1' };
        if (path === '/notes/note-1/versions/2/restore') {
          return { success: true, restored_from_version: 2, new_version: 3, restore_tags: true };
        }
        if (path.startsWith('/provenance/')) return { id: 'prov-1' };
        throw new Error(`Unexpected POST ${path}`);
      }),
      patch: vi.fn(async () => undefined),
      delete: vi.fn(async () => ({ success: true, deleted_version: 2 })),
      put: vi.fn(),
    } as unknown as ApiClient;
    notes = createNotesApi(client);
    provenance = createProvenanceApi(client);
  });

  function cases(): EvidenceCase[] {
    return [
      { operationId: 'bulk_create_notes', method: 'POST', contractPath: '/api/v1/notes/bulk', clientMethod: 'post', clientPath: '/notes/bulk', expectedArgs: ['/notes/bulk', { notes: [{ content: 'one' }] }], invoke: () => notes.bulkCreate([{ content: 'one' }]) },
      { operationId: 'bulk_reprocess_notes', method: 'POST', contractPath: '/api/v1/notes/reprocess', clientMethod: 'post', clientPath: '/notes/reprocess', expectedArgs: ['/notes/reprocess', { note_ids: ['note-1'], revision_mode: 'light' }], invoke: () => notes.reprocessAll({ noteIds: ['note-1'], revisionMode: 'light' }) },
      { operationId: 'get_notes_activity', method: 'GET', contractPath: '/api/v1/notes/activity', clientMethod: 'get', clientPath: '/notes/activity', expectedArgs: ['/notes/activity', { since: '7d', limit: '50' }], invoke: () => notes.getActivity({ since: '7d', limit: 50 }) },
      { operationId: 'get_notes_timeline', method: 'GET', contractPath: '/api/v1/notes/timeline', clientMethod: 'get', clientPath: '/notes/timeline', expectedArgs: ['/notes/timeline', { period: 'day', periods: '30' }], invoke: () => notes.getTimeline({ period: 'day', periods: 30 }) },
      { operationId: 'export_note', method: 'GET', contractPath: '/api/v1/notes/{id}/export', clientMethod: 'getText', clientPath: '/notes/note-1/export', expectedArgs: ['/notes/note-1/export', {}], invoke: () => notes.exportMarkdown('note-1') },
      { operationId: 'get_full_document', method: 'GET', contractPath: '/api/v1/notes/{id}/full', clientMethod: 'get', clientPath: '/notes/note-1/full', expectedArgs: ['/notes/note-1/full'], invoke: () => notes.getFullDocument('note-1') },
      { operationId: 'purge_note', method: 'POST', contractPath: '/api/v1/notes/{id}/purge', clientMethod: 'post', clientPath: '/notes/note-1/purge', expectedArgs: ['/notes/note-1/purge'], invoke: () => notes.purge('note-1') },
      { operationId: 'restore_note', method: 'POST', contractPath: '/api/v1/notes/{id}/restore', clientMethod: 'post', clientPath: '/notes/note-1/restore', expectedArgs: ['/notes/note-1/restore', undefined, undefined, { revision_mode: 'light' }], invoke: () => notes.restore('note-1', 'light') },
      { operationId: 'update_note_status', method: 'PATCH', contractPath: '/api/v1/notes/{id}/status', clientMethod: 'patch', clientPath: '/notes/note-1/status', expectedArgs: ['/notes/note-1/status', { starred: true, archived: false }], invoke: () => notes.updateStatus('note-1', { starred: true, archived: false }) },
      { operationId: 'delete_note_version', method: 'DELETE', contractPath: '/api/v1/notes/{id}/versions/{version}', clientMethod: 'delete', clientPath: '/notes/note-1/versions/2', expectedArgs: ['/notes/note-1/versions/2'], invoke: () => notes.deleteVersion('note-1', 2) },
      { operationId: 'restore_note_version', method: 'POST', contractPath: '/api/v1/notes/{id}/versions/{version}/restore', clientMethod: 'post', clientPath: '/notes/note-1/versions/2/restore', expectedArgs: ['/notes/note-1/versions/2/restore', { restore_tags: true }], invoke: () => notes.restoreVersion('note-1', 2, true) },
      { operationId: 'create_prov_device', method: 'POST', contractPath: '/api/v1/provenance/devices', clientMethod: 'post', clientPath: '/provenance/devices', expectedArgs: ['/provenance/devices', { device_make: 'Acme', device_model: 'One' }], invoke: () => provenance.createDevice({ device_make: 'Acme', device_model: 'One' }) },
      { operationId: 'create_file_provenance', method: 'POST', contractPath: '/api/v1/provenance/files', clientMethod: 'post', clientPath: '/provenance/files', expectedArgs: ['/provenance/files', { attachment_id: 'attachment-1', note_id: 'note-1' }], invoke: () => provenance.createFileProvenance({ attachment_id: 'attachment-1', note_id: 'note-1' }) },
      { operationId: 'create_prov_location', method: 'POST', contractPath: '/api/v1/provenance/locations', clientMethod: 'post', clientPath: '/provenance/locations', expectedArgs: ['/provenance/locations', { latitude: 40, longitude: -75, source: 'user_manual', confidence: 'high' }], invoke: () => provenance.createLocation({ latitude: 40, longitude: -75, source: 'user_manual', confidence: 'high' }) },
      { operationId: 'create_named_location', method: 'POST', contractPath: '/api/v1/provenance/named-locations', clientMethod: 'post', clientPath: '/provenance/named-locations', expectedArgs: ['/provenance/named-locations', { name: 'Desk', location_type: 'poi', latitude: 40, longitude: -75 }], invoke: () => provenance.createNamedLocation({ name: 'Desk', location_type: 'poi', latitude: 40, longitude: -75 }) },
      { operationId: 'create_note_provenance', method: 'POST', contractPath: '/api/v1/provenance/notes', clientMethod: 'post', clientPath: '/provenance/notes', expectedArgs: ['/provenance/notes', { note_id: 'note-1', event_type: 'created', time_source: 'manual' }], invoke: () => provenance.createNoteProvenance({ note_id: 'note-1', event_type: 'created', time_source: 'manual' }) },
    ];
  }

  it('contains only exact rows present in the pinned Fortemi ledger', () => {
    const evidence = cases();
    const promoted = CORE_CONTENT_OPERATIONS.filter((entry) => evidence.some((candidate) => candidate.operationId === entry.operationId));
    expect(promoted).toHaveLength(evidence.length);
    expect(new Set(evidence.map((entry) => entry.operationId)).size).toBe(evidence.length);

    for (const entry of evidence) {
      expect(promoted).toContainEqual(expect.objectContaining({
        method: entry.method,
        path: entry.contractPath,
        operationId: entry.operationId,
      }));
      expect(operationLedger.operations).toContainEqual(expect.objectContaining({
        method: entry.method,
        path: entry.contractPath,
        operation_id: entry.operationId,
      }));
    }
  });

  it.each([
    'bulk_create_notes', 'bulk_reprocess_notes', 'get_notes_activity', 'get_notes_timeline',
    'export_note', 'get_full_document', 'purge_note', 'restore_note', 'update_note_status',
    'delete_note_version', 'restore_note_version', 'create_prov_device', 'create_file_provenance',
    'create_prov_location', 'create_named_location', 'create_note_provenance',
  ])('%s invokes its exact typed client boundary', async (operationId) => {
    const entry = cases().find((candidate) => candidate.operationId === operationId);
    expect(entry).toBeDefined();
    expect(entry!.clientMethod === 'getText' ? 'GET' : entry!.clientMethod.toUpperCase()).toBe(entry!.method);
    await entry!.invoke();
    expect(vi.mocked(client[entry!.clientMethod])).toHaveBeenLastCalledWith(...entry!.expectedArgs);
  });

  it('keeps explicit-link mutations from #294 outside the promoted set', () => {
    expect(CORE_CONTENT_OPERATIONS.some((entry) => entry.path.includes('/links'))).toBe(false);
  });
});
