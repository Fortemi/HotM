#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ? resolve(process.argv[2]) : resolve(scriptDir, '../..');
const imageWorkflowPath = resolve(root, '.gitea/workflows/publish-hotm-ui-image.yml');
const ciWorkflowPath = resolve(root, '.gitea/workflows/ui-ci.yml');
const desktopReleaseWorkflowPath = resolve(root, '.gitea/workflows/desktop-release.yml');
const publishDistWorkflowPath = resolve(root, '.gitea/workflows/publish-dist.yml');
const packageJsonPath = resolve(root, 'ui/package.json');
const calVer = /^[0-9]{4}\.(?:[1-9]|1[0-2])\.[0-9]+$/;

function workflowHeader(text) {
  return text.split('\njobs:', 1)[0];
}

function jobBlock(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start < 0) return '';
  let end = start + 1;
  while (end < lines.length && !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[end])) end += 1;
  return lines.slice(start, end).join('\n');
}

const failures = [];
let imageWorkflow;
let ciWorkflow;
let desktopReleaseWorkflow;
let publishDistWorkflow;
let declaredVersion;
try {
  imageWorkflow = readFileSync(imageWorkflowPath, 'utf8');
  ciWorkflow = readFileSync(ciWorkflowPath, 'utf8');
  desktopReleaseWorkflow = readFileSync(desktopReleaseWorkflowPath, 'utf8');
  publishDistWorkflow = readFileSync(publishDistWorkflowPath, 'utf8');
  declaredVersion = JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
} catch (error) {
  console.error(`container release policy check failed: ${error.message}`);
  process.exit(1);
}

const imageHeader = workflowHeader(imageWorkflow);
const imageJob = jobBlock(imageWorkflow, 'build-and-push');
if (/^\s+branches:\s*/m.test(imageHeader)) failures.push('publish-hotm-ui-image.yml must not have a branch trigger');
if (!imageHeader.includes("tags: ['v*']")) failures.push('publish-hotm-ui-image.yml must retain the v* release trigger');
if (!imageJob.includes("if: startsWith(github.ref, 'refs/tags/v')")) failures.push('HotM image publication must have a release-ref job guard');
if (imageJob.includes('mode=rolling') || imageJob.includes('sha-${') || imageJob.includes('SHORT_SHA')) {
  failures.push('HotM image publication must not emit rolling or commit tags');
}

for (const fragment of [
  '^v[0-9]{4}\\.([1-9]|1[0-2])\\.[0-9]+$',
  'VERSION="${GITHUB_REF_NAME#v}"',
  "DECLARED_VERSION=$(jq -er '.version' ui/package.json)",
  'if [ "${VERSION}" != "${DECLARED_VERSION}" ]; then',
]) {
  if (!imageJob.includes(fragment)) failures.push(`HotM image publication is missing CalVer control: ${fragment}`);
}

for (const tagSet of [
  'UI_TAGS="${GHCR_UI}:latest,${GHCR_UI}:${VERSION},${GITEA_UI}:latest,${GITEA_UI}:${VERSION}"',
  'BUNDLE_TAGS="${GHCR_BUNDLE}:latest,${GHCR_BUNDLE}:${VERSION},${GITEA_BUNDLE}:latest,${GITEA_BUNDLE}:${VERSION}"',
]) {
  if (!imageJob.includes(tagSet)) failures.push(`HotM image publication is missing symmetric release tags: ${tagSet}`);
}

if (!calVer.test(String(declaredVersion))) failures.push(`ui/package.json version is not YYYY.M.P CalVer: ${declaredVersion}`);
if (jobBlock(ciWorkflow, 'publish-dev')) failures.push('ui-ci.yml still defines retired branch container publication');

const proxyRelease = jobBlock(ciWorkflow, 'publish-release');
for (const fragment of [
  "github.event_name == 'create'",
  "startsWith(github.ref, 'refs/tags/v')",
  '^v[0-9]{4}\\.([1-9]|1[0-2])\\.[0-9]+$',
  "DECLARED_VERSION=$(jq -er '.version' ui/package.json)",
]) {
  if (!proxyRelease.includes(fragment)) failures.push(`agent-proxy release is missing release control: ${fragment}`);
}
if (proxyRelease.includes('sha-${') || proxyRelease.includes('SHORT_SHA')) failures.push('agent-proxy release must not emit commit tags');

const createRefGuard = "github.event_name != 'create' || startsWith(github.ref, 'refs/tags/v')";
for (const jobName of ['quality-gate', 'agent-proxy-quality-gate', 'mocked-playwright-ci']) {
  if (!jobBlock(ciWorkflow, jobName).includes(createRefGuard)) {
    failures.push(`ui-ci.yml ${jobName} must skip non-tag create events`);
  }
}

const desktopReleaseGuard = "github.event_name == 'workflow_dispatch' || startsWith(github.ref, 'refs/tags/v')";
if (!jobBlock(desktopReleaseWorkflow, 'verify-tag').includes(desktopReleaseGuard)) {
  failures.push('desktop-release.yml must skip non-tag create events');
}

const publishDistGuard = "github.event_name == 'workflow_dispatch' || github.event_name == 'push' || startsWith(github.ref, 'refs/tags/v')";
if (!jobBlock(publishDistWorkflow, 'publish-dist').includes(publishDistGuard)) {
  failures.push('publish-dist.yml must skip non-tag create events');
}

if (failures.length > 0) {
  console.error('HotM container release policy check failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('HotM container release policy check passed');
