#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SIDECAR_PROVENANCE = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../release/live-asset-receipt-sidecar-provenance.json'),
  'utf8',
));

const REQUIRED_TRUE_CLAIMS = [
  'browserSetInputFilesAgainstLiveFortemiPassed',
  'browserTusMultiOffsetResumePassed',
  'browserTusExactlyOneAttachmentPassed',
  'reuploadAndShardMetadataRelationshipsPassed',
  'browserSavedDownloadPassed',
  'tauriLocalFileCoreAgainstLiveFortemiPassed',
  'sourceRetiredBeforeCleanRecoveryPassed',
  'browserAndDesktopNormalizedContractPassed',
  'signedFullV1CleanRecoveryPassed',
  'exactBytesDigestAndLengthPassed',
  'authenticatedBoundaryPassed',
  'authorityContractGatesPassed',
  'redactionScanPassed',
  'productionShardConsumerPassed',
];

const FIXTURE_IDENTITY = Object.freeze({
  id: 'hotm-live-assets-v1',
  browserTusBytes: 196608,
  browserTusSha256: 'd6ab0c60a307941a1d9793753bf0cbbb90008e89812869453b25e236ef56231f',
  uiUploadBytes: 131072,
  uiUploadSha256: '7298685ff5a1933017d78acb3d5d42f2a872bd1a38e0b152c4fb8bceebd47ea4',
});

const REQUIRED_FALSE_CLAIMS = [
  'launchedDesktopGui',
  'interactiveNativeDialogs',
  'suiteWidePortability',
];

const SUPPORTED_PLATFORMS = Object.freeze({
  'linux/x86_64/x86_64-unknown-linux-gnu': Object.freeze({
    os: 'linux',
    arch: 'x86_64',
    target: 'x86_64-unknown-linux-gnu',
    desktopTarget: 'tauri-command-core-linux-x86_64',
  }),
  'linux/arm64/aarch64-unknown-linux-gnu': Object.freeze({
    os: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    desktopTarget: 'tauri-command-core-linux-arm64',
  }),
  'darwin/arm64/aarch64-apple-darwin': Object.freeze({
    os: 'darwin',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
    desktopTarget: 'tauri-command-core-darwin-arm64',
  }),
});

