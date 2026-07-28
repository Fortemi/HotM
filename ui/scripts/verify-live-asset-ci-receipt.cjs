#!/usr/bin/env node

const fs = require('node:fs');

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
  'redactionScanPassed',
];

const REQUIRED_FALSE_CLAIMS = [
  'launchedDesktopGui',
  'interactiveNativeDialogs',
  'suiteWidePortability',
];

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
  if (receipt.issue !== 'Fortemi/HotM#283') failures.push('issue mismatch');
  if (receipt.status !== 'passed') failures.push('status must be passed');
  if (receipt.profile !== '2.0.0/full-v1') failures.push('profile mismatch');

  if (!exactCommit(receipt.identity?.hotmCommit)) {
    failures.push('identity.hotmCommit must be an exact commit');
  }
  if (!exactCommit(receipt.identity?.fortemiCommit)) {
    failures.push('identity.fortemiCommit must be an exact commit');
  }
  if (expectClean && receipt.identity?.hotmWorktreeDirty !== false) {
    failures.push('identity.hotmWorktreeDirty must be false');
  }
  if (receipt.identity?.fortemiHealthCommit !== receipt.identity?.fortemiCommit) {
    failures.push('Fortemi health commit does not match the pinned producer commit');
  }
  if (receipt.identity?.sidecarRelease !== `sidecar-${receipt.identity?.fortemiCommit?.slice(0, 12)}`) {
    failures.push('sidecar release does not match the pinned producer commit');
  }
  if (!sha256(receipt.identity?.sidecarSha256)) {
    failures.push('identity.sidecarSha256 invalid');
  }

  if (receipt.execution?.headless !== true) failures.push('execution.headless must be true');
  if (receipt.execution?.authenticationRequired !== true) {
    failures.push('execution.authenticationRequired must be true');
  }
  if (receipt.execution?.storageBackend !== 'filesystem') {
    failures.push('execution.storageBackend must be filesystem');
  }
  if (receipt.execution?.browserTarget !== 'playwright-chromium') {
    failures.push('execution.browserTarget mismatch');
  }
  if (receipt.execution?.desktopTarget !== 'tauri-command-core-linux-x86_64') {
    failures.push('execution.desktopTarget mismatch');
  }

  for (const child of ['browser', 'tauri']) {
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
    /mm_at_[A-Za-z0-9_-]{16,}|\/tmp\/|\/home\/|storage_path|private_key|shard_base64|authorization["']?\s*:/i
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
  if (receipt) failures.push(...validateLiveAssetCiReceipt(receipt, options));
  return {
    receipt: 'hotm-live-asset-ci-receipt-validation',
    issue: 'Fortemi/HotM#283',
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
  REQUIRED_FALSE_CLAIMS,
  REQUIRED_TRUE_CLAIMS,
  validateLiveAssetCiReceipt,
  verifyLiveAssetCiReceipt,
};
