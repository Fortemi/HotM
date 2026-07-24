import { ungzip } from 'pako';
import type {
  KnowledgeShardComponent,
  KnowledgeShardManifest,
  KnowledgeShardProfile,
} from './types-extended';

export const SUPPORTED_KNOWLEDGE_SHARD_PROFILE: KnowledgeShardProfile = 'core-v1';
export const SUPPORTED_KNOWLEDGE_SHARD_SCHEMA = '1.2.0';
export const SUPPORTED_KNOWLEDGE_SHARD_SCHEMAS = [
  '1.0.0',
  '1.1.0',
  '1.2.0',
] as const;
export const SUPPORTED_FULL_V1_SCHEMA = '2.0.0';
export const SUPPORTED_FULL_V1_PROFILE: KnowledgeShardProfile = 'full-v1';
export const SUPPORTED_KNOWLEDGE_SHARD_COMPONENTS: readonly KnowledgeShardComponent[] = [
  'notes',
  'collections',
  'tags',
  'templates',
  'links',
];
export const SUPPORTED_FULL_V1_COMPONENTS: readonly KnowledgeShardComponent[] = [
  'notes',
  'collections',
  'tags',
  'templates',
  'links',
  'note_originals',
  'note_original_history',
  'note_revised_current',
  'note_revisions',
  'embedding_configs',
  'embedding_sets',
  'embedding_set_members',
  'embeddings',
  'provenance_edges',
  'provenance_activities',
  'named_locations',
  'provenance_locations',
  'provenance_devices',
  'provenance_records',
  'skos_schemes',
  'skos_concepts',
  'skos_labels',
  'skos_notes',
  'skos_relations',
  'skos_mapping_relations',
  'skos_scheme_memberships',
  'note_skos_tags',
  'skos_collections',
  'skos_collection_members',
  'graph_sources',
  'graph_edges',
  'communities',
  'community_assignments',
];
export const SUPPORTED_FULL_V1_COUNT_FIELDS = [
  ...SUPPORTED_FULL_V1_COMPONENTS.slice(0, -2),
  'community_sets',
  ...SUPPORTED_FULL_V1_COMPONENTS.slice(-2),
] as const;

const REGISTERED_PROFILES = new Set<KnowledgeShardProfile>([
  'core-v1',
  'full-v1',
  'record-v1',
]);
const REGISTERED_CORE_SCHEMA_VERSIONS = new Set<string>(
  SUPPORTED_KNOWLEDGE_SHARD_SCHEMAS,
);
export const KNOWLEDGE_SHARD_COMPONENT_FILENAMES: Record<KnowledgeShardComponent, string> = {
  notes: 'notes.jsonl',
  collections: 'collections.json',
  tags: 'tags.json',
  templates: 'templates.json',
  links: 'links.jsonl',
  note_originals: 'note_originals.jsonl',
  note_original_history: 'note_original_history.jsonl',
  note_revised_current: 'note_revised_current.jsonl',
  note_revisions: 'note_revisions.jsonl',
  embedding_configs: 'embedding_configs.json',
  embedding_sets: 'embedding_sets.json',
  embedding_set_members: 'embedding_set_members.jsonl',
  embeddings: 'embeddings.jsonl',
  provenance_edges: 'provenance_edges.jsonl',
  provenance_activities: 'provenance_activities.jsonl',
  named_locations: 'named_locations.jsonl',
  provenance_locations: 'provenance_locations.jsonl',
  provenance_devices: 'provenance_devices.jsonl',
  provenance_records: 'provenance_records.jsonl',
  skos_schemes: 'skos_schemes.json',
  skos_concepts: 'skos_concepts.json',
  skos_labels: 'skos_labels.jsonl',
  skos_notes: 'skos_notes.jsonl',
  skos_relations: 'skos_relations.jsonl',
  skos_mapping_relations: 'skos_mapping_relations.jsonl',
  skos_scheme_memberships: 'skos_scheme_memberships.jsonl',
  note_skos_tags: 'note_skos_tags.jsonl',
  skos_collections: 'skos_collections.json',
  skos_collection_members: 'skos_collection_members.jsonl',
  graph_sources: 'graph_sources.json',
  graph_edges: 'graph_edges.jsonl',
  communities: 'communities.json',
  community_assignments: 'community_assignments.jsonl',
};
const COMPONENT_FILENAMES = KNOWLEDGE_SHARD_COMPONENT_FILENAMES;
const JSONL_COMPONENTS = new Set<KnowledgeShardComponent>(['notes', 'links']);
const TAR_BLOCK_SIZE = 512;
const MAX_MANIFEST_SIZE = 1024 * 1024;
const MAX_COMPRESSED_ARCHIVE_SIZE = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_ARCHIVE_SIZE = MAX_COMPRESSED_ARCHIVE_SIZE * 4;
const MAX_ARCHIVE_ENTRY_SIZE = MAX_COMPRESSED_ARCHIVE_SIZE;
const MAX_ARCHIVE_ENTRIES = 64;
const MAX_ARCHIVE_ENTRY_NAME_BYTES = 255;
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

