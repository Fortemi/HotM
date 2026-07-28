import { expect, test } from '@playwright/test';
import {
  createLiveAssetBrowserReceipt,
  validateCompletedLiveAssetBrowserReceipt,
  validateLiveAssetBrowserReceipt,
} from './asset-lifecycle-receipt';

test.describe('live asset metrics receipt schema', () => {
  test('keeps required fields and guarded claims stable without a live Fortemi API', () => {
    const receipt = createLiveAssetBrowserReceipt({
      apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
      liveMemory: 'hotm_live_schema_guard',
      recoveryMemory: 'hotm_live_schema_guard_recovery',
      liveApiToken: 'token-present',
      liveRequireAuth: true,
      browserTusBytes: 1024,
      browserTusSha256: 'a'.repeat(64),
      uiUploadBytes: 512,
      uiUploadSha256: 'b'.repeat(64),
    });
    receipt.timingsMillis.browserTusUploadMillis = 12;
    receipt.tusResume = {
      mismatchStatus: 409,
      resumeOffset: 256,
      finalOffset: 1024,
    };

    expect(validateLiveAssetBrowserReceipt(receipt)).toEqual([]);
    expect(receipt.schemaVersion).toBe('hotm.live-asset-browser-receipt.v1');
    expect(receipt.profile).toBe('2.0.0/full-v1');
    expect(receipt.authRequired).toBe(true);
    expect(receipt.bearerTokenSupplied).toBe(true);
    expect(receipt.claims.hotmDesktopGuiPassed).toBe(false);
    expect(receipt.claims.suiteWidePortability).toBe(false);
  });

  test('rejects broad portability or desktop GUI claims in browser metrics receipts', () => {
    const receipt = createLiveAssetBrowserReceipt({
      apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
      liveMemory: 'hotm_live_schema_guard',
      recoveryMemory: 'hotm_live_schema_guard_recovery',
      liveApiToken: null,
      liveRequireAuth: false,
      browserTusBytes: 1024,
      browserTusSha256: 'a'.repeat(64),
      uiUploadBytes: 512,
      uiUploadSha256: 'b'.repeat(64),
    });

    const invalid = {
      ...receipt,
      claims: {
        ...receipt.claims,
        hotmDesktopGuiPassed: true,
        suiteWidePortability: true,
      },
    };

    expect(validateLiveAssetBrowserReceipt(invalid)).toEqual([
      'hotmDesktopGuiPassed must remain false',
      'suiteWidePortability must remain false',
    ]);
  });

  test('requires enabled live-run claims, timings, archive size, and TUS resume evidence', () => {
    const receipt = createLiveAssetBrowserReceipt({
      apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
      liveMemory: 'hotm_live_schema_guard',
      recoveryMemory: 'hotm_live_schema_guard_recovery',
      liveApiToken: 'token-present',
      liveRequireAuth: true,
      browserTusBytes: 1024,
      browserTusSha256: 'a'.repeat(64),
      uiUploadBytes: 512,
      uiUploadSha256: 'b'.repeat(64),
    });

    expect(validateCompletedLiveAssetBrowserReceipt(receipt)).toEqual(
      expect.arrayContaining([
        'archiveBytes missing or invalid',
        'required timing uiUploadMillis missing or invalid',
        'tusResume mismatchStatus must be 409',
        'tusResume resumeOffset missing or invalid',
        'tusResume finalOffset must match browserTusBytes',
        'tusDisconnectResume interruptedOffset missing or invalid',
        'tusDisconnectResume resumeOffset missing or invalid',
        'tusDisconnectResume finalOffset must match browserTusBytes',
        'tusDisconnectResume must contain at least two increasing confirmed checkpoints',
        'claim browserBoundaryBytesPreserved must be true',
        'claim browserTusResumePassed must be true',
        'claim browserTusDisconnectResumePassed must be true',
        'claim signedFullV1RecoveryPassed must be true',
      ]),
    );

    receipt.archiveBytes = 4096;
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
      receipt.timingsMillis[key] = 1;
    }
    receipt.tusResume = {
      mismatchStatus: 409,
      resumeOffset: 512,
      finalOffset: 1024,
    };
    receipt.tusDisconnectResume = {
      interruptedOffset: 384,
      resumeOffset: 384,
      finalOffset: 1024,
      checkpoints: [
        { interruptedOffset: 384, resumeOffset: 384 },
        { interruptedOffset: 768, resumeOffset: 768 },
      ],
    };
    receipt.claims.browserBoundaryBytesPreserved = true;
    receipt.claims.browserTusResumePassed = true;
    receipt.claims.browserTusDisconnectResumePassed = true;
    receipt.claims.signedFullV1RecoveryPassed = true;

    expect(validateCompletedLiveAssetBrowserReceipt(receipt)).toEqual([]);
  });
});
