#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_RECEIPT_PATH = path.join('test-results', 'tauri-command-core-receipt', 'receipt.json');

const REQUIRED_SCOPE = [
  'real temporary local file bytes',
  'Tauri upload command core',
  'local TUS-compatible HTTP server create and PATCH',
  'desktop TUS offset-conflict HEAD resume and resumed PATCH',
  'Tauri download command core',
  'local attachment download HTTP server',
  'Authorization and X-Fortemi-Memory headers on upload and download',
  'upload metadata and final attachment JSON',
  'progress events',
  'download variant route',
  'saved filesystem bytes, byte count, reopened byte count, and SHA-256 digest',
  'selected native file paths are converted to local file metadata',
  'native download core writes, reopens, and hashes saved attachment bytes',
];

const REQUIRED_NOT_CLAIMED = [
  'Tauri desktop GUI launch',
  'interactive native picker/save dialog operated in a launched GUI',
  'real Fortemi backend',
  'trusted publisher allowlist',
];

function validateReceipt(receipt) {
  const failures = [];
  if (receipt.receipt !== 'hotm-tauri-local-file-command-core') failures.push('receipt mismatch');
  if (receipt.issue !== 'Fortemi/HotM#283') failures.push('issue mismatch');
  if (
    receipt.command !==
    'TAURI_CONFIG={"bundle":{"externalBin":[]}} cargo test local_file_ -- --nocapture && TAURI_CONFIG={"bundle":{"externalBin":[]}} cargo test native_ -- --nocapture'
  ) {
    failures.push('command mismatch');
  }
  if (receipt.status !== 'passed') failures.push('status must be passed');
  if (receipt.exit_code !== 0) failures.push('exit_code must be 0');
  for (const key of ['started_at', 'finished_at']) {
    if (typeof receipt[key] !== 'string' || receipt[key].length === 0) failures.push(`${key} missing`);
  }
  for (const key of ['repository', 'sha', 'ref', 'run_id']) {
    const value = receipt.git?.[key];
    if (value !== null && typeof value !== 'string') failures.push(`git ${key} invalid`);
  }
  if (!Array.isArray(receipt.scope)) {
    failures.push('scope must be an array');
  } else {
    for (const item of REQUIRED_SCOPE) {
      if (!receipt.scope.includes(item)) failures.push(`scope missing: ${item}`);
    }
  }
  if (!Array.isArray(receipt.not_claimed)) {
    failures.push('not_claimed must be an array');
  } else {
    for (const item of REQUIRED_NOT_CLAIMED) {
      if (!receipt.not_claimed.includes(item)) failures.push(`not_claimed missing: ${item}`);
    }
  }
  if (receipt.not_claimed?.some((item) => /suite-wide portability|full desktop GUI/i.test(item))) {
    failures.push('not_claimed must use explicit desktop/Fortemi boundaries');
  }
  return failures;
}

function verifyTauriCommandCoreReceipt(receiptPath = DEFAULT_RECEIPT_PATH) {
  const failures = [];
  let receipt = null;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    failures.push(`could not read receipt: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (receipt) failures.push(...validateReceipt(receipt));
  return {
    receipt: 'hotm-tauri-command-core-receipt-validation',
    issue: 'Fortemi/HotM#283',
    status: failures.length === 0 ? 'passed' : 'failed',
    receipt_path: receiptPath,
    failures,
  };
}

if (require.main === module) {
  const validation = verifyTauriCommandCoreReceipt(process.argv[2] || DEFAULT_RECEIPT_PATH);
  const validationPath = path.join(path.dirname(validation.receipt_path), 'receipt-validation.json');
  fs.mkdirSync(path.dirname(validationPath), { recursive: true });
  fs.writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`);
  if (validation.failures.length > 0) {
    console.error(validation.failures.join('\n'));
    process.exit(1);
  }
}

module.exports = {
  REQUIRED_NOT_CLAIMED,
  REQUIRED_SCOPE,
  validateReceipt,
  verifyTauriCommandCoreReceipt,
};
