#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const hotmRoot = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2] ?? resolve(hotmRoot, '../fortemi'));
const fixturePath = resolve(
  hotmRoot,
  'ui/src/api/contracts/fortemi-event-catalog.json',
);
const receiptPath = resolve(hotmRoot, 'release/sidecar-provenance.json');

const [fixtureText, receiptText] = await Promise.all([
  readFile(fixturePath, 'utf8'),
  readFile(receiptPath, 'utf8'),
]);
const fixture = JSON.parse(fixtureText);
const receipt = JSON.parse(receiptText);

if (fixture.producer.repository !== receipt.source_repository) {
  throw new Error(
    `producer repository mismatch: ${fixture.producer.repository} != ${receipt.source_repository}`,
  );
}
if (fixture.producer.commit !== receipt.target_commitish) {
  throw new Error(
    `producer commit mismatch: ${fixture.producer.commit} != ${receipt.target_commitish}`,
  );
}

const sourcePath = resolve(fortemiRoot, fixture.producer.sourcePath);
const asyncApiSourcePath = resolve(
  fortemiRoot,
  fixture.producer.asyncApi.sourcePath,
);
const [source, asyncApiSource] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(asyncApiSourcePath, 'utf8'),
]);
const sourceSha256 = createHash('sha256').update(source).digest('hex');
if (sourceSha256 !== fixture.producer.sourceSha256) {
  throw new Error(
    `producer source checksum mismatch: ${sourceSha256} != ${fixture.producer.sourceSha256}`,
  );
}
const asyncApiSourceSha256 = createHash('sha256')
  .update(asyncApiSource)
  .digest('hex');
if (asyncApiSourceSha256 !== fixture.producer.asyncApi.sourceSha256) {
  throw new Error(
    `producer AsyncAPI source checksum mismatch: ${asyncApiSourceSha256} != ${fixture.producer.asyncApi.sourceSha256}`,
  );
}
if (
  fixture.producer.asyncApi.asyncApiVersion !== '3.0.0'
  || fixture.producer.asyncApi.generatorVersion !== '2026.7.1'
) {
  throw new Error('unexpected pinned AsyncAPI generator version');
}

const methodStart = source.indexOf('pub fn namespaced_event_type(&self)');
const methodEnd = source.indexOf(
  '/// Returns the entity type this event relates to.',
  methodStart,
);
if (methodStart < 0 || methodEnd < 0) {
  throw new Error('could not locate ServerEvent::namespaced_event_type');
}

const eventTypes = [
  ...source
    .slice(methodStart, methodEnd)
    .matchAll(/"([a-z_]+(?:\.[a-z_]+)+)"/g),
].map((match) => match[1]).sort();
const expected = [...fixture.eventTypes].sort();

if (new Set(eventTypes).size !== eventTypes.length) {
  throw new Error('producer namespaced event catalog contains duplicates');
}
if (JSON.stringify(eventTypes) !== JSON.stringify(expected)) {
  const actualSet = new Set(eventTypes);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = eventTypes.filter((value) => !expectedSet.has(value));
  throw new Error(
    `event catalog drift: missing=[${missing.join(', ')}] unexpected=[${unexpected.join(', ')}]`,
  );
}

console.log(
  `Fortemi event catalog verified: ${eventTypes.length} events at ${fixture.producer.commit}; AsyncAPI ${fixture.producer.asyncApi.sha256}`,
);
