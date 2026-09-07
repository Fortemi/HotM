import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { parse } = createRequire(resolve(import.meta.dirname, '../../../ui/package.json'))('yaml');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

// Only informational metadata is excluded. Channels, schemas, operations,
// servers, protocol versions and future top-level fields must remain equal.
function wireDocument(document) {
  const { info, ...wire } = document;
  return JSON.stringify(stable(wire));
}

export function verifyLiveAsyncApiAuthority({ receipt, catalog, fixture, rules, readProducerFile }) {
  if (receipt.schemaVersion !== 1 || receipt.authority.repository !== 'Fortemi/fortemi') {
    throw new Error('unsupported live AsyncAPI authority receipt');
  }
  if (!/^[a-f0-9]{40}$/.test(receipt.authority.commit)) throw new Error('live authority commit must be immutable');
  if (receipt.packagedBaseline.commit !== catalog.producer.commit) throw new Error('packaged baseline commit differs');
  if (fixture.producer.commit !== catalog.producer.commit || rules.producer.commit !== catalog.producer.commit) {
    throw new Error('packaged fixture/rules producer differs from the catalog');
  }
  const artifact = receipt.authority.artifact;
  const liveBytes = readProducerFile(receipt.authority.commit, artifact.path);
  if (sha256(liveBytes) !== artifact.sha256 || liveBytes.length !== artifact.sizeBytes) {
    throw new Error('live AsyncAPI artifact checksum or byte length differs');
  }
  for (const source of receipt.authority.sources) {
    if (sha256(readProducerFile(receipt.authority.commit, source.path)) !== source.sha256) {
      throw new Error(`live source checksum differs: ${source.path}`);
    }
  }
  const baseline = catalog.producer.asyncApi;
  const baselineBytes = readProducerFile(catalog.producer.commit, baseline.artifactPath);
  if (sha256(baselineBytes) !== baseline.sha256 || baselineBytes.length !== baseline.sizeBytes) {
    throw new Error('packaged AsyncAPI artifact checksum or byte length differs');
  }
  const live = parse(liveBytes.toString('utf8'));
  const packaged = parse(baselineBytes.toString('utf8'));
  if (live.info?.version !== artifact.generatorVersion || live.asyncapi !== baseline.asyncApiVersion) {
    throw new Error('live AsyncAPI version metadata differs');
  }
  if (wireDocument(live) !== wireDocument(packaged)) {
    throw new Error('live AsyncAPI wire contract differs from packaged validated fixtures');
  }
  const events = Object.values(live.channels?.events?.messages ?? {}).map((message) => message['x-event-type']).sort();
  if (JSON.stringify(events) !== JSON.stringify([...catalog.eventTypes].sort())) throw new Error('live event inventory differs');
  if (fixture.cases.length !== events.length || rules.rules.length !== events.length) throw new Error('packaged positive fixture/rule coverage differs');
  return {
    liveCommit: receipt.authority.commit,
    packagedCommit: catalog.producer.commit,
    artifactSha256: artifact.sha256,
    generatorVersion: artifact.generatorVersion,
    eventCount: events.length,
    wireDocumentSha256: sha256(wireDocument(live)),
    scope: 'Exact live source/document pin and wire equivalence to separately validated packaged fixtures; no sidecar replacement or live transport execution claim.',
  };
}
