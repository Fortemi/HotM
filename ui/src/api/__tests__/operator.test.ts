import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import {
  createOperatorApi,
  OPERATOR_ACTION_OPERATIONS,
  OPERATOR_EVIDENCE_BOUNDARY,
  OPERATOR_READ_OPERATIONS,
} from '../operator';
import { SystemCompatibilityContractError } from '../systemCompatibility';
import operationDispositions from '../contracts/fortemi-operation-dispositions.json';

function compatibleContract() {
  return {
    schema_version: 1,
    contract_revision: '2026-07-06',
    api: {
      name: 'fortemi',
      version: '2026.7.12',
      minimum_hotm_enterprise_client: '2026.5.0',
      git_sha_present: true,
      build_date_present: true,
    },
    deployment: {
      mode: 'local_sidecar',
      edition: 'community',
      hosted_multi_tenant_ready: false,
    },
    auth: {
      required: false,
      mode: 'anonymous_local',
      oauth_issuer_configured: false,
      tenant_context_available: false,
    },
    capabilities: { core_notes: { state: 'available' } },
    links: {
      openapi: '/operator/openapi.yaml',
      asyncapi: '/operator/asyncapi.yaml',
      health: '/health',
      streaming_health: '/api/v1/health/streaming',
    },
  } as const;
}

