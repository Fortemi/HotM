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

export function createKnowledgeShardFile(
  manifest: KnowledgeShardManifest = canonicalManifest,
): File {
  const manifestBytes = encoder.encode(JSON.stringify(manifest));
  const paddedSize = Math.ceil(manifestBytes.length / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  const tarBytes = new Uint8Array(TAR_BLOCK_SIZE + paddedSize + TAR_BLOCK_SIZE * 2);
  const header = tarBytes.subarray(0, TAR_BLOCK_SIZE);

  writeText(header, 0, 100, 'manifest.json');
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, manifestBytes.length);
  writeOctal(header, 136, 12, 0);
  header.fill(32, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeText(header, 257, 6, 'ustar\0');
  writeText(header, 263, 2, '00');

  const checksum = header.reduce((sum, value) => sum + value, 0);
  writeText(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  tarBytes.set(manifestBytes, TAR_BLOCK_SIZE);

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
