#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyLiveAsyncApiAuthority } from './live-asyncapi-authority.mjs';

const root = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2] ?? resolve(root, '../fortemi'));
const json = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const result = verifyLiveAsyncApiAuthority({
  receipt: json('ui/src/api/contracts/fortemi-live-asyncapi-authority-receipt.json'),
  catalog: json('ui/src/api/contracts/fortemi-event-catalog.json'),
  fixture: json('ui/src/api/contracts/fortemi-asyncapi-event-fixtures.json'),
  rules: json('ui/src/api/contracts/fortemi-asyncapi-event-validation-rules.json'),
  readProducerFile: (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], {
    cwd: fortemiRoot, maxBuffer: 16 * 1024 * 1024,
  }),
});
console.log(JSON.stringify({ result: 'pass', ...result }, null, 2));
