import type { ApiClient } from './client';
import { getServerRoot } from './client';
import { getTauriFetch } from '@/lib/tauri';
import packageMetadata from '../../package.json';
import compatibilityReceipt from './contracts/fortemi-system-compatibility-receipt.json';

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
    claim_contract_version?: string;
    claim_contract_profile?: string;
    authority_release?: string;
  };
  capabilities: Record<string, SystemCapability>;
  links: {
    openapi: string;
    asyncapi: string;
    health: string;
    streaming_health: string;
  };
}

export const SUPPORTED_SYSTEM_COMPATIBILITY_SCHEMA_VERSION = compatibilityReceipt.consumer.compatibilitySchemaVersion;
export const SUPPORTED_SYSTEM_COMPATIBILITY_REVISIONS = compatibilityReceipt.consumer.acceptedContractRevisions;

export type SystemCompatibilityBlockCode =
  | 'compatibility_unavailable'
  | 'malformed_contract'
  | 'unsupported_schema'
  | 'unsupported_revision'
  | 'invalid_minimum_client'
  | 'minimum_client_not_met'
  | 'invalid_api_version'
  | 'server_api_too_old'
  | 'server_api_too_new'
  | 'unsupported_auth_contract';

export class SystemCompatibilityContractError extends Error {
  constructor(
    public readonly code: SystemCompatibilityBlockCode,
    message: string,
  ) {
    super(message);
    this.name = 'SystemCompatibilityContractError';
  }
}

interface ParsedVersion {
  core: [number, number, number];
  prerelease: string[] | null;
}

function parseSemVer(value: unknown): ParsedVersion | null {
  if (typeof value !== 'string') return null;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) return null;
  const core = match.slice(1, 4).map(Number) as [number, number, number];
  if (core.some((part) => !Number.isSafeInteger(part))) return null;
  const prerelease = match[4]?.split('.') ?? null;
  if (prerelease?.some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))) {
    return null;
  }
  return { core, prerelease };
}

