#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const issue = 'Fortemi/HotM#291';
const schemaVersion = 'hotm.mocked-playwright-ci-receipt.v1';
const fixtureContractFiles = [
  'e2e/fixtures/test-data.ts',
  'e2e/tests/compatibility-admission.spec.ts',
  'e2e/tests/enterprise-preview.spec.ts',
  'e2e/tests/error-handling.spec.ts',
  'e2e/tests/navigation.spec.ts',
  'e2e/tests/note-crud.spec.ts',
  'e2e/tests/search.spec.ts',
  'e2e/tests/tags.spec.ts',
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function hotmSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function fileDigest(root, relativePath) {
  const fullPath = path.join(root, 'ui', relativePath);
  const stat = fs.statSync(fullPath);
  return {
    path: `ui/${relativePath}`,
    bytes: stat.size,
    sha256: sha256(fs.readFileSync(fullPath)),
  };
}

function fixtureContractDigest(root) {
  const files = fixtureContractFiles.map((relativePath) => fileDigest(root, relativePath));
  const canonical = JSON.stringify(files, null, 2);
  return {
    algorithm: 'sha256',
    digest: sha256(canonical),
    files,
  };
}

function baseReceipt() {
  const root = repoRoot();
  const exactHotmSha = hotmSha();
  const githubSha = process.env.GITHUB_SHA || null;
  return {
    schemaVersion,
    issue,
    receipt: 'hotm-mocked-playwright-ci',
    status: 'started',
    command: 'npx playwright test --config scripts/playwright-mocked-ci.config.cjs',
    generated_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    finished_at: null,
    git: {
      repository: process.env.GITHUB_REPOSITORY || null,
      ref: process.env.GITHUB_REF || null,
      run_id: process.env.GITHUB_RUN_ID || null,
      hotm_sha: exactHotmSha,
      github_sha: githubSha,
      github_sha_matches_hotm_sha: githubSha === null || githubSha === exactHotmSha,
    },
    fixture_contract: fixtureContractDigest(root),
    matrix: {
      projects: [
        { name: 'mocked-desktop-1280', width: 1280, height: 900 },
        { name: 'mocked-mobile-390', width: 390, height: 900 },
      ],
    },
    artifacts: {
      html_report: 'ui/playwright-report/mocked-ci/',
      traces_screenshots_videos: 'ui/test-results/mocked-ci/artifacts/',
    },
    gates: {
      mocked_playwright_required: true,
      live_fortemi: 'separate opt-in live-asset-receipt job',
      tauri_desktop: 'separate desktop-build-matrix.yml and desktop-release.yml workflows',
    },
  };
}

function readReceipt(outputPath) {
  return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
}

function writeReceipt(outputPath, receipt) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
}

function validate(receipt) {
  const failures = [];
  if (receipt.schemaVersion !== schemaVersion) failures.push('schemaVersion mismatch');
  if (receipt.issue !== issue) failures.push('issue mismatch');
  if (!['started', 'passed', 'failed'].includes(receipt.status)) failures.push('invalid status');
  if (!/^[0-9a-f]{40}$/.test(receipt.git?.hotm_sha || '')) failures.push('git.hotm_sha must be a full SHA');
  if (receipt.git?.github_sha_matches_hotm_sha !== true) {
    failures.push('GITHUB_SHA does not match checked-out HotM HEAD');
  }
  if (!/^[0-9a-f]{64}$/.test(receipt.fixture_contract?.digest || '')) {
    failures.push('fixture contract digest missing');
  }
  if (!Array.isArray(receipt.fixture_contract?.files) || receipt.fixture_contract.files.length !== fixtureContractFiles.length) {
    failures.push('fixture contract file inventory mismatch');
  }
  if (!Array.isArray(receipt.matrix?.projects) || receipt.matrix.projects.length !== 2) {
    failures.push('desktop/mobile project matrix missing');
  }
  for (const project of receipt.matrix?.projects || []) {
    if (!Number.isInteger(project.width) || !Number.isInteger(project.height)) {
      failures.push(`viewport dimensions missing for ${project.name || 'unknown project'}`);
    }
  }
  return failures;
}

function usage() {
  console.error('usage: write-mocked-playwright-ci-receipt.cjs --prepare|--finalize|--verify <receipt.json> [exit-code]');
}

const [mode, outputPath, exitCodeValue] = process.argv.slice(2);
if (!mode || !outputPath) {
  usage();
  process.exit(2);
}

try {
  if (mode === '--prepare') {
    const receipt = baseReceipt();
    const failures = validate(receipt);
    if (failures.length > 0) throw new Error(failures.join('\n'));
    writeReceipt(outputPath, receipt);
  } else if (mode === '--finalize') {
    const exitCode = Number(exitCodeValue);
    if (!Number.isInteger(exitCode) || exitCode < 0) throw new Error('exit-code must be a non-negative integer');
    const receipt = readReceipt(outputPath);
    receipt.status = exitCode === 0 ? 'passed' : 'failed';
    receipt.exit_code = exitCode;
    receipt.finished_at = new Date().toISOString();
    writeReceipt(outputPath, receipt);
  } else if (mode === '--verify') {
    const receipt = readReceipt(outputPath);
    const failures = validate(receipt);
    if (failures.length > 0) throw new Error(failures.join('\n'));
  } else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
