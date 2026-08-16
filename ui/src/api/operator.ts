import { ApiError, NetworkError } from './errors';
import { getServerRoot, type ApiClient } from './client';
import { getAuthorizationHeader } from './auth-context';
import type { ArchivesApi } from './archives';
import type { BackupApi } from './backup';
import type { ChatApi } from './chat';
import type { EmbeddingsApi } from './embeddings';
import type { HealthApi } from './health';
import type { InferenceApi } from './inference';
import type { JobsApi } from './jobs';
import type { LinksApi } from './links';
import type {
  CompatibilityAdmissionSnapshot,
  SystemCompatibilityResponse,
  createSystemCompatibilityApi,
} from './systemCompatibility';
import { SystemCompatibilityContractError } from './systemCompatibility';
import type { WebhooksApi } from './webhooks';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import { getHostAdapter, getTauriFetch } from '@/lib/tauri';

export type OperatorDomain =
  | 'compatibility'
  | 'inference'
  | 'graph'
  | 'health'
  | 'storage'
  | 'jobs'
  | 'webhooks'
  | 'backup'
  | 'archives'
  | 'embeddings';

export type OperatorDiagnosticState =
  | 'available'
  | 'empty'
  | 'degraded'
  | 'unauthorized'
  | 'unavailable'
  | 'incompatible'
  | 'unknown'
  | 'error';

export interface OperatorOperation {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  operationId: string;
}

export interface OperatorMetric {
  label: string;
  value: number | string | boolean;
}

export interface OperatorDiagnostic {
  id: string;
  domain: OperatorDomain;
  label: string;
  state: OperatorDiagnosticState;
  metrics: OperatorMetric[];
  operationIds: string[];
  truncated?: boolean;
}

export interface OperatorSnapshot {
  state: 'success' | 'empty' | 'partial' | 'degraded' | 'unauthorized' | 'incompatible';
  fetchedAt: string;
  diagnostics: OperatorDiagnostic[];
  mutation: OperatorMutationAdmission;
}

export interface OperatorMutationAdmission {
  state: 'allowed' | 'checking' | 'unauthorized' | 'incompatible' | 'unavailable';
  reason: string;
}

export type OperatorActionId =
  | 'pause_jobs_global'
  | 'resume_jobs_global'
  | 'pause_jobs_archive'
  | 'resume_jobs_archive'
  | 'backup_trigger'
  | 'database_backup_snapshot'
  | 'database_backup_restore'
  | 'swap_backup'
  | 'set_default_archive'
  | 'trigger_graph_maintenance'
  | 'capture_diagnostics_snapshot'
  | 'recompute_snn_scores'
  | 'pfnet_sparsify'
  | 'coarse_community_detection'
  | 'refresh_embedding_set'
  | 'test_webhook'
  | 'update_webhook'
  | 'delete_webhook'
  | 'complete'
  | 'stream'
  | 'create_embedding_config'
  | 'update_embedding_config'
  | 'delete_embedding_config'
  | 'create_embedding_set'
  | 'update_embedding_set'
  | 'delete_embedding_set'
  | 'add_embedding_set_members'
  | 'remove_embedding_set_member'
  | 'create_archive'
  | 'update_archive'
  | 'delete_archive'
  | 'clone_archive'
  | 'update_backup_metadata'
  | 'delete_inbound_source';

export interface OperatorActionRequest {
  action: OperatorActionId;
  target?: string;
  secondaryTarget?: string;
  value?: string;
  numericValue?: number;
  enabled?: boolean;
}

export type OperatorInspectionId =
  | 'job_detail'
  | 'webhook_detail'
  | 'webhook_deliveries'
  | 'graph_compare'
  | 'archive_stats'
  | 'backup_info'
  | 'backup_metadata'
  | 'archive_detail'
  | 'embedding_set'
  | 'embedding_config'
  | 'provider_catalog'
  | 'model_catalog';

export interface OperatorInspectionRequest {
  inspection: OperatorInspectionId;
  target?: string;
  compareTarget?: string;
}

export interface OperatorActionResult {
  state: 'accepted';
  operationId: OperatorActionId;
  metrics?: OperatorMetric[];
}

interface CompatibilityGate {
  preflight(): Promise<SystemCompatibilityResponse>;
  requireRemoteMutation(): Promise<void>;
  getSnapshot(): CompatibilityAdmissionSnapshot;
}

interface OperatorServices {
  archives: ArchivesApi;
  backup: BackupApi;
  chat: ChatApi;
  embeddings: EmbeddingsApi;
  health: HealthApi;
  inference: InferenceApi;
  jobs: JobsApi;
  links: LinksApi;
  systemCompatibility: ReturnType<typeof createSystemCompatibilityApi>;
  webhooks: WebhooksApi;
}

interface ProbeDefinition {
  id: string;
  domain: OperatorDomain;
  label: string;
  operations: readonly OperatorOperation[];
  run: () => Promise<DecodedMetrics>;
}

interface DecodedMetrics {
  metrics: OperatorMetric[];
  empty?: boolean;
  degraded?: boolean;
  truncated?: boolean;
}

const MAX_COLLECTION_ITEMS = 500;
const MAX_SAFE_COUNT = 1_000_000_000;
const MAX_TARGET_LENGTH = 128;
const MAX_TEXT_LENGTH = 256;
const MAX_STREAM_BYTES = 65_536;
const MAX_STREAM_EVENTS = 256;
const MAX_CONTRACT_DOCUMENT_BYTES = 10_000_000;
const INFERENCE_PROBE_PROMPT = 'Reply with exactly OK.';

const op = (method: OperatorOperation['method'], path: string, operationId: string): OperatorOperation => ({
  method,
  path,
  operationId,
});