function harness(options: { directErrorPath?: string; compatibilityError?: Error; hostedPreview?: boolean } = {}) {
  const contractFetch = vi.fn(async () => new Response('schema: bounded', {
    status: 200,
    headers: { 'Content-Type': 'application/yaml' },
  }));
  vi.stubGlobal('fetch', contractFetch);
  const contract = options.hostedPreview
    ? {
        ...compatibleContract(),
        deployment: { mode: 'hosted', edition: 'enterprise', hosted_multi_tenant_ready: true },
        auth: {
          required: true,
          mode: 'oauth_bearer',
          oauth_issuer_configured: true,
          tenant_context_available: true,
          claim_contract_version: '1.0.0',
          claim_contract_profile: 'rust-node-jwt-v1',
          authority_release: 'v2026.7.0',
        },
        capabilities: { backoffice_api: { state: 'preview' } },
      }
    : compatibleContract();
  const admission = options.compatibilityError
    ? { state: 'blocked', response: null, error: options.compatibilityError }
    : { state: 'compatible', response: contract, error: null };
  const gate = {
    preflight: options.compatibilityError
      ? vi.fn().mockRejectedValue(options.compatibilityError)
      : vi.fn().mockResolvedValue(contract),
    requireRemoteMutation: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(() => admission),
  };
  const client = {
    baseUrl: 'http://localhost:3000/api/v1',
    requireMutation: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(async (path: string) => {
      if (path === options.directErrorPath) throw new ApiError('raw-secret-error', 403, { token: 'do-not-render' });
      if (path === '/inference/providers') {
        return { providers: [{ id: 'provider-a', api_key: 'provider-secret' }] };
      }
      if (path === '/memory/info') return { percent_used: 42, path: '/private/database' };
      if (path === '/rate-limit/status') return { limit: 100, remaining: 80, tenant_id: 'tenant-secret' };
      if (path === '/extraction/stats') return { total_jobs: 9, details: { token: 'token-secret' } };
      if (path === '/health/access-frequency') return { notes: [], count: 0, summary: { total_notes: 10 } };
      if (path.startsWith('/embedding-configs/')) return { dimension: 768, is_default: false, supports_mrl: true, provider: 'ollama', provider_config: { api_key: 'secret' } };
      return {};
    }),
    post: vi.fn(async (path: string, _body?: unknown): Promise<unknown> => {
      if (path === '/inference/complete') {
        return { content: 'OK secret body', finish_reason: 'stop', model: 'private-model', provider_id: 'private-provider' };
      }
      return {};
    }),
    patch: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const services = {
    inference: {
      getConfig: vi.fn().mockResolvedValue({ providers: ['local'], api_key: 'inference-secret' }),
      getAuditLog: vi.fn().mockResolvedValue({ entries: [{ before_json: { api_key: 'audit-secret' } }] }),
    },
    chat: {
      getModelCatalog: vi.fn().mockResolvedValue({
        models: [{ slug: 'model-a', provider: 'local', capabilities: [] }],
        providers: [],
        defaults: { language: 'model-a', embedding: 'model-a' },
      }),
    },
    links: {
      getGraphTopologyStats: vi.fn().mockResolvedValue({
        total_notes: 10,
        total_links: 20,
        isolated_nodes: 0,
        connected_components: 1,
        avg_degree: 2,
        max_degree: 4,
      }),
      getGraphDiagnostics: vi.fn().mockResolvedValue({ status: 'ok', path: '/private/graph' }),
      listGraphDiagnosticsSnapshots: vi.fn().mockResolvedValue([]),
      getGraphColdSpots: vi.fn().mockResolvedValue({ summary: { cold_access_count: 0 } }),
      triggerGraphMaintenance: vi.fn().mockResolvedValue({ status: 'queued', id: 'secret-job-id' }),
      captureGraphDiagnosticsSnapshot: vi.fn().mockResolvedValue({ id: 'secret-snapshot-id' }),
      recomputeSnnScores: vi.fn().mockResolvedValue({ status: 'ok' }),
      sparsifyGraphWithPfnet: vi.fn().mockResolvedValue({ status: 'ok' }),
      detectCoarseGraphCommunities: vi.fn().mockResolvedValue({ status: 'ok' }),
      compareGraphDiagnosticsSnapshots: vi.fn().mockResolvedValue({ before: {}, after: {}, delta: { density: 1 } }),
    },
    health: {
      getKnowledgeHealth: vi.fn().mockResolvedValue({
        total_notes: 10,
        orphan_notes: 0,
        stale_notes: 0,
        unlinked_notes: 0,
        avg_links_per_note: 2,
        tag_coverage: 1,
        last_activity: '2026-08-16T00:00:00Z',
      }),
      getStreamingHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        sse: { state: 'reported', metrics: {} },
        rtp: { state: 'reported', metrics: {} },
        chat: { state: 'reported', metrics: {} },
        ingest: { state: 'reported', metrics: {} },
        inbound: { state: 'reported', metrics: {} },
      }),
      getOrphanTags: vi.fn().mockResolvedValue([]),
      getStaleNotes: vi.fn().mockResolvedValue([]),
      getUnlinkedNotes: vi.fn().mockResolvedValue([]),
      getTagCooccurrence: vi.fn().mockResolvedValue({ pairs: [] }),
    },
    jobs: {
      getQueueStats: vi.fn().mockResolvedValue({ pending: 1, processing: 0, completed_last_hour: 2, failed_last_hour: 0, total: 3 }),
      getPauseStatus: vi.fn().mockResolvedValue({ global: 'running', archives: {} }),
      listJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
      pauseGlobal: vi.fn().mockResolvedValue({ status: 'paused', scope: 'global' }),
      resumeGlobal: vi.fn().mockResolvedValue({ status: 'resumed', scope: 'global' }),
      pauseArchive: vi.fn().mockResolvedValue({ status: 'paused', scope: 'archive' }),
      resumeArchive: vi.fn().mockResolvedValue({ status: 'resumed', scope: 'archive' }),
    },
    webhooks: {
      list: vi.fn().mockResolvedValue([{ id: 'hook-id', url: 'https://secret.example/path', secret: 'hook-secret', events: [], is_active: true, created_at: '', updated_at: '', failure_count: 0, max_retries: 1 }]),
      listIncomingReceivers: vi.fn().mockResolvedValue([]),
      listInboundSources: vi.fn().mockResolvedValue([]),
      test: vi.fn().mockResolvedValue({ id: 'delivery-id', webhook_id: 'hook-id', event_type: 'test', payload: {}, delivered_at: '', success: true }),
      get: vi.fn().mockResolvedValue({ id: 'hook-id', url: 'https://secret.example', events: ['note.created'], is_active: true, created_at: '', updated_at: '', failure_count: 0, max_retries: 1 }),
      getDeliveries: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteInboundSource: vi.fn().mockResolvedValue(undefined),
    },
    backup: {
      getBackupStatus: vi.fn().mockResolvedValue({ status: 'idle', last_backup: '/private/backup.db' }),
      listBackups: vi.fn().mockResolvedValue([{ filename: 'private.db', size_bytes: 1, created_at: '', type: 'database' }]),
      triggerBackup: vi.fn().mockResolvedValue(undefined),
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreDatabase: vi.fn().mockResolvedValue(undefined),
      swapBackup: vi.fn().mockResolvedValue(undefined),
      getBackupInfo: vi.fn().mockResolvedValue({ filename: 'secret.db', size_bytes: 1, created_at: '', type: 'database' }),
      getBackupMetadata: vi.fn().mockResolvedValue({ filename: 'secret.db', has_metadata: true, metadata: { title: 'private', tags: ['secret'] } }),
      updateBackupMetadata: vi.fn().mockResolvedValue({ filename: 'secret.db', success: true }),
    },
    archives: {
      list: vi.fn().mockResolvedValue([{ id: 'tenant-secret', name: 'private', schema_name: 'secret', created_at: '', is_default: true, schema_version: 1 }]),
      stats: vi.fn().mockResolvedValue({ name: 'private', note_count: 1, size_bytes: 2, schema_name: 'secret' }),
      setDefault: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ id: 'tenant-secret', name: 'private', schema_name: 'secret', created_at: '', is_default: false, schema_version: 1, note_count: 2, size_bytes: 3 }),
      create: vi.fn().mockResolvedValue({ id: 'tenant-secret' }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clone: vi.fn().mockResolvedValue({ id: 'tenant-secret' }),
    },
    embeddings: {
      listConfigs: vi.fn().mockResolvedValue([{ id: 'config-secret', name: 'private', model: 'private-model', dimensions: 3, is_default: true, created_at: '' }]),
      listSets: vi.fn().mockResolvedValue([]),
      getDefaultConfig: vi.fn().mockResolvedValue({ id: 'config-secret', name: 'private', model: 'private-model', dimensions: 3, is_default: true, created_at: '' }),
      refreshSet: vi.fn().mockResolvedValue(undefined),
      getSet: vi.fn().mockResolvedValue({ slug: 'research', name: 'secret', embedding_config_id: 'secret', created_at: '', updated_at: '', mode: 'auto', criteria: {} }),
      listSetMembers: vi.fn().mockResolvedValue([]),
      createSet: vi.fn().mockResolvedValue({}),
      updateSet: vi.fn().mockResolvedValue({}),
      deleteSet: vi.fn().mockResolvedValue(undefined),
      addSetMembers: vi.fn().mockResolvedValue(undefined),
      removeSetMember: vi.fn().mockResolvedValue(undefined),
    },
    systemCompatibility: {
      getOpenApi: vi.fn().mockResolvedValue('openapi: 3.1.0'),
      getAsyncApi: vi.fn().mockResolvedValue('asyncapi: 3.0.0'),
    },
  };

  return {
    api: createOperatorApi(client as never, services as never, gate as never),
    client,
    contractFetch,
    services,
    gate,
  };
}

