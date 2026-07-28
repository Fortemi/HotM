import { writeFileSync } from 'node:fs';
import type { TestInfo } from '@playwright/test';

export type LiveAssetBrowserReceipt = {
  schemaVersion: 'hotm.live-asset-browser-receipt.v1';
  issue: string;
  profile: '2.0.0/full-v1';
  apiUrl: string;
  memory: string;
  recoveryMemory: string;
  authRequired: boolean;
  bearerTokenSupplied: boolean;
  corpus: {
    fixtureId: 'hotm-live-assets-v1';
    browserTusBytes: number;
    browserTusSha256: string;
    uiUploadBytes: number;
    uiUploadSha256: string;
  };
  archiveBytes?: number;
  timingsMillis: Record<string, number>;
  tusResume: {
    mismatchStatus?: number;
    resumeOffset?: number;
    finalOffset?: number;
  };
  tusDisconnectResume: {
    interruptedOffset?: number;
    resumeOffset?: number;
    finalOffset?: number;
    checkpoints?: Array<{
      interruptedOffset: number;
      resumeOffset: number;
    }>;
  };
  claims: {
    browserBoundaryBytesPreserved: boolean;
    browserTusResumePassed: boolean;
    browserTusDisconnectResumePassed: boolean;
    browserTusExactlyOneAttachmentPassed: boolean;
    reuploadAndShardMetadataRelationshipsPassed: boolean;
    signedFullV1RecoveryPassed: boolean;
    productionShardConsumerPassed: boolean;
    hotmDesktopGuiPassed: false;
    suiteWidePortability: false;
  };
};

export function createLiveAssetBrowserReceipt(args: {
  apiBaseUrl: string;
  liveMemory: string;
  recoveryMemory: string;
  liveApiToken: string | null;
  liveRequireAuth: boolean;
  browserTusBytes: number;
  browserTusSha256: string;
  uiUploadBytes: number;
  uiUploadSha256: string;
}): LiveAssetBrowserReceipt {
  return {
    schemaVersion: 'hotm.live-asset-browser-receipt.v1',
    issue: 'Fortemi/HotM#283',
    profile: '2.0.0/full-v1',
    apiUrl: args.apiBaseUrl,
    memory: args.liveMemory,
    recoveryMemory: args.recoveryMemory,
    authRequired: args.liveRequireAuth,
    bearerTokenSupplied: Boolean(args.liveApiToken),
    corpus: {
      fixtureId: 'hotm-live-assets-v1',
      browserTusBytes: args.browserTusBytes,
      browserTusSha256: args.browserTusSha256,
      uiUploadBytes: args.uiUploadBytes,
      uiUploadSha256: args.uiUploadSha256,
    },
    timingsMillis: {},
    tusResume: {},
    tusDisconnectResume: {},
    claims: {
      browserBoundaryBytesPreserved: false,
      browserTusResumePassed: false,
      browserTusDisconnectResumePassed: false,
      browserTusExactlyOneAttachmentPassed: false,
      reuploadAndShardMetadataRelationshipsPassed: false,
      signedFullV1RecoveryPassed: false,
      productionShardConsumerPassed: false,
      hotmDesktopGuiPassed: false,
      suiteWidePortability: false,
    },
  };
}

