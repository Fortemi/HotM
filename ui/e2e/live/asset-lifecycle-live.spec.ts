import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  assertAuthRequired,
  createTestNote,
  deleteLiveMemory,
  deleteNote,
  downloadAttachmentBytes,
  downloadAttachmentEvidence,
  ensureLiveMemory,
  exportFullV1Shard,
  getApiBaseUrl,
  getLiveApiToken,
  getLiveMemoryName,
  importFullV1Shard,
  listNoteAttachments,
} from '../fixtures/live-api-helpers';
import {
  createLiveAssetBrowserReceipt,
  timeReceipt,
  writeLiveAssetReceipt,
} from './asset-lifecycle-receipt';

const LIVE_ASSET_E2E = process.env.HOTM_LIVE_ASSET_E2E === '1';
const LIVE_REQUIRE_AUTH = ['1', 'true'].includes(
  process.env.HOTM_LIVE_REQUIRE_AUTH?.toLowerCase() ?? '',
);

test.describe('live asset lifecycle', () => {
  test.skip(!LIVE_ASSET_E2E, 'Set HOTM_LIVE_ASSET_E2E=1 and HOTM_API_URL to run live Fortemi browser-boundary asset tests.');
  test.setTimeout(120000);

  test('UI file upload, browser TUS resume, server-origin download, reupload, full-v1 export, and clean import preserve bytes', async ({ page }, testInfo) => {
    const apiBaseUrl = getApiBaseUrl();
    const liveMemory = getLiveMemoryName();
    if (!liveMemory) {
      throw new Error('HOTM_LIVE_MEMORY is required for enabled live-assets tests to avoid default archive pollution.');
    }
    const liveApiToken = getLiveApiToken();
    if (LIVE_REQUIRE_AUTH) {
      if (!liveApiToken) {
        throw new Error('HOTM_API_TOKEN or VITE_API_BEARER_TOKEN is required when HOTM_LIVE_REQUIRE_AUTH=1.');
      }
      await assertAuthRequired();
    }
    const recoveryMemory = `${liveMemory}_recovery`;
    await ensureLiveMemory();
    await ensureLiveMemory(recoveryMemory);
    const sourceNote = await createTestNote('HotM live asset source', 'HotM live asset source');
    const destinationNote = await createTestNote('HotM live asset destination', 'HotM live asset destination');
    const runSeed = Date.now() % 251;
    const bytes = deterministicBytes(192 * 1024, runSeed);
    const expectedSha256 = sha256Hex(bytes);
    const uiBytes = deterministicBytes(128 * 1024, runSeed + 29);
    const uiSha256 = sha256Hex(uiBytes);
    const uiFilename = `hotm-live-ui-${Date.now()}.bin`;
    const receipt = createLiveAssetBrowserReceipt({
      apiBaseUrl,
      liveMemory,
      recoveryMemory,
      liveApiToken,
      liveRequireAuth: LIVE_REQUIRE_AUTH,
      browserTusBytes: bytes.length,
      browserTusSha256: expectedSha256,
      uiUploadBytes: uiBytes.length,
      uiUploadSha256: uiSha256,
    });

    try {
      await page.addInitScript(
        ({ memory, token }) => {
          if (memory) window.localStorage.setItem('hotm_active_memory', memory);
          if (token) window.localStorage.setItem('hotm_api_bearer_token', token);
        },
        { memory: liveMemory, token: liveApiToken },
      );
      await page.goto('/');
      await page.evaluate(
        ({ memory, token }) => {
          if (memory) window.localStorage.setItem('hotm_active_memory', memory);
          if (token) window.localStorage.setItem('hotm_api_bearer_token', token);
        },
        { memory: liveMemory, token: liveApiToken },
      );
      await expect.poll(
        () => page.evaluate(() => ({
          memory: window.localStorage.getItem('hotm_active_memory'),
          tokenSet: Boolean(window.localStorage.getItem('hotm_api_bearer_token')),
        })),
      ).toEqual({ memory: liveMemory, tokenSet: Boolean(liveApiToken) });
      await page.reload();
      const browserNoteList = await page.evaluate(
        async ({ apiBaseUrl, memory }) => {
          const token = window.localStorage.getItem('hotm_api_bearer_token');
          const response = await fetch(`${apiBaseUrl}/notes?sort_by=created_at&sort_order=desc&limit=100&offset=0`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'X-Fortemi-Memory': memory,
            },
          });
          return {
            ok: response.ok,
            status: response.status,
            text: await response.text(),
          };
        },
        { apiBaseUrl, memory: liveMemory },
      );
      expect(browserNoteList.ok, browserNoteList.text).toBe(true);
      expect(JSON.parse(browserNoteList.text).notes.some((note: { id?: string }) => note.id === sourceNote.id)).toBe(true);
      await page.evaluate((memory) => {
        window.dispatchEvent(new CustomEvent('hotm-memory-changed', { detail: { memory } }));
      }, liveMemory);
      await page.getByRole('button', { name: sourceNoteTitle(sourceNote) }).first().waitFor({ timeout: 20000 });

      const uiAttachment = await timeReceipt(receipt, 'uiUploadMillis', () =>
        uploadViaAttachmentsPanel(
          page,
          testInfo,
          sourceNote.id,
          sourceNoteTitle(sourceNote),
          uiFilename,
          uiBytes,
          uiSha256,
        ),
      );
      const uiDownloaded = await timeReceipt(receipt, 'uiServerDownloadMillis', () =>
        downloadAttachmentBytes(uiAttachment.id),
      );
      expect(sha256Hex(uiDownloaded)).toBe(uiSha256);
      await timeReceipt(receipt, 'uiSavedFileDownloadMillis', () =>
        downloadAttachmentViaUiAndVerifyFile(
          page,
          testInfo,
          uiAttachment.id,
          uiFilename,
          uiSha256,
        ),
      );

      const firstAttachment = await timeReceipt(receipt, 'browserTusUploadMillis', () =>
        runBrowserTusRoundTrip(
          page,
          apiBaseUrl,
          liveMemory,
          liveApiToken,
          sourceNote.id,
          Array.from(bytes),
          'hotm-live-browser.bin',
        ),
      );
      expect(firstAttachment.sha256).toBe(expectedSha256);
      expect(firstAttachment.mismatchStatus).toBe(409);
      expect(firstAttachment.resumeOffset).toBeGreaterThan(0);
      expect(firstAttachment.finalOffset).toBe(bytes.length);
      receipt.tusResume = {
        mismatchStatus: firstAttachment.mismatchStatus,
        resumeOffset: firstAttachment.resumeOffset,
        finalOffset: firstAttachment.finalOffset,
      };
      receipt.claims.browserTusResumePassed = true;

      const disconnectedAttachment = await timeReceipt(receipt, 'browserTusDisconnectResumeMillis', () =>
        runBrowserTusDisconnectResumeRoundTrip(
          page,
          apiBaseUrl,
          liveMemory,
          liveApiToken,
          sourceNote.id,
          Array.from(bytes),
          'hotm-live-browser-disconnect-resume.bin',
        ),
      );
      expect(disconnectedAttachment.sha256).toBe(expectedSha256);
      expect(disconnectedAttachment.interruptedOffset).toBeGreaterThan(0);
      expect(disconnectedAttachment.resumeOffset).toBe(disconnectedAttachment.interruptedOffset);
      expect(disconnectedAttachment.finalOffset).toBe(bytes.length);
      const disconnectedDownloaded = await timeReceipt(receipt, 'browserTusDisconnectResumeDownloadMillis', () =>
        downloadAttachmentBytes(disconnectedAttachment.attachmentId),
      );
      expect(sha256Hex(disconnectedDownloaded)).toBe(expectedSha256);
      const disconnectedRecords = await listNoteAttachments(sourceNote.id);
      expect(
        disconnectedRecords.filter(
          (attachment) => attachment.filename === 'hotm-live-browser-disconnect-resume.bin',
        ),
      ).toEqual([
        expect.objectContaining({
          id: disconnectedAttachment.attachmentId,
          note_id: sourceNote.id,
        }),
      ]);
      receipt.tusDisconnectResume = {
        interruptedOffset: disconnectedAttachment.interruptedOffset,
        resumeOffset: disconnectedAttachment.resumeOffset,
        finalOffset: disconnectedAttachment.finalOffset,
        checkpoints: disconnectedAttachment.checkpoints,
      };
      receipt.claims.browserTusDisconnectResumePassed = true;
      receipt.claims.browserTusExactlyOneAttachmentPassed = true;

      const downloaded = await timeReceipt(receipt, 'browserDownloadMillis', () =>
        page.evaluate(
          async ({ apiBaseUrl, attachmentId, liveMemory }) => {
            const headers = {
              ...(liveMemory ? { 'X-Fortemi-Memory': liveMemory } : {}),
              ...(localStorage.getItem('hotm_api_bearer_token')
                ? { Authorization: `Bearer ${localStorage.getItem('hotm_api_bearer_token')}` }
                : {}),
            };
            const response = await fetch(`${apiBaseUrl}/attachments/${attachmentId}/download`, { headers });
            if (!response.ok) throw new Error(`download failed ${response.status}`);
            const array = new Uint8Array(await response.arrayBuffer());
            return Array.from(array);
          },
          { apiBaseUrl, attachmentId: firstAttachment.attachmentId, liveMemory },
        ),
      );
      expect(sha256Hex(Uint8Array.from(downloaded))).toBe(expectedSha256);

      const reuploaded = await timeReceipt(receipt, 'browserTusReuploadMillis', () =>
        runBrowserTusRoundTrip(
          page,
          apiBaseUrl,
          liveMemory,
          liveApiToken,
          destinationNote.id,
          downloaded,
          'hotm-live-browser-return.bin',
        ),
      );
      expect(reuploaded.sha256).toBe(expectedSha256);
      const sourceReturnAttachment = await pollForDownloadableAttachment(
        destinationNote.id,
        'hotm-live-browser-return.bin',
        expectedSha256,
      );
      expect(sourceReturnAttachment.id).toBe(reuploaded.attachmentId);
      const sourceReturnEvidence = await downloadAttachmentEvidence(sourceReturnAttachment.id);
      expect(sourceReturnEvidence.bytes).toHaveLength(bytes.length);
      expect(sha256Hex(sourceReturnEvidence.bytes)).toBe(expectedSha256);
      expect(sourceReturnEvidence.contentType).toBe('application/octet-stream');
      expect(sourceReturnEvidence.contentDisposition).toMatch(
        /^attachment; filename="attachment_filename_len_28_[0-9a-f-]{36}"$/,
      );

      const serverDownloaded = await timeReceipt(receipt, 'serverReturnDownloadMillis', () =>
        downloadAttachmentBytes(reuploaded.attachmentId),
      );
      expect(sha256Hex(serverDownloaded)).toBe(expectedSha256);
      receipt.claims.browserBoundaryBytesPreserved = true;

      const shard = await timeReceipt(receipt, 'fullV1ExportMillis', () => exportFullV1Shard());
      receipt.archiveBytes = shard.length;
      const entries = readTarEntries(maybeGunzip(shard));
      const manifestBytes = entries.get('manifest.json');
      expect(manifestBytes).toBeDefined();
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      expect(manifest.version).toBe('2.0.0');
      expect(manifest.profile).toBe('full-v1');
      expect(entries.has('signature.json')).toBe(true);
      expect([...entries.keys()].some((name) => /^blobs\/[0-9a-f]{64}$/.test(name))).toBe(true);

      const importResult = await timeReceipt(receipt, 'fullV1ImportMillis', () =>
        importFullV1Shard(shard, recoveryMemory),
      );
      expect(importResult.manifest).toBeDefined();
      const recoveredAttachment = await timeReceipt(receipt, 'recoveryPollMillis', () =>
        pollForDownloadableAttachment(
          sourceNote.id,
          'hotm-live-browser.bin',
          expectedSha256,
          recoveryMemory,
        ),
      );
      const recoveredBytes = await timeReceipt(receipt, 'recoveryDownloadMillis', () =>
        downloadAttachmentBytes(recoveredAttachment.id, recoveryMemory),
      );
      expect(sha256Hex(recoveredBytes)).toBe(expectedSha256);
      const recoveredReturnAttachment = await pollForDownloadableAttachment(
        destinationNote.id,
        'hotm-live-browser-return.bin',
        expectedSha256,
        recoveryMemory,
      );
      const recoveredReturnEvidence = await downloadAttachmentEvidence(
        recoveredReturnAttachment.id,
        recoveryMemory,
      );
      expect(normalizedAttachmentContract(recoveredReturnAttachment)).toEqual(
        normalizedAttachmentContract(sourceReturnAttachment),
      );
      expect(recoveredReturnEvidence.bytes).toHaveLength(sourceReturnEvidence.bytes.length);
      expect(sha256Hex(recoveredReturnEvidence.bytes)).toBe(expectedSha256);
      expect(recoveredReturnEvidence.contentType).toBe(sourceReturnEvidence.contentType);
      expect(recoveredReturnEvidence.contentDisposition).toBe(
        sourceReturnEvidence.contentDisposition,
      );
      receipt.claims.signedFullV1RecoveryPassed = true;
      receipt.claims.reuploadAndShardMetadataRelationshipsPassed = true;
      receipt.timingsMillis.fullV1RtoImportPollAndDownloadMillis =
        (receipt.timingsMillis.fullV1ImportMillis ?? 0) +
        (receipt.timingsMillis.recoveryPollMillis ?? 0) +
        (receipt.timingsMillis.recoveryDownloadMillis ?? 0);
      await writeLiveAssetReceipt(testInfo, receipt);
    } finally {
      await deleteNote(sourceNote.id).catch(() => false);
      await deleteNote(destinationNote.id).catch(() => false);
      await deleteLiveMemory(recoveryMemory).catch(() => false);
      await deleteLiveMemory(liveMemory).catch(() => false);
    }
  });
});

