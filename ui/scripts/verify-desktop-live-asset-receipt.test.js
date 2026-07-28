import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  DEFAULT_RECEIPT_PATH,
  verifyDesktopLiveAssetReceipt,
} = require('./verify-desktop-live-asset-receipt.cjs');

const tempDirs = [];

function receipt(overrides = {}) {
  const valid = JSON.parse(fs.readFileSync(DEFAULT_RECEIPT_PATH, 'utf8'));
  return { ...valid, ...overrides };
}

function writeReceipt(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hotm-desktop-live-receipt-'));
  tempDirs.push(dir);
  const receiptPath = path.join(dir, 'receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(value, null, 2)}\n`);
  return receiptPath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('verifyDesktopLiveAssetReceipt', () => {
  test('passes the checked-in launched desktop receipt', () => {
    const validation = verifyDesktopLiveAssetReceipt();
    expect(validation.status).toBe('passed');
    expect(validation.failures).toEqual([]);
  });

  test('rejects byte or digest drift', () => {
    const invalid = receipt({
      destination: {
        ...receipt().destination,
        bytes: 12,
        sha256: 'f'.repeat(64),
      },
    });
    const validation = verifyDesktopLiveAssetReceipt(writeReceipt(invalid));
    expect(validation.failures).toEqual(
      expect.arrayContaining([
        'source/server/destination byte counts differ',
        'source and destination SHA-256 differ',
      ]),
    );
  });

  test('rejects an unearned portability or immutable-CI claim', () => {
    const base = receipt();
    const invalid = {
      ...base,
      claims: {
        ...base.claims,
        immutableCiGuiReceiptPassed: true,
        suiteWidePortability: true,
      },
    };
    const validation = verifyDesktopLiveAssetReceipt(writeReceipt(invalid));
    expect(validation.failures).toEqual(
      expect.arrayContaining([
        'claim immutableCiGuiReceiptPassed must be false',
        'claim suiteWidePortability must be false',
      ]),
    );
  });

  test('rejects local paths in evidence', () => {
    const invalid = receipt({
      interactions: {
        ...receipt().interactions,
        verification: 'read /tmp/private-file',
      },
    });
    const validation = verifyDesktopLiveAssetReceipt(writeReceipt(invalid));
    expect(validation.failures).toContain(
      'receipt contains a local path, storage path, or credential-shaped text',
    );
  });
});