describe('operator API', () => {
  it('pins exact methods, paths, and operation IDs for the operator surface', () => {
    const promoted = [
      ...OPERATOR_READ_OPERATIONS,
      ...Object.values(OPERATOR_ACTION_OPERATIONS),
    ];
    const authoritative = new Set(
      operationDispositions.operations.map((item) => `${item.method} ${item.path}#${item.operation_id}`),
    );

    for (const operation of promoted) {
      expect(
        authoritative.has(`${operation.method} ${operation.path}#${operation.operationId}`),
        `${operation.operationId} must match the pinned Fortemi disposition`,
      ).toBe(true);
    }

    const operationIds = promoted.map((operation) => operation.operationId);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('keeps secret-bearing creation and binary transfer operations outside promotion', () => {
    const promotedIds = new Set([
      ...OPERATOR_READ_OPERATIONS.map((operation) => operation.operationId),
      ...Object.values(OPERATOR_ACTION_OPERATIONS).map((operation) => operation.operationId),
    ]);
    const excludedIds = OPERATOR_EVIDENCE_BOUNDARY.notPromoted.map((operation) => operation.operationId);

    expect(excludedIds).toEqual(expect.arrayContaining([
      'create_webhook',
      'create_incoming_webhook_receiver',
      'create_inbound_source',
      'database_backup_download',
      'database_backup_upload',
      'backup_download',
      'knowledge_archive_upload',
      'knowledge_archive_download',
    ]));
    for (const operationId of excludedIds) expect(promotedIds.has(operationId)).toBe(false);
  });

  it('loads independently classified diagnostics and emits redacted bounded summaries', async () => {
    const { api, client, services } = harness();
    const snapshot = await api.loadSnapshot();

    expect(snapshot.state).toBe('success');
    expect(snapshot.mutation).toEqual({ state: 'allowed', reason: 'compatible_local_operator' });
    expect(client.get).toHaveBeenCalledWith('/inference/providers');
    expect(client.get).toHaveBeenCalledWith('/memory/info');
    expect(client.get).toHaveBeenCalledWith('/rate-limit/status');
    expect(client.get).toHaveBeenCalledWith('/extraction/stats');
    expect(client.get).toHaveBeenCalledWith('/health/access-frequency', { limit: '50', sort: 'most_accessed' });
    expect(services.health.getOrphanTags).toHaveBeenCalledOnce();
    expect(services.health.getStaleNotes).toHaveBeenCalledWith(180);
    expect(services.health.getUnlinkedNotes).toHaveBeenCalledOnce();
    expect(services.health.getTagCooccurrence).toHaveBeenCalledWith(5);
    expect(services.embeddings.getDefaultConfig).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('/private');
    expect(serialized).not.toContain('tenant-');
    expect(serialized).not.toContain('hook-id');
  });

  it('classifies authorization failures without exposing server error bodies', async () => {
    const { api } = harness({ directErrorPath: '/memory/info' });
    const snapshot = await api.loadSnapshot();

    expect(snapshot.state).toBe('partial');
    expect(snapshot.diagnostics.find((item) => item.id === 'storage')).toMatchObject({
      state: 'unauthorized',
      metrics: [],
    });
    expect(JSON.stringify(snapshot)).not.toContain('raw-secret-error');
    expect(JSON.stringify(snapshot)).not.toContain('do-not-render');
  });

  it('aggregates fully unauthorized operational probes independently of compatibility metadata', async () => {
    const { api, client, services } = harness();
    const unauthorized = new ApiError('sensitive server detail', 403, { token: 'do-not-render' });
    client.get.mockRejectedValue(unauthorized);
    for (const service of Object.values(services)) {
      for (const method of Object.values(service)) {
        if (typeof method === 'function' && 'mockRejectedValue' in method) {
          method.mockRejectedValue(unauthorized);
        }
      }
    }

    const snapshot = await api.loadSnapshot();

    expect(snapshot.state).toBe('unauthorized');
    expect(snapshot.diagnostics.find((item) => item.id === 'compatibility')?.state).toBe('available');
    expect(JSON.stringify(snapshot)).not.toMatch(/sensitive|do-not-render/);
  });

  it('fails closed before all operational probes when compatibility is not admitted', async () => {
    const error = new SystemCompatibilityContractError('unsupported_revision', 'raw revision detail');
    const { api, client, services } = harness({ compatibilityError: error });
    const snapshot = await api.loadSnapshot();

    expect(snapshot.state).toBe('incompatible');
    expect(snapshot.diagnostics).toEqual([expect.objectContaining({ state: 'incompatible', metrics: [] })]);
    expect(client.get).not.toHaveBeenCalled();
    expect(services.health.getKnowledgeHealth).not.toHaveBeenCalled();
    expect(JSON.stringify(snapshot)).not.toContain('raw revision detail');
  });

  it('runs admitted global controls through existing typed APIs', async () => {
    const { api, services } = harness();
    await api.runAction({ action: 'pause_jobs_global' });
    await api.runAction({ action: 'resume_jobs_global' });
    await api.runAction({ action: 'backup_trigger' });
    await api.runAction({ action: 'trigger_graph_maintenance' });
    expect(services.jobs.pauseGlobal).toHaveBeenCalledOnce();
    expect(services.jobs.resumeGlobal).toHaveBeenCalledOnce();
    expect(services.backup.triggerBackup).toHaveBeenCalledOnce();
    expect(services.links.triggerGraphMaintenance).toHaveBeenCalledOnce();
  });

  it('validates bounded targets before typed embedding and webhook controls', async () => {
    const { api, services } = harness();
    await api.runAction({ action: 'refresh_embedding_set', target: 'research-v2' });
    await api.runAction({ action: 'test_webhook', target: 'hook_01' });
    expect(services.embeddings.refreshSet).toHaveBeenCalledWith('research-v2');
    expect(services.webhooks.test).toHaveBeenCalledWith('hook_01');
    await expect(api.runAction({ action: 'test_webhook', target: '../unsafe' })).rejects.toThrow('bounded target');
  });

  it('runs scoped jobs, recovery, archive, and graph controls through typed APIs', async () => {
    const { api, services } = harness();
    await api.runAction({ action: 'pause_jobs_archive', target: 'research' });
    await api.runAction({ action: 'resume_jobs_archive', target: 'research' });
    await api.runAction({ action: 'database_backup_snapshot', target: 'before-upgrade' });
    await api.runAction({ action: 'database_backup_restore', target: 'backup-01.db' });
    await api.runAction({ action: 'swap_backup', target: 'backup-02.db' });
    await api.runAction({ action: 'set_default_archive', target: 'research' });
    await api.runAction({ action: 'capture_diagnostics_snapshot', target: 'post-maintenance' });
    await api.runAction({ action: 'recompute_snn_scores' });
    await api.runAction({ action: 'pfnet_sparsify' });
    await api.runAction({ action: 'coarse_community_detection' });

    expect(services.jobs.pauseArchive).toHaveBeenCalledWith('research');
    expect(services.jobs.resumeArchive).toHaveBeenCalledWith('research');
    expect(services.backup.createSnapshot).toHaveBeenCalledWith({ name: 'before-upgrade' });
    expect(services.backup.restoreDatabase).toHaveBeenCalledWith({ filename: 'backup-01.db', skip_snapshot: false });
    expect(services.backup.swapBackup).toHaveBeenCalledWith({ filename: 'backup-02.db', dry_run: false, strategy: 'wipe' });
    expect(services.archives.setDefault).toHaveBeenCalledWith('research');
    expect(services.links.captureGraphDiagnosticsSnapshot).toHaveBeenCalledWith({ label: 'post-maintenance', sample_size: 100 });
    expect(services.links.recomputeSnnScores).toHaveBeenCalledWith({ dry_run: false });
    expect(services.links.sparsifyGraphWithPfnet).toHaveBeenCalledWith({ dry_run: false });
    expect(services.links.detectCoarseGraphCommunities).toHaveBeenCalledWith({});
  });

  it('runs webhook lifecycle controls without rendering webhook data', async () => {
    const { api, services } = harness();
    await api.runAction({ action: 'update_webhook', target: 'hook-01', enabled: true });
    await api.runAction({ action: 'update_webhook', target: 'hook-01', enabled: false });
    await api.runAction({ action: 'delete_webhook', target: 'hook-01' });
    expect(services.webhooks.update).toHaveBeenNthCalledWith(1, 'hook-01', { is_active: true });
    expect(services.webhooks.update).toHaveBeenNthCalledWith(2, 'hook-01', { is_active: false });
    expect(services.webhooks.delete).toHaveBeenCalledWith('hook-01');
    await expect(api.runAction({ action: 'update_webhook', target: 'hook-01' })).rejects.toThrow('active state');
  });

  it('runs a fixed bounded inference completion without credentials or response content', async () => {
    const { api, client } = harness();
    const result = await api.runAction({ action: 'complete', target: 'model-a' });

    expect(client.post).toHaveBeenCalledWith('/inference/complete', {
      model: 'model-a',
      messages: [{ role: 'user', content: 'Reply with exactly OK.' }],
      max_tokens: 8,
      temperature: 0,
      think: false,
    });
    const requestBody = client.post.mock.calls[0]?.[1];
    expect(requestBody).not.toHaveProperty('api_key');
    expect(requestBody).not.toHaveProperty('base_url');
    expect(requestBody).not.toHaveProperty('provider_id');
    expect(result).toMatchObject({
      state: 'accepted',
      operationId: 'complete',
      metrics: expect.arrayContaining([{ label: 'content characters', value: 14 }]),
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|private-model|private-provider/);
  });

  it('fails closed on malformed or oversized inference completion responses', async () => {
    const malformed = harness();
    malformed.client.post.mockResolvedValueOnce({ content: 'OK', finish_reason: 'stop', model: 'model-a' });
    await expect(malformed.api.runAction({ action: 'complete', target: 'model-a' })).rejects.toThrow('malformed');

    const oversized = harness();
    oversized.client.post.mockResolvedValueOnce({
      content: 'x'.repeat(65_537),
      finish_reason: 'stop',
      model: 'model-a',
      provider_id: 'provider-a',
    });
    await expect(oversized.api.runAction({ action: 'complete', target: 'model-a' })).rejects.toThrow('exceeds');
  });

  it('runs a bounded SSE diagnostic and counts unknown events without retaining content', async () => {
    const { api, client } = harness();
    const fetch = vi.fn().mockResolvedValue(new Response([
      'event: delta\ndata: {"content":"stream-secret"}',
      'event: future-event\ndata: {"token":"unknown-secret"}',
      'event: done\ndata: {"finish_reason":"stop","model":"private-model","provider_id":"private-provider"}',
      '',
    ].join('\n\n'), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', fetch);

    const result = await api.runAction({ action: 'stream', target: 'model-a' });

    expect(client.requireMutation).toHaveBeenCalledWith('POST', '/inference/stream');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/inference/stream',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'model-a', max_tokens: 8, temperature: 0, think: false });
    expect(body).not.toHaveProperty('api_key');
    expect(body).not.toHaveProperty('base_url');
    expect(body).not.toHaveProperty('provider_id');
    expect(result.metrics).toEqual(expect.arrayContaining([
      { label: 'completed', value: true },
      { label: 'delta events', value: 1 },
      { label: 'unknown events', value: 1 },
      { label: 'content characters', value: 13 },
    ]));
    expect(JSON.stringify(result)).not.toMatch(/stream-secret|unknown-secret|private-model|private-provider/);
  });

  it('cancels and rejects an oversized inference stream', async () => {
    const { api } = harness();
    let cancelled = false;
    let emitted = 0;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        emitted += 1;
        if (emitted <= 2) controller.enqueue(new Uint8Array(32_769));
      },
      cancel() { cancelled = true; },
    }), { status: 200 })));

    await expect(api.runAction({ action: 'stream', target: 'model-a' })).rejects.toThrow('byte bounds');
    expect(cancelled).toBe(true);
  });

  it.each([
    ['event: delta\ndata: {}\n\n', 'delta is malformed'],
    ['event: done\ndata: {"finish_reason":"stop"}\n\n', 'completion is malformed'],
    ['event: future\ndata: {}\n\n', 'ended before completion'],
    ['event: error\ndata: {}\n\n', 'reported an error'],
  ])('fails closed for invalid SSE sequence %#', async (stream, message) => {
    const { api } = harness();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));
    await expect(api.runAction({ action: 'stream', target: 'model-a' })).rejects.toThrow(message);
  });

  it('dispatches embedding config, set, member, and regeneration controls with bounded inputs', async () => {
    const { api, client, services } = harness();
    await api.runAction({ action: 'create_embedding_config', target: 'local-small', secondaryTarget: 'embed-v2', numericValue: 768 });
    await api.runAction({ action: 'update_embedding_config', target: 'cfg-01', secondaryTarget: 'embed-v3', numericValue: 1024 });
    await api.runAction({ action: 'delete_embedding_config', target: 'cfg-02' });
    await api.runAction({ action: 'create_embedding_set', target: 'research', secondaryTarget: 'cfg-01', value: 'Research set' });
    await api.runAction({ action: 'update_embedding_set', target: 'research', value: 'Updated research' });
    await api.runAction({ action: 'add_embedding_set_members', target: 'research', secondaryTarget: 'note-01' });
    await api.runAction({ action: 'remove_embedding_set_member', target: 'research', secondaryTarget: 'note-01' });
    await api.runAction({ action: 'refresh_embedding_set', target: 'research' });
    await api.runAction({ action: 'delete_embedding_set', target: 'research' });

    expect(client.post).toHaveBeenCalledWith('/embedding-configs', { name: 'local-small', model: 'embed-v2', dimension: 768 });
    expect(client.patch).toHaveBeenCalledWith('/embedding-configs/cfg-01', { model: 'embed-v3', dimension: 1024 });
    expect(client.delete).toHaveBeenCalledWith('/embedding-configs/cfg-02');
    expect(services.embeddings.createSet).toHaveBeenCalledWith({ slug: 'research', name: 'Research set', embedding_config_id: 'cfg-01', mode: 'manual' });
    expect(services.embeddings.updateSet).toHaveBeenCalledWith('research', { name: 'Updated research' });
    expect(services.embeddings.addSetMembers).toHaveBeenCalledWith('research', { note_ids: ['note-01'] });
    expect(services.embeddings.removeSetMember).toHaveBeenCalledWith('research', 'note-01');
    expect(services.embeddings.refreshSet).toHaveBeenCalledWith('research');
    expect(services.embeddings.deleteSet).toHaveBeenCalledWith('research');
    await expect(api.runAction({ action: 'create_embedding_config', target: 'cfg', secondaryTarget: 'model', numericValue: 0 })).rejects.toThrow('dimension');
  });

  it('dispatches archive, backup metadata, and inbound deletion through existing typed APIs', async () => {
    const { api, services } = harness();
    await api.runAction({ action: 'create_archive', target: 'research', value: 'Research archive' });
    await api.runAction({ action: 'update_archive', target: 'research', value: 'Updated archive' });
    await api.runAction({ action: 'clone_archive', target: 'research', secondaryTarget: 'research-copy' });
    await api.runAction({ action: 'update_backup_metadata', target: 'backup-01.db', value: 'Before upgrade' });
    await api.runAction({ action: 'delete_inbound_source', target: 'mail-ingest' });
    await api.runAction({ action: 'delete_archive', target: 'research-copy' });

    expect(services.archives.create).toHaveBeenCalledWith({ name: 'research', description: 'Research archive' });
    expect(services.archives.update).toHaveBeenCalledWith('research', { description: 'Updated archive' });
    expect(services.archives.clone).toHaveBeenCalledWith('research', { new_name: 'research-copy' });
    expect(services.backup.updateBackupMetadata).toHaveBeenCalledWith('backup-01.db', { title: 'Before upgrade' });
    expect(services.webhooks.deleteInboundSource).toHaveBeenCalledWith('mail-ingest');
    expect(services.archives.delete).toHaveBeenCalledWith('research-copy');
  });

  it.each([
    ['job_detail', 'job-01', undefined, 'get_job'],
    ['webhook_detail', 'hook-01', undefined, 'get_webhook'],
    ['webhook_deliveries', 'hook-01', undefined, 'list_webhook_deliveries'],
    ['graph_compare', 'before-01', 'after-01', 'compare_diagnostics_snapshots'],
    ['archive_stats', 'research', undefined, 'get_archive_stats'],
    ['archive_detail', 'research', undefined, 'get_archive'],
    ['backup_info', 'backup-01.db', undefined, 'get_backup_info'],
    ['backup_metadata', 'backup-01.db', undefined, 'get_backup_metadata'],
    ['embedding_set', 'research-v2', undefined, 'get_embedding_set'],
    ['embedding_config', 'config-01', undefined, 'get_embedding_config'],
    ['provider_catalog', undefined, undefined, 'list_providers'],
    ['model_catalog', undefined, undefined, 'list_models'],
  ] as const)('returns a bounded redacted %s inspection', async (inspection, target, compareTarget, operationId) => {
    const { api } = harness();
    const result = await api.inspect({ inspection, ...(target ? { target } : {}), ...(compareTarget ? { compareTarget } : {}) });
    expect(result.operationIds).toContain(operationId);
    expect(result.metrics.length).toBeLessThanOrEqual(8);
    expect(JSON.stringify(result)).not.toMatch(/secret|private|tenant|hook-01|job-01|backup-01\.db|research-v2/);
  });

  it('streams compatibility-provided OpenAPI and AsyncAPI links without retaining document bodies', async () => {
    const { api, contractFetch, services } = harness();
    const result = await api.loadSnapshot();
    expect(contractFetch).toHaveBeenCalledTimes(2);
    expect(contractFetch).toHaveBeenCalledWith(
      'http://localhost:3000/operator/openapi.yaml',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(contractFetch).toHaveBeenCalledWith(
      'http://localhost:3000/operator/asyncapi.yaml',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(services.systemCompatibility.getOpenApi).not.toHaveBeenCalled();
    expect(services.systemCompatibility.getAsyncApi).not.toHaveBeenCalled();
    expect(result.diagnostics.find((item) => item.id === 'contract-documents')).toMatchObject({
      state: 'available',
      metrics: [
        { label: 'OpenAPI verified', value: true },
        { label: 'AsyncAPI verified', value: true },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('schema: bounded');
  });

  it('cancels contract documents whose declared content length exceeds the cap', async () => {
    const { api } = harness();
    let cancelled = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/operator/openapi.yaml')) {
        return new Response(new ReadableStream({ cancel: () => { cancelled = true; } }), {
          status: 200,
          headers: { 'Content-Length': '10000001' },
        });
      }
      return new Response('asyncapi: bounded');
    }));

    const result = await api.loadSnapshot();

    expect(cancelled).toBe(true);
    expect(result.diagnostics.find((item) => item.id === 'contract-documents')).toMatchObject({
      state: 'error',
      metrics: [],
    });
    expect(JSON.stringify(result)).not.toMatch(/10000001|asyncapi: bounded/);
  });

  it('cancels chunked contract documents as soon as observed bytes exceed the cap', async () => {
    const { api } = harness();
    let cancelled = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/operator/openapi.yaml')) {
        let emitted = 0;
        return new Response(new ReadableStream<Uint8Array>({
          pull(controller) {
            emitted += 1;
            if (emitted <= 2) controller.enqueue(new Uint8Array(5_000_001));
          },
          cancel() { cancelled = true; },
        }), { status: 200 });
      }
      return new Response('asyncapi: bounded');
    }));

    const result = await api.loadSnapshot();

    expect(cancelled).toBe(true);
    expect(result.diagnostics.find((item) => item.id === 'contract-documents')).toMatchObject({
      state: 'error',
      metrics: [],
    });
    expect(JSON.stringify(result)).not.toContain('asyncapi: bounded');
  });

  it('does not admit hosted preview controls', async () => {
    const { api, services } = harness({ hostedPreview: true });
    await expect(api.runAction({ action: 'backup_trigger' })).rejects.toBeInstanceOf(SystemCompatibilityContractError);
    expect(services.backup.triggerBackup).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown', true, 'incompatible'],
    ['preview', true, 'incompatible'],
    ['unavailable', true, 'unavailable'],
    ['available', false, 'unauthorized'],
  ] as const)('fails closed for hosted %s capability with tenant context %s', async (capabilityState, tenantContext, admissionState) => {
    const { api, gate, services } = harness();
    gate.getSnapshot.mockReturnValue({
      state: 'compatible',
      response: {
        ...compatibleContract(),
        deployment: { mode: 'hosted', edition: 'enterprise', hosted_multi_tenant_ready: true },
        auth: {
          required: true,
          mode: 'oauth_bearer',
          oauth_issuer_configured: true,
          tenant_context_available: tenantContext,
          claim_contract_version: '1.0.0',
          claim_contract_profile: 'rust-node-jwt-v1',
          authority_release: 'v2026.7.0',
        },
        capabilities: { backoffice_api: { state: capabilityState } },
      },
      error: null,
    } as never);

    expect(api.getMutationAdmission().state).toBe(admissionState);
    await expect(api.runAction({ action: 'backup_trigger' })).rejects.toBeInstanceOf(SystemCompatibilityContractError);
    expect(services.backup.triggerBackup).not.toHaveBeenCalled();
  });
});
