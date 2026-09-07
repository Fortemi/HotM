import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyLiveAsyncApiAuthority } from './live-asyncapi-authority.mjs';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const liveCommit = 'a'.repeat(40);
const packagedCommit = 'b'.repeat(40);
function sample(change = (doc) => doc) {
  const packaged = { asyncapi: '3.0.0', info: { version: '2026.7.19' }, channels: { events: { messages: { updated: { 'x-event-type': 'note.updated', payload: { type: 'object', required: ['id'] } } } } }, components: {}, operations: {}, servers: {} };
  const live = change({ ...structuredClone(packaged), info: { version: '2026.9.7' } });
  const bytes = { [liveCommit]: Buffer.from(JSON.stringify(live)), [packagedCommit]: Buffer.from(JSON.stringify(packaged)) };
  const source = Buffer.from('source at exact commit');
  const receipt = { schemaVersion: 1, authority: { repository: 'Fortemi/fortemi', commit: liveCommit, artifact: { path: 'asyncapi.yaml', sha256: hash(bytes[liveCommit]), sizeBytes: bytes[liveCommit].length, generatorVersion: '2026.9.7' }, sources: [{ path: 'asyncapi.rs', sha256: hash(source) }] }, packagedBaseline: { commit: packagedCommit } };
  const catalog = { producer: { commit: packagedCommit, asyncApi: { artifactPath: 'asyncapi.yaml', sha256: hash(bytes[packagedCommit]), sizeBytes: bytes[packagedCommit].length, asyncApiVersion: '3.0.0' } }, eventTypes: ['note.updated'] };
  return { receipt, catalog, fixture: { producer: { commit: packagedCommit }, cases: [{}] }, rules: { producer: { commit: packagedCommit }, rules: [{}] }, readProducerFile(commit, path) { assert.ok([liveCommit, packagedCommit].includes(commit)); return path === 'asyncapi.rs' ? source : bytes[commit]; } };
}
test('accepts only informational version changes while preserving packaged source identity', () => {
  const result = verifyLiveAsyncApiAuthority(sample());
  assert.equal(result.liveCommit, liveCommit);
  assert.equal(result.packagedCommit, packagedCommit);
  assert.equal(result.eventCount, 1);
});
test('rejects live payload schema drift even with a correct new artifact hash', () => {
  const value = sample((doc) => { doc.channels.events.messages.updated.payload.required = []; return doc; });
  assert.throws(() => verifyLiveAsyncApiAuthority(value), /wire contract differs/);
});
test('rejects future top-level semantic fields rather than silently ignoring them', () => {
  const value = sample((doc) => ({ ...doc, security: { scopes: ['read'] } }));
  assert.throws(() => verifyLiveAsyncApiAuthority(value), /wire contract differs/);
});
test('rejects mismatched immutable live document hash', () => {
  const value = sample(); value.receipt.authority.artifact.sha256 = '0'.repeat(64);
  assert.throws(() => verifyLiveAsyncApiAuthority(value), /artifact checksum/);
});
test('rejects changed producer source bytes', () => {
  const value = sample(); value.receipt.authority.sources[0].sha256 = '0'.repeat(64);
  assert.throws(() => verifyLiveAsyncApiAuthority(value), /source checksum/);
});
test('rejects a mismatched packaged fixture origin', () => {
  const value = sample(); value.fixture.producer.commit = liveCommit;
  assert.throws(() => verifyLiveAsyncApiAuthority(value), /fixture\/rules producer differs/);
});
test('rejects moving refs and insufficient fixture coverage', () => {
  const moving = sample(); moving.receipt.authority.commit = 'main';
  assert.throws(() => verifyLiveAsyncApiAuthority(moving), /immutable/);
  const incomplete = sample(); incomplete.fixture.cases = [];
  assert.throws(() => verifyLiveAsyncApiAuthority(incomplete), /coverage differs/);
});
