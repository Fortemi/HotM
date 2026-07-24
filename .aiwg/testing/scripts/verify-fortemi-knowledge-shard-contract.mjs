#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const hotmRoot = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2] ?? resolve(hotmRoot, '../fortemi'));
const receiptPath = resolve(
  hotmRoot,
  'ui/src/api/contracts/fortemi-knowledge-shard-receipt.json',
);
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readProducerFile(path, commit = receipt.authority.commit) {
  return execFileSync(
    'git',
    ['-C', fortemiRoot, 'show', `${commit}:${path}`],
  );
}

const contract = readProducerFile(receipt.authority.contract.path);
if (sha256(contract) !== receipt.authority.contract.sha256) {
  throw new Error('Fortemi Knowledge Shard contract checksum mismatch');
}
const parsedContract = JSON.parse(contract.toString('utf8'));
if (
  parsedContract.contractRevision !== receipt.authority.contract.revision
  || parsedContract.knowledgeShard?.schemaVersion !== receipt.currentSchemaVersion
  || parsedContract.profiles?.[receipt.profile]?.supported !== true
) {
  throw new Error('Fortemi Knowledge Shard contract identity is unexpected');
}

for (const input of receipt.inputs) {
  const localFixture = await readFile(resolve(hotmRoot, input.localPath));
  const producerFixture = readProducerFile(input.producerPath);
  const localSha256 = sha256(localFixture);
  const producerSha256 = sha256(producerFixture);

  if (localSha256 !== input.sha256) {
    throw new Error(
      `HotM fixture checksum mismatch for ${input.localPath}: ${localSha256} != ${input.sha256}`,
    );
  }
  if (producerSha256 !== input.sha256) {
    throw new Error(
      `Fortemi fixture checksum mismatch for ${input.producerPath}: ${producerSha256} != ${input.sha256}`,
    );
  }
  if (!localFixture.equals(producerFixture)) {
    throw new Error(`HotM fixture differs from Fortemi authority: ${input.localPath}`);
  }
}

const manifestVersions = receipt.inputs
  .filter((input) => input.kind === 'manifest')
  .map((input) => input.version)
  .sort();
if (
  JSON.stringify(manifestVersions)
  !== JSON.stringify([...receipt.acceptedSchemaVersions].sort())
) {
  throw new Error('Pinned manifest versions do not match the accepted migration window');
}

const fullV1 = receipt.fullV1;
const fullContract = readProducerFile(
  fullV1.authority.contract.path,
  fullV1.authority.commit,
);
if (sha256(fullContract) !== fullV1.authority.contract.sha256) {
  throw new Error('Fortemi Knowledge Shard 2.0.0 contract checksum mismatch');
}
const parsedFullContract = JSON.parse(fullContract.toString('utf8'));
if (
  parsedFullContract.contractRevision !== fullV1.authority.contract.revision
  || parsedFullContract.knowledgeShard?.schemaVersion !== fullV1.tuple.schemaVersion
  || parsedFullContract.schemaBundle?.sha256
    !== fullV1.authority.contract.schemaBundleSha256
  || parsedFullContract.presenceSemantics?.fieldCount
    !== fullV1.authority.contract.fieldInventoryCount
  || parsedFullContract.schemaBundle?.files?.[
    'contracts/knowledge-shard/2.0.0/field-semantics.json'
  ] !== fullV1.authority.contract.fieldSemanticsSha256
) {
  throw new Error('Fortemi Knowledge Shard 2.0.0 authority identity is unexpected');
}

const fullManifestSchema = readProducerFile(
  fullV1.authority.manifestSchema.path,
  fullV1.authority.commit,
);
if (sha256(fullManifestSchema) !== fullV1.authority.manifestSchema.sha256) {
  throw new Error('Fortemi Knowledge Shard full-v1 manifest schema checksum mismatch');
}
const parsedFullManifest = JSON.parse(fullManifestSchema.toString('utf8'));
if (
  JSON.stringify(parsedFullManifest.properties?.components?.items?.enum)
    !== JSON.stringify(fullV1.components)
  || JSON.stringify(parsedFullManifest.$defs?.counts?.required)
    !== JSON.stringify(fullV1.countFields)
) {
  throw new Error('HotM full-v1 component/count inventory differs from Fortemi authority');
}

const runtimeReceiptBytes = readProducerFile(
  fullV1.runtimeReceipt.path,
  fullV1.runtimeReceipt.commit,
);
if (sha256(runtimeReceiptBytes) !== fullV1.runtimeReceipt.sha256) {
  throw new Error('Fortemi schema-2 runtime receipt checksum mismatch');
}
const runtimeReceipt = JSON.parse(runtimeReceiptBytes.toString('utf8'));
if (
  runtimeReceipt.status !== 'delivered-main-conformance-passed'
  || runtimeReceipt.implementation?.commit !== fullV1.runtimeReceipt.implementationCommit
  || runtimeReceipt.consumer?.zeroMutationOnFailure !== true
  || runtimeReceipt.consumer?.exactAttachmentBlobReexport !== true
) {
  throw new Error('Fortemi schema-2 runtime receipt is missing required recovery evidence');
}

const pairedReceiptBytes = readProducerFile(
  fullV1.pairedReceipt.path,
  fullV1.pairedReceipt.commit,
);
if (sha256(pairedReceiptBytes) !== fullV1.pairedReceipt.sha256) {
  throw new Error('Fortemi full-v1 paired receipt checksum mismatch');
}
const pairedReceipt = JSON.parse(pairedReceiptBytes.toString('utf8'));
const requiredCoverage = [
  'all-33-components',
  'all-34-count-fields',
  'attachment-bytes',
  'signatures',
  'tampered-input',
  'resource-limits',
  'repeated-imports',
  'zero-mutation-on-rejection',
];
if (
  pairedReceipt.status !== 'delivered-cross-repository-conformance-passed'
  || pairedReceipt.tuple?.schemaVersion !== fullV1.tuple.schemaVersion
  || pairedReceipt.tuple?.profile !== fullV1.tuple.profile
  || pairedReceipt.claims?.fullV1Interoperability !== true
  || pairedReceipt.claims?.suiteWide !== false
  || pairedReceipt.claims?.completeBackup !== false
  || requiredCoverage.some((item) => !pairedReceipt.coverage?.includes(item))
) {
  throw new Error('Fortemi full-v1 paired receipt is missing required scoped evidence');
}

console.log(
  `Fortemi Knowledge Shard ${receipt.profile} fixtures verified at ${receipt.authority.commit} `
  + `(revision ${receipt.authority.contract.revision}, schemas ${receipt.acceptedSchemaVersions.join(', ')}); `
  + `${fullV1.tuple.schemaVersion}/${fullV1.tuple.profile} authority and paired receipt verified `
  + `(revision ${fullV1.authority.contract.revision})`,
);
