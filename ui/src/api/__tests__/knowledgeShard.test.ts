import { describe, expect, it } from 'vitest';
import { gzip } from 'pako';
import knowledgeShardReceipt from '../contracts/fortemi-knowledge-shard-receipt.json';
import {
  inspectKnowledgeShard,
  KNOWLEDGE_SHARD_COMPONENT_FILENAMES,
  normalizeKnowledgeShardInclude,
  SUPPORTED_FULL_V1_COUNT_FIELDS,
  SUPPORTED_FULL_V1_COMPONENTS,
} from '../knowledgeShard';
import {
  canonicalManifest,
  createKnowledgeShardFile,
  fullV1Manifest,
  historicalManifests,
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
  it('matches the pinned Fortemi 2.0.0/full-v1 authority inventory', () => {
    expect(SUPPORTED_FULL_V1_COMPONENTS).toEqual(
      knowledgeShardReceipt.fullV1.components,
    );
    expect(SUPPORTED_FULL_V1_COUNT_FIELDS).toEqual(
      knowledgeShardReceipt.fullV1.countFields,
    );
  });

  it('accepts the pinned current Fortemi core-v1 manifest fixture', async () => {
    const manifest = await inspectKnowledgeShard(createKnowledgeShardFile());

    expect(manifest).toEqual(canonicalManifest);
    expect(manifest.profile).toBe('core-v1');
    expect(manifest.version).toBe('1.2.0');
    expect(manifest.min_reader_version).toBe('1.2.0');
  });

  it.each(historicalManifests)(
    'accepts the registered Fortemi core-v1 schema $version',
    async (manifest) => {
      const inspected = await inspectKnowledgeShard(createKnowledgeShardFile(manifest));
      expect(inspected.version).toBe(manifest.version);
      expect(inspected.min_reader_version).toBe(manifest.min_reader_version);
    },
  );

  it('rejects an unregistered same-major schema', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      version: '1.1.1',
    }))).rejects.toThrow('schema 1.1.1 is unsupported');
  });

  it('accepts exact 2.0.0/full-v1 through streaming inspection without reading an ArrayBuffer', async () => {
    const file = createKnowledgeShardFile(fullV1Manifest);
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.reject(new Error('full archive buffering is forbidden')),
    });

    await expect(inspectKnowledgeShard(file)).resolves.toMatchObject({
      version: '2.0.0',
      profile: 'full-v1',
      min_reader_version: '2.0.0',
    });
  });

  it('rejects non-exact full-v1 and record-v1 tuples before upload', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      profile: 'full-v1',
    }))).rejects.toThrow('tuple 1.2.0/full-v1 is unsupported');

    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      profile: 'record-v1',
    }))).rejects.toThrow('profile record-v1 is not supported');
  });

  it('requires the complete full-v1 component inventory', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...fullV1Manifest,
      components: fullV1Manifest.components.slice(0, -1),
    }, {}))).rejects.toThrow('complete 33-component inventory');
  });

  it('requires the complete 34-field full-v1 count inventory', async () => {
    const { community_sets: _missing, ...counts } = fullV1Manifest.counts;
    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...fullV1Manifest,
      counts,
    }))).rejects.toThrow('complete 34-field count inventory');
  });

  it('requires every declared full-v1 component entry before upload', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile(
      fullV1Manifest,
      Object.fromEntries(
        SUPPORTED_FULL_V1_COMPONENTS
          .slice(1)
          .map((component) => [
            KNOWLEDGE_SHARD_COMPONENT_FILENAMES[component],
            new Uint8Array(),
          ]),
      ),
    ))).rejects.toThrow('component notes.jsonl is missing');
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

  it('rejects missing, tampered, and miscounted component contents before upload', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile(
      canonicalManifest,
      {},
    ))).rejects.toThrow('component notes.jsonl is missing');

    await expect(inspectKnowledgeShard(createKnowledgeShardFile(
      canonicalManifest,
      { 'notes.jsonl': new TextEncoder().encode('{"id":"tampered"}\n') },
    ))).rejects.toThrow('checksum for notes.jsonl does not match its contents');

    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      counts: { ...canonicalManifest.counts, notes: 0 },
    }))).rejects.toThrow('count for notes does not match its contents');
  });

  it('rejects undeclared archive files and checksum inventory drift', async () => {
    await expect(inspectKnowledgeShard(createKnowledgeShardFile(
      canonicalManifest,
      {
        'notes.jsonl': new Uint8Array(),
        'unexpected.json': new TextEncoder().encode('[]'),
      },
    ))).rejects.toThrow('contains undeclared file unexpected.json');

    await expect(inspectKnowledgeShard(createKnowledgeShardFile({
      ...canonicalManifest,
      checksums: {
        ...canonicalManifest.checksums,
        'unexpected.json': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    }))).rejects.toThrow('checksum inventory does not match declared components');
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
