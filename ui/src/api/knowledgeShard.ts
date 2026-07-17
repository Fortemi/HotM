import { ungzip } from 'pako';
import type {
  KnowledgeShardComponent,
  KnowledgeShardManifest,
  KnowledgeShardProfile,
} from './types-extended';

export const SUPPORTED_KNOWLEDGE_SHARD_PROFILE: KnowledgeShardProfile = 'core-v1';
export const SUPPORTED_KNOWLEDGE_SHARD_SCHEMA = '1.0.0';
export const SUPPORTED_KNOWLEDGE_SHARD_COMPONENTS: readonly KnowledgeShardComponent[] = [
  'notes',
  'collections',
  'tags',
  'templates',
  'links',
];

const REGISTERED_PROFILES = new Set<KnowledgeShardProfile>([
  'core-v1',
  'full-v1',
  'record-v1',
]);
const COMPONENT_FILENAMES: Record<KnowledgeShardComponent, string> = {
  notes: 'notes.jsonl',
  collections: 'collections.json',
  tags: 'tags.json',
  templates: 'templates.json',
  links: 'links.jsonl',
};
const TAR_BLOCK_SIZE = 512;
const MAX_MANIFEST_SIZE = 1024 * 1024;
const textDecoder = new TextDecoder('utf-8', { fatal: true });

function readTarText(bytes: Uint8Array, start: number, length: number): string {
  const field = bytes.subarray(start, start + length);
  const end = field.indexOf(0);
  return textDecoder.decode(end === -1 ? field : field.subarray(0, end)).trim();
}

function parseTarOctal(bytes: Uint8Array, start: number, length: number, label: string): number {
  const value = readTarText(bytes, start, length).replace(/\s/g, '');
  if (!/^[0-7]+$/.test(value)) {
    throw new Error(`Knowledge shard has an invalid TAR ${label}.`);
  }
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Knowledge shard TAR ${label} is out of range.`);
  }
  return parsed;
}

function validateTarHeaderChecksum(bytes: Uint8Array, offset: number): void {
  const expected = parseTarOctal(bytes, offset + 148, 8, 'header checksum');
  let actual = 0;
  for (let index = 0; index < TAR_BLOCK_SIZE; index += 1) {
    actual += index >= 148 && index < 156 ? 32 : bytes[offset + index];
  }
  if (actual !== expected) {
    throw new Error('Knowledge shard TAR header checksum validation failed.');
  }
}

function extractManifestBytes(tarBytes: Uint8Array): Uint8Array {
  let offset = 0;
  let manifest: Uint8Array | undefined;

  while (offset + TAR_BLOCK_SIZE <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + TAR_BLOCK_SIZE);
    if (header.every((value) => value === 0)) break;

    validateTarHeaderChecksum(tarBytes, offset);
    const name = readTarText(tarBytes, offset, 100);
    const prefix = readTarText(tarBytes, offset + 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = parseTarOctal(tarBytes, offset + 124, 12, 'entry size');
    const contentStart = offset + TAR_BLOCK_SIZE;
    const contentEnd = contentStart + size;
    if (contentEnd > tarBytes.length) {
      throw new Error('Knowledge shard TAR entry extends beyond the archive.');
    }

    if (path === 'manifest.json') {
      if (manifest) {
        throw new Error('Knowledge shard contains more than one manifest.json.');
      }
      if (size === 0 || size > MAX_MANIFEST_SIZE) {
        throw new Error('Knowledge shard manifest.json size is invalid.');
      }
      manifest = tarBytes.slice(contentStart, contentEnd);
    }

    offset = contentStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  }

  if (!manifest) {
    throw new Error('Knowledge shard manifest.json is required.');
  }
  return manifest;
}

function parseStrictSemver(value: unknown, label: string): [number, number, number] {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${label} must be strict Semantic Versioning (MAJOR.MINOR.PATCH).`);
  }
  const parts = value.split('.').map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error(`${label} is out of range.`);
  }
  return parts as [number, number, number];
}