function compareSemVers(left: ParsedVersion, right: ParsedVersion): number {
  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) {
      return left.core[index] < right.core[index] ? -1 : 1;
    }
  }
  if (left.prerelease === null && right.prerelease === null) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) < Number(rightPart) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function validateCompatibilityBoundary(
  raw: SystemCompatibilityResponse,
  clientVersion: string,
): void {
  if (!raw || typeof raw !== 'object' || !raw.api || typeof raw.api !== 'object') {
    throw new SystemCompatibilityContractError(
      'malformed_contract',
      'Fortemi compatibility metadata is malformed.',
    );
  }
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

  if (raw.api.name !== compatibilityReceipt.consumer.apiName) {
    throw new SystemCompatibilityContractError(
      'malformed_contract',
      `Compatibility metadata identifies an unexpected API: ${String(raw.api.name)}.`,
    );
  }

  const minimumVersion = parseSemVer(raw.api.minimum_hotm_enterprise_client);
  const currentVersion = parseSemVer(clientVersion);
  if (!minimumVersion || !currentVersion) {
    throw new SystemCompatibilityContractError(
      'invalid_minimum_client',
      'Fortemi compatibility minimum-client policy is malformed or the HotM client version is unavailable.',
    );
  }
  if (compareSemVers(currentVersion, minimumVersion) < 0) {
    throw new SystemCompatibilityContractError(
      'minimum_client_not_met',
      `Fortemi requires HotM ${raw.api.minimum_hotm_enterprise_client} or later; this client is ${clientVersion}.`,
    );
  }

  const serverVersion = parseSemVer(raw.api.version);
  const minimumServerVersion = parseSemVer(compatibilityReceipt.consumer.minimumServerApiVersion);
  const maximumServerVersion = parseSemVer(compatibilityReceipt.consumer.maximumServerApiVersionExclusive);
  if (!serverVersion || !minimumServerVersion || !maximumServerVersion) {
    throw new SystemCompatibilityContractError(
      'invalid_api_version',
      `Fortemi server API version ${String(raw.api.version)} is malformed.`,
    );
  }
  if (compareSemVers(serverVersion, minimumServerVersion) < 0) {
    throw new SystemCompatibilityContractError(
      'server_api_too_old',
      `Fortemi ${raw.api.version} is older than supported ${compatibilityReceipt.consumer.minimumServerApiVersion}.`,
    );
  }
  if (compareSemVers(serverVersion, maximumServerVersion) >= 0) {
    throw new SystemCompatibilityContractError(
      'server_api_too_new',
      `Fortemi ${raw.api.version} is newer than the accepted API range.`,
    );
  }

  if (!raw.auth || typeof raw.auth !== 'object') {
    throw new SystemCompatibilityContractError('malformed_contract', 'Fortemi auth compatibility metadata is missing.');
  }
  if (raw.auth.required) {
    if (
      typeof raw.auth.claim_contract_version !== 'string'
      || !compatibilityReceipt.consumer.acceptedAuthClaimContractVersions.includes(raw.auth.claim_contract_version)
      || typeof raw.auth.claim_contract_profile !== 'string'
      || !compatibilityReceipt.consumer.acceptedAuthClaimContractProfiles.includes(raw.auth.claim_contract_profile)
      || typeof raw.auth.authority_release !== 'string'
      || !compatibilityReceipt.consumer.acceptedAuthAuthorityReleases.includes(raw.auth.authority_release)
    ) {
      throw new SystemCompatibilityContractError(
        'unsupported_auth_contract',
        'Fortemi auth claim authority is unsupported.',
      );
    }
  } else if (!compatibilityReceipt.consumer.localAuthModes.includes(raw.auth.mode)) {
    throw new SystemCompatibilityContractError(
      'unsupported_auth_contract',
      `Fortemi local auth mode ${String(raw.auth.mode)} is unsupported.`,
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

    async getOpenApi(path = '/api/v1/operator/openapi.yaml'): Promise<string> {
      return fetchContract(path, 'OpenAPI');
    },

    async getAsyncApi(path = '/api/v1/operator/asyncapi.yaml'): Promise<string> {
      return fetchContract(path, 'AsyncAPI');
    },
  };
}

export type CompatibilityAdmissionState = 'unresolved' | 'checking' | 'compatible' | 'blocked';

export interface CompatibilityAdmissionSnapshot {
  state: CompatibilityAdmissionState;
  response: SystemCompatibilityResponse | null;
  error: SystemCompatibilityContractError | null;
}

export function createCompatibilityAdmissionGate(
  compatibilityApi: ReturnType<typeof createSystemCompatibilityApi>,
) {
  let snapshot: CompatibilityAdmissionSnapshot = {
    state: 'unresolved',
    response: null,
    error: null,
  };
  let pending: Promise<SystemCompatibilityResponse> | null = null;

  const preflight = async (): Promise<SystemCompatibilityResponse> => {
    if (snapshot.state === 'compatible' && snapshot.response) return snapshot.response;
    if (snapshot.state === 'blocked' && snapshot.error) throw snapshot.error;
    if (pending) return pending;

    snapshot = { state: 'checking', response: null, error: null };
    pending = compatibilityApi.get()
      .then((response) => {
        snapshot = { state: 'compatible', response, error: null };
        return response;
      })
      .catch((cause: unknown) => {
        const error = cause instanceof SystemCompatibilityContractError
          ? cause
          : new SystemCompatibilityContractError(
            'compatibility_unavailable',
            `Fortemi compatibility could not be established: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        snapshot = { state: 'blocked', response: null, error };
        throw error;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };

  return {
    preflight,
    async requireRemoteMutation(): Promise<void> {
      await preflight();
    },
    getSnapshot(): CompatibilityAdmissionSnapshot {
      return snapshot;
    },
    reset(): void {
      pending = null;
      snapshot = { state: 'unresolved', response: null, error: null };
    },
  };
}
