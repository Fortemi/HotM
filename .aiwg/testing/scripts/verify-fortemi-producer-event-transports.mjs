#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { sha256 } from './producer-event-fixtures.mjs';

const root = resolve(import.meta.dirname, '../../..');
assert.equal(process.argv.length, 4, 'usage: transport-verifier <fortemi-root> <receipt-output>');
const sourceFiles = [
  'ui/src/api/events.ts', 'ui/src/services/realtimeEventBus.ts', 'ui/src/services/websocket.ts',
  'ui/src/api/__tests__/events.test.ts', 'ui/src/services/__tests__/realtimeEventBus.test.ts',
  'ui/src/services/__tests__/websocket-producer-fixtures.test.ts',
  'ui/src/api/contracts/fortemi-producer-event-fixture-pin.json', 'ui/src/api/contracts/fortemi-producer-event-fixtures.json',
  'ui/src/api/contracts/fortemi-event-catalog.json', 'ui/src/api/contracts/fortemi-asyncapi-event-fixtures.json',
  'ui/src/api/contracts/fortemi-asyncapi-event-validation-rules.json', 'ui/src/api/contracts/fortemi-live-asyncapi-authority-receipt.json',
  '.aiwg/testing/scripts/producer-event-fixtures.mjs', '.aiwg/testing/scripts/live-asyncapi-authority.mjs',
  '.aiwg/testing/scripts/verify-fortemi-producer-event-fixtures.mjs', '.aiwg/testing/scripts/verify-fortemi-producer-event-transports.mjs',
  'ui/package.json', 'ui/package-lock.json',
];
const identities = () => Object.fromEntries(sourceFiles.map((path) => [path, sha256(readFileSync(resolve(root, path)))]));
const sourceSha256 = identities();
const authority = JSON.parse(execFileSync(process.execPath, [resolve(root, '.aiwg/testing/scripts/verify-fortemi-producer-event-fixtures.mjs'), resolve(process.argv[2])], { encoding: 'utf8' }));
const fixture = JSON.parse(readFileSync(resolve(root, 'ui/src/api/contracts/fortemi-producer-event-fixtures.json')));
const temporary = mkdtempSync(resolve(tmpdir(), 'hotm-producer-events-'));
const output = resolve(process.argv[3]);
try {
  const reportPath = resolve(temporary, 'vitest.json');
  execFileSync(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run', 'src/api/__tests__/events.test.ts',
    'src/services/__tests__/realtimeEventBus.test.ts', 'src/services/__tests__/websocket-producer-fixtures.test.ts',
    '--reporter=json', `--outputFile=${reportPath}`,
  ], { cwd: resolve(root, 'ui'), stdio: 'inherit' });
  const reportBytes = readFileSync(reportPath);
  const report = JSON.parse(reportBytes);
  assert.equal(report.success, true, 'transport test run failed');
  assert.equal(report.numPendingTests, 0, 'transport test run skipped tests');
  assert.equal(report.numFailedTests, 0, 'transport tests failed');
  const assertions = report.testResults.flatMap((file) => file.assertionResults);
  const expected = {
    eventSource: (event) => `events client replay handling decodes producer '${event}' through EventSource`,
    fetchSse: (event) => `events client replay handling decodes producer '${event}' through fetch SSE framing`,
    websocketEnvelope: (event) => `producer fixtures over WebSocket: envelope decodes '${event}' through the production message handler`,
    websocketLegacyPayload: (event) => `producer fixtures over WebSocket: legacy payload decodes '${event}' through the production message handler`,
  };
  const transports = Object.fromEntries(Object.entries(expected).map(([transport, title]) => {
    const events = fixture.cases.map(({ eventType }) => {
      const matches = assertions.filter((result) => result.fullName === title(eventType));
      assert.equal(matches.length, 1, `missing/duplicate ${transport} ${eventType} test`);
      assert.equal(matches[0].status, 'passed', `${transport} ${eventType} did not pass`);
      return eventType;
    });
    return [transport, { passed: events.length, events }];
  }));
  assert.deepEqual(identities(), sourceSha256, 'sources changed while testing');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(`${output}.vitest.json`, reportBytes);
  const receipt = {
    schemaVersion: 1, result: 'pass', authority,
    consumerCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceSha256, catalogSha256: sourceSha256['ui/src/api/contracts/fortemi-event-catalog.json'],
    producerReceiptSha256: fixture.producer.receipt.sha256,
    producerManifestSha256: fixture.producer.manifestSha256,
    eventCount: fixture.eventCount, schemaCount: fixture.schemaCount,
    totalTests: report.numTotalTests, passedTests: report.numPassedTests, transports,
    testReport: { path: `${output}.vitest.json`, sha256: sha256(reportBytes) }, scope: fixture.scope,
  };
  writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ result: receipt.result, totalTests: receipt.totalTests, transports: Object.fromEntries(Object.entries(transports).map(([name, value]) => [name, value.passed])), receipt: output }, null, 2));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
