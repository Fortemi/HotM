import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  createLiveAssetCiReceiptPair,
  validateLiveAssetCiReceiptPair,
} = require('./verify-live-asset-ci-receipt-pair.cjs');
const { FIXTURE_IDENTITY } = require('./verify-live-asset-ci-receipt.cjs');
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

function receipt(platformName) {
  const platform = PLATFORMS[platformName];
  const fortemiCommit = provenance.target_commitish;
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
      desktopTarget: platform.desktopTarget,
      headless: true,
      authenticationRequired: true,
      storageBackend: 'filesystem',
      databaseProvisioning: platformName === 'linux' ? 'managed-docker' : 'external',
      browserTarget: 'playwright-chromium',
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

describe('live asset CI receipt pair verifier', () => {
  test('emits a bounded aggregate for one Linux and one Darwin receipt', () => {
    const aggregate = createLiveAssetCiReceiptPair([
      { receipt: receipt('darwin'), sha256: 'e'.repeat(64) },
      { receipt: receipt('linux'), sha256: 'f'.repeat(64) },
    ]);

    expect(aggregate.status).toBe('passed');
    expect(aggregate.failures).toEqual([]);
    expect(aggregate.claims).toMatchObject({
      exactLinuxDarwinPairPassed: true,
      launchedDesktopGui: false,
      interactiveNativeDialogs: false,
      suiteWidePortability: false,
    });
    expect(aggregate.children['linux-x86_64'].receiptSha256).toBe('f'.repeat(64));
    expect(aggregate.children['darwin-arm64'].receiptSha256).toBe('e'.repeat(64));
  });

  test('rejects a duplicate Linux receipt and missing Darwin evidence', () => {
    const failures = validateLiveAssetCiReceiptPair([
      receipt('linux'),
      receipt('linux'),
    ]);
    expect(failures).toEqual(expect.arrayContaining([
      'duplicate platform receipt: linux/x86_64/x86_64-unknown-linux-gnu',
      'missing required platform receipt: darwin/arm64/aarch64-apple-darwin',
    ]));
  });

  test('rejects revision drift between otherwise valid platform receipts', () => {
    const darwin = receipt('darwin');
    darwin.identity.hotmCommit = '9'.repeat(40);
    expect(validateLiveAssetCiReceiptPair([receipt('linux'), darwin])).toContain(
      'HotM commit differs between platform receipts',
    );
  });
});
