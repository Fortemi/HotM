import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receiptPath = 'contracts/asyncapi/producer-event-fixture-receipt.json';
const manifestPath = 'contracts/asyncapi/fixtures/manifest.json';
const corpusRoot = 'contracts/asyncapi/fixtures/events';
const algorithm = 'sha256(raw fixture file bytes concatenated in lexicographic path order)';

export function buildProducerEventFixtures({ pin, liveReceipt, catalog, rules, readProducerFile }) {
  assert.equal(pin.schemaVersion, 1, 'unsupported producer fixture pin');
  assert.equal(pin.authority.repository, 'Fortemi/fortemi', 'producer repository differs');
  const commit = pin.authority.commit;
  assert.match(commit, /^[a-f0-9]{40}$/, 'producer commit must be immutable');
  assert.equal(commit, liveReceipt.authority.commit, 'producer and live authority pins differ');
  assert.equal(pin.authority.receipt.path, receiptPath, 'producer receipt path differs');
  const receiptBytes = readProducerFile(commit, receiptPath);
  assert.equal(sha256(receiptBytes), pin.authority.receipt.sha256, 'producer receipt checksum differs');
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.schema_version, 'fortemi.asyncapi.event-fixture-receipt.v1');
  assert.equal(receipt.producer_repository, pin.authority.repository);
  assert.equal(receipt.producer_commit, 'external-delivery-pin');
  assert.equal(receipt.manifest_path, manifestPath, 'manifest path differs');
  assert.equal(receipt.corpus_root, corpusRoot, 'corpus root differs');
  assert.equal(receipt.asyncapi_path, liveReceipt.authority.artifact.path);
  assert.equal(receipt.asyncapi_sha256, liveReceipt.authority.artifact.sha256, 'AsyncAPI identity differs');
  assert.equal(receipt.consumer_pin.fortemi_commit, 'external-delivery-pin');
  assert.equal(receipt.consumer_pin.manifest_sha256, receipt.manifest_sha256);
  assert.equal(receipt.consumer_pin.corpus_sha256, receipt.corpus_sha256);
  const manifestBytes = readProducerFile(commit, manifestPath);
  assert.equal(sha256(manifestBytes), receipt.manifest_sha256, 'manifest checksum differs');
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schema_version, 'fortemi.asyncapi.event-fixtures.v1');
  assert.equal(manifest.producer_repository, pin.authority.repository);
  assert.equal(manifest.producer_commit, 'external-delivery-pin');
  assert.equal(manifest.asyncapi_path, receipt.asyncapi_path);
  assert.equal(manifest.asyncapi_sha256, receipt.asyncapi_sha256);
  assert.equal(manifest.envelope_contract_revision, '1', 'unsupported envelope revision');
  assert.equal(manifest.payload_revision, 1, 'unsupported payload revision');
  assert.equal(manifest.corpus.root, corpusRoot);
  assert.equal(manifest.corpus.aggregate_algorithm, algorithm, 'unsupported corpus digest algorithm');
  assert.equal(manifest.corpus.sha256, receipt.corpus_sha256);
  assert.equal(manifest.event_count, receipt.event_count);
  assert.equal(manifest.event_count, catalog.eventTypes.length, 'event count differs');
  assert.equal(manifest.fixtures.length, manifest.event_count, 'fixture count differs');
  assert.equal(manifest.schema_count, 4, 'schema count differs');
  assert.deepEqual(manifest.fixtures.map((item) => item.event_type).sort(), [...catalog.eventTypes].sort(), 'event inventory differs');
  assert.equal(new Set(manifest.fixtures.map((item) => item.path)).size, manifest.event_count, 'duplicate fixture path');
  assert.equal(new Set(manifest.fixtures.map((item) => item.variant_name)).size, manifest.event_count, 'duplicate payload variant');
  const ruleByEvent = new Map(rules.rules.map((rule) => [rule.eventType, rule]));
  const corpus = [];
  const cases = [...manifest.fixtures].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map((item) => {
    assert.match(item.path, /^contracts\/asyncapi\/fixtures\/events\/[a-z0-9_]+\.json$/, 'invalid fixture path');
    const rule = ruleByEvent.get(item.event_type);
    assert.ok(rule, 'missing consumer validation rule');
    assert.equal(item.variant_name, rule.legacyType, 'payload variant differs');
    assert.equal(item.payload_schema_component, `ServerEvent.oneOf[type=${item.variant_name}]`, 'payload schema selector differs');
    assert.equal(item.payload_revision, manifest.payload_revision);
    assert.equal(item.envelope_contract_revision, manifest.envelope_contract_revision);
    const bytes = readProducerFile(commit, item.path);
    assert.equal(sha256(bytes), item.sha256, `fixture checksum differs: ${item.path}`);
    corpus.push(bytes);
    const envelope = JSON.parse(bytes);
    assert.equal(envelope.event_type, item.event_type, 'envelope event name differs');
    assert.equal(envelope.payload.type, item.variant_name, 'envelope payload variant differs');
    assert.equal(envelope.payload_version, item.payload_revision, 'envelope payload revision differs');
    return { eventType: item.event_type, legacyType: item.variant_name, path: item.path, sha256: item.sha256, envelope };
  });
  assert.equal(sha256(Buffer.concat(corpus)), receipt.corpus_sha256, 'aggregate corpus checksum differs');
  return {
    schemaVersion: 1,
    fixtureSource: 'producer-owned Rust EventEnvelope; JSON values imported without semantic changes',
    producer: { ...pin.authority, manifestPath, manifestSha256: receipt.manifest_sha256, asyncApiSha256: receipt.asyncapi_sha256, corpusSha256: receipt.corpus_sha256 },
    eventCount: manifest.event_count,
    schemaCount: manifest.schema_count,
    envelopeContractRevision: manifest.envelope_contract_revision,
    payloadRevision: manifest.payload_revision,
    scope: 'Pinned producer examples through mocked SSE and WebSocket transport boundaries; no live execution, authentication, sidecar replacement, or suite-wide compatibility claim.',
    cases,
  };
}
