import type { ApiClient } from './client';

export type SystemCapabilityState =
  | 'available'
  | 'preview'
  | 'unavailable'
  | 'unknown';

export interface SystemCapability {
  state: SystemCapabilityState;
  reason_code?: string;
}

export interface SystemCompatibilityResponse {
  schema_version: number;
  contract_revision: string;
  api: {
    name: string;
    version: string;
    minimum_hotm_enterprise_client: string;
    git_sha_present: boolean;
    build_date_present: boolean;
  };
  deployment: {
    mode: string;
    edition: string;
    hosted_multi_tenant_ready: boolean;
  };
  auth: {
    required: boolean;
    mode: string;
    oauth_issuer_configured: boolean;
    tenant_context_available: boolean;
  };
  capabilities: Record<string, SystemCapability>;
  links: {
    openapi: string;
    asyncapi: string;
    health: string;
    streaming_health: string;
  };
}

function normalizeCapability(raw: unknown): SystemCapability {
  if (!raw || typeof raw !== 'object') {
    return { state: 'unknown' };
  }

  const value = raw as Record<string, unknown>;
  const state = typeof value.state === 'string' ? value.state : 'unknown';
  const normalizedState: SystemCapabilityState = ['available', 'preview', 'unavailable', 'unknown'].includes(state)
    ? state as SystemCapabilityState
    : 'unknown';
  const reasonCode = typeof value.reason_code === 'string' ? value.reason_code : undefined;

  return {
    state: normalizedState,
    ...(reasonCode ? { reason_code: reasonCode } : {}),
  };
}

export function normalizeSystemCompatibility(raw: SystemCompatibilityResponse): SystemCompatibilityResponse {
  const capabilities = Object.fromEntries(
    Object.entries(raw.capabilities ?? {}).map(([key, value]) => [key, normalizeCapability(value)])
  );

  return {
    ...raw,
    schema_version: Number(raw.schema_version ?? 0),
    contract_revision: raw.contract_revision ?? 'unknown',
    capabilities,
  };
}

export function createSystemCompatibilityApi(client: ApiClient) {
  return {
    async get(): Promise<SystemCompatibilityResponse> {
      const response = await client.get<SystemCompatibilityResponse>('/system/compatibility');
      return normalizeSystemCompatibility(response);
    },
  };
}
