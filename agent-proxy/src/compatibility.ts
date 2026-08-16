import compatibilityReceipt from './contracts/fortemi-system-compatibility-receipt.json';

export type CompatibilityBlockCode =
  | 'compatibility_unavailable'
  | 'malformed_contract'
  | 'unsupported_schema'
  | 'unsupported_revision'
  | 'invalid_minimum_client'
  | 'invalid_api_version'
  | 'server_api_too_old'
  | 'server_api_too_new'
  | 'unsupported_auth_contract';

export interface CompatibleFortemiMetadata {
  auth: {
    required: boolean;
    mode: string;
    claimContractVersion?: string;
  };
}

export class CompatibilityAdmissionError extends Error {
  constructor(public readonly code: CompatibilityBlockCode, message: string) {
    super(message);
    this.name = 'CompatibilityAdmissionError';
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
  if (prerelease?.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) return null;
  return { core, prerelease };
}

function compareSemVers(left: ParsedVersion, right: ParsedVersion): number {
  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] < right.core[index] ? -1 : 1;
  }
  if (left.prerelease === null && right.prerelease === null) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
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

export function assertCompatibleFortemi(raw: unknown): CompatibleFortemiMetadata {
  if (!raw || typeof raw !== 'object') {
    throw new CompatibilityAdmissionError('malformed_contract', 'Fortemi compatibility metadata is malformed.');
  }
  const value = raw as Record<string, unknown>;
  if (Number(value.schema_version) !== compatibilityReceipt.consumer.compatibilitySchemaVersion) {
    throw new CompatibilityAdmissionError('unsupported_schema', `Unsupported Fortemi compatibility schema ${String(value.schema_version)}.`);
  }
  if (
    typeof value.contract_revision !== 'string'
    || !compatibilityReceipt.consumer.acceptedContractRevisions.includes(value.contract_revision)
  ) {
    throw new CompatibilityAdmissionError('unsupported_revision', `Unsupported Fortemi compatibility revision ${String(value.contract_revision)}.`);
  }

  const api = value.api as Record<string, unknown> | undefined;
  if (!api || api.name !== compatibilityReceipt.consumer.apiName) {
    throw new CompatibilityAdmissionError('malformed_contract', 'Fortemi API identity metadata is missing or invalid.');
  }
  const requiredClient = parseSemVer(api.minimum_hotm_enterprise_client);
  const currentClient = parseSemVer(compatibilityReceipt.consumer.hotmClientVersion);
  if (!requiredClient || !currentClient) {
    throw new CompatibilityAdmissionError('invalid_minimum_client', 'Fortemi minimum-client policy is malformed.');
  }
  if (compareSemVers(currentClient, requiredClient) < 0) {
    throw new CompatibilityAdmissionError(
      'invalid_minimum_client',
      `Fortemi requires HotM ${String(api.minimum_hotm_enterprise_client)} or later.`,
    );
  }
  const server = parseSemVer(api.version);
  const minimum = parseSemVer(compatibilityReceipt.consumer.minimumServerApiVersion);
  const maximum = parseSemVer(compatibilityReceipt.consumer.maximumServerApiVersionExclusive);
  if (!server || !minimum || !maximum) {
    throw new CompatibilityAdmissionError('invalid_api_version', `Fortemi API version ${String(api.version)} is malformed.`);
  }
  if (compareSemVers(server, minimum) < 0) {
    throw new CompatibilityAdmissionError('server_api_too_old', `Fortemi ${String(api.version)} is older than the supported range.`);
  }
  if (compareSemVers(server, maximum) >= 0) {
    throw new CompatibilityAdmissionError('server_api_too_new', `Fortemi ${String(api.version)} is newer than the supported range.`);
  }

  const auth = value.auth as Record<string, unknown> | undefined;
  if (!auth) {
    throw new CompatibilityAdmissionError('malformed_contract', 'Fortemi auth compatibility metadata is missing.');
  }
  if (auth.required === true) {
    if (
      typeof auth.claim_contract_version !== 'string'
      || !compatibilityReceipt.consumer.acceptedAuthClaimContractVersions.includes(auth.claim_contract_version)
    ) {
      throw new CompatibilityAdmissionError('unsupported_auth_contract', `Unsupported Fortemi auth claim contract ${String(auth.claim_contract_version)}.`);
    }
    return {
      auth: {
        required: true,
        mode: typeof auth.mode === 'string' ? auth.mode : 'oauth',
        claimContractVersion: auth.claim_contract_version,
      },
    };
  } else if (
    auth.required !== false
    || typeof auth.mode !== 'string'
    || !compatibilityReceipt.consumer.localAuthModes.includes(auth.mode)
  ) {
    throw new CompatibilityAdmissionError('unsupported_auth_contract', `Unsupported Fortemi local auth mode ${String(auth.mode)}.`);
  }
  return { auth: { required: false, mode: auth.mode } };
}

let admittedUrl: string | null = null;
let admittedMetadata: CompatibleFortemiMetadata | null = null;
let blockedError: CompatibilityAdmissionError | null = null;
let pending: Promise<void> | null = null;

export async function requireCompatibleFortemi(apiBaseUrl: string): Promise<CompatibleFortemiMetadata> {
  if (admittedUrl === apiBaseUrl && admittedMetadata) return admittedMetadata;
  if (blockedError) throw blockedError;
  if (pending) {
    await pending;
    if (!admittedMetadata) throw blockedError ?? new CompatibilityAdmissionError('compatibility_unavailable', 'Fortemi compatibility admission did not complete.');
    return admittedMetadata;
  }

  const compatibilityUrl = `${apiBaseUrl.replace(/\/$/, '')}/system/compatibility`;
  pending = fetch(compatibilityUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new CompatibilityAdmissionError(
          'compatibility_unavailable',
          `Fortemi compatibility request failed with ${response.status}.`,
        );
      }
      admittedMetadata = assertCompatibleFortemi(await response.json());
      admittedUrl = apiBaseUrl;
    })
    .catch((cause: unknown) => {
      blockedError = cause instanceof CompatibilityAdmissionError
        ? cause
        : new CompatibilityAdmissionError(
          'compatibility_unavailable',
          `Fortemi compatibility could not be established: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      throw blockedError;
    })
    .finally(() => {
      pending = null;
    });
  await pending;
  if (!admittedMetadata) throw blockedError ?? new CompatibilityAdmissionError('compatibility_unavailable', 'Fortemi compatibility admission did not complete.');
  return admittedMetadata;
}

export async function requireCompatibleFortemiMutation(apiBaseUrl: string): Promise<void> {
  await requireCompatibleFortemi(apiBaseUrl);
}

export function resetCompatibilityAdmissionForTests(): void {
  admittedUrl = null;
  admittedMetadata = null;
  blockedError = null;
  pending = null;
}