function deterministicBytes(len: number, seed = 17): Uint8Array {
  const bytes = new Uint8Array(len);
  for (let index = 0; index < len; index += 1) {
    bytes[index] = (index * 31 + Math.floor(index / 257) + seed) % 251;
  }
  return bytes;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function maybeGunzip(bytes: Uint8Array): Uint8Array {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return gunzipSync(bytes);
  }
  return bytes;
}

function readTarString(bytes: Uint8Array, start: number, len: number): string {
  const field = bytes.subarray(start, start + len);
  const end = field.indexOf(0);
  return new TextDecoder().decode(end === -1 ? field : field.subarray(0, end)).trim();
}

function readTarEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = readTarString(bytes, offset, 100);
    const prefix = readTarString(bytes, offset + 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const sizeText = readTarString(bytes, offset + 124, 12).replace(/\s/g, '');
    const size = Number.parseInt(sizeText, 8);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    entries.set(path, bytes.slice(contentStart, contentEnd));
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function runBrowserTusRoundTrip(
  page: Page,
  apiBaseUrl: string,
  liveMemory: string | null,
  liveApiToken: string | null,
  noteId: string,
  byteValues: number[],
  filename: string,
): Promise<{
  attachmentId: string;
  finalOffset: number;
  mismatchStatus: number;
  resumeOffset: number;
  sha256: string;
}> {
  return page.evaluate(
    async ({ apiBaseUrl, liveMemory, liveApiToken, noteId, byteValues, filename }) => {
      const bytes = Uint8Array.from(byteValues);
      const metadata = `filename ${btoa(filename)},content_type ${btoa('application/octet-stream')}`;
      const routingHeaders = liveMemory ? { 'X-Fortemi-Memory': liveMemory } : {};
      const authHeaders = liveApiToken ? { Authorization: `Bearer ${liveApiToken}` } : {};
      const create = await fetch(`${apiBaseUrl}/notes/${noteId}/attachments/tus`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(bytes.length),
          'Upload-Metadata': metadata,
        },
      });
      if (create.status !== 201) throw new Error(`TUS create failed ${create.status}: ${await create.text()}`);
      const location = create.headers.get('Location');
      if (!location) throw new Error('TUS create did not return Location');
      const uploadUrl = new URL(location, apiBaseUrl).toString();
      const split = Math.floor(bytes.length / 2);

      const first = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': '0',
        },
        body: bytes.slice(0, split),
      });
      if (first.status !== 204) throw new Error(`first PATCH failed ${first.status}: ${await first.text()}`);

      const mismatch = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': '0',
        },
        body: bytes.slice(split),
      });

      const head = await fetch(uploadUrl, {
        method: 'HEAD',
        headers: { ...authHeaders, ...routingHeaders, 'Tus-Resumable': '1.0.0' },
      });
      if (head.status !== 200) throw new Error(`HEAD failed ${head.status}`);
      const resumeOffset = Number(head.headers.get('Upload-Offset'));

      const final = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': String(resumeOffset),
        },
        body: bytes.slice(resumeOffset),
      });
      if (final.status !== 200) throw new Error(`final PATCH failed ${final.status}: ${await final.text()}`);
      const attachment = await final.json();

      const finalized = await fetch(uploadUrl, { headers: { ...authHeaders, ...routingHeaders } });
      if (finalized.status !== 200) throw new Error(`finalized GET failed ${finalized.status}: ${await finalized.text()}`);

      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');

      return {
        attachmentId: attachment.id as string,
        finalOffset: Number(final.headers.get('Upload-Offset')),
        mismatchStatus: mismatch.status,
        resumeOffset,
        sha256,
      };
    },
    { apiBaseUrl, liveMemory, liveApiToken, noteId, byteValues, filename },
  );
}

