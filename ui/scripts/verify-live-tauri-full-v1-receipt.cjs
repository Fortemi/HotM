#!/usr/bin/env node

const fs = require('node:fs');

const REQUIRED_TRUE_CLAIMS = [
  'tauriLocalFileCoreAgainstLiveFortemiPassed',
  'trustRequiredSignedFullV1RecoveryPassed',
  'sourceServerRecoveryBytesPassed',
  'desktopDownloadCoreSavedAndReopenedPassed',
];

const REQUIRED_FALSE_CLAIMS = [
  'launchedTauriGuiInThisRunPassed',
  'interactiveNativeDialogsInThisRunPassed',
  'immutableCiArtifactPublished',
  'suiteWidePortability',
];

const REQUIRED_NOT_CLAIMED = [
  'launched Tauri GUI operation in this command-core run',
  'interactive native picker or save dialog in this command-core run',
  'immutable CI artifact publication before upload completes',
  'non-Linux desktop platforms',
  'suite-wide portability or complete backup',
];

const TIMING_FIELDS = [
  'tauriLocalFileUpload',
  'signedFullV1Export',
  'trustRequiredFullV1Import',
  'tauriRecoveredFileDownload',
  'recoveryRtoImportAndDownload',
];

function validateLiveTauriFullV1Receipt(receipt) {
  const failures = [];
  if (receipt.schemaVersion !== 'hotm.desktop-live-full-v1-recovery-receipt.v1') {
    failures.push('schemaVersion mismatch');
  }
  if (receipt.receipt !== 'hotm-desktop-live-full-v1-recovery') {
    failures.push('receipt mismatch');
  }
  if (receipt.issue !== 'Fortemi/HotM#283') failures.push('issue mismatch');
  if (receipt.status !== 'passed') failures.push('status must be passed');
  if (receipt.profile !== '2.0.0/full-v1') failures.push('profile mismatch');

  for (const field of ['hotmGitCommit', 'fortemiGitCommit']) {
    if (!/^[0-9a-f]{40}$/.test(receipt.identity?.[field] || '')) {
      failures.push(`identity.${field} must be an exact commit`);
    }
  }
  if (receipt.identity?.hotmWorktreeDirty !== false) {
    failures.push('identity.hotmWorktreeDirty must be false');
  }
  if (typeof receipt.identity?.fortemiVersion !== 'string' || !receipt.identity.fortemiVersion) {
    failures.push('identity.fortemiVersion missing');
  }
  if (typeof receipt.identity?.authenticationRequired !== 'boolean') {
    failures.push('identity.authenticationRequired invalid');
  }
  if (receipt.identity?.bearerTokenSupplied !== receipt.identity?.authenticationRequired) {
    failures.push('bearer token state does not match authentication requirement');
  }
  if (receipt.identity?.storageBackend !== 'filesystem') {
    failures.push('storage backend must be filesystem');
  }

  const sourceMemory = receipt.source?.memory;
  const recoveryMemory = receipt.recovery?.memory;
  if (typeof sourceMemory !== 'string' || !sourceMemory.startsWith('hotm_live_')) {
    failures.push('source memory must use the isolated hotm_live_ prefix');
  }
  if (typeof recoveryMemory !== 'string' || !recoveryMemory.startsWith('hotm_live_')) {
    failures.push('recovery memory must use the isolated hotm_live_ prefix');
  }
  if (sourceMemory === recoveryMemory) failures.push('source and recovery memories must differ');

  for (const section of ['source', 'recovery']) {
    if (!/^[0-9a-f-]{36}$/.test(receipt[section]?.attachmentId || '')) {
      failures.push(`${section}.attachmentId invalid`);
    }
    if (receipt[section]?.filename !== 'desktop-live-full-v1.bin') {
      failures.push(`${section}.filename mismatch`);
    }
    if (!Number.isInteger(receipt[section]?.bytes) || receipt[section].bytes <= 0) {
      failures.push(`${section}.bytes invalid`);
    }
    if (!/^[0-9a-f]{64}$/.test(receipt[section]?.sha256 || '')) {
      failures.push(`${section}.sha256 invalid`);
    }
    if (!/^blake3:[0-9a-f]{64}$/.test(receipt[section]?.contentHash || '')) {
      failures.push(`${section}.contentHash invalid`);
    }
  }
  if (!/^[0-9a-f-]{36}$/.test(receipt.source?.noteId || '')) {
    failures.push('source.noteId invalid');
  }
  if (receipt.source?.bytes !== receipt.recovery?.bytes) {
    failures.push('source and recovery byte counts differ');
  }
  if (receipt.source?.sha256 !== receipt.recovery?.sha256) {
    failures.push('source and recovery SHA-256 differ');
  }
  if (receipt.source?.contentHash !== receipt.recovery?.contentHash) {
    failures.push('source and recovery BLAKE3 hashes differ');
  }
  if (receipt.recovery?.savedFileReopened !== true) {
    failures.push('recovered saved file was not reopened');
  }
  if (receipt.recovery?.signaturePolicy !== 'require') {
    failures.push('signature policy must be require');
  }

  if (!Number.isInteger(receipt.archiveBytes) || receipt.archiveBytes <= 0) {
    failures.push('archiveBytes invalid');
  }
  for (const field of TIMING_FIELDS) {
    if (!Number.isInteger(receipt.timingsMillis?.[field]) || receipt.timingsMillis[field] < 0) {
      failures.push(`timingsMillis.${field} invalid`);
    }
  }
  if (
    Number.isInteger(receipt.timingsMillis?.trustRequiredFullV1Import)
    && Number.isInteger(receipt.timingsMillis?.tauriRecoveredFileDownload)
    && receipt.timingsMillis.recoveryRtoImportAndDownload
      !== receipt.timingsMillis.trustRequiredFullV1Import
        + receipt.timingsMillis.tauriRecoveredFileDownload
  ) {
    failures.push('recovery RTO does not equal import plus recovered download');
  }

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
  if (/\/tmp\/|\/home\/|storage_path|private_key|bearer\s|authorization/i.test(serialized)) {
    failures.push('receipt contains a local/storage path or credential-shaped text');
  }
  return failures;
}

function verifyLiveTauriFullV1Receipt(receiptPath) {
  const failures = [];
  let receipt = null;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    failures.push(`could not read receipt: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (receipt) failures.push(...validateLiveTauriFullV1Receipt(receipt));
  return {
    receipt: 'hotm-desktop-live-full-v1-recovery-validation',
    issue: 'Fortemi/HotM#283',
    status: failures.length === 0 ? 'passed' : 'failed',
    receiptPath,
    failures,
  };
}

if (require.main === module) {
  const receiptPath = process.argv[2];
  if (!receiptPath) {
    console.error('usage: verify-live-tauri-full-v1-receipt.cjs <receipt.json>');
    process.exit(2);
  }
  const validation = verifyLiveTauriFullV1Receipt(receiptPath);
  console.log(JSON.stringify(validation, null, 2));
  if (validation.failures.length > 0) process.exit(1);
}

module.exports = {
  REQUIRED_FALSE_CLAIMS,
  REQUIRED_NOT_CLAIMED,
  REQUIRED_TRUE_CLAIMS,
  TIMING_FIELDS,
  validateLiveTauriFullV1Receipt,
  verifyLiveTauriFullV1Receipt,
};
