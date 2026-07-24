import type { ApiClient } from './client';
import { getServerRoot } from './client';
import { getTauriFetch } from '@/lib/tauri';
import packageMetadata from '../../package.json';

export type SystemCapabilityState =
  | 'available'
  | 'degraded'
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

export const SUPPORTED_SYSTEM_COMPATIBILITY_SCHEMA_VERSION = 1;
export const SUPPORTED_SYSTEM_COMPATIBILITY_REVISIONS = ['2026-07-06'] as const;

export class SystemCompatibilityContractError extends Error {
  constructor(
    public readonly code:
      | 'unsupported_schema'
      | 'unsupported_revision'
      | 'invalid_minimum_client'
      | 'minimum_client_not_met',
    message: string,
  ) {
    super(message);
    this.name = 'SystemCompatibilityContractError';
  }
}

interface ParsedVersion {
  core: [number, number, number];
  prerelease: string | null;
}

function parseClientVersion(value: unknown): ParsedVersion | null {
  if (typeof value !== 'string') return null;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
  if (!match) return null;
  const core = match.slice(1, 4).map(Number) as [number, number, number];
  if (core.some((part) => !Number.isSafeInteger(part))) return null;
  return { core, prerelease: match[4] ?? null };
}

function compareClientVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) {
      return left.core[index] < right.core[index] ? -1 : 1;
    }
  }
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  return left.prerelease.localeCompare(right.prerelease);
}

function validateCompatibilityBoundary(
  raw: SystemCompatibilityResponse,
  clientVersion: string,
): void {
  const schemaVersion = Number(raw.schema_version);
  if (schemaVersion !== SUPPORTED_SYSTEM_COMPATIBILITY_SCHEMA_VERSION) {
    throw new SystemCompatibilityContractError(
      'unsupported_schema',
      `Fortemi compatibility schema ${String(raw.schema_version)} is unsupported.`,
    );
  }

  if (
    typeof raw.contract_revision !== 'string'
    || !SUPPORTED_SYSTEM_COMPATIBILITY_REVISIONS.includes(
      raw.contract_revision as (typeof SUPPORTED_SYSTEM_COMPATIBILITY_REVISIONS)[number],
    )
  ) {
    throw new SystemCompatibilityContractError(
      'unsupported_revision',
      `Fortemi compatibility revision ${String(raw.contract_revision)} is unsupported.`,
    );
  }

  const minimumVersion = parseClientVersion(raw.api?.minimum_hotm_enterprise_client);
  const currentVersion = parseClientVersion(clientVersion);
  if (!minimumVersion || !currentVersion) {
    throw new SystemCompatibilityContractError(
      'invalid_minimum_client',
      'Fortemi compatibility minimum-client policy is malformed or the HotM client version is unavailable.',
    );
  }
  if (compareClientVersions(currentVersion, minimumVersion) < 0) {
    throw new SystemCompatibilityContractError(
      'minimum_client_not_met',
      `Fortemi requires HotM ${raw.api.minimum_hotm_enterprise_client} or later; this client is ${clientVersion}.`,
    );
  }
}

function normalizeCapability(raw: unknown): SystemCapability {
  if (!raw || typeof raw !== 'object') {
    return { state: 'unknown' };
  }

  const value = raw as Record<string, unknown>;
  const state = typeof value.state === 'string' ? value.state : 'unknown';
  const normalizedState: SystemCapabilityState = ['available', 'degraded', 'preview', 'unavailable', 'unknown'].includes(state)
    ? state as SystemCapabilityState
    : 'unknown';
  const reasonCode = typeof value.reason_code === 'string' ? value.reason_code : undefined;

  return {
    state: normalizedState,
    ...(reasonCode ? { reason_code: reasonCode } : {}),
  };
}

export function normalizeSystemCompatibility(
  raw: SystemCompatibilityResponse,
  clientVersion = packageMetadata.version,
): SystemCompatibilityResponse {
  validateCompatibilityBoundary(raw, clientVersion);
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
  const contractUrl = (path: string): string => {
    if (/^https?:\/\//i.test(path)) return path;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getServerRoot(client.baseUrl)}${normalizedPath}`;
  };

  const fetchContract = async (path: string, fallback: string): Promise<string> => {
    const response = await getTauriFetch()(contractUrl(path), {
      method: 'GET',
      headers: { Accept: 'application/yaml,text/yaml,text/plain,*/*' },
    });
    if (!response.ok) {
      throw new Error(`${fallback} fetch failed: ${response.statusText || response.status}`);
    }
    return response.text();
  };

  return {
    async get(): Promise<SystemCompatibilityResponse> {
      const response = await client.get<SystemCompatibilityResponse>('/system/compatibility');
      return normalizeSystemCompatibility(response);
    },

    async getOpenApi(path = '/openapi.yaml'): Promise<string> {
      return fetchContract(path, 'OpenAPI');
    },

    async getAsyncApi(path = '/asyncapi.yaml'): Promise<string> {
      return fetchContract(path, 'AsyncAPI');
    },
  };
}