async function runBrowserTusDisconnectResumeRoundTrip(
  page: Page,
  apiBaseUrl: string,
  liveMemory: string | null,
  liveApiToken: string | null,
  noteId: string,
  byteValues: number[],
  filename: string,
): Promise<{
  attachmentId: string;
  finalOffset: number;
  interruptedOffset: number;
  resumeOffset: number;
  checkpoints: Array<{
    interruptedOffset: number;
    resumeOffset: number;
  }>;
  sha256: string;
}> {
  return page.evaluate(
    async ({ apiBaseUrl, liveMemory, liveApiToken, noteId, byteValues, filename }) => {
      const bytes = Uint8Array.from(byteValues);
      const metadata = `filename ${btoa(filename)},content_type ${btoa('application/octet-stream')}`;
      const routingHeaders = liveMemory ? { 'X-Fortemi-Memory': liveMemory } : {};
      const authHeaders = liveApiToken ? { Authorization: `Bearer ${liveApiToken}` } : {};
      const create = await fetch(`${apiBaseUrl}/notes/${noteId}/attachments/tus`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(bytes.length),
          'Upload-Metadata': metadata,
        },
      });
      if (create.status !== 201) throw new Error(`TUS create failed ${create.status}: ${await create.text()}`);
      const location = create.headers.get('Location');
      if (!location) throw new Error('TUS create did not return Location');
      const uploadUrl = new URL(location, apiBaseUrl).toString();
      const interruptedOffset = Math.floor(bytes.length / 3);
      const secondInterruptedOffset = Math.floor((bytes.length * 2) / 3);

      const partial = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': '0',
        },
        body: bytes.slice(0, interruptedOffset),
      });
      if (partial.status !== 204) throw new Error(`partial PATCH failed ${partial.status}: ${await partial.text()}`);

      const head = await fetch(uploadUrl, {
        method: 'HEAD',
        headers: { ...authHeaders, ...routingHeaders, 'Tus-Resumable': '1.0.0' },
      });
      if (head.status !== 200) throw new Error(`reconnect HEAD failed ${head.status}`);
      const resumeOffset = Number(head.headers.get('Upload-Offset'));

      const secondPartial = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': String(resumeOffset),
        },
        body: bytes.slice(resumeOffset, secondInterruptedOffset),
      });
      if (secondPartial.status !== 204) {
        throw new Error(`second partial PATCH failed ${secondPartial.status}: ${await secondPartial.text()}`);
      }

      const secondHead = await fetch(uploadUrl, {
        method: 'HEAD',
        headers: { ...authHeaders, ...routingHeaders, 'Tus-Resumable': '1.0.0' },
      });
      if (secondHead.status !== 200) throw new Error(`second reconnect HEAD failed ${secondHead.status}`);
      const secondResumeOffset = Number(secondHead.headers.get('Upload-Offset'));

      const final = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          ...routingHeaders,
          'Tus-Resumable': '1.0.0',
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': String(secondResumeOffset),
        },
        body: bytes.slice(secondResumeOffset),
      });
      if (final.status !== 200) throw new Error(`resumed PATCH failed ${final.status}: ${await final.text()}`);
      const attachment = await final.json();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');

      return {
        attachmentId: attachment.id as string,
        finalOffset: Number(final.headers.get('Upload-Offset')),
        interruptedOffset,
        resumeOffset,
        checkpoints: [
          { interruptedOffset, resumeOffset },
          {
            interruptedOffset: secondInterruptedOffset,
            resumeOffset: secondResumeOffset,
          },
        ],
        sha256,
      };
    },
    { apiBaseUrl, liveMemory, liveApiToken, noteId, byteValues, filename },
  );
}

