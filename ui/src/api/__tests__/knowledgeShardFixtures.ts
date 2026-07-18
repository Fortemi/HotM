import { gzip } from 'pako';
import canonicalManifestJson from '../contracts/fortemi-core-v1-manifest.json';
import type { KnowledgeShardManifest } from '../types-extended';

const encoder = new TextEncoder();
const TAR_BLOCK_SIZE = 512;

export const canonicalManifest =
  canonicalManifestJson as unknown as KnowledgeShardManifest;

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
  const files = componentFiles ?? Object.fromEntries(
    manifest.components.map((component) => [
      {
        notes: 'notes.jsonl',
        collections: 'collections.json',
        tags: 'tags.json',
        templates: 'templates.json',
        links: 'links.jsonl',
      }[component],
      encoder.encode(component === 'notes' || component === 'links' ? '' : '[]'),
    ]),
  );
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
