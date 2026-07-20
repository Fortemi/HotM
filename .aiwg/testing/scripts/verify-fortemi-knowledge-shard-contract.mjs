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

function readProducerFile(path) {
  return execFileSync(
    'git',
    ['-C', fortemiRoot, 'show', `${receipt.authority.commit}:${path}`],
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

console.log(
  `Fortemi Knowledge Shard ${receipt.profile} fixtures verified at ${receipt.authority.commit} `
  + `(revision ${receipt.authority.contract.revision}, schemas ${receipt.acceptedSchemaVersions.join(', ')})`,
);