export function validateLiveAssetBrowserReceipt(receipt: LiveAssetBrowserReceipt): string[] {
  const failures: string[] = [];
  if (receipt.schemaVersion !== 'hotm.live-asset-browser-receipt.v1') {
    failures.push('schemaVersion mismatch');
  }
  if (receipt.profile !== '2.0.0/full-v1') {
    failures.push('profile mismatch');
  }
  if (receipt.issue !== 'Fortemi/HotM#283') {
    failures.push('issue mismatch');
  }
  for (const key of ['apiUrl', 'memory', 'recoveryMemory'] as const) {
    if (!receipt[key]) failures.push(`${key} missing`);
  }
  for (const key of ['browserTusBytes', 'uiUploadBytes'] as const) {
    if (!Number.isInteger(receipt.corpus[key]) || receipt.corpus[key] <= 0) {
      failures.push(`corpus ${key} missing or invalid`);
    }
  }
  if (receipt.corpus.fixtureId !== 'hotm-live-assets-v1') {
    failures.push('corpus fixtureId mismatch');
  }
  for (const key of ['browserTusSha256', 'uiUploadSha256'] as const) {
    if (!/^[0-9a-f]{64}$/.test(receipt.corpus[key])) {
      failures.push(`corpus ${key} missing or invalid`);
    }
  }
  for (const [key, value] of Object.entries(receipt.timingsMillis)) {
    if (!Number.isInteger(value) || value < 0) failures.push(`timing ${key} invalid`);
  }
  for (const key of ['mismatchStatus', 'resumeOffset', 'finalOffset'] as const) {
    const value = receipt.tusResume[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      failures.push(`tusResume ${key} invalid`);
    }
  }
  for (const key of ['interruptedOffset', 'resumeOffset', 'finalOffset'] as const) {
    const value = receipt.tusDisconnectResume[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      failures.push(`tusDisconnectResume ${key} invalid`);
    }
  }
  if (receipt.tusDisconnectResume.checkpoints !== undefined) {
    if (!Array.isArray(receipt.tusDisconnectResume.checkpoints)) {
      failures.push('tusDisconnectResume checkpoints invalid');
    } else {
      for (const [index, checkpoint] of receipt.tusDisconnectResume.checkpoints.entries()) {
        if (
          !Number.isInteger(checkpoint.interruptedOffset)
          || checkpoint.interruptedOffset <= 0
          || checkpoint.resumeOffset !== checkpoint.interruptedOffset
        ) {
          failures.push(`tusDisconnectResume checkpoint ${index} invalid`);
        }
      }
    }
  }
  if (receipt.claims.hotmDesktopGuiPassed !== false) {
    failures.push('hotmDesktopGuiPassed must remain false');
  }
  if (receipt.claims.suiteWidePortability !== false) {
    failures.push('suiteWidePortability must remain false');
  }
  const serialized = JSON.stringify(receipt);
  if (
    /mm_at_[A-Za-z0-9_-]{16,}|\/tmp\/|\/home\/|storage_path|private_key|shard_base64|authorization["']?\s*:|"manifest"\s*:/i
      .test(serialized)
  ) {
    failures.push('receipt contains a credential, local/storage path, manifest body, or payload bytes');
  }
  return failures;
}

export function validateCompletedLiveAssetBrowserReceipt(receipt: LiveAssetBrowserReceipt): string[] {
  const failures = validateLiveAssetBrowserReceipt(receipt);
  const requiredTimings = [
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
  ];

  if (!Number.isInteger(receipt.archiveBytes) || receipt.archiveBytes <= 0) {
    failures.push('archiveBytes missing or invalid');
  }
  for (const key of requiredTimings) {
    const value = receipt.timingsMillis[key];
    if (!Number.isInteger(value) || value < 0) failures.push(`required timing ${key} missing or invalid`);
  }
  if (receipt.tusResume.mismatchStatus !== 409) {
    failures.push('tusResume mismatchStatus must be 409');
  }
  if (!Number.isInteger(receipt.tusResume.resumeOffset) || receipt.tusResume.resumeOffset <= 0) {
    failures.push('tusResume resumeOffset missing or invalid');
  }
  if (receipt.tusResume.finalOffset !== receipt.corpus.browserTusBytes) {
    failures.push('tusResume finalOffset must match browserTusBytes');
  }
  if (!Number.isInteger(receipt.tusDisconnectResume.interruptedOffset) || receipt.tusDisconnectResume.interruptedOffset <= 0) {
    failures.push('tusDisconnectResume interruptedOffset missing or invalid');
  }
  if (!Number.isInteger(receipt.tusDisconnectResume.resumeOffset) || receipt.tusDisconnectResume.resumeOffset <= 0) {
    failures.push('tusDisconnectResume resumeOffset missing or invalid');
  }
  if (receipt.tusDisconnectResume.resumeOffset !== receipt.tusDisconnectResume.interruptedOffset) {
    failures.push('tusDisconnectResume resumeOffset must match interruptedOffset');
  }
  if (receipt.tusDisconnectResume.finalOffset !== receipt.corpus.browserTusBytes) {
    failures.push('tusDisconnectResume finalOffset must match browserTusBytes');
  }
  const checkpoints = receipt.tusDisconnectResume.checkpoints;
  if (
    !Array.isArray(checkpoints)
    || checkpoints.length < 2
    || checkpoints.some((checkpoint, index) =>
      checkpoint.resumeOffset !== checkpoint.interruptedOffset
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
    'productionShardConsumerPassed',
  ] as const) {
    if (receipt.claims[key] !== true) failures.push(`claim ${key} must be true`);
  }

  return failures;
}

export async function timeReceipt<T>(
  receipt: LiveAssetBrowserReceipt,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    return await operation();
  } finally {
    receipt.timingsMillis[key] = Date.now() - started;
  }
}

export async function writeLiveAssetReceipt(
  testInfo: TestInfo,
  receipt: LiveAssetBrowserReceipt,
): Promise<void> {
  const failures = validateCompletedLiveAssetBrowserReceipt(receipt);
  if (failures.length > 0) {
    throw new Error(`HotM live asset browser metrics receipt is invalid: ${failures.join(', ')}`);
  }
  const receiptPath = testInfo.outputPath('hotm-live-asset-browser-metrics.json');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  await testInfo.attach('hotm-live-asset-browser-metrics', {
    path: receiptPath,
    contentType: 'application/json',
  });
}