function sourceNoteTitle(note: { [key: string]: unknown }): string {
  return typeof note.title === 'string' ? note.title : 'HotM live asset source';
}

async function uploadViaAttachmentsPanel(
  page: Page,
  testInfo: TestInfo,
  noteId: string,
  noteTitle: string,
  filename: string,
  bytes: Uint8Array,
  expectedSha256: string,
): Promise<{ id: string }> {
  const filePath = testInfo.outputPath(filename);
  writeFileSync(filePath, bytes);

  const noteButton = page.getByRole('button', { name: noteTitle }).first();
  await expect(noteButton).toBeVisible({ timeout: 20000 });
  await noteButton.evaluate((element) => (element as HTMLElement).click());
  await page.getByRole('tab', { name: /Attachments/ }).click();

  await page.locator('input[type="file"]').first().setInputFiles(filePath);
  await expect(page.getByTestId('upload-queued-flash')).toBeVisible({ timeout: 10000 });

  return pollForDownloadableAttachment(noteId, filename, expectedSha256);
}

async function downloadAttachmentViaUiAndVerifyFile(
  page: Page,
  testInfo: TestInfo,
  attachmentId: string,
  expectedFilename: string,
  expectedSha256: string,
): Promise<void> {
  const attachmentCard = page
    .locator(`[data-testid="attachment-card-${attachmentId}"], [data-testid="attachment-row-${attachmentId}"]`)
    .first();
  await expect(attachmentCard).toBeVisible({ timeout: 20000 });
  await attachmentCard.hover();
  await attachmentCard.locator('button').first().click();

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /^Download$/ }).click(),
  ]).then(([download]) => download);

  expect(download.suggestedFilename()).toBe(expectedFilename);
  const savedPath = testInfo.outputPath(`saved-${expectedFilename}`);
  await download.saveAs(savedPath);
  const savedBytes = readFileSync(savedPath);
  expect(sha256Hex(savedBytes)).toBe(expectedSha256);
}

