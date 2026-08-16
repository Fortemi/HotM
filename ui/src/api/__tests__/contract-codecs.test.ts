import { describe, expect, it } from 'vitest';
import { ApiError, ContractDecodeError, NetworkError } from '../errors';
import { decodeCoreOperationFailure } from '../contract-codecs';
import { SystemCompatibilityContractError } from '../systemCompatibility';

describe('core operation failure decoding', () => {
  it.each([
    new SystemCompatibilityContractError('unsupported_revision', 'private revision detail'),
    new ContractDecodeError('operation', 'private response detail'),
    new NetworkError('private host detail'),
    new ApiError('private server detail', 500, { token: 'private-token' }),
    new Error('private unknown detail'),
  ])('never exposes raw error details from %s', (error) => {
    const failure = decodeCoreOperationFailure(error);
    expect(JSON.stringify(failure)).not.toMatch(/private|token/);
  });
});
