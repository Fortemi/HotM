import { ApiError, ContractDecodeError, NetworkError } from './errors';
import { SystemCompatibilityContractError } from './systemCompatibility';

export { ContractDecodeError } from './errors';

export type CoreOperationFailureKind =
  | 'unauthorized'
  | 'forbidden'
  | 'incompatible'
  | 'degraded'
  | 'not_found'
  | 'invalid_response'
  | 'unknown';

export interface CoreOperationFailure {
  kind: CoreOperationFailureKind;
  message: string;
  retryable: boolean;
}

export function decodeCoreOperationFailure(error: unknown): CoreOperationFailure {
  if (error instanceof SystemCompatibilityContractError) {
    return { kind: 'incompatible', message: 'Server compatibility admission failed.', retryable: false };
  }
  if (error instanceof ContractDecodeError) {
    return { kind: 'invalid_response', message: 'The server response did not match the pinned contract.', retryable: true };
  }
  if (error instanceof NetworkError) {
    return { kind: 'degraded', message: 'The server is unavailable or degraded.', retryable: true };
  }
  if (error instanceof ApiError) {
    if (error.statusCode === 401) {
      return { kind: 'unauthorized', message: 'Authentication is required for this operation.', retryable: false };
    }
    if (error.statusCode === 403) {
      return { kind: 'forbidden', message: 'Your identity is not authorized for this operation.', retryable: false };
    }
    if (error.statusCode === 404) {
      return { kind: 'not_found', message: 'The requested resource was not found.', retryable: false };
    }
    return {
      kind: error.statusCode >= 500 ? 'degraded' : 'unknown',
      message: error.statusCode === 429
        ? 'The operation is rate limited. Retry later.'
        : error.statusCode >= 500
          ? 'The server could not complete the operation.'
          : 'The server rejected the operation.',
      retryable: error.statusCode >= 500 || error.statusCode === 429,
    };
  }
  return {
    kind: 'unknown',
    message: 'The operation failed for an unknown reason.',
    retryable: true,
  };
}

export function asRecord(value: unknown, operationId: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractDecodeError(operationId, 'expected an object response');
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, operationId: string, field = 'response'): unknown[] {
  if (!Array.isArray(value)) {
    throw new ContractDecodeError(operationId, `expected ${field} to be an array`);
  }
  return value;
}

export function requiredString(
  record: Record<string, unknown>,
  field: string,
  operationId: string,
): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractDecodeError(operationId, `expected ${field} to be a non-empty string`);
  }
  return value;
}

export function optionalString(record: Record<string, unknown>, field: string): string | undefined {
  return typeof record[field] === 'string' ? record[field] : undefined;
}

export function finiteNumber(
  record: Record<string, unknown>,
  field: string,
  operationId: string,
  fallback?: number,
): number {
  const value = record[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (fallback !== undefined) return fallback;
  throw new ContractDecodeError(operationId, `expected ${field} to be a finite number`);
}

export function booleanField(
  record: Record<string, unknown>,
  field: string,
  operationId: string,
  fallback?: boolean,
): boolean {
  const value = record[field];
  if (typeof value === 'boolean') return value;
  if (fallback !== undefined) return fallback;
  throw new ContractDecodeError(operationId, `expected ${field} to be a boolean`);
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
