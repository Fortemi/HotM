import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  FIXTURE_IDENTITY,
  validateLiveAssetCiReceipt,
  verifyLiveAssetCiReceipt,
} = require('./verify-live-asset-ci-receipt.cjs');
const provenance = require('../../release/live-asset-receipt-sidecar-provenance.json');

const PLATFORMS = {
  linux: {
    os: 'linux',
    arch: 'x86_64',
    target: 'x86_64-unknown-linux-gnu',
    desktopTarget: 'tauri-command-core-linux-x86_64',
    sidecarSha256: provenance.assets['x86_64-unknown-linux-gnu'].sha256,
  },
  darwin: {
    os: 'darwin',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
    desktopTarget: 'tauri-command-core-darwin-arm64',
    sidecarSha256: provenance.assets['aarch64-apple-darwin'].sha256,
  },
};

function validReceipt(platformName = 'linux') {
  const fortemiCommit = provenance.target_commitish;
  const platform = PLATFORMS[platformName];
  return {
    schemaVersion: 'hotm.live-asset-ci-receipt.v1',
    issue: 'Fortemi/HotM#284',
    status: 'passed',
    profile: '2.0.0/full-v1',
    identity: {
      hotmCommit: 'fef1b74b4189a3cf1500c0ac5387fff2cd07f618',
      hotmWorktreeDirty: false,
      fortemiCommit,
      fortemiHealthCommit: fortemiCommit,
      sidecarRelease: provenance.release_tag,
      sidecarSha256: platform.sidecarSha256,
      fixture: FIXTURE_IDENTITY,
    },
    execution: {
      os: platform.os,
      arch: platform.arch,
      target: platform.target,
      headless: true,
      authenticationRequired: true,
      storageBackend: 'filesystem',
      databaseProvisioning: platformName === 'linux' ? 'managed-docker' : 'external',
      browserTarget: 'playwright-chromium',
      desktopTarget: platform.desktopTarget,
    },
    children: {
      browser: { status: 'passed', sha256: 'b'.repeat(64) },
      tauri: { status: 'passed', sha256: 'c'.repeat(64) },
      authorityContracts: { status: 'passed', sha256: 'd'.repeat(64) },
    },
    claims: {
      browserSetInputFilesAgainstLiveFortemiPassed: true,
      browserTusMultiOffsetResumePassed: true,
      browserTusExactlyOneAttachmentPassed: true,
      reuploadAndShardMetadataRelationshipsPassed: true,
      browserSavedDownloadPassed: true,
      tauriLocalFileCoreAgainstLiveFortemiPassed: true,
      sourceRetiredBeforeCleanRecoveryPassed: true,
      browserAndDesktopNormalizedContractPassed: true,
      signedFullV1CleanRecoveryPassed: true,
      exactBytesDigestAndLengthPassed: true,
      authenticatedBoundaryPassed: true,
      authorityContractGatesPassed: true,
      redactionScanPassed: true,
      productionShardConsumerPassed: true,
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
  test.each([
    ['Linux x86_64', 'linux'],
    ['Darwin arm64', 'darwin'],
  ])('accepts the bounded headless authenticated receipt on %s', (_label, platform) => {
    expect(validateLiveAssetCiReceipt(validReceipt(platform))).toEqual([]);
  });

  test('rejects an unsupported target even when the OS and architecture are supported', () => {
    const receipt = validReceipt('darwin');
    receipt.execution.target = 'x86_64-apple-darwin';
    expect(validateLiveAssetCiReceipt(receipt)).toContain(
      'execution platform must be Linux x86_64 or Darwin arm64',
    );
  });

  test.each([
    ['credential', (receipt) => { receipt.leak = `mm_at_${'x'.repeat(24)}`; }],
    ['local path', (receipt) => { receipt.leak = '/tmp/private'; }],
    ['macOS local path', (receipt) => { receipt.leak = '/Users/runner/private'; }],
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

  test('rejects a producer revision that differs from pinned provenance', () => {
    const receipt = validReceipt();
    receipt.identity.fortemiCommit = 'e'.repeat(40);
    receipt.identity.fortemiHealthCommit = receipt.identity.fortemiCommit;
    expect(validateLiveAssetCiReceipt(receipt)).toContain(
      'identity.fortemiCommit does not match pinned sidecar provenance',
    );
  });

  test('recomputes every child digest from sibling evidence files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hotm-live-receipt-'));
    const receipt = validReceipt();
    const children = {
      browser: 'browser-metrics.json',
      tauri: 'tauri-receipt.json',
      authorityContracts: 'authority-contract-gates.json',
    };
    for (const [name, filename] of Object.entries(children)) {
      const bytes = Buffer.from(`${name}\n`);
      writeFileSync(join(directory, filename), bytes);
      receipt.children[name].sha256 = createHash('sha256').update(bytes).digest('hex');
    }
    const receiptPath = join(directory, 'receipt.json');
    writeFileSync(receiptPath, JSON.stringify(receipt));
    expect(verifyLiveAssetCiReceipt(receiptPath).failures).toEqual([]);

    writeFileSync(join(directory, 'browser-metrics.json'), 'tampered\n');
    expect(verifyLiveAssetCiReceipt(receiptPath).failures).toContain(
      'children.browser evidence digest mismatch',
    );
  });
});
