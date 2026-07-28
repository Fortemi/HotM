import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  REQUIRED_NOT_CLAIMED,
  REQUIRED_SCOPE,
  verifyTauriCommandCoreReceipt,
} = require('./verify-tauri-command-core-receipt.cjs');

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hotm-tauri-receipt-'));
  tempDirs.push(dir);
  return dir;
}

function validReceipt(overrides = {}) {
  return {
    receipt: 'hotm-tauri-local-file-command-core',
    issue: 'Fortemi/HotM#283',
    command: 'TAURI_CONFIG={"bundle":{"externalBin":[]}} cargo test local_file_ -- --nocapture && TAURI_CONFIG={"bundle":{"externalBin":[]}} cargo test native_ -- --nocapture',
    status: 'passed',
    exit_code: 0,
    started_at: '2026-07-27T21:00:00Z',
    finished_at: '2026-07-27T21:01:00Z',
    git: {
      repository: 'Fortemi/HotM',
      sha: 'a'.repeat(40),
      ref: 'refs/heads/main',
      run_id: '123',
    },
    scope: [...REQUIRED_SCOPE],
    not_claimed: [...REQUIRED_NOT_CLAIMED],
    ...overrides,
  };
}

function writeReceipt(receipt) {
  const dir = makeTempDir();
  const receiptPath = path.join(dir, 'receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receiptPath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('verifyTauriCommandCoreReceipt', () => {
  test('passes a complete command-core receipt', () => {
    const validation = verifyTauriCommandCoreReceipt(writeReceipt(validReceipt()));

    expect(validation.status).toBe('passed');
    expect(validation.failures).toEqual([]);
  });

  test('fails when cargo tests did not pass', () => {
    const validation = verifyTauriCommandCoreReceipt(
      writeReceipt(validReceipt({ status: 'failed', exit_code: 101 })),
    );

    expect(validation.status).toBe('failed');
    expect(validation.failures).toEqual(
      expect.arrayContaining(['status must be passed', 'exit_code must be 0']),
    );
  });

  test('fails when command-core scope is incomplete', () => {
    const validation = verifyTauriCommandCoreReceipt(
      writeReceipt(validReceipt({ scope: REQUIRED_SCOPE.filter((item) => item !== 'progress events') })),
    );

    expect(validation.status).toBe('failed');
    expect(validation.failures).toEqual(expect.arrayContaining(['scope missing: progress events']));
  });

  test('fails when native GUI and real-backend caveats are missing', () => {
    const validation = verifyTauriCommandCoreReceipt(
      writeReceipt(validReceipt({ not_claimed: ['Tauri desktop GUI launch'] })),
    );

    expect(validation.status).toBe('failed');
    expect(validation.failures).toEqual(
      expect.arrayContaining([
        'not_claimed missing: interactive native picker/save dialog operated in a launched GUI',
        'not_claimed missing: real Fortemi backend',
        'not_claimed missing: trusted publisher allowlist',
      ]),
    );
  });
});
