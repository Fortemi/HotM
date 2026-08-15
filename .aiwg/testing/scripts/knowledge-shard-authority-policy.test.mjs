import assert from 'node:assert/strict';
import test from 'node:test';

import { validateKnowledgeShardAuthorityPolicy } from './knowledge-shard-authority-policy.mjs';

function fixtures() {
  const receipt = {
    fullV1: {
      tuple: { schemaVersion: '2.0.0', profile: 'full-v1' },
      authority: {
        contract: {
          revision: '21',
          sha256: 'contract-sha',
          schemaBundleSha256: 'bundle-sha',
        },
      },
      runtimeReceipt: { sha256: 'runtime-sha' },
      pairedReceipt: { sha256: 'interop-sha' },
    },
  };
  const contract = {
    contractRevision: '21',
    status: 'receipt-bound-opt-in',
    profiles: {
      'full-v1': { advertised: true },
      'record-v1': { advertised: false },
    },
    selection: {
      advertisedOptIn: [{ schemaVersion: '2.0.0', profile: 'full-v1' }],
      unadvertised: [
        { schemaVersion: '2.0.0', profile: 'core-v1' },
        { schemaVersion: '2.0.0', profile: 'record-v1' },
      ],
    },
  };
  const advertisement = {
    status: 'receipt-bound-opt-in-advertised',
    authority: {
      contractRevision: '21',
      contractSha256: 'contract-sha',
      schemaBundleSha256: 'bundle-sha',
    },
    selection: {
      advertisedOptIn: [{ schemaVersion: '2.0.0', profile: 'full-v1' }],
    },
    evidence: {
      runtimeReceipt: { sha256: 'runtime-sha' },
      fullV1InteropReceipt: { sha256: 'interop-sha' },
    },
    claims: {
      exact2_0_0FullV1NamedCells: true,
      suiteWide: false,
      completeBackup: false,
      parity: false,
    },
  };
  return { receipt, contract, advertisement };
}

test('accepts exact revision-21 receipt-bound full-v1 advertisement', () => {
  const input = fixtures();
  assert.deepEqual(validateKnowledgeShardAuthorityPolicy(
    input.receipt, input.contract, input.advertisement,
  ), []);
});

test('fails closed on an unknown contract revision', () => {
  const input = fixtures();
  input.contract.contractRevision = '22';
  assert.match(
    validateKnowledgeShardAuthorityPolicy(
      input.receipt, input.contract, input.advertisement,
    ).join('\n'),
    /unsupported Knowledge Shard contract revision/,
  );
});

test('rejects an unsupported profile tuple', () => {
  const input = fixtures();
  input.receipt.fullV1.tuple.profile = 'record-v1';
  assert.match(
    validateKnowledgeShardAuthorityPolicy(
      input.receipt, input.contract, input.advertisement,
    ).join('\n'),
    /only the exact advertised 2\.0\.0\/full-v1 tuple/,
  );
});

test('rejects missing receipt-bound opt-in advertisement', () => {
  const input = fixtures();
  input.contract.selection.advertisedOptIn = [];
  assert.match(
    validateKnowledgeShardAuthorityPolicy(
      input.receipt, input.contract, input.advertisement,
    ).join('\n'),
    /advertised opt-in tuple is missing/,
  );
});

test('rejects advertisement receipt evidence drift', () => {
  const input = fixtures();
  input.advertisement.evidence.fullV1InteropReceipt.sha256 = 'drifted';
  assert.match(
    validateKnowledgeShardAuthorityPolicy(
      input.receipt, input.contract, input.advertisement,
    ).join('\n'),
    /advertisement evidence does not bind/,
  );
});
