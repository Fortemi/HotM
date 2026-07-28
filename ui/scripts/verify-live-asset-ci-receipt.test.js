import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { validateLiveAssetCiReceipt } = require('./verify-live-asset-ci-receipt.cjs');

function validReceipt() {
  const fortemiCommit = '51a0e6c4ed33874ce34a5ae799a41801b81f431d';
  return {
    schemaVersion: 'hotm.live-asset-ci-receipt.v1',
    issue: 'Fortemi/HotM#283',
    status: 'passed',
    profile: '2.0.0/full-v1',
    identity: {
      hotmCommit: 'fef1b74b4189a3cf1500c0ac5387fff2cd07f618',
      hotmWorktreeDirty: false,
      fortemiCommit,
      fortemiHealthCommit: fortemiCommit,
      sidecarRelease: `sidecar-${fortemiCommit.slice(0, 12)}`,
      sidecarSha256: 'a'.repeat(64),
    },
    execution: {
      headless: true,
      authenticationRequired: true,
      storageBackend: 'filesystem',
      browserTarget: 'playwright-chromium',
      desktopTarget: 'tauri-command-core-linux-x86_64',
    },
    children: {
      browser: { status: 'passed', sha256: 'b'.repeat(64) },
      tauri: { status: 'passed', sha256: 'c'.repeat(64) },
    },
    claims: {
      browserSetInputFilesAgainstLiveFortemiPassed: true,
      browserTusMultiOffsetResumePassed: true,
      browserSavedDownloadPassed: true,
      tauriLocalFileCoreAgainstLiveFortemiPassed: true,
      signedFullV1CleanRecoveryPassed: true,
      exactBytesDigestAndLengthPassed: true,
      authenticatedBoundaryPassed: true,
      redactionScanPassed: true,
      launchedDesktopGui: false,
      interactiveNativeDialogs: false,
      suiteWidePortability: false,
    },
    publication: {
      artifact: 'hotm-live-asset-ci-receipt',
      uploadPending: true,
    },
  };
}

describe('live asset CI receipt verifier', () => {
  test('accepts the bounded headless authenticated receipt', () => {
    expect(validateLiveAssetCiReceipt(validReceipt())).toEqual([]);
  });

  test.each([
    ['credential', (receipt) => { receipt.leak = `mm_at_${'x'.repeat(24)}`; }],
    ['local path', (receipt) => { receipt.leak = '/tmp/private'; }],
    ['storage path', (receipt) => { receipt.storage_path = 'secret'; }],
    ['manifest payload', (receipt) => { receipt.shard_base64 = 'payload'; }],
  ])('rejects a %s leak', (_name, mutate) => {
    const receipt = validReceipt();
    mutate(receipt);
    expect(validateLiveAssetCiReceipt(receipt)).toContain(
      'receipt contains a credential, local/storage path, manifest payload, or payload bytes',
    );
  });

  test('rejects producer identity drift and unsupported broad claims', () => {
    const receipt = validReceipt();
    receipt.identity.fortemiHealthCommit = 'd'.repeat(40);
    receipt.claims.suiteWidePortability = true;
    expect(validateLiveAssetCiReceipt(receipt)).toEqual(expect.arrayContaining([
      'Fortemi health commit does not match the pinned producer commit',
      'claim suiteWidePortability must be false',
    ]));
  });
});