export const OPERATOR_READ_OPERATIONS = [
  op('GET', '/api/v1/system/compatibility', 'system_compatibility'),
  op('GET', '/api/v1/inference/config', 'get_inference_config'),
  op('GET', '/api/v1/inference/config/audit', 'get_inference_config_audit'),
  op('GET', '/api/v1/inference/providers', 'list_providers'),
  op('GET', '/api/v1/models', 'list_models'),
  op('GET', '/api/v1/graph/diagnostics', 'graph_diagnostics'),
  op('GET', '/api/v1/graph/diagnostics/history', 'list_diagnostics_snapshots'),
  op('GET', '/api/v1/graph/topology/stats', 'graph_topology_stats'),
  op('GET', '/api/v1/graph/cold-spots', 'get_cold_spots'),
  op('GET', '/api/v1/health/knowledge', 'get_knowledge_health'),
  op('GET', '/api/v1/health/access-frequency', 'get_access_frequency'),
  op('GET', '/api/v1/health/orphan-tags', 'get_orphan_tags'),
  op('GET', '/api/v1/health/stale-notes', 'get_stale_notes'),
  op('GET', '/api/v1/health/streaming', 'streaming_health_check'),
  op('GET', '/api/v1/health/tag-cooccurrence', 'get_tag_cooccurrence'),
  op('GET', '/api/v1/health/unlinked-notes', 'get_unlinked_notes'),
  op('GET', '/api/v1/memory/info', 'memory_info'),
  op('GET', '/api/v1/rate-limit/status', 'rate_limit_status'),
  op('GET', '/api/v1/extraction/stats', 'extraction_stats'),
  op('GET', '/api/v1/jobs', 'list_jobs'),
  op('GET', '/api/v1/jobs/stats', 'queue_stats'),
  op('GET', '/api/v1/jobs/status', 'get_job_pause_status'),
  op('GET', '/api/v1/webhooks', 'list_webhooks'),
  op('GET', '/api/v1/webhooks/incoming', 'list_incoming_webhook_receivers'),
  op('GET', '/api/v1/inbound-sources', 'list_inbound_sources'),
  op('GET', '/api/v1/backup/status', 'backup_status'),
  op('GET', '/api/v1/backup/list', 'list_backups'),
  op('GET', '/api/v1/archives', 'list_archives'),
  op('GET', '/api/v1/embedding-configs', 'list_embedding_configs'),
  op('GET', '/api/v1/embedding-configs/default', 'get_default_embedding_config'),
  op('GET', '/api/v1/embedding-sets', 'list_embedding_sets'),
  op('GET', '/api/v1/jobs/{id}', 'get_job'),
  op('GET', '/api/v1/webhooks/{id}', 'get_webhook'),
  op('GET', '/api/v1/webhooks/{id}/deliveries', 'list_webhook_deliveries'),
  op('GET', '/api/v1/graph/diagnostics/compare', 'compare_diagnostics_snapshots'),
  op('GET', '/api/v1/archives/{name}/stats', 'get_archive_stats'),
  op('GET', '/api/v1/archives/{name}', 'get_archive'),
  op('GET', '/api/v1/backup/list/{filename}', 'get_backup_info'),
  op('GET', '/api/v1/backup/metadata/{filename}', 'get_backup_metadata'),
  op('GET', '/api/v1/embedding-configs/{id}', 'get_embedding_config'),
  op('GET', '/api/v1/embedding-sets/{slug}', 'get_embedding_set'),
  op('GET', '/api/v1/embedding-sets/{slug}/members', 'list_embedding_set_members'),
] as const;

export const OPERATOR_ACTION_OPERATIONS: Record<OperatorActionId, OperatorOperation> = {
  pause_jobs_global: op('POST', '/api/v1/jobs/pause', 'pause_jobs_global'),
  resume_jobs_global: op('POST', '/api/v1/jobs/resume', 'resume_jobs_global'),
  pause_jobs_archive: op('POST', '/api/v1/jobs/pause/{archive}', 'pause_jobs_archive'),
  resume_jobs_archive: op('POST', '/api/v1/jobs/resume/{archive}', 'resume_jobs_archive'),
  backup_trigger: op('POST', '/api/v1/backup/trigger', 'backup_trigger'),
  database_backup_snapshot: op('POST', '/api/v1/backup/database/snapshot', 'database_backup_snapshot'),
  database_backup_restore: op('POST', '/api/v1/backup/database/restore', 'database_backup_restore'),
  swap_backup: op('POST', '/api/v1/backup/swap', 'swap_backup'),
  set_default_archive: op('POST', '/api/v1/archives/{name}/set-default', 'set_default_archive'),
  trigger_graph_maintenance: op('POST', '/api/v1/graph/maintenance', 'trigger_graph_maintenance'),
  capture_diagnostics_snapshot: op('POST', '/api/v1/graph/diagnostics/snapshot', 'capture_diagnostics_snapshot'),
  recompute_snn_scores: op('POST', '/api/v1/graph/snn/recompute', 'recompute_snn_scores'),
  pfnet_sparsify: op('POST', '/api/v1/graph/pfnet/sparsify', 'pfnet_sparsify'),
  coarse_community_detection: op('POST', '/api/v1/graph/community/coarse', 'coarse_community_detection'),
  refresh_embedding_set: op('POST', '/api/v1/embedding-sets/{slug}/refresh', 'refresh_embedding_set'),
  test_webhook: op('POST', '/api/v1/webhooks/{id}/test', 'test_webhook'),
  update_webhook: op('PATCH', '/api/v1/webhooks/{id}', 'update_webhook'),
  delete_webhook: op('DELETE', '/api/v1/webhooks/{id}', 'delete_webhook_handler'),
  complete: op('POST', '/api/v1/inference/complete', 'complete'),
  stream: op('POST', '/api/v1/inference/stream', 'stream'),
  create_embedding_config: op('POST', '/api/v1/embedding-configs', 'create_embedding_config'),
  update_embedding_config: op('PATCH', '/api/v1/embedding-configs/{id}', 'update_embedding_config'),
  delete_embedding_config: op('DELETE', '/api/v1/embedding-configs/{id}', 'delete_embedding_config'),
  create_embedding_set: op('POST', '/api/v1/embedding-sets', 'create_embedding_set'),
  update_embedding_set: op('PATCH', '/api/v1/embedding-sets/{slug}', 'update_embedding_set'),
  delete_embedding_set: op('DELETE', '/api/v1/embedding-sets/{slug}', 'delete_embedding_set'),
  add_embedding_set_members: op('POST', '/api/v1/embedding-sets/{slug}/members', 'add_embedding_set_members'),
  remove_embedding_set_member: op('DELETE', '/api/v1/embedding-sets/{slug}/members/{note_id}', 'remove_embedding_set_member'),
  create_archive: op('POST', '/api/v1/archives', 'create_archive'),
  update_archive: op('PATCH', '/api/v1/archives/{name}', 'update_archive'),
  delete_archive: op('DELETE', '/api/v1/archives/{name}', 'delete_archive'),
  clone_archive: op('POST', '/api/v1/archives/{name}/clone', 'clone_archive'),
  update_backup_metadata: op('PUT', '/api/v1/backup/metadata/{filename}', 'update_backup_metadata'),
  delete_inbound_source: op('DELETE', '/api/v1/inbound-sources/{name}', 'delete_inbound_source'),
};

