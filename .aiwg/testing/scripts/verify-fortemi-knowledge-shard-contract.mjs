#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PRODUCER_COMMIT = '2eb5c6b739b3bb6a042a35050a3ae89960dd3ed4';
const PRODUCER_PATH = 'tests/fixtures/shards/v1.0.0-minimal.json';
const EXPECTED_SHA256 = '4ed7e3b7d4845122653c95bcf2508a7f440cf067fe64ca493f0785519b9300f1';

const hotmRoot = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2] ?? resolve(hotmRoot, '../fortemi'));
const fixturePath = resolve(
  hotmRoot,
  'ui/src/api/contracts/fortemi-core-v1-manifest.json',
);

const localFixture = await readFile(fixturePath);
const producerFixture = execFileSync(
  'git',
  ['-C', fortemiRoot, 'show', `${PRODUCER_COMMIT}:${PRODUCER_PATH}`],
);
const localSha256 = createHash('sha256').update(localFixture).digest('hex');
const producerSha256 = createHash('sha256').update(producerFixture).digest('hex');

if (localSha256 !== EXPECTED_SHA256) {
  throw new Error(`HotM fixture checksum mismatch: ${localSha256} != ${EXPECTED_SHA256}`);
}
if (producerSha256 !== EXPECTED_SHA256) {
  throw new Error(`Fortemi fixture checksum mismatch: ${producerSha256} != ${EXPECTED_SHA256}`);
}
if (!localFixture.equals(producerFixture)) {
  throw new Error('HotM Knowledge Shard fixture differs from the pinned Fortemi fixture');
}

const manifest = JSON.parse(localFixture.toString('utf8'));
if (
  manifest.format !== 'matric-shard'
  || manifest.profile !== 'core-v1'
  || manifest.version !== '1.0.0'
  || manifest.min_reader_version !== '1.0.0'
) {
  throw new Error('Pinned Knowledge Shard fixture has an unexpected contract identity');
}

console.log(
  `Fortemi Knowledge Shard fixture verified at ${PRODUCER_COMMIT}: ${EXPECTED_SHA256}`,
);
