import { gzip } from 'pako';
import canonicalManifestJson from '../contracts/fortemi-core-v1-manifest.json';
import historicalV1ManifestJson from '../contracts/fortemi-core-v1-v1.0-manifest.json';
import historicalV1_1ManifestJson from '../contracts/fortemi-core-v1-v1.1-manifest.json';
import collectionsJson from '../contracts/fortemi-core-v1-current/collections.json?raw';
import linksJsonl from '../contracts/fortemi-core-v1-current/links.jsonl?raw';
import currentNotesJsonl from '../contracts/fortemi-core-v1-current/notes.jsonl?raw';
import historicalNotesJsonl from '../contracts/fortemi-core-v1-current/notes-v1.0.jsonl?raw';
import tagsJson from '../contracts/fortemi-core-v1-current/tags.json?raw';
import templatesJson from '../contracts/fortemi-core-v1-current/templates.json?raw';
import type { KnowledgeShardManifest } from '../types-extended';

const encoder = new TextEncoder();
const TAR_BLOCK_SIZE = 512;

export const canonicalManifest =
  canonicalManifestJson as unknown as KnowledgeShardManifest;
export const historicalManifests = [
  historicalV1ManifestJson,
  historicalV1_1ManifestJson,
] as unknown as KnowledgeShardManifest[];

const sharedComponentFiles = {
  'collections.json': encoder.encode(collectionsJson),
  'tags.json': encoder.encode(tagsJson),
  'templates.json': encoder.encode(templatesJson),
  'links.jsonl': encoder.encode(linksJsonl),
};

function canonicalComponentFiles(version: string): Record<string, Uint8Array> {
  return {
    ...sharedComponentFiles,
    'notes.jsonl': encoder.encode(
      version === '1.0.0' ? historicalNotesJsonl : currentNotesJsonl,
    ),
  };
}

function writeText(target: Uint8Array, offset: number, length: number, value: string): void {
  const encoded = encoder.encode(value);
  if (encoded.length > length) throw new Error('TAR fixture field is too long');
  target.set(encoded, offset);
}

function writeOctal(target: Uint8Array, offset: number, length: number, value: number): void {
  writeText(target, offset, length, `${value.toString(8).padStart(length - 1, '0')}\0`);
}

function tarEntry(name: string, contents: Uint8Array): Uint8Array {
  const paddedSize = Math.ceil(contents.length / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  const entry = new Uint8Array(TAR_BLOCK_SIZE + paddedSize);
  const header = entry.subarray(0, TAR_BLOCK_SIZE);

  writeText(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, contents.length);
  writeOctal(header, 136, 12, 0);
  header.fill(32, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeText(header, 257, 6, 'ustar\0');
  writeText(header, 263, 2, '00');

  const checksum = header.reduce((sum, value) => sum + value, 0);
  writeText(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  entry.set(contents, TAR_BLOCK_SIZE);
  return entry;
}

export function createKnowledgeShardFile(
  manifest: KnowledgeShardManifest = canonicalManifest,
  componentFiles?: Record<string, Uint8Array>,
): File {
  const files = componentFiles ?? canonicalComponentFiles(manifest.version);
  const entries = [
    ...Object.entries(files).map(([name, contents]) => tarEntry(name, contents)),
    tarEntry('manifest.json', encoder.encode(JSON.stringify(manifest))),
  ];
  const byteLength = entries.reduce((total, entry) => total + entry.byteLength, 0);
  const tarBytes = new Uint8Array(byteLength + TAR_BLOCK_SIZE * 2);
  let offset = 0;
  for (const entry of entries) {
    tarBytes.set(entry, offset);
    offset += entry.byteLength;
  }

  const archiveBytes = gzip(tarBytes);
  const file = new File([archiveBytes], 'fortemi-core-v1.shard', {
    type: 'application/gzip',
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(
      archiveBytes.buffer.slice(
        archiveBytes.byteOffset,
        archiveBytes.byteOffset + archiveBytes.byteLength,
      ),
    ),
  });
  return file;
}