function sha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function exactCommit(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function validateLiveAssetCiReceipt(receipt, { expectClean = true } = {}) {
  const failures = [];
  if (receipt.schemaVersion !== 'hotm.live-asset-ci-receipt.v1') {
    failures.push('schemaVersion mismatch');
  }
  if (receipt.issue !== 'Fortemi/HotM#284') failures.push('issue mismatch');
  if (receipt.status !== 'passed') failures.push('status must be passed');
  if (receipt.profile !== '2.0.0/full-v1') failures.push('profile mismatch');

  if (!exactCommit(receipt.identity?.hotmCommit)) {
    failures.push('identity.hotmCommit must be an exact commit');
  }
  if (!exactCommit(receipt.identity?.fortemiCommit)) {
    failures.push('identity.fortemiCommit must be an exact commit');
  }
  if (receipt.identity?.fortemiCommit !== SIDECAR_PROVENANCE.target_commitish) {
    failures.push('identity.fortemiCommit does not match pinned sidecar provenance');
  }
  if (expectClean && receipt.identity?.hotmWorktreeDirty !== false) {
    failures.push('identity.hotmWorktreeDirty must be false');
  }
  if (receipt.identity?.fortemiHealthCommit !== receipt.identity?.fortemiCommit) {
    failures.push('Fortemi health commit does not match the pinned producer commit');
  }
  if (receipt.identity?.sidecarRelease !== SIDECAR_PROVENANCE.release_tag) {
    failures.push('sidecar release does not match pinned sidecar provenance');
  }
  if (JSON.stringify(receipt.identity?.fixture) !== JSON.stringify(FIXTURE_IDENTITY)) {
    failures.push('identity.fixture does not match the deterministic live corpus');
  }
  if (!sha256(receipt.identity?.sidecarSha256)) {
    failures.push('identity.sidecarSha256 invalid');
  }

  const platformKey = [
    receipt.execution?.os,
    receipt.execution?.arch,
    receipt.execution?.target,
  ].join('/');
  const platform = SUPPORTED_PLATFORMS[platformKey];
  if (!platform) {
    failures.push(
      'execution platform must be Linux x86_64, Linux arm64, or Darwin arm64',
    );
  } else if (
    receipt.identity?.sidecarSha256
      !== SIDECAR_PROVENANCE.assets?.[platform.target]?.sha256
  ) {
    failures.push('identity.sidecarSha256 does not match the pinned platform asset');
  }
  if (receipt.execution?.headless !== true) failures.push('execution.headless must be true');
  if (receipt.execution?.authenticationRequired !== true) {
    failures.push('execution.authenticationRequired must be true');
  }
  if (receipt.execution?.storageBackend !== 'filesystem') {
    failures.push('execution.storageBackend must be filesystem');
  }
  if (!['managed-docker', 'external'].includes(receipt.execution?.databaseProvisioning)) {
    failures.push('execution.databaseProvisioning invalid');
  }
  if (receipt.execution?.browserTarget !== 'playwright-chromium') {
    failures.push('execution.browserTarget mismatch');
  }
  if (platform && receipt.execution?.desktopTarget !== platform.desktopTarget) {
    failures.push('execution.desktopTarget mismatch');
  }

  for (const child of ['browser', 'tauri', 'authorityContracts']) {
    if (receipt.children?.[child]?.status !== 'passed') {
      failures.push(`children.${child}.status must be passed`);
    }
    if (!sha256(receipt.children?.[child]?.sha256)) {
      failures.push(`children.${child}.sha256 invalid`);
    }
  }

  for (const claim of REQUIRED_TRUE_CLAIMS) {
    if (receipt.claims?.[claim] !== true) failures.push(`claim ${claim} must be true`);
  }
  for (const claim of REQUIRED_FALSE_CLAIMS) {
    if (receipt.claims?.[claim] !== false) failures.push(`claim ${claim} must be false`);
  }
  if (receipt.publication?.artifact !== 'hotm-live-asset-ci-receipt') {
    failures.push('publication.artifact mismatch');
  }
  if (receipt.publication?.uploadPending !== true) {
    failures.push('publication.uploadPending must be true before artifact upload');
  }

  const serialized = JSON.stringify(receipt);
  if (
    /mm_at_[A-Za-z0-9_-]{16,}|\/tmp\/|\/home\/|\/Users\/|\/private\/(?:tmp|var)\/|storage_path|private_key|shard_base64|authorization["']?\s*:/i
      .test(serialized)
  ) {
    failures.push('receipt contains a credential, local/storage path, manifest payload, or payload bytes');
  }
  return failures;
}

function verifyLiveAssetCiReceipt(receiptPath, options = {}) {
  const failures = [];
  let receipt = null;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    failures.push(`could not read receipt: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (receipt) {
    failures.push(...validateLiveAssetCiReceipt(receipt, options));
    if (options.verifyChildFiles !== false) {
      const directory = path.dirname(receiptPath);
      const childFiles = {
        browser: 'browser-metrics.json',
        tauri: 'tauri-receipt.json',
        authorityContracts: 'authority-contract-gates.json',
      };
      for (const [name, filename] of Object.entries(childFiles)) {
        const childPath = path.join(directory, filename);
        if (!fs.existsSync(childPath)) {
          failures.push(`children.${name} evidence file is missing`);
          continue;
        }
        const digest = crypto.createHash('sha256')
          .update(fs.readFileSync(childPath))
          .digest('hex');
        if (digest !== receipt.children?.[name]?.sha256) {
          failures.push(`children.${name} evidence digest mismatch`);
        }
      }
    }
  }
  return {
    receipt: 'hotm-live-asset-ci-receipt-validation',
    issue: 'Fortemi/HotM#284',
    status: failures.length === 0 ? 'passed' : 'failed',
    failures,
  };
}

if (require.main === module) {
  const receiptPath = process.argv[2];
  if (!receiptPath) {
    console.error('usage: verify-live-asset-ci-receipt.cjs <receipt.json>');
    process.exit(2);
  }
  const validation = verifyLiveAssetCiReceipt(receiptPath, {
    expectClean: process.env.HOTM_LIVE_EXPECT_CLEAN !== '0',
  });
  console.log(JSON.stringify(validation, null, 2));
  if (validation.failures.length > 0) process.exit(1);
}

module.exports = {
  FIXTURE_IDENTITY,
  REQUIRED_FALSE_CLAIMS,
  REQUIRED_TRUE_CLAIMS,
  SUPPORTED_PLATFORMS,
  validateLiveAssetCiReceipt,
  verifyLiveAssetCiReceipt,
};
