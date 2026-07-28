#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const {
  SUPPORTED_PLATFORMS,
  validateLiveAssetCiReceipt,
} = require('./verify-live-asset-ci-receipt.cjs');

const REQUIRED_PLATFORM_KEYS = Object.freeze(Object.keys(SUPPORTED_PLATFORMS));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function platformKey(receipt) {
  return [
    receipt?.execution?.os,
    receipt?.execution?.arch,
    receipt?.execution?.target,
  ].join('/');
}

function platformLabel(receipt) {
  return `${receipt?.execution?.os}-${receipt?.execution?.arch}`;
}

function distinctValues(receipts, read) {
  return new Set(receipts.map(read));
}

function validateLiveAssetCiReceiptPair(entries, options = {}) {
  const failures = [];
  const seen = new Map();
  for (const [index, entry] of entries.entries()) {
    const receipt = entry?.receipt ?? entry;
    const key = platformKey(receipt);
    for (const failure of validateLiveAssetCiReceipt(receipt, options)) {
      failures.push(`children[${index}] ${failure}`);
    }
    if (seen.has(key)) {
      failures.push(`duplicate platform receipt: ${key}`);
    } else {
      seen.set(key, receipt);
    }
  }

  for (const key of REQUIRED_PLATFORM_KEYS) {
    if (!seen.has(key)) failures.push(`missing required platform receipt: ${key}`);
  }
  for (const key of seen.keys()) {
    if (!REQUIRED_PLATFORM_KEYS.includes(key)) {
      failures.push(`unsupported platform receipt: ${key}`);
    }
  }
  if (entries.length !== REQUIRED_PLATFORM_KEYS.length) {
    failures.push(`exactly ${REQUIRED_PLATFORM_KEYS.length} platform receipts are required`);
  }

  const receipts = entries.map((entry) => entry?.receipt ?? entry);
  const identityFields = [
    ['HotM commit', (receipt) => receipt.identity?.hotmCommit],
    ['Fortemi commit', (receipt) => receipt.identity?.fortemiCommit],
    ['Fortemi health commit', (receipt) => receipt.identity?.fortemiHealthCommit],
    ['sidecar release', (receipt) => receipt.identity?.sidecarRelease],
    ['fixture identity', (receipt) => JSON.stringify(receipt.identity?.fixture)],
    ['profile', (receipt) => receipt.profile],
  ];
  for (const [label, read] of identityFields) {
    if (receipts.length > 0 && distinctValues(receipts, read).size !== 1) {
      failures.push(`${label} differs between platform receipts`);
    }
  }
  return failures;
}

function createLiveAssetCiReceiptPair(entries, options = {}) {
  const failures = validateLiveAssetCiReceiptPair(entries, options);
  const receipts = entries.map((entry) => entry?.receipt ?? entry);
  const first = receipts[0];
  const byKey = new Map(entries.map((entry) => [platformKey(entry?.receipt ?? entry), entry]));
  const childEntries = {};
  for (const key of REQUIRED_PLATFORM_KEYS) {
    const entry = byKey.get(key);
    const receipt = entry?.receipt ?? entry;
    const label = receipt ? platformLabel(receipt) : SUPPORTED_PLATFORMS[key].os;
    childEntries[label] = receipt
      ? {
          os: receipt.execution.os,
          arch: receipt.execution.arch,
          target: receipt.execution.target,
          desktopTarget: receipt.execution.desktopTarget,
          receiptSha256: entry?.sha256 ?? sha256(JSON.stringify(receipt)),
        }
      : null;
  }

  const passed = failures.length === 0;
  return {
    schemaVersion: 'hotm.live-asset-ci-receipt-pair.v1',
    issue: 'Fortemi/HotM#284',
    status: passed ? 'passed' : 'failed',
    requiredPlatforms: REQUIRED_PLATFORM_KEYS.map((key) => SUPPORTED_PLATFORMS[key]),
    identity: {
      hotmCommit: passed ? first.identity.hotmCommit : null,
      fortemiCommit: passed ? first.identity.fortemiCommit : null,
      sidecarRelease: passed ? first.identity.sidecarRelease : null,
      fixture: passed ? first.identity.fixture : null,
      profile: passed ? first.profile : null,
    },
    children: childEntries,
    claims: {
      exactLinuxDarwinPairPassed: passed,
      identicalConsumerAndAuthorityRevisionsPassed: passed,
      launchedDesktopGui: false,
      interactiveNativeDialogs: false,
      suiteWidePortability: false,
    },
    publication: {
      artifact: 'hotm-live-asset-ci-receipt-linux-darwin-pair',
      uploadPending: true,
    },
    notClaimed: [
      'launched Tauri GUI or interactive native dialogs',
      'desktop targets other than Linux x86_64 and Darwin arm64',
      'suite-wide portability or complete backup',
    ],
    failures,
  };
}

function readReceipt(receiptPath) {
  const bytes = fs.readFileSync(receiptPath);
  return {
    receipt: JSON.parse(bytes.toString('utf8')),
    sha256: sha256(bytes),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length > 3) {
    console.error(
      'usage: verify-live-asset-ci-receipt-pair.cjs <linux-receipt.json> '
        + '<darwin-receipt.json> [aggregate-receipt.json]',
    );
    process.exit(2);
  }

  let aggregate;
  try {
    aggregate = createLiveAssetCiReceiptPair(
      args.slice(0, 2).map(readReceipt),
      { expectClean: process.env.HOTM_LIVE_EXPECT_CLEAN !== '0' },
    );
    if (args[2]) {
      fs.writeFileSync(args[2], `${JSON.stringify(aggregate, null, 2)}\n`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  console.log(JSON.stringify(aggregate, null, 2));
  if (aggregate.failures.length > 0) process.exit(1);
}

module.exports = {
  REQUIRED_PLATFORM_KEYS,
  createLiveAssetCiReceiptPair,
  validateLiveAssetCiReceiptPair,
};