function extractTarEntries(tarBytes: Uint8Array): Map<string, Uint8Array> {
  let offset = 0;
  const entries = new Map<string, Uint8Array>();

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

    if (!path || path.startsWith('/') || path.split('/').includes('..')) {
      throw new Error('Knowledge shard contains an unsafe TAR path.');
    }
    if (entries.has(path)) {
      throw new Error(`Knowledge shard contains duplicate TAR entry ${path}.`);
    }
    entries.set(path, tarBytes.slice(contentStart, contentEnd));

    offset = contentStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  }

  const manifest = entries.get('manifest.json');
  if (!manifest) {
    throw new Error('Knowledge shard manifest.json is required.');
  }
  if (manifest.byteLength === 0 || manifest.byteLength > MAX_MANIFEST_SIZE) {
    throw new Error('Knowledge shard manifest.json size is invalid.');
  }
  return entries;
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

function isReaderCompatible(
  minimum: [number, number, number],
  supportedSchema: string,
): boolean {
  const current = parseStrictSemver(
    supportedSchema,
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
  if (profile === 'record-v1') {
    throw new Error(
      'Knowledge shard profile record-v1 is not supported; HotM accepts core-v1 and exact 2.0.0/full-v1 recovery archives.',
    );
  }

  parseStrictSemver(manifest.version, 'Knowledge shard schema version');
  const isFullV1 = profile === SUPPORTED_FULL_V1_PROFILE;
  if (isFullV1) {
    if (manifest.version !== SUPPORTED_FULL_V1_SCHEMA) {
      throw new Error(
        `Knowledge shard tuple ${String(manifest.version)}/full-v1 is unsupported; HotM accepts exact 2.0.0/full-v1 recovery archives.`,
      );
    }
  } else {
    if (
      profile !== SUPPORTED_KNOWLEDGE_SHARD_PROFILE
      || typeof manifest.version !== 'string'
      || !REGISTERED_CORE_SCHEMA_VERSIONS.has(manifest.version)
    ) {
      throw new Error(
        `Knowledge shard schema ${String(manifest.version)} is unsupported for core-v1; HotM accepts ${SUPPORTED_KNOWLEDGE_SHARD_SCHEMAS.join(', ')}.`,
      );
    }
  }
  const minimumReader = parseStrictSemver(
    manifest.min_reader_version,
    'Knowledge shard minimum reader version',
  );
  const supportedReader = isFullV1
    ? SUPPORTED_FULL_V1_SCHEMA
    : SUPPORTED_KNOWLEDGE_SHARD_SCHEMA;
  if (!isReaderCompatible(minimumReader, supportedReader)) {
    throw new Error(
      `Knowledge shard requires reader schema ${String(manifest.min_reader_version)}; HotM supports ${supportedReader} for this profile.`,
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
  const supportedComponents = isFullV1
    ? SUPPORTED_FULL_V1_COMPONENTS
    : SUPPORTED_KNOWLEDGE_SHARD_COMPONENTS;
  const components = manifest.components.map((component) => {
    if (
      typeof component !== 'string'
      || !supportedComponents.includes(component as KnowledgeShardComponent)
    ) {
      throw new Error(`Knowledge shard component ${String(component)} is unsupported.`);
    }
    return component as KnowledgeShardComponent;
  });
  if (new Set(components).size !== components.length) {
    throw new Error('Knowledge shard components must be unique.');
  }
  if (
    isFullV1
    && (
      components.length !== SUPPORTED_FULL_V1_COMPONENTS.length
      || SUPPORTED_FULL_V1_COMPONENTS.some((component) => !components.includes(component))
    )
  ) {
    throw new Error('Knowledge shard 2.0.0/full-v1 must declare the complete 33-component inventory.');
  }

  const counts = requireRecord(manifest.counts, 'Knowledge shard counts');
  const checksums = requireRecord(manifest.checksums, 'Knowledge shard checksums');
  if (isFullV1) {
    const countFields = Object.keys(counts);
    if (
      countFields.length !== SUPPORTED_FULL_V1_COUNT_FIELDS.length
      || SUPPORTED_FULL_V1_COUNT_FIELDS.some((field) => !countFields.includes(field))
    ) {
      throw new Error('Knowledge shard 2.0.0/full-v1 must declare the complete 34-field count inventory.');
    }
    const checksumFiles = Object.keys(checksums);
    const expectedChecksumFiles = SUPPORTED_FULL_V1_COMPONENTS.map(
      (component) => COMPONENT_FILENAMES[component],
    );
    if (
      checksumFiles.length !== expectedChecksumFiles.length
      || expectedChecksumFiles.some((path) => !checksumFiles.includes(path))
    ) {
      throw new Error(
        'Knowledge shard 2.0.0/full-v1 checksum inventory must match all 33 components.',
      );
    }
  }
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

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function parseComponentCount(
  component: KnowledgeShardComponent,
  filename: string,
  bytes: Uint8Array,
): number {
  let text: string;
  try {
    text = textDecoder.decode(bytes);
  } catch {
    throw new Error(`Knowledge shard component ${filename} is not valid UTF-8.`);
  }

  if (JSONL_COMPONENTS.has(component)) {
    const records = text.split(/\r?\n/).filter((line) => line.trim());
    for (const record of records) {
      try {
        JSON.parse(record);
      } catch {
        throw new Error(`Knowledge shard component ${filename} contains invalid JSON.`);
      }
    }
    return records.length;
  }

  let records: unknown;
  try {
    records = JSON.parse(text);
  } catch {
    throw new Error(`Knowledge shard component ${filename} contains invalid JSON.`);
  }
  if (!Array.isArray(records)) {
    throw new Error(`Knowledge shard component ${filename} must contain a JSON array.`);
  }
  return records.length;
}

async function validateArchiveContents(
  manifest: KnowledgeShardManifest,
  entries: Map<string, Uint8Array>,
): Promise<void> {
  const expectedFiles = new Set([
    'manifest.json',
    ...manifest.components.map((component) => COMPONENT_FILENAMES[component]),
  ]);
  for (const path of entries.keys()) {
    if (!expectedFiles.has(path)) {
      throw new Error(`Knowledge shard contains undeclared file ${path}.`);
    }
  }

  const declaredChecksumFiles = Object.keys(manifest.checksums);
  const componentFiles = [...expectedFiles].filter((path) => path !== 'manifest.json');
  if (
    declaredChecksumFiles.length !== componentFiles.length
    || declaredChecksumFiles.some((path) => !componentFiles.includes(path))
  ) {
    throw new Error('Knowledge shard checksum inventory does not match declared components.');
  }

  for (const component of manifest.components) {
    const filename = COMPONENT_FILENAMES[component];
    const bytes = entries.get(filename);
    if (!bytes) {
      throw new Error(`Knowledge shard component ${filename} is missing.`);
    }
    const actualChecksum = await sha256Hex(bytes);
    if (actualChecksum !== manifest.checksums[filename]) {
      throw new Error(`Knowledge shard checksum for ${filename} does not match its contents.`);
    }
    const actualCount = parseComponentCount(component, filename, bytes);
    if (actualCount !== manifest.counts[component]) {
      throw new Error(`Knowledge shard count for ${component} does not match its contents.`);
    }
  }
}

class StreamingByteReader {
  private buffered = new Uint8Array();
  private finished = false;

  constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
  ) {}

  private async fill(length: number): Promise<void> {
    while (this.buffered.byteLength < length && !this.finished) {
      const next = await this.reader.read();
      if (next.done) {
        this.finished = true;
        break;
      }
      const combined = new Uint8Array(this.buffered.byteLength + next.value.byteLength);
      combined.set(this.buffered);
      combined.set(next.value, this.buffered.byteLength);
      this.buffered = combined;
    }
  }

  async readExact(length: number, allowCleanEof = false): Promise<Uint8Array | null> {
    await this.fill(length);
    if (this.buffered.byteLength === 0 && allowCleanEof && this.finished) return null;
    if (this.buffered.byteLength < length) {
      throw new Error('Knowledge shard TAR entry extends beyond the archive.');
    }
    const result = this.buffered.slice(0, length);
    this.buffered = this.buffered.slice(length);
    return result;
  }

  async skip(length: number): Promise<void> {
    let remaining = length;
    while (remaining > 0) {
      const chunkSize = Math.min(remaining, 64 * 1024);
      await this.readExact(chunkSize);
      remaining -= chunkSize;
    }
  }

  async cancel(): Promise<void> {
    await this.reader.cancel().catch(() => undefined);
  }
}

async function inspectStreamedTarManifest(blob: Blob): Promise<KnowledgeShardManifest> {
  if (blob.size <= 0 || blob.size > MAX_COMPRESSED_ARCHIVE_SIZE) {
    throw new Error('Knowledge shard exceeds the compressed size limit.');
  }
  if (typeof DecompressionStream === 'undefined' || typeof blob.stream !== 'function') {
    throw new Error('Streaming Knowledge Shard inspection is unavailable in this client.');
  }

  let decompressed: ReadableStream<Uint8Array>;
  try {
    decompressed = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  } catch {
    throw new Error('Knowledge shard is not a valid gzip archive.');
  }

  const stream = new StreamingByteReader(decompressed.getReader());
  const entries = new Set<string>();
  let entryCount = 0;
  let uncompressedBytes = 0;
  let manifestBytes: Uint8Array | null = null;

  try {
    while (true) {
      const header = await stream.readExact(TAR_BLOCK_SIZE, true);
      if (!header || header.every((value) => value === 0)) break;

      validateTarHeaderChecksum(header, 0);
      const name = readTarText(header, 0, 100);
      const prefix = readTarText(header, 345, 155);
      const path = prefix ? `${prefix}/${name}` : name;
      const size = parseTarOctal(header, 124, 12, 'entry size');
      const typeFlag = header[156];
      const paddedSize = Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;

      entryCount += 1;
      uncompressedBytes += TAR_BLOCK_SIZE + paddedSize;
      if (entryCount > MAX_ARCHIVE_ENTRIES) {
        throw new Error('Knowledge shard exceeds the archive entry limit.');
      }
      if (uncompressedBytes > MAX_UNCOMPRESSED_ARCHIVE_SIZE) {
        throw new Error('Knowledge shard exceeds the uncompressed size limit.');
      }
      if (size > MAX_ARCHIVE_ENTRY_SIZE) {
        throw new Error(`Knowledge shard entry ${path || '<unnamed>'} exceeds the entry size limit.`);
      }
      if (
        !path
        || new TextEncoder().encode(path).byteLength > MAX_ARCHIVE_ENTRY_NAME_BYTES
        || path.startsWith('/')
        || path.split('/').includes('..')
      ) {
        throw new Error('Knowledge shard contains an unsafe TAR path.');
      }
      if (typeFlag !== 0 && typeFlag !== '0'.charCodeAt(0)) {
        throw new Error(`Knowledge shard contains unsupported TAR entry ${path}.`);
      }
      if (entries.has(path)) {
        throw new Error(`Knowledge shard contains duplicate TAR entry ${path}.`);
      }
      entries.add(path);

      if (path === 'manifest.json') {
        if (size === 0 || size > MAX_MANIFEST_SIZE) {
          throw new Error('Knowledge shard manifest.json size is invalid.');
        }
        manifestBytes = await stream.readExact(size);
        await stream.skip(paddedSize - size);
      } else {
        await stream.skip(paddedSize);
      }
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Knowledge shard is not a valid gzip archive.');
    }
    throw error;
  } finally {
    await stream.cancel();
  }

  if (!manifestBytes) {
    throw new Error('Knowledge shard manifest.json is required.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(manifestBytes));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Knowledge shard manifest.json is not valid JSON.');
    }
    throw error;
  }
  const manifest = validateManifest(parsed);
  if (manifest.profile === SUPPORTED_FULL_V1_PROFILE) {
    for (const component of SUPPORTED_FULL_V1_COMPONENTS) {
      const filename = COMPONENT_FILENAMES[component];
      if (!entries.has(filename)) {
        throw new Error(`Knowledge shard component ${filename} is missing.`);
      }
    }
  }
  return manifest;
}

export async function inspectKnowledgeShard(blob: Blob): Promise<KnowledgeShardManifest> {
  let streamedManifest: KnowledgeShardManifest | null = null;
  try {
    streamedManifest = await inspectStreamedTarManifest(blob);
  } catch (error) {
    if (
      error instanceof Error
      && error.message === 'Streaming Knowledge Shard inspection is unavailable in this client.'
    ) {
      streamedManifest = null;
    } else {
      throw error;
    }
  }

  if (streamedManifest?.profile === SUPPORTED_FULL_V1_PROFILE) {
    return streamedManifest;
  }

  let tarBytes: Uint8Array;
  try {
    tarBytes = ungzip(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    throw new Error('Knowledge shard is not a valid gzip archive.');
  }

  const entries = extractTarEntries(tarBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(entries.get('manifest.json')));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Knowledge shard manifest.json is not valid JSON.');
    }
    throw error;
  }
  const manifest = validateManifest(parsed);
  if (
    streamedManifest
    && (
      streamedManifest.profile !== manifest.profile
      || streamedManifest.version !== manifest.version
    )
  ) {
    throw new Error('Knowledge shard manifest changed between streaming and full validation.');
  }
  await validateArchiveContents(manifest, entries);
  return manifest;
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
