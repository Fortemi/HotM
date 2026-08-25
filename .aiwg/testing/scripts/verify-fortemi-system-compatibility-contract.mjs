#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const hotmRoot = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2] ?? resolve(hotmRoot, '../fortemi'));
const uiReceiptPath = resolve(hotmRoot, 'ui/src/api/contracts/fortemi-system-compatibility-receipt.json');
const proxyReceiptPath = resolve(hotmRoot, 'agent-proxy/src/contracts/fortemi-system-compatibility-receipt.json');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function producerFile(commit, path) {
  return execFileSync('git', ['show', `${commit}:${path}`], {
    cwd: fortemiRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

const [uiReceiptText, proxyReceiptText] = await Promise.all([
  readFile(uiReceiptPath, 'utf8'),
  readFile(proxyReceiptPath, 'utf8'),
]);
if (uiReceiptText !== proxyReceiptText) {
  throw new Error('UI and agent-proxy compatibility receipts differ');
}

const receipt = JSON.parse(uiReceiptText);
const profileSource = producerFile(receipt.producer.commit, receipt.producer.profile.path);
const responseSource = producerFile(receipt.producer.commit, receipt.producer.responseSource.path);
if (sha256(profileSource) !== receipt.producer.profile.sha256) {
  throw new Error('pinned Fortemi compatibility profile checksum mismatch');
}
if (sha256(responseSource) !== receipt.producer.responseSource.sha256) {
  throw new Error('pinned Fortemi compatibility response source checksum mismatch');
}

const profile = JSON.parse(profileSource);
if (profile.schema_version !== receipt.consumer.compatibilitySchemaVersion) {
  throw new Error('compatibility schema version differs from the pinned producer profile');
}
if (!receipt.consumer.acceptedContractRevisions.includes(profile.authority?.server_compatibility_revision)) {
  throw new Error('compatibility revision differs from the pinned producer profile');
}

function exactAcceptedValue(values, label) {
  if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') {
    throw new Error(`${label} must contain exactly one accepted string`);
  }
  return values[0];
}

const claimContractVersion = exactAcceptedValue(
  receipt.consumer.acceptedAuthClaimContractVersions,
  'acceptedAuthClaimContractVersions',
);
const claimContractProfile = exactAcceptedValue(
  receipt.consumer.acceptedAuthClaimContractProfiles,
  'acceptedAuthClaimContractProfiles',
);
const authorityRelease = exactAcceptedValue(
  receipt.consumer.acceptedAuthAuthorityReleases,
  'acceptedAuthAuthorityReleases',
);

const requiredSourceFragments = [
  'struct CompatibilityResponse',
  `schema_version: ${receipt.consumer.compatibilitySchemaVersion}`,
  `contract_revision: "${profile.authority.server_compatibility_revision}"`,
  'minimum_hotm_enterprise_client',
  'auth: CompatibilityAuth',
  `claim_contract_version: inputs.multi_tenant.then_some("${claimContractVersion}")`,
  `claim_contract_profile: inputs.multi_tenant.then_some("${claimContractProfile}")`,
  `authority_release: inputs.multi_tenant.then_some("${authorityRelease}")`,
];
for (const fragment of requiredSourceFragments) {
  if (!responseSource.includes(fragment)) {
    throw new Error(`pinned compatibility response source is missing: ${fragment}`);
  }
}

console.log(
  `Fortemi compatibility profile verified at ${receipt.producer.commit}: schema ${profile.schema_version}, revision ${profile.authority.server_compatibility_revision}`,
);
