import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  REQUIRED_FALSE_CLAIMS,
  REQUIRED_NOT_CLAIMED,
  REQUIRED_TRUE_CLAIMS,
  TIMING_FIELDS,
  validateLiveTauriFullV1Receipt,
} = require('./verify-live-tauri-full-v1-receipt.cjs');

function validReceipt() {
  const contentHash = `blake3:${'c'.repeat(64)}`;
  const claims = Object.fromEntries([
    ...REQUIRED_TRUE_CLAIMS.map((claim) => [claim, true]),
    ...REQUIRED_FALSE_CLAIMS.map((claim) => [claim, false]),
  ]);
  const timingsMillis = Object.fromEntries(TIMING_FIELDS.map((field) => [field, 10]));
  timingsMillis.recoveryRtoImportAndDownload =
    timingsMillis.trustRequiredFullV1Import + timingsMillis.tauriRecoveredFileDownload;
  return {
    schemaVersion: 'hotm.desktop-live-full-v1-recovery-receipt.v1',
    receipt: 'hotm-desktop-live-full-v1-recovery',
    issue: 'Fortemi/HotM#283',
    status: 'passed',
    profile: '2.0.0/full-v1',
    identity: {
      hotmGitCommit: 'a'.repeat(40),
      hotmWorktreeDirty: false,
      fortemiGitCommit: 'b'.repeat(40),
      fortemiVersion: '2026.7.12',
      authenticationRequired: true,
      bearerTokenSupplied: true,
      storageBackend: 'filesystem',
    },
    source: {
      memory: 'hotm_live_source',
      noteId: '019fa65c-4054-7cb2-9018-73870583311f',
      attachmentId: '019fa65c-432d-74f3-bd53-3ed167ede8d5',
      filename: 'desktop-live-full-v1.bin',
      bytes: 262144,
      sha256: 'd'.repeat(64),
      contentHash,
    },
    recovery: {
      memory: 'hotm_live_recovery',
      attachmentId: '019fa65c-432d-74f3-bd53-3ed167ede8d6',
      filename: 'desktop-live-full-v1.bin',
      bytes: 262144,
      sha256: 'd'.repeat(64),
      contentHash,
      savedFileReopened: true,
      signaturePolicy: 'require',
    },
    timingsMillis,
    archiveBytes: 4096,
    claims,
    notClaimed: [...REQUIRED_NOT_CLAIMED],
  };
}

describe('live Tauri full-v1 receipt verifier', () => {
  test('accepts exact live command-path signed recovery evidence', () => {
    expect(validateLiveTauriFullV1Receipt(validReceipt())).toEqual([]);
  });

  test('rejects revision ambiguity and source/recovery aliasing', () => {
    const receipt = validReceipt();
    receipt.identity.fortemiGitCommit = 'unknown';
    receipt.recovery.memory = receipt.source.memory;
    expect(validateLiveTauriFullV1Receipt(receipt)).toEqual(
      expect.arrayContaining([
        'identity.fortemiGitCommit must be an exact commit',
        'source and recovery memories must differ',
      ]),
    );
  });

  test('rejects digest drift and permissive signature policy', () => {
    const receipt = validReceipt();
    receipt.recovery.sha256 = 'e'.repeat(64);
    receipt.recovery.contentHash = `blake3:${'f'.repeat(64)}`;
    receipt.recovery.signaturePolicy = 'trusted-local-only';
    expect(validateLiveTauriFullV1Receipt(receipt)).toEqual(
      expect.arrayContaining([
        'source and recovery SHA-256 differ',
        'source and recovery BLAKE3 hashes differ',
        'signature policy must be require',
      ]),
    );
  });

  test('rejects broadened GUI, CI, or portability claims', () => {
    const receipt = validReceipt();
    receipt.claims.launchedTauriGuiInThisRunPassed = true;
    receipt.claims.immutableCiArtifactPublished = true;
    receipt.claims.suiteWidePortability = true;
    expect(validateLiveTauriFullV1Receipt(receipt)).toEqual(
      expect.arrayContaining([
        'claim launchedTauriGuiInThisRunPassed must be false',
        'claim immutableCiArtifactPublished must be false',
        'claim suiteWidePortability must be false',
      ]),
    );
  });

  test('rejects local paths and credential-shaped output', () => {
    const receipt = validReceipt();
    receipt.debug = '/tmp/secret Authorization: Bearer token';
    expect(validateLiveTauriFullV1Receipt(receipt)).toContain(
      'receipt contains a local/storage path or credential-shaped text',
    );
  });
});