export const OPERATOR_EVIDENCE_BOUNDARY = {
  proves: 'Exact client operation dispatch, bounded decoding, redacted rendering, compatibility admission, and explicit mutation confirmation.',
  doesNotProve: 'Live Fortemi response conformance, authorization policy conformance, or server-side mutation outcomes without separate live receipts.',
  notPromoted: [
    { operationId: 'create_webhook', reason: 'Webhook creation, including secret entry, remains in the dedicated Webhooks panel.' },
    { operationId: 'create_incoming_webhook_receiver', reason: 'Receiver secret provisioning remains in the dedicated Webhooks panel.' },
    { operationId: 'create_inbound_source', reason: 'Inbound source configuration may contain secrets and is not rendered by the operator console.' },
    { operationId: 'database_backup_download', reason: 'Binary transfer is outside the bounded JSON operator console.' },
    { operationId: 'database_backup_upload', reason: 'Binary upload is outside the bounded JSON operator console.' },
    { operationId: 'backup_download', reason: 'Binary transfer is outside the bounded JSON operator console.' },
    { operationId: 'memory_backup_download', reason: 'Binary archive transfer is outside the bounded JSON operator console.' },
    { operationId: 'knowledge_archive_upload', reason: 'Binary archive upload remains restricted.' },
    { operationId: 'knowledge_archive_download', reason: 'Binary archive download remains restricted.' },
    { operationId: 'backup_export', reason: 'Full-content backup export is not rendered by the bounded operator console.' },
    { operationId: 'backup_import', reason: 'Full-content backup import remains outside promotion pending the restricted transfer review.' },
    { operationId: 'knowledge_shard', reason: 'Knowledge Shard transfer is profile-gated and remains outside this operator increment.' },
    { operationId: 'knowledge_shard_import', reason: 'Knowledge Shard import remains outside this operator increment.' },
    { operationId: 'knowledge_shard_import_upload', reason: 'Knowledge Shard binary upload remains restricted.' },
  ],
} as const;

function boundedNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_SAFE_COUNT, value));
}

function boundedCollection(value: unknown): { count: number; truncated: boolean } {
  if (!Array.isArray(value)) return { count: 0, truncated: false };
  return {
    count: Math.min(value.length, MAX_COLLECTION_ITEMS),
    truncated: value.length > MAX_COLLECTION_ITEMS,
  };
}

function safeState(value: unknown, allowed: readonly string[]): string {
  return typeof value === 'string' && allowed.includes(value.toLowerCase())
    ? value.toLowerCase()
    : 'unknown';
}

function classifyError(error: unknown): OperatorDiagnosticState {
  if (error instanceof SystemCompatibilityContractError) return 'incompatible';
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'unauthorized';
    if ([404, 405, 501].includes(error.statusCode)) return 'unavailable';
    if ([409, 412, 426].includes(error.statusCode)) return 'incompatible';
    return 'error';
  }
  if (error instanceof NetworkError) return 'unavailable';
  return 'error';
}

function mutationAdmission(
  snapshot: CompatibilityAdmissionSnapshot,
): OperatorMutationAdmission {
  if (snapshot.state === 'checking' || snapshot.state === 'unresolved') {
    return { state: 'checking', reason: 'compatibility_not_admitted' };
  }
  if (snapshot.state === 'blocked' || !snapshot.response) {
    return { state: 'incompatible', reason: snapshot.error?.code ?? 'compatibility_unavailable' };
  }

  const contract = snapshot.response;
  if (contract.deployment.mode === 'local_sidecar' && !contract.auth.required) {
    return { state: 'allowed', reason: 'compatible_local_operator' };
  }

  const backoffice = contract.capabilities.backoffice_api;
  if (contract.auth.required && !contract.auth.tenant_context_available) {
    return { state: 'unauthorized', reason: 'tenant_context_unavailable' };
  }
  if (!backoffice || backoffice.state !== 'available') {
    return {
      state: backoffice?.state === 'unavailable' ? 'unavailable' : 'incompatible',
      reason: backoffice?.reason_code ?? 'operator_capability_not_available',
    };
  }
  return { state: 'allowed', reason: 'compatible_hosted_operator' };
}

function aggregateState(diagnostics: OperatorDiagnostic[]): OperatorSnapshot['state'] {
  const operational = diagnostics.filter((item) => item.domain !== 'compatibility');
  if (operational.some((item) => item.state === 'incompatible')) return 'incompatible';
  if (operational.length > 0 && operational.every((item) => item.state === 'unauthorized')) return 'unauthorized';
  if (operational.length > 0 && operational.every((item) => item.state === 'empty')) return 'empty';
  if (operational.some((item) => ['unauthorized', 'unavailable', 'unknown', 'error'].includes(item.state))) return 'partial';
  if (operational.some((item) => item.state === 'degraded')) return 'degraded';
  return 'success';
}

function validateTarget(target: string | undefined): string {
  const normalized = target?.trim() ?? '';
  if (!normalized || normalized.length > MAX_TARGET_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error('A valid bounded target is required for this control.');
  }
  return normalized;
}

function validateText(value: string | undefined, label: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized || normalized.length > MAX_TEXT_LENGTH || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`A valid bounded ${label} is required for this control.`);
  }
  return normalized;
}

function validateDimension(value: number | undefined): number {
  if (!Number.isInteger(value) || value === undefined || value < 1 || value > 65_536) {
    throw new Error('A valid embedding dimension is required for this control.');
  }
  return value;
}

interface InferenceCompleteResponse {
  content: string;
  finish_reason: string;
  model: string;
  provider_id: string;
}

function decodeInferenceComplete(value: unknown): InferenceCompleteResponse {
  if (!value || typeof value !== 'object') throw new Error('Inference completion response is malformed.');
  const record = value as Record<string, unknown>;
  const fields = ['content', 'finish_reason', 'model', 'provider_id'] as const;
  if (fields.some((field) => typeof record[field] !== 'string')) {
    throw new Error('Inference completion response is malformed.');
  }
  const decoded = record as unknown as InferenceCompleteResponse;
  if (
    decoded.content.length > MAX_STREAM_BYTES
    || decoded.finish_reason.length > MAX_TEXT_LENGTH
    || decoded.model.length > MAX_TEXT_LENGTH
    || decoded.provider_id.length > MAX_TEXT_LENGTH
  ) {
    throw new Error('Inference completion response exceeds diagnostic bounds.');
  }
  return decoded;
}

