#!/usr/bin/env node

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../..');
const verifier = resolve(scriptDir, 'verify-container-release-policy.mjs');
const copiedFiles = [
  '.gitea/workflows/publish-hotm-ui-image.yml',
  '.gitea/workflows/ui-ci.yml',
  '.gitea/workflows/desktop-release.yml',
  '.gitea/workflows/publish-dist.yml',
  'ui/package.json',
];

function fixture() {
  const target = mkdtempSync(join(tmpdir(), 'hotm-release-policy-'));
  for (const relative of copiedFiles) {
    const destination = resolve(target, relative);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(root, relative), destination);
  }
  return target;
}

function runVerifier(target) {
  return spawnSync(process.execPath, [verifier, target], { cwd: root, encoding: 'utf8' });
}

function mutate(target, relative, oldText, newText) {
  const path = resolve(target, relative);
  const text = readFileSync(path, 'utf8');
  assert.ok(text.includes(oldText), `fixture is missing mutation target: ${oldText}`);
  writeFileSync(path, text.replace(oldText, newText));
}

function withFixture(callback) {
  const target = fixture();
  try {
    callback(target);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
}

test('current policy passes', () => withFixture((target) => {
  const result = runVerifier(target);
  assert.equal(result.status, 0, result.stderr);
}));

test('branch trigger fails closed', () => withFixture((target) => {
  mutate(target, '.gitea/workflows/publish-hotm-ui-image.yml', "  push:\n    tags: ['v*']", "  push:\n    branches: [main]\n    tags: ['v*']");
  const result = runVerifier(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not have a branch trigger/);
}));

test('bundle commit tag fails closed', () => withFixture((target) => {
  mutate(target, '.gitea/workflows/publish-hotm-ui-image.yml', '${GITEA_BUNDLE}:${VERSION}"', '${GITEA_BUNDLE}:sha-${GITHUB_SHA}"');
  const result = runVerifier(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rolling or commit tags/);
}));

test('non-CalVer package version fails closed', () => withFixture((target) => {
  mutate(target, 'ui/package.json', '"version": "2026.7.1"', '"version": "dev"');
  const result = runVerifier(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not YYYY\.M\.P CalVer/);
}));

test('retired proxy development publisher fails closed', () => withFixture((target) => {
  const path = resolve(target, '.gitea/workflows/ui-ci.yml');
  writeFileSync(path, `${readFileSync(path, 'utf8')}\n  publish-dev:\n    if: github.ref == 'refs/heads/main'\n    steps: []\n`);
  const result = runVerifier(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /retired branch container publication/);
}));

test('desktop release without a non-tag create guard fails closed', () => withFixture((target) => {
  mutate(
    target,
    '.gitea/workflows/desktop-release.yml',
    "    if: github.event_name == 'workflow_dispatch' || startsWith(github.ref, 'refs/tags/v')\n",
    '',
  );
  const result = runVerifier(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /desktop-release.yml must skip non-tag create events/);
}));

test('UI dist without a non-tag create guard fails closed', () => withFixture((target) => {
  mutate(
    target,
    '.gitea/workflows/publish-dist.yml',
    "    if: github.event_name == 'workflow_dispatch' || github.event_name == 'push' || startsWith(github.ref, 'refs/tags/v')\n",
    '',
  );
  const result = runVerifier(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /publish-dist.yml must skip non-tag create events/);
}));

test('quality CI without a non-tag create guard fails closed', () => withFixture((target) => {
  mutate(
    target,
    '.gitea/workflows/ui-ci.yml',
    "    if: github.event_name != 'create' || startsWith(github.ref, 'refs/tags/v')\n",
    '',
  );
  const result = runVerifier(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality-gate must skip non-tag create events/);
}));
