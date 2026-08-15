#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const require = createRequire(resolve(root, 'ui/package.json'));
const YAML = require('yaml');
const rollbackFiles = new Map();

function writeContractFile(path, contents) {
  if (!rollbackFiles.has(path)) {
    rollbackFiles.set(path, readFileSync(path));
  }
  writeFileSync(path, contents);
}

function rollback() {
  for (const [path, contents] of rollbackFiles) writeFileSync(path, contents);
}

function fail(message) {
  throw new Error(`refresh-fortemi-live-contracts: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!value || !['--fortemi-root', '--commit', '--sidecar-provenance'].includes(name)) {
      fail(
        'usage: refresh-fortemi-live-contracts.mjs '
          + '--fortemi-root <checkout> --commit <sha> --sidecar-provenance <json>',
      );
    }
    options[name.slice(2)] = value;
  }
  if (!/^[0-9a-f]{40}$/.test(options.commit ?? '')) fail('commit must be exact');
  return {
    fortemiRoot: resolve(options['fortemi-root']),
    commit: options.commit,
    sidecarProvenance: resolve(options['sidecar-provenance']),
  };
}

function gitShow(fortemiRoot, commit, path) {
  return execFileSync(
    'git',
    ['-C', fortemiRoot, 'show', `${commit}:${path}`],
    { maxBuffer: 8 * 1024 * 1024 },
  );
}

function eventTypes(source) {
  const start = source.indexOf('pub fn namespaced_event_type(&self)');
  const end = source.indexOf(
    '/// Returns the entity type this event relates to.',
    start,
  );
  if (start < 0 || end < 0) fail('could not locate the Fortemi event type catalog');
  const values = [
    ...source.slice(start, end).matchAll(/"([a-z_]+(?:\.[a-z_]+)+)"/g),
  ].map((match) => match[1]);
  if (values.length !== new Set(values).size) fail('event type catalog has duplicates');
  return values.sort();
}

function main() {
  const { fortemiRoot, commit, sidecarProvenance } = parseArgs(
    process.argv.slice(2),
  );
  const resolvedCommit = execFileSync(
    'git',
    ['-C', fortemiRoot, 'rev-parse', `${commit}^{commit}`],
    { encoding: 'utf8' },
  ).trim();
  if (resolvedCommit !== commit) fail('producer checkout cannot resolve the exact commit');

  const sidecar = JSON.parse(readFileSync(sidecarProvenance, 'utf8'));
  if (
    sidecar.source_repository !== 'Fortemi/fortemi'
    || sidecar.target_commitish !== commit
    || !sidecar.assets?.['x86_64-unknown-linux-gnu']
    || !sidecar.assets?.['aarch64-unknown-linux-gnu']
    || !sidecar.assets?.['aarch64-apple-darwin']
  ) {
    fail('sidecar provenance does not bind the required producer/platform assets');
  }
  for (const path of [
    'release/sidecar-provenance.json',
    'release/live-asset-receipt-sidecar-provenance.json',
  ]) {
    writeContractFile(resolve(root, path), `${JSON.stringify(sidecar, null, 2)}\n`);
  }

  const contractsRoot = resolve(root, 'ui/src/api/contracts');
  const openApiBytes = gitShow(
    fortemiRoot,
    commit,
    'contracts/openapi/openapi.yaml',
  );
  writeContractFile(resolve(contractsRoot, 'fortemi-openapi.yaml'), openApiBytes);
  const openApi = YAML.parse(openApiBytes.toString('utf8'));
  const previousOpenApiReceipt = JSON.parse(
    readFileSync(resolve(contractsRoot, 'fortemi-openapi-receipt.json'), 'utf8'),
  );
  const skew = JSON.parse(
    readFileSync(
      resolve(contractsRoot, 'fortemi-openapi-skew-fixtures.json'),
      'utf8',
    ),
  );
  const acceptedContractVersions = [
    ...new Set(
      skew.fixtures
        .filter((fixture) => fixture.expected === 'compatible')
        .map((fixture) => fixture.contractVersion),
    ),
  ];
  const inspection = JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve(root, '.aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs'),
        fortemiRoot,
        '--inspect',
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    ),
  );
  const contractRevision = openApi['x-fortemi-contract']?.contract_revision;
  const contractVersion = openApi.info?.version;
  writeContractFile(
    resolve(contractsRoot, 'fortemi-openapi-receipt.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      producer: {
        repository: 'Fortemi/fortemi',
        commit,
        path: 'contracts/openapi/openapi.yaml',
        sha256: sha256(openApiBytes),
        contractRevision,
        contractVersion,
      },
      consumer: {
        semanticProfile: previousOpenApiReceipt.consumer.semanticProfile,
        acceptedContractRevisions: [contractRevision],
        acceptedContractVersions,
        semanticSha256: inspection.semanticSha256,
      },
      statistics: inspection.statistics,
    }, null, 2)}\n`,
  );

  const eventsBytes = gitShow(
    fortemiRoot,
    commit,
    'crates/matric-core/src/events.rs',
  );
  const asyncSourceBytes = gitShow(
    fortemiRoot,
    commit,
    'crates/matric-core/src/asyncapi.rs',
  );
  const asyncArtifactBytes = gitShow(
    fortemiRoot,
    commit,
    'contracts/asyncapi/asyncapi.yaml',
  );
  const asyncDocument = YAML.parse(asyncArtifactBytes.toString('utf8'));
  const previousCatalog = JSON.parse(
    readFileSync(resolve(contractsRoot, 'fortemi-event-catalog.json'), 'utf8'),
  );
  writeContractFile(
    resolve(contractsRoot, 'fortemi-event-catalog.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      producer: {
        repository: 'Fortemi/fortemi',
        commit,
        sourcePath: 'crates/matric-core/src/events.rs',
        sourceSha256: sha256(eventsBytes),
        asyncApi: {
          sourcePath: 'crates/matric-core/src/asyncapi.rs',
          sourceSha256: sha256(asyncSourceBytes),
          artifactPath: 'contracts/asyncapi/asyncapi.yaml',
          format: 'yaml',
          asyncApiVersion: asyncDocument.asyncapi,
          generatorVersion: asyncDocument.info?.version,
          canonicalServerUrl: asyncDocument.servers?.production?.host,
          sha256: sha256(asyncArtifactBytes),
          sizeBytes: asyncArtifactBytes.byteLength,
        },
      },
      eventTypes: eventTypes(eventsBytes.toString('utf8')),
      defaultTypePrefixes: previousCatalog.defaultTypePrefixes,
    }, null, 2)}\n`,
  );

  const compatibilityReceiptPath = resolve(
    contractsRoot,
    'fortemi-system-compatibility-receipt.json',
  );
  const compatibilityReceipt = JSON.parse(
    readFileSync(compatibilityReceiptPath, 'utf8'),
  );
  const compatibilityProfileBytes = gitShow(
    fortemiRoot,
    commit,
    compatibilityReceipt.producer.profile.path,
  );
  const compatibilityResponseBytes = gitShow(
    fortemiRoot,
    commit,
    compatibilityReceipt.producer.responseSource.path,
  );
  compatibilityReceipt.producer.commit = commit;
  compatibilityReceipt.producer.profile.sha256 = sha256(compatibilityProfileBytes);
  compatibilityReceipt.producer.responseSource.sha256 = sha256(compatibilityResponseBytes);
  const compatibilityReceiptBytes = `${JSON.stringify(compatibilityReceipt, null, 2)}\n`;
  writeContractFile(compatibilityReceiptPath, compatibilityReceiptBytes);
  writeContractFile(
    resolve(root, 'agent-proxy/src/contracts/fortemi-system-compatibility-receipt.json'),
    compatibilityReceiptBytes,
  );

  const shardReceiptPath = resolve(
    contractsRoot,
    'fortemi-knowledge-shard-receipt.json',
  );
  const shardReceipt = JSON.parse(readFileSync(shardReceiptPath, 'utf8'));
  const coreContractBytes = gitShow(
    fortemiRoot,
    commit,
    shardReceipt.authority.contract.path,
  );
  const coreContract = JSON.parse(coreContractBytes.toString('utf8'));
  if (coreContract.contractRevision !== '19') {
    fail(`unsupported core-v1 contract revision ${coreContract.contractRevision}`);
  }
  shardReceipt.authority.commit = commit;
  shardReceipt.authority.contract.sha256 = sha256(coreContractBytes);
  shardReceipt.authority.contract.revision = coreContract.contractRevision;
  for (const input of shardReceipt.inputs) {
    const bytes = gitShow(fortemiRoot, commit, input.producerPath);
    input.sha256 = sha256(bytes);
    writeContractFile(resolve(root, input.localPath), bytes);
  }

  const fullContractBytes = gitShow(
    fortemiRoot,
    commit,
    shardReceipt.fullV1.authority.contract.path,
  );
  const fullContract = JSON.parse(fullContractBytes.toString('utf8'));
  if (
    fullContract.contractRevision !== '21'
    || fullContract.status !== 'receipt-bound-opt-in'
    || fullContract.profiles?.['full-v1']?.advertised !== true
    || fullContract.profiles?.['record-v1']?.advertised !== false
  ) {
    fail('Knowledge Shard authority is not the supported revision-21 opt-in contract');
  }
  const fullAuthority = shardReceipt.fullV1.authority;
  fullAuthority.commit = commit;
  fullAuthority.contract.sha256 = sha256(fullContractBytes);
  fullAuthority.contract.revision = fullContract.contractRevision;
  fullAuthority.contract.schemaBundleSha256 = fullContract.schemaBundle.sha256;
  fullAuthority.contract.fieldSemanticsSha256 =
    fullContract.schemaBundle.files['contracts/knowledge-shard/2.0.0/field-semantics.json'];
  fullAuthority.contract.fieldInventoryCount = fullContract.presenceSemantics.fieldCount;
  fullAuthority.manifestSchema.sha256 = sha256(gitShow(
    fortemiRoot,
    commit,
    fullAuthority.manifestSchema.path,
  ));
  fullAuthority.advertisementReceipt.sha256 = sha256(gitShow(
    fortemiRoot,
    commit,
    fullAuthority.advertisementReceipt.path,
  ));
  for (const evidence of [
    shardReceipt.fullV1.runtimeReceipt,
    shardReceipt.fullV1.pairedReceipt,
  ]) {
    evidence.commit = commit;
    evidence.sha256 = sha256(gitShow(fortemiRoot, commit, evidence.path));
  }
  writeContractFile(shardReceiptPath, `${JSON.stringify(shardReceipt, null, 2)}\n`);

  execFileSync(
    process.execPath,
    [resolve(root, '.aiwg/testing/scripts/verify-fortemi-knowledge-shard-contract.mjs'), fortemiRoot],
    { stdio: 'inherit' },
  );
  execFileSync(
    process.execPath,
    [resolve(root, '.aiwg/testing/scripts/verify-fortemi-system-compatibility-contract.mjs'), fortemiRoot],
    { stdio: 'inherit' },
  );
}

try {
  main();
} catch (error) {
  rollback();
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
