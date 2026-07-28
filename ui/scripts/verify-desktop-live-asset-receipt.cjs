#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_RECEIPT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '.aiwg',
  'evidence',
  'hotm-desktop-live-asset-receipt-2026-07-27.json',
);

const REQUIRED_TRUE_CLAIMS = [
  'launchedLinuxTauriGuiPassed',
  'interactiveNativePickerUploadPassed',
  'interactiveNativeSaveDownloadPassed',
  'realFortemiFilesystemBackendPassed',
  'exactBidirectionalBytesPassed',
];

const REQUIRED_FALSE_CLAIMS = [
  'browserTusResumePassed',
  'signedFullV1RecoveryPassed',
  'authenticatedLifecyclePassed',
  'immutableCiGuiReceiptPassed',
  'suiteWidePortability',
];

const REQUIRED_NOT_CLAIMED = [
  'signed 2.0.0/full-v1 export or clean-destination recovery in this desktop run',
  'authenticated desktop lifecycle',
  'non-Linux desktop platforms',
  'browser TUS disconnect/resume',
  'immutable CI operation of the interactive GUI',
  'suite-wide portability or complete backup',
];

function validateDesktopLiveAssetReceipt(receipt) {
  const failures = [];
  if (receipt.schemaVersion !== 'hotm.desktop-live-asset-receipt.v1') {
    failures.push('schemaVersion mismatch');
  }
  if (receipt.receipt !== 'hotm-desktop-live-asset') failures.push('receipt mismatch');
  if (receipt.issue !== 'Fortemi/HotM#283') failures.push('issue mismatch');
  if (receipt.status !== 'passed') failures.push('status must be passed');
  if (!Number.isFinite(Date.parse(receipt.observedAt))) failures.push('observedAt invalid');

  if (receipt.platform?.os !== 'linux') failures.push('platform os must be linux');
  if (receipt.platform?.dialogBackend !== 'tauri-plugin-dialog/gtk3') {
    failures.push('dialog backend mismatch');
  }
  if (receipt.runtime?.tauriGuiLaunched !== true) failures.push('Tauri GUI launch missing');
  if (receipt.runtime?.fortemiStorageBackend !== 'filesystem') {
    failures.push('Fortemi storage backend must be filesystem');
  }
  if (receipt.runtime?.isolatedStorageRoot !== true) failures.push('isolated storage root missing');
  if (receipt.runtime?.authenticationRequired !== false) {
    failures.push('authenticationRequired must record false');
  }

  for (const section of ['source', 'server', 'destination']) {
    if (!Number.isInteger(receipt[section]?.bytes) || receipt[section].bytes <= 0) {
      failures.push(`${section} bytes invalid`);
    }
  }
  if (receipt.source?.bytes !== receipt.server?.bytes || receipt.source?.bytes !== receipt.destination?.bytes) {
    failures.push('source/server/destination byte counts differ');
  }
  for (const section of ['source', 'destination']) {
    if (!/^[0-9a-f]{64}$/.test(receipt[section]?.sha256 || '')) {
      failures.push(`${section} sha256 invalid`);
    }
  }
  if (receipt.source?.sha256 !== receipt.destination?.sha256) {
    failures.push('source and destination SHA-256 differ');
  }
  if (!/^blake3:[0-9a-f]{64}$/.test(receipt.server?.contentHash || '')) {
    failures.push('server contentHash invalid');
  }
  for (const key of ['noteId', 'attachmentId', 'blobId']) {
    if (!/^[0-9a-f-]{36}$/.test(receipt.server?.[key] || '')) failures.push(`server ${key} invalid`);
  }
  if (receipt.server?.attachmentStatus !== 'uploaded') failures.push('attachment status mismatch');
  if (receipt.destination?.reopened !== true) failures.push('saved file was not reopened');

  for (const claim of REQUIRED_TRUE_CLAIMS) {
    if (receipt.claims?.[claim] !== true) failures.push(`claim ${claim} must be true`);
  }
  for (const claim of REQUIRED_FALSE_CLAIMS) {
    if (receipt.claims?.[claim] !== false) failures.push(`claim ${claim} must be false`);
  }
  if (!Array.isArray(receipt.notClaimed)) {
    failures.push('notClaimed must be an array');
  } else {
    for (const boundary of REQUIRED_NOT_CLAIMED) {
      if (!receipt.notClaimed.includes(boundary)) failures.push(`notClaimed missing: ${boundary}`);
    }
  }

  const serialized = JSON.stringify(receipt);
  if (/\/tmp\/|\/home\/|storage_path|bearer|authorization/i.test(serialized)) {
    failures.push('receipt contains a local path, storage path, or credential-shaped text');
  }
  return failures;
}

function verifyDesktopLiveAssetReceipt(receiptPath = DEFAULT_RECEIPT_PATH) {
  const failures = [];
  let receipt = null;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    failures.push(`could not read receipt: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (receipt) failures.push(...validateDesktopLiveAssetReceipt(receipt));
  return {
    receipt: 'hotm-desktop-live-asset-receipt-validation',
    issue: 'Fortemi/HotM#283',
    status: failures.length === 0 ? 'passed' : 'failed',
    receiptPath,
    failures,
  };
}

if (require.main === module) {
  const validation = verifyDesktopLiveAssetReceipt(process.argv[2] || DEFAULT_RECEIPT_PATH);
  console.log(JSON.stringify(validation, null, 2));
  if (validation.failures.length > 0) process.exit(1);
}

module.exports = {
  DEFAULT_RECEIPT_PATH,
  REQUIRED_FALSE_CLAIMS,
  REQUIRED_NOT_CLAIMED,
  REQUIRED_TRUE_CLAIMS,
  validateDesktopLiveAssetReceipt,
  verifyDesktopLiveAssetReceipt,
};