function isReaderCompatible(minimum: [number, number, number]): boolean {
  const current = parseStrictSemver(
    SUPPORTED_KNOWLEDGE_SHARD_SCHEMA,
    'HotM Knowledge Shard schema',
  );
  if (current[0] !== minimum[0]) return false;
  for (let index = 1; index < current.length; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }
  return true;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function validateManifest(value: unknown): KnowledgeShardManifest {
  const manifest = requireRecord(value, 'Knowledge shard manifest');
  if (manifest.format !== 'matric-shard') {
    throw new Error('Knowledge shard format is unsupported.');
  }

  const profile = manifest.profile;
  if (typeof profile !== 'string' || !REGISTERED_PROFILES.has(profile as KnowledgeShardProfile)) {
    throw new Error('Knowledge shard profile is unknown.');
  }
  if (profile !== SUPPORTED_KNOWLEDGE_SHARD_PROFILE) {
    throw new Error(
      `Knowledge shard profile ${profile} is not supported; HotM accepts core-v1 only.`,
    );
  }

  parseStrictSemver(manifest.version, 'Knowledge shard schema version');
  if (manifest.version !== SUPPORTED_KNOWLEDGE_SHARD_SCHEMA) {
    throw new Error(
      `Knowledge shard schema ${String(manifest.version)} is unsupported; HotM accepts ${SUPPORTED_KNOWLEDGE_SHARD_SCHEMA}.`,
    );
  }
  const minimumReader = parseStrictSemver(
    manifest.min_reader_version,
    'Knowledge shard minimum reader version',
  );
  if (!isReaderCompatible(minimumReader)) {
    throw new Error(
      `Knowledge shard requires reader schema ${String(manifest.min_reader_version)}; HotM supports ${SUPPORTED_KNOWLEDGE_SHARD_SCHEMA}.`,
    );
  }

  const producer = requireRecord(manifest.producer, 'Knowledge shard producer');
  for (const field of ['name', 'version'] as const) {
    if (typeof producer[field] !== 'string' || !producer[field].trim()) {
      throw new Error(`Knowledge shard producer.${field} is required.`);
    }
  }

  if (!Array.isArray(manifest.components) || manifest.components.length === 0) {
    throw new Error('Knowledge shard must declare at least one component.');
  }
  const components = manifest.components.map((component) => {
    if (
      typeof component !== 'string'
      || !SUPPORTED_KNOWLEDGE_SHARD_COMPONENTS.includes(component as KnowledgeShardComponent)
    ) {
      throw new Error(`Knowledge shard component ${String(component)} is unsupported.`);
    }
    return component as KnowledgeShardComponent;
  });
  if (new Set(components).size !== components.length) {
    throw new Error('Knowledge shard components must be unique.');
  }

  const counts = requireRecord(manifest.counts, 'Knowledge shard counts');
  const checksums = requireRecord(manifest.checksums, 'Knowledge shard checksums');
  for (const component of components) {
    const count = counts[component];
    if (!Number.isSafeInteger(count) || (count as number) < 0) {
      throw new Error(`Knowledge shard count for ${component} is invalid.`);
    }
    const filename = COMPONENT_FILENAMES[component];
    const checksum = checksums[filename];
    if (typeof checksum !== 'string' || !/^[a-f0-9]{64}$/.test(checksum)) {
      throw new Error(`Knowledge shard checksum for ${filename} is invalid.`);
    }
  }

  return manifest as unknown as KnowledgeShardManifest;
}

export async function inspectKnowledgeShard(blob: Blob): Promise<KnowledgeShardManifest> {
  let tarBytes: Uint8Array;
  try {
    tarBytes = ungzip(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    throw new Error('Knowledge shard is not a valid gzip archive.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(extractManifestBytes(tarBytes)));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Knowledge shard manifest.json is not valid JSON.');
    }
    throw error;
  }
  return validateManifest(parsed);
}

export function normalizeKnowledgeShardInclude(
  components: readonly KnowledgeShardComponent[] | undefined,
): string | undefined {
  if (!components) return undefined;
  if (components.length === 0 || new Set(components).size !== components.length) {
    throw new Error('Knowledge shard export components must be non-empty and unique.');
  }
  for (const component of components) {
    if (!SUPPORTED_KNOWLEDGE_SHARD_COMPONENTS.includes(component)) {
      throw new Error(`Knowledge shard export component ${component} is unsupported.`);
    }
  }
  return components.join(',');
}
