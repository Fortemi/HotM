import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  verifyReceiptArtifactManifest,
  writeReceiptArtifactManifest,
} = require('./write-receipt-artifact-manifest.cjs');

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hotm-receipt-manifest-'));
  tempDirs.push(dir);
  return dir;
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('writeReceiptArtifactManifest', () => {
  test('writes sorted byte and SHA-256 entries for every artifact file', () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(root, 'nested', 'metrics.json'), 'metrics\n');
    fs.writeFileSync(path.join(root, 'receipt.json'), 'receipt\n');

    const outputPath = path.join(root, 'artifact-manifest.json');
    const manifest = writeReceiptArtifactManifest({
      outputPath,
      artifact: 'hotm-live-asset-browser-receipt',
      roots: [root],
      now: new Date('2026-07-27T22:00:00Z'),
      env: {
        GITHUB_REPOSITORY: 'Fortemi/HotM',
        GITHUB_SHA: 'a'.repeat(40),
        GITHUB_REF: 'refs/heads/main',
        GITHUB_RUN_ID: '12345',
      },
    });

    expect(manifest).toMatchObject({
      schemaVersion: 'hotm.receipt-artifact-manifest.v1',
      issue: 'Fortemi/HotM#283',
      artifact: 'hotm-live-asset-browser-receipt',
      generated_at: '2026-07-27T22:00:00.000Z',
      git: {
        repository: 'Fortemi/HotM',
        sha: 'a'.repeat(40),
        ref: 'refs/heads/main',
        run_id: '12345',
      },
    });
    expect(manifest.files).toEqual([
      {
        root,
        path: 'nested/metrics.json',
        bytes: Buffer.byteLength('metrics\n'),
        sha256: digest('metrics\n'),
      },
      {
        root,
        path: 'receipt.json',
        bytes: Buffer.byteLength('receipt\n'),
        sha256: digest('receipt\n'),
      },
    ]);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual(manifest);

    const validation = verifyReceiptArtifactManifest(outputPath);
    expect(validation).toMatchObject({
      receipt: 'hotm-receipt-artifact-manifest-validation',
      issue: 'Fortemi/HotM#283',
      status: 'passed',
      manifest_path: outputPath,
      artifact: 'hotm-live-asset-browser-receipt',
      files: 2,
      failures: [],
    });
    expect(fs.existsSync(path.join(root, 'artifact-manifest-validation.json'))).toBe(false);
  });

  test('excludes the manifest itself when rewriting', () => {
    const root = makeTempDir();
    const outputPath = path.join(root, 'artifact-manifest.json');
    fs.writeFileSync(path.join(root, 'receipt.json'), 'receipt\n');
    fs.writeFileSync(outputPath, 'stale manifest\n');

    const manifest = writeReceiptArtifactManifest({
      outputPath,
      artifact: 'hotm-tauri-command-core-receipt',
      roots: [root],
      now: new Date('2026-07-27T22:05:00Z'),
      env: {},
    });

    expect(manifest.files.map((file) => file.path)).toEqual(['receipt.json']);
  });

  test('fails stale manifests after artifact bytes change', () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'receipt.json'), 'receipt\n');
    const outputPath = path.join(root, 'artifact-manifest.json');
    writeReceiptArtifactManifest({
      outputPath,
      artifact: 'hotm-tauri-command-core-receipt',
      roots: [root],
      now: new Date('2026-07-27T22:10:00Z'),
      env: {},
    });

    fs.writeFileSync(path.join(root, 'receipt.json'), 'changed bytes\n');
    const validation = verifyReceiptArtifactManifest(outputPath);

    expect(validation.status).toBe('failed');
    expect(validation.failures).toEqual(
      expect.arrayContaining([
        'byte count mismatch: ' + `${root}/receipt.json`,
        'sha256 mismatch: ' + `${root}/receipt.json`,
      ]),
    );
  });

  test('fails manifests that reference missing files', () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'receipt.json'), 'receipt\n');
    const outputPath = path.join(root, 'artifact-manifest.json');
    writeReceiptArtifactManifest({
      outputPath,
      artifact: 'hotm-tauri-command-core-receipt',
      roots: [root],
      now: new Date('2026-07-27T22:15:00Z'),
      env: {},
    });

    fs.rmSync(path.join(root, 'receipt.json'));
    const validation = verifyReceiptArtifactManifest(outputPath);

    expect(validation.status).toBe('failed');
    expect(validation.failures).toContain(`missing file: ${root}/receipt.json`);
  });
});
