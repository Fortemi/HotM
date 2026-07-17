import { describe, expect, it } from 'vitest';
import { gzip } from 'pako';
import {
  inspectKnowledgeShard,
  normalizeKnowledgeShardInclude,
} from '../knowledgeShard';
import {
  canonicalManifest,
  createKnowledgeShardFile,
} from './knowledgeShardFixtures';

function binaryFile(bytes: Uint8Array, name: string): File {
  const file = new File([bytes], name, { type: 'application/gzip' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  });
  return file;
}

describe('Knowledge Shard contract', () => {
  it('accepts the pinned Fortemi core-v1 manifest fixture', async () => {
    const manifest = await inspectKnowledgeShard(createKnowledgeShardFile());

    expect(manifest).toEqual(canonicalManifest);
    expect(manifest.profile).toBe('core-v1');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.min_reader_version).toBe('1.0.0');
  });

  it.each([
    ['full-v1', 'profile full-v1 is not supported'],
    ['record-v1', 'profile record-v1 is not supported'],
  ] as const)('rejects unsupported profile %s before upload', async (profile, message) => {
    const file = createKnowledgeShardFile({ ...canonicalManifest, profile });
    await expect(inspectKnowledgeShard(file)).rejects.toThrow(message);
  });

  it('rejects unknown profiles', async () => {
    const file = createKnowledgeShardFile({
      ...canonicalManifest,
      profile: 'future-v1' as never,
    });
    await expect(inspectKnowledgeShard(file)).rejects.toThrow('profile is unknown');
  });

  it('rejects unsupported schema and minimum-reader versions', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      version: '2.0.0',
    }))).rejects.toThrow('schema 2.0.0 is unsupported');

    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      min_reader_version: '2.0.0',
    }))).rejects.toThrow('requires reader schema 2.0.0');
  });

  it('rejects unsupported components and malformed checksums', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      components: ['notes', 'embeddings' as never],
    }))).rejects.toThrow('component embeddings is unsupported');

    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      checksums: { 'notes.jsonl': 'not-a-sha256' },
    }))).rejects.toThrow('checksum for notes.jsonl is invalid');
  });

  it('rejects invalid declared counts', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      counts: { ...canonicalManifest.counts, notes: -1 },
    }))).rejects.toThrow('count for notes is invalid');
  });

  it('rejects malformed gzip and TAR input', async () => {
    await expect(inspectKnowledgeShard(binaryFile(
      new TextEncoder().encode('not a gzip archive'),
      'invalid.shard',
    ))).rejects.toThrow('not a valid gzip archive');

    await expect(inspectKnowledgeShard(binaryFile(
      gzip(new Uint8Array(512).fill(1)),
      'invalid-tar.shard',
    ))).rejects.toThrow('invalid TAR header checksum');
  });

  it('serializes only supported, unique export components', () => {
    expect(normalizeKnowledgeShardInclude(['notes', 'tags'])).toBe('notes,tags');
    expect(normalizeKnowledgeShardInclude(undefined)).toBeUndefined();
    expect(() => normalizeKnowledgeShardInclude(['notes', 'notes']))
      .toThrow('must be non-empty and unique');
  });
});
