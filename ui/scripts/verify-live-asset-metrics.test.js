import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { verifyLiveAssetMetrics } = require('./verify-live-asset-metrics.cjs');

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hotm-live-metrics-'));
  tempDirs.push(dir);
  return dir;
}

function completeMetrics(overrides = {}) {
  return {
    schemaVersion: 'hotm.live-asset-browser-receipt.v1',
    issue: 'Fortemi/HotM#283',
    profile: '2.0.0/full-v1',
    apiUrl: 'http://127.0.0.1:3000/api/v1',
    memory: 'hotm_live_metrics_guard',
    recoveryMemory: 'hotm_live_metrics_guard_recovery',
    authRequired: true,
    bearerTokenSupplied: true,
    corpus: {
      browserTusBytes: 1024,
      browserTusSha256: 'a'.repeat(64),
      uiUploadBytes: 512,
      uiUploadSha256: 'b'.repeat(64),
    },
    archiveBytes: 4096,
    timingsMillis: Object.fromEntries([
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
    ].map((key) => [key, 1])),
    tusResume: {
      mismatchStatus: 409,
      resumeOffset: 512,
      finalOffset: 1024,
    },
    tusDisconnectResume: {
      interruptedOffset: 384,
      resumeOffset: 384,
      finalOffset: 1024,
    },
    claims: {
      browserBoundaryBytesPreserved: true,
      browserTusResumePassed: true,
      browserTusDisconnectResumePassed: true,
      signedFullV1RecoveryPassed: true,
      hotmDesktopGuiPassed: false,
      suiteWidePortability: false,
    },
    ...overrides,
  };
}

function writeMetrics(resultsDir, subdir, metrics) {
  const directory = path.join(resultsDir, subdir);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'hotm-live-asset-browser-metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('verifyLiveAssetMetrics', () => {
  test('passes exactly one completed live asset metrics artifact', () => {
    const root = makeTempDir();
    const resultsDir = path.join(root, 'test-results');
    const receiptDir = path.join(resultsDir, 'live-asset-receipt');
    writeMetrics(resultsDir, 'live-asset-lifecycle', completeMetrics());

    const validation = verifyLiveAssetMetrics({ resultsDir, receiptDir });

    expect(validation.status).toBe('passed');
    expect(validation.failures).toEqual([]);
    expect(validation.metrics_artifacts).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(receiptDir, 'metrics-validation.json'), 'utf8'))).toMatchObject({
      status: 'passed',
      failures: [],
    });
  });

  test('fails when the enabled run does not publish metrics', () => {
    const root = makeTempDir();
    const resultsDir = path.join(root, 'test-results');
    const receiptDir = path.join(resultsDir, 'live-asset-receipt');

    const validation = verifyLiveAssetMetrics({ resultsDir, receiptDir });

    expect(validation.status).toBe('failed');
    expect(validation.failures).toEqual(['expected exactly one hotm-live-asset-browser-metrics.json, found 0']);
  });

  test('fails duplicate metrics artifacts to avoid ambiguous CI evidence', () => {
    const root = makeTempDir();
    const resultsDir = path.join(root, 'test-results');
    const receiptDir = path.join(resultsDir, 'live-asset-receipt');
    writeMetrics(resultsDir, 'first', completeMetrics());
    writeMetrics(resultsDir, 'second', completeMetrics());

    const validation = verifyLiveAssetMetrics({ resultsDir, receiptDir });

    expect(validation.status).toBe('failed');
    expect(validation.failures).toEqual(['expected exactly one hotm-live-asset-browser-metrics.json, found 2']);
  });

  test('fails under-asserted metrics artifacts', () => {
    const root = makeTempDir();
    const resultsDir = path.join(root, 'test-results');
    const receiptDir = path.join(resultsDir, 'live-asset-receipt');
    const metrics = completeMetrics({
      archiveBytes: 0,
      timingsMillis: {},
      tusResume: {
        mismatchStatus: 204,
        resumeOffset: 0,
        finalOffset: 1023,
      },
      tusDisconnectResume: {
        interruptedOffset: 0,
        resumeOffset: 1,
        finalOffset: 1023,
      },
      claims: {
        browserBoundaryBytesPreserved: false,
        browserTusResumePassed: false,
        browserTusDisconnectResumePassed: false,
        signedFullV1RecoveryPassed: false,
        hotmDesktopGuiPassed: false,
        suiteWidePortability: false,
      },
    });
    writeMetrics(resultsDir, 'live-asset-lifecycle', metrics);

    const validation = verifyLiveAssetMetrics({ resultsDir, receiptDir });

    expect(validation.status).toBe('failed');
    expect(validation.failures).toEqual(
      expect.arrayContaining([
        'archiveBytes missing or invalid',
        'uiUploadMillis missing or invalid',
        'tusResume mismatchStatus must be 409',
        'tusResume resumeOffset missing or invalid',
        'tusResume finalOffset must match browserTusBytes',
        'tusDisconnectResume interruptedOffset missing or invalid',
        'tusDisconnectResume resumeOffset must match interruptedOffset',
        'tusDisconnectResume finalOffset must match browserTusBytes',
        'claim browserBoundaryBytesPreserved must be true',
        'claim browserTusResumePassed must be true',
        'claim browserTusDisconnectResumePassed must be true',
        'claim signedFullV1RecoveryPassed must be true',
      ]),
    );
  });
});
