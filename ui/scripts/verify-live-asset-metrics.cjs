#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_RESULTS_DIR = 'test-results';
const DEFAULT_RECEIPT_DIR = path.join(DEFAULT_RESULTS_DIR, 'live-asset-receipt');
const METRICS_NAME = 'hotm-live-asset-browser-metrics.json';

function integerAtLeast(value, minimum) {
  return Number.isInteger(value) && value >= minimum;
}

function sha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function findMetricsFiles(root) {
  const matches = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(resolved);
      } else if (entry.isFile() && entry.name === METRICS_NAME) {
        matches.push(resolved);
      }
    }
  }
  walk(root);
  return [...new Set(matches)];
}

function validateMetrics(metrics) {
  const failures = [];
  if (metrics.schemaVersion !== 'hotm.live-asset-browser-receipt.v1') failures.push('schemaVersion mismatch');
  if (metrics.issue !== 'Fortemi/HotM#283') failures.push('issue mismatch');
  if (metrics.profile !== '2.0.0/full-v1') failures.push('profile mismatch');
  for (const key of ['apiUrl', 'memory', 'recoveryMemory']) {
    if (!metrics[key]) failures.push(`${key} missing`);
  }
  if (!integerAtLeast(metrics.corpus?.browserTusBytes, 1)) failures.push('browserTusBytes missing or invalid');
  if (!integerAtLeast(metrics.corpus?.uiUploadBytes, 1)) failures.push('uiUploadBytes missing or invalid');
  if (!sha256(metrics.corpus?.browserTusSha256)) failures.push('browserTusSha256 missing or invalid');
  if (!sha256(metrics.corpus?.uiUploadSha256)) failures.push('uiUploadSha256 missing or invalid');
  if (!integerAtLeast(metrics.archiveBytes, 1)) failures.push('archiveBytes missing or invalid');
  for (const key of [
    'uiUploadMillis',
    'uiServerDownloadMillis',
    'uiSavedFileDownloadMillis',
    'browserTusUploadMillis',
    'browserTusDisconnectResumeMillis',
    'browserTusDisconnectResumeDownloadMillis',
    'browserDownloadMillis',
    'browserTusReuploadMillis',
    'serverReturnDownloadMillis',
    'fullV1ExportMillis',
    'fullV1ImportMillis',
    'recoveryPollMillis',
    'recoveryDownloadMillis',
    'fullV1RtoImportPollAndDownloadMillis',
  ]) {
    if (!integerAtLeast(metrics.timingsMillis?.[key], 0)) failures.push(`${key} missing or invalid`);
  }
  if (metrics.tusResume?.mismatchStatus !== 409) failures.push('tusResume mismatchStatus must be 409');
  if (!integerAtLeast(metrics.tusResume?.resumeOffset, 1)) failures.push('tusResume resumeOffset missing or invalid');
  if (metrics.tusResume?.finalOffset !== metrics.corpus?.browserTusBytes) {
    failures.push('tusResume finalOffset must match browserTusBytes');
  }
  if (!integerAtLeast(metrics.tusDisconnectResume?.interruptedOffset, 1)) {
    failures.push('tusDisconnectResume interruptedOffset missing or invalid');
  }
  if (!integerAtLeast(metrics.tusDisconnectResume?.resumeOffset, 1)) {
    failures.push('tusDisconnectResume resumeOffset missing or invalid');
  }
  if (metrics.tusDisconnectResume?.resumeOffset !== metrics.tusDisconnectResume?.interruptedOffset) {
    failures.push('tusDisconnectResume resumeOffset must match interruptedOffset');
  }
  if (metrics.tusDisconnectResume?.finalOffset !== metrics.corpus?.browserTusBytes) {
    failures.push('tusDisconnectResume finalOffset must match browserTusBytes');
  }
  const checkpoints = metrics.tusDisconnectResume?.checkpoints;
  if (
    !Array.isArray(checkpoints)
    || checkpoints.length < 2
    || checkpoints.some((checkpoint, index) =>
      checkpoint?.resumeOffset !== checkpoint?.interruptedOffset
      || !integerAtLeast(checkpoint?.interruptedOffset, 1)
      || checkpoint.interruptedOffset <= (checkpoints[index - 1]?.interruptedOffset ?? 0))
  ) {
    failures.push('tusDisconnectResume must contain at least two increasing confirmed checkpoints');
  }
  for (const key of [
    'browserBoundaryBytesPreserved',
    'browserTusResumePassed',
    'browserTusDisconnectResumePassed',
    'browserTusExactlyOneAttachmentPassed',
    'reuploadAndShardMetadataRelationshipsPassed',
    'signedFullV1RecoveryPassed',
  ]) {
    if (metrics.claims?.[key] !== true) failures.push(`claim ${key} must be true`);
  }
  if (metrics.claims?.hotmDesktopGuiPassed !== false) failures.push('hotmDesktopGuiPassed must remain false');
  if (metrics.claims?.suiteWidePortability !== false) failures.push('suiteWidePortability must remain false');
  const serialized = JSON.stringify(metrics);
  if (
    /mm_at_[A-Za-z0-9_-]{16,}|\/tmp\/|\/home\/|storage_path|private_key|shard_base64|authorization["']?\s*:|"manifest"\s*:/i
      .test(serialized)
  ) {
    failures.push('metrics contain a credential, local/storage path, manifest body, or payload bytes');
  }
  return failures;
}

function verifyLiveAssetMetrics({
  resultsDir = DEFAULT_RESULTS_DIR,
  receiptDir = DEFAULT_RECEIPT_DIR,
} = {}) {
  const failures = [];
  const metricsArtifacts = findMetricsFiles(resultsDir);

  if (metricsArtifacts.length !== 1) {
    failures.push(`expected exactly one ${METRICS_NAME}, found ${metricsArtifacts.length}`);
  }

  if (metricsArtifacts.length === 1) {
    try {
      const metrics = JSON.parse(fs.readFileSync(metricsArtifacts[0], 'utf8'));
      failures.push(...validateMetrics(metrics));
    } catch (error) {
      failures.push(`could not parse metrics JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  fs.mkdirSync(receiptDir, { recursive: true });
  const validation = {
    receipt: 'hotm-live-asset-browser-metrics-validation',
    issue: 'Fortemi/HotM#283',
    status: failures.length === 0 ? 'passed' : 'failed',
    metrics_artifacts: metricsArtifacts,
    failures,
  };
  fs.writeFileSync(path.join(receiptDir, 'metrics-validation.json'), `${JSON.stringify(validation, null, 2)}\n`);
  return validation;
}

if (require.main === module) {
  const validation = verifyLiveAssetMetrics({
    resultsDir: process.argv[2] || DEFAULT_RESULTS_DIR,
    receiptDir: process.argv[3] || DEFAULT_RECEIPT_DIR,
  });
  if (validation.failures.length > 0) {
    console.error(validation.failures.join('\n'));
    process.exit(1);
  }
}

module.exports = {
  verifyLiveAssetMetrics,
  validateMetrics,
};