async function pollForDownloadableAttachment(
  noteId: string,
  filename: string,
  expectedSha256: string,
  memoryName?: string | null,
): Promise<{ id: string; [key: string]: unknown }> {
  const deadline = Date.now() + 30000;
  let lastSeen = '';
  let lastDownloadError = '';

  while (Date.now() < deadline) {
    const attachments = await listNoteAttachments(noteId, memoryName);
    const match = attachments.find((attachment) => attachment.filename === filename || attachment.path === filename);
    if (match && typeof match.id === 'string') {
      try {
        const downloaded = await downloadAttachmentBytes(match.id, memoryName);
        if (sha256Hex(downloaded) === expectedSha256) {
          return { ...match, id: match.id };
        }
        lastDownloadError = `sha256 mismatch for ${match.id}`;
      } catch (error) {
        lastDownloadError = error instanceof Error ? error.message : String(error);
      }
    }
    lastSeen = attachments
      .map((attachment) => String(attachment.filename ?? attachment.path ?? attachment.id ?? 'unknown'))
      .join(', ');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for downloadable UI-uploaded attachment ${filename}; last attachments: ${lastSeen}; last download error: ${lastDownloadError}`,
  );
}

function normalizedAttachmentContract(attachment: Record<string, unknown>): Record<string, unknown> {
  return {
    id: attachment.id,
    noteId: attachment.note_id,
    blobId: attachment.blob_id,
    filename: attachment.filename,
    originalFilename: attachment.original_filename ?? null,
  };
}
