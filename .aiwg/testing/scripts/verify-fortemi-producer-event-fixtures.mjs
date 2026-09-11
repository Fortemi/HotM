#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildProducerEventFixtures, sha256 } from './producer-event-fixtures.mjs';
import { verifyLiveAsyncApiAuthority } from './live-asyncapi-authority.mjs';

const root = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2] ?? resolve(root, '../fortemi'));
assert.ok(process.argv.length <= 4 && (!process.argv[3] || process.argv[3] === '--write'), 'usage: verifier [fortemi-root] [--write]');
const json = (path) => JSON.parse(readFileSync(resolve(root, 'ui/src/api/contracts', path), 'utf8'));
const liveReceipt = json('fortemi-live-asyncapi-authority-receipt.json');
const catalog = json('fortemi-event-catalog.json');
const rules = json('fortemi-asyncapi-event-validation-rules.json');
const readProducerFile = (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], { cwd: fortemiRoot, maxBuffer: 16 * 1024 * 1024 });
const live = verifyLiveAsyncApiAuthority({ receipt: liveReceipt, catalog, rules, fixture: json('fortemi-asyncapi-event-fixtures.json'), readProducerFile });
const bundle = buildProducerEventFixtures({ pin: json('fortemi-producer-event-fixture-pin.json'), liveReceipt, catalog, rules, readProducerFile });
const target = resolve(root, 'ui/src/api/contracts/fortemi-producer-event-fixtures.json');
const bytes = JSON.stringify(bundle, null, 2) + '\n';
if (process.argv[3] === '--write') writeFileSync(target, bytes);
else assert.equal(readFileSync(target, 'utf8'), bytes, 'imported producer fixtures drifted; regenerate explicitly with --write');
console.log(JSON.stringify({ result: 'pass', producerCommit: live.liveCommit, packagedCommit: live.packagedCommit, eventCount: bundle.eventCount, schemaCount: bundle.schemaCount, corpusSha256: bundle.producer.corpusSha256, importedFixtureSha256: sha256(bytes), scope: bundle.scope }, null, 2));
