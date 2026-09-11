import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProducerEventFixtures, sha256 } from './producer-event-fixtures.mjs';

function sample() {
  const commit = 'a'.repeat(40);
  const receiptPath = 'contracts/asyncapi/producer-event-fixture-receipt.json';
  const manifestPath = 'contracts/asyncapi/fixtures/manifest.json';
  const root = 'contracts/asyncapi/fixtures/events';
  const artifact = { path: 'contracts/asyncapi/asyncapi.yaml', sha256: 'b'.repeat(64) };
  const envelope = { event_type: 'note.updated', payload_version: 1, payload: { type: 'NoteUpdated' } };
  const bytes = (value) => Buffer.from(JSON.stringify(value) + '\n');
  const fixtureBytes = bytes(envelope);
  const manifest = {
    schema_version: 'fortemi.asyncapi.event-fixtures.v1', producer_repository: 'Fortemi/fortemi', producer_commit: 'external-delivery-pin',
    asyncapi_path: artifact.path, asyncapi_sha256: artifact.sha256, envelope_contract_revision: '1', payload_revision: 1,
    event_count: 1, schema_count: 4, corpus: { root, aggregate_algorithm: 'sha256(raw fixture file bytes concatenated in lexicographic path order)', sha256: sha256(fixtureBytes) },
    fixtures: [{ event_type: 'note.updated', variant_name: 'NoteUpdated', path: `${root}/note_updated.json`, payload_schema_component: 'ServerEvent.oneOf[type=NoteUpdated]', payload_revision: 1, envelope_contract_revision: '1', sha256: sha256(fixtureBytes) }],
  };
  const receipt = {
    schema_version: 'fortemi.asyncapi.event-fixture-receipt.v1', producer_repository: 'Fortemi/fortemi', producer_commit: 'external-delivery-pin',
    manifest_path: manifestPath, manifest_sha256: sha256(bytes(manifest)), asyncapi_path: artifact.path, asyncapi_sha256: artifact.sha256,
    corpus_root: root, corpus_sha256: manifest.corpus.sha256, event_count: 1,
    consumer_pin: { fortemi_commit: 'external-delivery-pin', manifest_sha256: sha256(bytes(manifest)), corpus_sha256: manifest.corpus.sha256 },
  };
  const files = new Map([[receiptPath, bytes(receipt)], [manifestPath, bytes(manifest)], [manifest.fixtures[0].path, fixtureBytes]]);
  const pin = { schemaVersion: 1, authority: { repository: 'Fortemi/fortemi', commit, receipt: { path: receiptPath, sha256: sha256(bytes(receipt)) } } };
  const input = { pin, liveReceipt: { authority: { commit, artifact } }, catalog: { eventTypes: ['note.updated'] }, rules: { rules: [{ eventType: 'note.updated', legacyType: 'NoteUpdated' }] }, readProducerFile(readCommit, path) { assert.equal(readCommit, commit); assert.ok(files.has(path), `unexpected source read: ${path}`); return files.get(path); } };
  // Rebind the outer digests so semantic drift tests cannot pass by failing only a checksum.
  const rebindManifest = () => {
    files.set(manifestPath, bytes(manifest));
    receipt.manifest_sha256 = sha256(files.get(manifestPath));
    receipt.consumer_pin.manifest_sha256 = receipt.manifest_sha256;
    files.set(receiptPath, bytes(receipt));
    pin.authority.receipt.sha256 = sha256(files.get(receiptPath));
  };
  return { input, files, manifest, receipt, rebindManifest };
}

test('imports producer envelope values and binds all source identities deterministically', () => {
  const { input } = sample();
  const first = buildProducerEventFixtures(input);
  assert.deepEqual(buildProducerEventFixtures(input), first);
  assert.equal(first.eventCount, 1);
  assert.equal(first.cases[0].envelope.payload.type, 'NoteUpdated');
});
for (const [name, mutate, pattern] of [
  ['moving pin', ({ input }) => { input.pin.authority.commit = 'main'; }, /immutable/],
  ['independent live pin mismatch', ({ input }) => { input.liveReceipt.authority.commit = 'c'.repeat(40); }, /pins differ/],
  ['receipt byte drift', ({ input }) => { input.pin.authority.receipt.sha256 = '0'.repeat(64); }, /receipt checksum/],
  ['manifest byte drift', ({ files }) => { files.set('contracts/asyncapi/fixtures/manifest.json', Buffer.from('{}')); }, /manifest checksum/],
  ['fixture byte drift', ({ files, manifest }) => { files.set(manifest.fixtures[0].path, Buffer.from('{}')); }, /fixture checksum/],
  ['AsyncAPI mismatch', ({ input }) => { input.liveReceipt.authority.artifact.sha256 = '0'.repeat(64); }, /AsyncAPI identity/],
  ['unrecognized envelope revision', ({ manifest, rebindManifest }) => { manifest.envelope_contract_revision = '2'; rebindManifest(); }, /envelope revision/],
  ['unrecognized payload revision', ({ manifest, rebindManifest }) => { manifest.payload_revision = 2; rebindManifest(); }, /payload revision/],
  ['schema count drift', ({ manifest, rebindManifest }) => { manifest.schema_count = 5; rebindManifest(); }, /schema count/],
  ['missing fixture', ({ manifest, rebindManifest }) => { manifest.fixtures = []; rebindManifest(); }, /fixture count/],
  ['extra fixture', ({ manifest, rebindManifest }) => { manifest.fixtures.push(manifest.fixtures[0]); rebindManifest(); }, /fixture count/],
  ['unknown event mapping', ({ manifest, rebindManifest }) => { manifest.fixtures[0].event_type = 'future.unknown'; rebindManifest(); }, /event inventory/],
  ['path traversal', ({ manifest, rebindManifest }) => { manifest.fixtures[0].path = 'contracts/asyncapi/fixtures/events/../secret.json'; rebindManifest(); }, /invalid fixture path/],
  ['wrong Rust variant', ({ manifest, rebindManifest }) => { manifest.fixtures[0].variant_name = 'QueueStatus'; rebindManifest(); }, /payload variant/],
  ['wrong schema selector', ({ manifest, rebindManifest }) => { manifest.fixtures[0].payload_schema_component = 'Other'; rebindManifest(); }, /schema selector/],
  ['aggregate byte drift', ({ manifest, receipt, rebindManifest }) => { manifest.corpus.sha256 = '0'.repeat(64); receipt.corpus_sha256 = manifest.corpus.sha256; receipt.consumer_pin.corpus_sha256 = manifest.corpus.sha256; rebindManifest(); }, /aggregate corpus checksum/],
]) {
  test(`rejects ${name}`, () => {
    const state = sample();
    mutate(state);
    assert.throws(() => buildProducerEventFixtures(state.input), pattern);
  });
}