function inferenceProbeRequest(model: string) {
  return {
    model,
    messages: [{ role: 'user', content: INFERENCE_PROBE_PROMPT }],
    max_tokens: 8,
    temperature: 0,
    think: false,
  };
}

function contractDocumentUrl(client: ApiClient, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getServerRoot(client.baseUrl)}${normalizedPath}`;
}

async function verifyBoundedContractDocument(
  client: ApiClient,
  path: string,
): Promise<boolean> {
  const response = await getTauriFetch()(contractDocumentUrl(client, path), {
    method: 'GET',
    headers: { Accept: 'application/yaml,text/yaml,text/plain,*/*' },
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ApiError('Contract document request failed.', response.status);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const advertisedBytes = Number(contentLength);
    if (Number.isFinite(advertisedBytes) && advertisedBytes > MAX_CONTRACT_DOCUMENT_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('Contract document exceeds diagnostic bounds.');
    }
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Contract document stream is unavailable.');
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_CONTRACT_DOCUMENT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error('Contract document exceeds diagnostic bounds.');
    }
  }
  return bytes > 0;
}

function parseInferenceSseFrame(frame: string): { event: string; payload: Record<string, unknown> } | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const fieldValue = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') event = fieldValue || 'message';
    if (field === 'data') data.push(fieldValue);
  }
  if (data.length === 0) return null;
  try {
    const payload = JSON.parse(data.join('\n')) as unknown;
    return {
      event,
      payload: payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {},
    };
  } catch {
    return { event, payload: {} };
  }
}

async function runInferenceStream(client: ApiClient, model: string): Promise<OperatorMetric[]> {
  await client.requireMutation('POST', '/inference/stream');
  const activeMemory = getActiveMemory();
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    ...getAuthorizationHeader(),
    ...(activeMemory ? { [getMemoryRoutingHeaderName()]: activeMemory } : {}),
  };
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
  try {
    const httpFetch = getHostAdapter() ? globalThis.fetch : getTauriFetch();
    const response = await httpFetch(`${client.baseUrl}/inference/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(inferenceProbeRequest(model)),
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError('Inference stream request failed.', response.status);
    if (!response.body) throw new Error('Inference stream is unavailable.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let carry = '';
    let bytes = 0;
    let events = 0;
    let deltas = 0;
    let unknownEvents = 0;
    let contentChars = 0;
    let completed = false;

    const recordFrame = (frame: string) => {
      const parsed = parseInferenceSseFrame(frame);
      if (!parsed) return;
      events += 1;
      if (events > MAX_STREAM_EVENTS) throw new Error('Inference stream exceeds diagnostic event bounds.');
      if (parsed.event === 'delta') {
        const content = parsed.payload.content;
        if (typeof content !== 'string') throw new Error('Inference stream delta is malformed.');
        deltas += 1;
        contentChars = Math.min(MAX_STREAM_BYTES, contentChars + content.length);
      } else if (parsed.event === 'done') {
        const { finish_reason: finishReason, model, provider_id: providerId } = parsed.payload;
        if (
          typeof finishReason !== 'string'
          || typeof model !== 'string'
          || typeof providerId !== 'string'
          || finishReason.length > MAX_TEXT_LENGTH
          || model.length > MAX_TEXT_LENGTH
          || providerId.length > MAX_TEXT_LENGTH
        ) {
          throw new Error('Inference stream completion is malformed.');
        }
        completed = true;
      } else if (parsed.event === 'error') {
        throw new Error('Inference stream reported an error.');
      } else {
        unknownEvents += 1;
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_STREAM_BYTES) throw new Error('Inference stream exceeds diagnostic byte bounds.');
        const frames = (carry + decoder.decode(value, { stream: true })).split(/\r?\n\r?\n/);
        carry = frames.pop() ?? '';
        frames.forEach(recordFrame);
      }
      const finalFrames = (carry + decoder.decode()).split(/\r?\n\r?\n/).filter(Boolean);
      finalFrames.forEach(recordFrame);
      if (!completed) throw new Error('Inference stream ended before completion.');

      return [
        { label: 'completed', value: completed },
        { label: 'delta events', value: Math.min(deltas, MAX_STREAM_EVENTS) },
        { label: 'unknown events', value: Math.min(unknownEvents, MAX_STREAM_EVENTS) },
        { label: 'content characters', value: Math.min(contentChars, MAX_STREAM_BYTES) },
      ];
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function isOperatorSnapshotStale(
  snapshot: OperatorSnapshot,
  now = Date.now(),
  staleAfterMs = 60_000,
): boolean {
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  return !Number.isFinite(fetchedAt) || now - fetchedAt > staleAfterMs;
}

export function createOperatorApi(
  client: ApiClient,
  services: OperatorServices,
  gate: CompatibilityGate,
) {
  const probes = (): ProbeDefinition[] => [
    {
      id: 'contract-documents',
      domain: 'compatibility',
      label: 'Contract documents',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'system_compatibility'),
      run: async () => {
        const response = gate.getSnapshot().response;
        if (!response) throw new SystemCompatibilityContractError('compatibility_unavailable', 'Compatibility links are unavailable.');
        const [openapiAvailable, asyncapiAvailable] = await Promise.all([
          verifyBoundedContractDocument(client, response.links.openapi),
          verifyBoundedContractDocument(client, response.links.asyncapi),
        ]);
        return {
          metrics: [
            { label: 'OpenAPI verified', value: openapiAvailable },
            { label: 'AsyncAPI verified', value: asyncapiAvailable },
          ],
          degraded: !openapiAvailable || !asyncapiAvailable,
        };
      },
    },
    {
      id: 'inference',
      domain: 'inference',
      label: 'Inference',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.operationId.startsWith('get_inference') || item.operationId === 'list_providers' || item.operationId === 'list_models'),
      run: async () => {
        const [config, audit, providersRaw, catalog] = await Promise.all([
          services.inference.getConfig(),
          services.inference.getAuditLog({ limit: 50 }),
          client.get<unknown>('/inference/providers'),
          services.chat.getModelCatalog(),
        ]);
        const providers = boundedCollection(
          Array.isArray(providersRaw)
            ? providersRaw
            : (providersRaw as Record<string, unknown> | null)?.providers,
        );
        const models = boundedCollection(catalog.models);
        const audits = boundedCollection(audit.entries);
        return {
          metrics: [
            { label: 'configured providers', value: Math.min(config.providers.length, MAX_COLLECTION_ITEMS) },
            { label: 'reported providers', value: providers.count },
            { label: 'models', value: models.count },
            { label: 'recent changes', value: audits.count },
          ],
          empty: config.providers.length === 0 && providers.count === 0 && models.count === 0,
          truncated: providers.truncated || models.truncated || audits.truncated,
        };
      },
    },
    {
      id: 'graph',
      domain: 'graph',
      label: 'Graph',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.path.startsWith('/api/v1/graph/')),
      run: async () => {
        const [topology, diagnostics, history, coldSpots] = await Promise.all([
          services.links.getGraphTopologyStats(),
          services.links.getGraphDiagnostics(100),
          services.links.listGraphDiagnosticsSnapshots(25),
          services.links.getGraphColdSpots({ limit: 25, cold_days: 90, max_accesses: 1 }),
        ]);
        const historyCount = boundedCollection(history);
        const diagnosticsPresent = Object.keys(diagnostics).slice(0, 100).length > 0;
        return {
          metrics: [
            { label: 'notes', value: boundedNumber(topology.total_notes) },
            { label: 'links', value: boundedNumber(topology.total_links) },
            { label: 'isolated', value: boundedNumber(topology.isolated_nodes) },
            { label: 'snapshots', value: historyCount.count },
            { label: 'cold spots', value: boundedNumber(coldSpots.summary?.cold_access_count) },
          ],
          empty: boundedNumber(topology.total_notes) === 0,
          degraded: !diagnosticsPresent || boundedNumber(topology.isolated_nodes) > 0,
          truncated: historyCount.truncated,
        };
      },
    },
    {
      id: 'health',
      domain: 'health',
      label: 'Knowledge and streaming',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.path.startsWith('/api/v1/health/')),
      run: async () => {
        const [knowledge, streaming, access, orphanTags, staleNotes, unlinkedNotes, tagCooccurrence] = await Promise.all([
          services.health.getKnowledgeHealth(),
          services.health.getStreamingHealth(),
          client.get<Record<string, unknown>>('/health/access-frequency', { limit: '50', sort: 'most_accessed' }),
          services.health.getOrphanTags(),
          services.health.getStaleNotes(180),
          services.health.getUnlinkedNotes(),
          services.health.getTagCooccurrence(5),
        ]);
        const blockStates = [streaming.sse.state, streaming.rtp.state, streaming.chat.state, streaming.ingest.state, streaming.inbound.state];
        const accessNotes = boundedCollection(access.notes);
        const orphanCount = boundedCollection(orphanTags);
        const staleCount = boundedCollection(staleNotes);
        const unlinkedCount = boundedCollection(unlinkedNotes);
        const pairCount = boundedCollection(tagCooccurrence.pairs);
        return {
          metrics: [
            { label: 'notes', value: boundedNumber(knowledge.total_notes) },
            { label: 'access records', value: accessNotes.count },
            { label: 'orphan tags', value: orphanCount.count },
            { label: 'stale records', value: staleCount.count },
            { label: 'unlinked records', value: unlinkedCount.count },
            { label: 'tag pairs', value: pairCount.count },
            { label: 'streaming', value: safeState(streaming.status, ['healthy', 'ok', 'degraded', 'unhealthy']) },
            { label: 'reported streams', value: blockStates.filter((state) => state === 'reported').length },
          ],
          empty: boundedNumber(knowledge.total_notes) === 0,
          degraded: blockStates.some((state) => state !== 'reported')
            || ['degraded', 'unhealthy'].includes(streaming.status.toLowerCase())
            || orphanCount.count + staleCount.count + unlinkedCount.count > 0,
          truncated: accessNotes.truncated || orphanCount.truncated || staleCount.truncated || unlinkedCount.truncated || pairCount.truncated,
        };
      },
    },
    {
      id: 'storage',
      domain: 'storage',
      label: 'Memory, storage, and rate limits',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => ['/api/v1/memory/info', '/api/v1/rate-limit/status', '/api/v1/extraction/stats'].includes(item.path)),
      run: async () => {
        const [memory, rateLimit, extraction] = await Promise.all([
          client.get<Record<string, unknown>>('/memory/info'),
          client.get<Record<string, unknown>>('/rate-limit/status'),
          client.get<Record<string, unknown>>('/extraction/stats'),
        ]);
        const extractionTotal = boundedNumber(extraction.total ?? extraction.total_jobs ?? extraction.processed);
        const remaining = boundedNumber(rateLimit.remaining);
        const limit = boundedNumber(rateLimit.limit);
        return {
          metrics: [
            { label: 'storage used', value: Math.min(100, boundedNumber(memory.percent_used)) },
            { label: 'rate remaining', value: remaining },
            { label: 'rate limit', value: limit },
            { label: 'extractions', value: extractionTotal },
          ],
          empty: Object.keys(memory).length === 0
            && Object.keys(rateLimit).length === 0
            && Object.keys(extraction).length === 0,
          degraded: (limit > 0 && remaining === 0) || boundedNumber(memory.percent_used) >= 90,
        };
      },
    },
    {
      id: 'jobs',
      domain: 'jobs',
      label: 'Jobs',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.path.startsWith('/api/v1/jobs')),
      run: async () => {
        const [stats, pause, jobs] = await Promise.all([
          services.jobs.getQueueStats(),
          services.jobs.getPauseStatus(),
          services.jobs.listJobs({ limit: 50, offset: 0 }),
        ]);
        const listed = boundedCollection(jobs.jobs);
        return {
          metrics: [
            { label: 'queue', value: safeState(pause.global, ['running', 'paused']) },
            { label: 'pending', value: boundedNumber(stats.pending) },
            { label: 'processing', value: boundedNumber(stats.processing) },
            { label: 'failed recently', value: boundedNumber(stats.failed_last_hour) },
            { label: 'listed', value: listed.count },
          ],
          empty: boundedNumber(stats.total) === 0 && listed.count === 0,
          degraded: pause.global !== 'running' || boundedNumber(stats.failed_last_hour) > 0,
          truncated: listed.truncated,
        };
      },
    },
    {
      id: 'webhooks',
      domain: 'webhooks',
      label: 'Webhooks and inbound',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.path.startsWith('/api/v1/webhooks') || item.path === '/api/v1/inbound-sources'),
      run: async () => {
        const [webhooks, incoming, inbound] = await Promise.all([
          services.webhooks.list(),
          services.webhooks.listIncomingReceivers(),
          services.webhooks.listInboundSources(),
        ]);
        const outgoingCount = boundedCollection(webhooks);
        const incomingCount = boundedCollection(incoming);
        const inboundCount = boundedCollection(inbound);
        return {
          metrics: [
            { label: 'outgoing', value: outgoingCount.count },
            { label: 'active outgoing', value: Math.min(webhooks.filter((item) => item.is_active).length, MAX_COLLECTION_ITEMS) },
            { label: 'incoming', value: incomingCount.count },
            { label: 'inbound sources', value: inboundCount.count },
          ],
          empty: outgoingCount.count + incomingCount.count + inboundCount.count === 0,
          degraded: webhooks.some((item) => item.failure_count > 0),
          truncated: outgoingCount.truncated || incomingCount.truncated || inboundCount.truncated,
        };
      },
    },
    {
      id: 'backup',
      domain: 'backup',
      label: 'Backup',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.path.startsWith('/api/v1/backup/')),
      run: async () => {
        const [status, backups] = await Promise.all([
          services.backup.getBackupStatus(),
          services.backup.listBackups(),
        ]);
        const count = boundedCollection(backups);
        const backupState = safeState(status.status, ['idle', 'running', 'completed', 'failed']);
        return {
          metrics: [
            { label: 'state', value: backupState },
            { label: 'available backups', value: count.count },
          ],
          empty: count.count === 0 && backupState === 'idle',
          degraded: backupState === 'failed' || backupState === 'unknown',
          truncated: count.truncated,
        };
      },
    },
    {
      id: 'archives',
      domain: 'archives',
      label: 'Archives',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.path === '/api/v1/archives'),
      run: async () => {
        const archives = await services.archives.list();
        const count = boundedCollection(archives);
        return {
          metrics: [
            { label: 'archives', value: count.count },
            { label: 'default configured', value: archives.some((item) => item.is_default) },
          ],
          empty: count.count === 0,
          degraded: count.count > 0 && !archives.some((item) => item.is_default),
          truncated: count.truncated,
        };
      },
    },
    {
      id: 'embeddings',
      domain: 'embeddings',
      label: 'Embeddings',
      operations: OPERATOR_READ_OPERATIONS.filter((item) => item.path.startsWith('/api/v1/embedding-')),
      run: async () => {
        const [configs, defaultConfig, sets] = await Promise.all([
          services.embeddings.listConfigs(),
          services.embeddings.getDefaultConfig(),
          services.embeddings.listSets(),
        ]);
        const configCount = boundedCollection(configs);
        const setCount = boundedCollection(sets);
        return {
          metrics: [
            { label: 'configurations', value: configCount.count },
            { label: 'sets', value: setCount.count },
            { label: 'default configured', value: Boolean(defaultConfig.id) && configs.some((item) => item.id === defaultConfig.id || item.is_default) },
          ],
          empty: configCount.count === 0 && setCount.count === 0,
          degraded: configCount.count > 0 && !configs.some((item) => item.is_default),
          truncated: configCount.truncated || setCount.truncated,
        };
      },
    },
  ];

  return {
    async loadSnapshot(): Promise<OperatorSnapshot> {
      let compatibility: OperatorDiagnostic;
      try {
        const response = await gate.preflight();
        compatibility = {
          id: 'compatibility',
          domain: 'compatibility',
          label: 'Compatibility',
          state: 'available',
          metrics: [
            { label: 'contract admitted', value: true },
            { label: 'capabilities', value: Math.min(Object.keys(response.capabilities).length, MAX_COLLECTION_ITEMS) },
          ],
          operationIds: ['system_compatibility'],
        };
      } catch (error) {
        compatibility = {
          id: 'compatibility',
          domain: 'compatibility',
          label: 'Compatibility',
          state: classifyError(error),
          metrics: [],
          operationIds: ['system_compatibility'],
        };
        return {
          state: 'incompatible',
          fetchedAt: new Date().toISOString(),
          diagnostics: [compatibility],
          mutation: mutationAdmission(gate.getSnapshot()),
        };
      }

      const results = await Promise.all(probes().map(async (probe): Promise<OperatorDiagnostic> => {
        try {
          const decoded = await probe.run();
          return {
            id: probe.id,
            domain: probe.domain,
            label: probe.label,
            state: decoded.degraded ? 'degraded' : decoded.empty ? 'empty' : 'available',
            metrics: decoded.metrics.slice(0, 8),
            operationIds: probe.operations.map((item) => item.operationId),
            ...(decoded.truncated ? { truncated: true } : {}),
          };
        } catch (error) {
          return {
            id: probe.id,
            domain: probe.domain,
            label: probe.label,
            state: classifyError(error),
            metrics: [],
            operationIds: probe.operations.map((item) => item.operationId),
          };
        }
      }));
      const diagnostics = [compatibility, ...results];
      return {
        state: aggregateState(diagnostics),
        fetchedAt: new Date().toISOString(),
        diagnostics,
        mutation: mutationAdmission(gate.getSnapshot()),
      };
    },

    getMutationAdmission(): OperatorMutationAdmission {
      return mutationAdmission(gate.getSnapshot());
    },

    async inspect(request: OperatorInspectionRequest): Promise<OperatorDiagnostic> {
      const target = request.inspection === 'provider_catalog' || request.inspection === 'model_catalog'
        ? ''
        : validateTarget(request.target);
      let decoded: DecodedMetrics;
      let operations: readonly OperatorOperation[];

      switch (request.inspection) {
        case 'job_detail': {
          const job = await client.get<Record<string, unknown>>(`/jobs/${encodeURIComponent(target)}`);
          decoded = {
            metrics: [
              { label: 'state', value: safeState(job.status, ['pending', 'queued', 'running', 'processing', 'completed', 'failed', 'cancelled']) },
              { label: 'progress', value: Math.min(100, boundedNumber(job.progress_percent)) },
              { label: 'retries', value: boundedNumber(job.retry_count) },
            ],
            degraded: ['failed', 'cancelled', 'unknown'].includes(safeState(job.status, ['pending', 'queued', 'running', 'processing', 'completed', 'failed', 'cancelled'])),
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'get_job');
          break;
        }
        case 'webhook_detail': {
          const webhook = await services.webhooks.get(target);
          decoded = {
            metrics: [
              { label: 'active', value: webhook.is_active === true },
              { label: 'event types', value: Math.min(webhook.events.length, MAX_COLLECTION_ITEMS) },
              { label: 'failures', value: boundedNumber(webhook.failure_count) },
              { label: 'retry limit', value: boundedNumber(webhook.max_retries) },
            ],
            degraded: !webhook.is_active || webhook.failure_count > 0,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'get_webhook');
          break;
        }
        case 'webhook_deliveries': {
          const deliveries = await services.webhooks.getDeliveries(target);
          const count = boundedCollection(deliveries);
          decoded = {
            metrics: [
              { label: 'deliveries', value: count.count },
              { label: 'successful', value: Math.min(deliveries.filter((item) => item.success).length, MAX_COLLECTION_ITEMS) },
              { label: 'failed', value: Math.min(deliveries.filter((item) => !item.success).length, MAX_COLLECTION_ITEMS) },
            ],
            empty: count.count === 0,
            degraded: deliveries.some((item) => !item.success),
            truncated: count.truncated,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'list_webhook_deliveries');
          break;
        }
        case 'graph_compare': {
          const compareTarget = validateTarget(request.compareTarget);
          const comparison = await services.links.compareGraphDiagnosticsSnapshots(target, compareTarget);
          const deltaCount = comparison.delta && typeof comparison.delta === 'object'
            ? Math.min(Object.keys(comparison.delta).length, 100)
            : 0;
          decoded = {
            metrics: [
              { label: 'changed metrics', value: deltaCount },
              { label: 'comparison available', value: Boolean(comparison.before && comparison.after) },
            ],
            empty: deltaCount === 0,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'compare_diagnostics_snapshots');
          break;
        }
        case 'archive_stats': {
          const stats = await services.archives.stats(target);
          decoded = {
            metrics: [
              { label: 'notes', value: boundedNumber(stats.note_count) },
              { label: 'storage bytes', value: boundedNumber(stats.size_bytes) },
            ],
            empty: boundedNumber(stats.note_count) === 0,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'get_archive_stats');
          break;
        }
        case 'backup_info': {
          const backup = await services.backup.getBackupInfo(target);
          decoded = {
            metrics: [
              { label: 'type', value: safeState(backup.type, ['database', 'knowledge-shard', 'archive']) },
              { label: 'size bytes', value: boundedNumber(backup.size_bytes) },
              { label: 'manifest present', value: Boolean(backup.manifest) },
            ],
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'get_backup_info');
          break;
        }
        case 'backup_metadata': {
          const metadata = await services.backup.getBackupMetadata(target);
          decoded = {
            metrics: [
              { label: 'metadata present', value: metadata.has_metadata === true || Boolean(metadata.metadata) },
              { label: 'title present', value: Boolean(metadata.metadata?.title ?? metadata.metadata?.label) },
              { label: 'description present', value: Boolean(metadata.metadata?.description) },
              { label: 'tags', value: Math.min(metadata.metadata?.tags?.length ?? 0, MAX_COLLECTION_ITEMS) },
            ],
            empty: metadata.has_metadata === false && !metadata.metadata,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'get_backup_metadata');
          break;
        }
        case 'archive_detail': {
          const archive = await services.archives.get(target);
          decoded = {
            metrics: [
              { label: 'default', value: archive.is_default === true },
              { label: 'notes', value: boundedNumber(archive.note_count) },
              { label: 'storage bytes', value: boundedNumber(archive.size_bytes) },
              { label: 'schema version', value: boundedNumber(archive.schema_version) },
            ],
            empty: boundedNumber(archive.note_count) === 0,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'get_archive');
          break;
        }
        case 'embedding_set': {
          const [set, members] = await Promise.all([
            services.embeddings.getSet(target),
            services.embeddings.listSetMembers(target),
          ]);
          const count = boundedCollection(members);
          decoded = {
            metrics: [
              { label: 'members', value: count.count },
              { label: 'automatic membership', value: set.mode === 'auto' },
              { label: 'criteria configured', value: Boolean(set.criteria) },
            ],
            empty: count.count === 0,
            truncated: count.truncated,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => ['get_embedding_set', 'list_embedding_set_members'].includes(item.operationId));
          break;
        }
        case 'embedding_config': {
          const config = await client.get<Record<string, unknown>>(`/embedding-configs/${encodeURIComponent(target)}`);
          decoded = {
            metrics: [
              { label: 'dimension', value: boundedNumber(config.dimension ?? config.dimensions) },
              { label: 'default', value: config.is_default === true },
              { label: 'MRL enabled', value: config.supports_mrl === true },
              { label: 'provider configured', value: typeof config.provider === 'string' },
            ],
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'get_embedding_config');
          break;
        }
        case 'provider_catalog': {
          const response = await client.get<unknown>('/inference/providers');
          const providers = Array.isArray(response)
            ? response
            : (response as Record<string, unknown> | null)?.providers;
          const bounded = boundedCollection(providers);
          const rows = Array.isArray(providers) ? providers.slice(0, MAX_COLLECTION_ITEMS) : [];
          decoded = {
            metrics: [
              { label: 'providers', value: bounded.count },
              { label: 'server configured', value: rows.filter((item) => item && typeof item === 'object' && (item as Record<string, unknown>).server_configured === true).length },
              { label: 'generation capable', value: rows.filter((item) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).capabilities) && ((item as Record<string, unknown>).capabilities as unknown[]).includes('generation')).length },
              { label: 'embedding capable', value: rows.filter((item) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).capabilities) && ((item as Record<string, unknown>).capabilities as unknown[]).includes('embedding')).length },
            ],
            empty: bounded.count === 0,
            truncated: bounded.truncated,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'list_providers');
          break;
        }
        case 'model_catalog': {
          const catalog = await services.chat.getModelCatalog();
          const models = boundedCollection(catalog.models);
          const providers = boundedCollection(catalog.providers);
          decoded = {
            metrics: [
              { label: 'models', value: models.count },
              { label: 'providers', value: providers.count },
              { label: 'healthy providers', value: Math.min(catalog.providers.filter((item) => item.health === 'healthy').length, MAX_COLLECTION_ITEMS) },
              { label: 'language default', value: Boolean(catalog.defaults.language) },
              { label: 'embedding default', value: Boolean(catalog.defaults.embedding) },
            ],
            empty: models.count === 0,
            degraded: catalog.providers.some((item) => item.health === 'unhealthy'),
            truncated: models.truncated || providers.truncated,
          };
          operations = OPERATOR_READ_OPERATIONS.filter((item) => item.operationId === 'list_models');
          break;
        }
      }

      return {
        id: `inspection-${request.inspection}`,
        domain: request.inspection.startsWith('job')
          ? 'jobs'
          : request.inspection.startsWith('webhook')
            ? 'webhooks'
            : request.inspection.startsWith('graph')
              ? 'graph'
              : request.inspection.startsWith('archive')
                ? 'archives'
                : request.inspection.startsWith('backup')
                  ? 'backup'
                  : request.inspection === 'provider_catalog' || request.inspection === 'model_catalog'
                    ? 'inference'
                    : 'embeddings',
        label: 'Inspection result',
        state: decoded.degraded ? 'degraded' : decoded.empty ? 'empty' : 'available',
        metrics: decoded.metrics.slice(0, 8),
        operationIds: operations.map((item) => item.operationId),
        ...(decoded.truncated ? { truncated: true } : {}),
      };
    },

    async runAction(request: OperatorActionRequest): Promise<OperatorActionResult> {
      await gate.requireRemoteMutation();
      const admission = mutationAdmission(gate.getSnapshot());
      if (admission.state !== 'allowed') {
        throw new SystemCompatibilityContractError(
          'compatibility_unavailable',
          'Operator mutation admission is unavailable.',
        );
      }

      let metrics: OperatorMetric[] | undefined;
      switch (request.action) {
        case 'pause_jobs_global':
          await services.jobs.pauseGlobal();
          break;
        case 'resume_jobs_global':
          await services.jobs.resumeGlobal();
          break;
        case 'pause_jobs_archive':
          await services.jobs.pauseArchive(validateTarget(request.target));
          break;
        case 'resume_jobs_archive':
          await services.jobs.resumeArchive(validateTarget(request.target));
          break;
        case 'backup_trigger':
          await services.backup.triggerBackup();
          break;
        case 'database_backup_snapshot':
          await services.backup.createSnapshot({ name: validateTarget(request.target) });
          break;
        case 'database_backup_restore':
          await services.backup.restoreDatabase({ filename: validateTarget(request.target), skip_snapshot: false });
          break;
        case 'swap_backup':
          await services.backup.swapBackup({ filename: validateTarget(request.target), dry_run: false, strategy: 'wipe' });
          break;
        case 'set_default_archive':
          await services.archives.setDefault(validateTarget(request.target));
          break;
        case 'trigger_graph_maintenance':
          await services.links.triggerGraphMaintenance({ steps: ['normalize', 'snn', 'pfnet', 'snapshot'] });
          break;
        case 'capture_diagnostics_snapshot':
          await services.links.captureGraphDiagnosticsSnapshot({ label: validateTarget(request.target), sample_size: 100 });
          break;
        case 'recompute_snn_scores':
          await services.links.recomputeSnnScores({ dry_run: false });
          break;
        case 'pfnet_sparsify':
          await services.links.sparsifyGraphWithPfnet({ dry_run: false });
          break;
        case 'coarse_community_detection':
          await services.links.detectCoarseGraphCommunities({});
          break;
        case 'refresh_embedding_set':
          await services.embeddings.refreshSet(validateTarget(request.target));
          break;
        case 'test_webhook':
          await services.webhooks.test(validateTarget(request.target));
          break;
        case 'update_webhook':
          if (typeof request.enabled !== 'boolean') throw new Error('Webhook active state is required.');
          await services.webhooks.update(validateTarget(request.target), { is_active: request.enabled });
          break;
        case 'delete_webhook':
          await services.webhooks.delete(validateTarget(request.target));
          break;
        case 'complete': {
          const model = validateTarget(request.target);
          const response = decodeInferenceComplete(
            await client.post<unknown>('/inference/complete', inferenceProbeRequest(model)),
          );
          metrics = [
            { label: 'completed', value: true },
            { label: 'content characters', value: response.content.length },
            { label: 'finish reason', value: safeState(response.finish_reason, ['stop', 'length', 'complete', 'completed']) },
            { label: 'model reported', value: response.model.length > 0 },
            { label: 'provider reported', value: response.provider_id.length > 0 },
          ];
          break;
        }
        case 'stream':
          metrics = await runInferenceStream(client, validateTarget(request.target));
          break;
        case 'create_embedding_config':
          await client.post('/embedding-configs', {
            name: validateText(request.target, 'configuration name'),
            model: validateTarget(request.secondaryTarget),
            dimension: validateDimension(request.numericValue),
          });
          break;
        case 'update_embedding_config':
          await client.patch(`/embedding-configs/${encodeURIComponent(validateTarget(request.target))}`, {
            model: validateTarget(request.secondaryTarget),
            dimension: validateDimension(request.numericValue),
          });
          break;
        case 'delete_embedding_config':
          await client.delete(`/embedding-configs/${encodeURIComponent(validateTarget(request.target))}`);
          break;
        case 'create_embedding_set':
          await services.embeddings.createSet({
            slug: validateTarget(request.target),
            name: validateText(request.value, 'embedding set name'),
            embedding_config_id: validateTarget(request.secondaryTarget),
            mode: 'manual',
          });
          break;
        case 'update_embedding_set':
          await services.embeddings.updateSet(validateTarget(request.target), {
            name: validateText(request.value, 'embedding set name'),
          });
          break;
        case 'delete_embedding_set':
          await services.embeddings.deleteSet(validateTarget(request.target));
          break;
        case 'add_embedding_set_members':
          await services.embeddings.addSetMembers(validateTarget(request.target), {
            note_ids: [validateTarget(request.secondaryTarget)],
          });
          break;
        case 'remove_embedding_set_member':
          await services.embeddings.removeSetMember(
            validateTarget(request.target),
            validateTarget(request.secondaryTarget),
          );
          break;
        case 'create_archive':
          await services.archives.create({
            name: validateTarget(request.target),
            ...(request.value?.trim() ? { description: validateText(request.value, 'archive description') } : {}),
          });
          break;
        case 'update_archive':
          await services.archives.update(validateTarget(request.target), {
            description: validateText(request.value, 'archive description'),
          });
          break;
        case 'delete_archive':
          await services.archives.delete(validateTarget(request.target));
          break;
        case 'clone_archive':
          await services.archives.clone(validateTarget(request.target), {
            new_name: validateTarget(request.secondaryTarget),
          });
          break;
        case 'update_backup_metadata':
          await services.backup.updateBackupMetadata(validateTarget(request.target), {
            title: validateText(request.value, 'backup title'),
          });
          break;
        case 'delete_inbound_source':
          await services.webhooks.deleteInboundSource(validateTarget(request.target));
          break;
      }

      return { state: 'accepted', operationId: request.action, ...(metrics ? { metrics } : {}) };
    },
  };
}

export type OperatorApi = ReturnType<typeof createOperatorApi>;
