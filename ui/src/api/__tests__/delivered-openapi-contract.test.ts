import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import { createCallsApi } from '../calls';
import { createLinksApi } from '../links';
import type { ApiClient } from '../client';

type Schema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  oneOf?: Schema[];
  allOf?: Schema[];
  additionalProperties?: boolean;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, {
    parameters?: Array<{ name: string; in: string; required?: boolean }>;
    requestBody?: {
      content?: Record<string, { schema?: Schema }>;
    };
    responses?: Record<string, {
      content?: Record<string, { schema?: Schema }>;
    }>;
    security?: Array<Record<string, string[]>>;
    'x-fortemi-authorization'?: Record<string, unknown>;
    'x-fortemi-operation-disposition'?: Record<string, unknown>;
  }>>;
  components: {
    schemas: Record<string, Schema>;
  };
};

const contract = parse(
  readFileSync(path.resolve(process.cwd(), 'src/api/contracts/fortemi-openapi.yaml'), 'utf8'),
) as OpenApiDocument;
const manualLinkReceipt = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), 'src/api/contracts/fortemi-manual-note-link-receipt.json'),
    'utf8',
  ),
) as {
  contract: string;
  producer: Record<string, string>;
  platformCells: Array<{ platform: string; status: string; owner: string }>;
  claimBoundary: Record<string, boolean | string>;
};

function resolveSchema(schema: Schema): Schema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.match(/^#\/components\/schemas\/(.+)$/)?.[1];
  if (!name || !contract.components.schemas[name]) {
    throw new Error(`unsupported schema reference: ${schema.$ref}`);
  }
  return contract.components.schemas[name];
}

function validateSchema(input: unknown, unresolved: Schema, location = '$'): void {
  const schema = resolveSchema(unresolved);
  if (schema.enum && !schema.enum.includes(input)) {
    throw new Error(`${location} is not an allowed enum value`);
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => {
      try {
        validateSchema(input, candidate, location);
        return true;
      } catch {
        return false;
      }
    });
    if (matches.length !== 1) throw new Error(`${location} does not match exactly one schema`);
    return;
  }
  for (const candidate of schema.allOf ?? []) validateSchema(input, candidate, location);

  const types = typeof schema.type === 'string' ? [schema.type] : schema.type;
  if (!types) return;
  if (input === null) {
    if (!types.includes('null')) throw new Error(`${location} cannot be null`);
    return;
  }
  const actualType = Array.isArray(input) ? 'array' : typeof input;
  const matchesType = types.some((type) =>
    type === actualType || (type === 'integer' && actualType === 'number' && Number.isInteger(input)),
  );
  if (!matchesType) throw new Error(`${location} must be ${types.join(' or ')}`);

  if (actualType === 'array' && schema.items) {
    (input as unknown[]).forEach((item, index) =>
      validateSchema(item, schema.items as Schema, `${location}[${index}]`),
    );
  }
  if (actualType === 'object') {
    const object = input as Record<string, unknown>;
    for (const field of schema.required ?? []) {
      if (!(field in object)) throw new Error(`${location}.${field} is required`);
    }
    for (const [field, value] of Object.entries(object)) {
      const property = schema.properties?.[field];
      if (property) validateSchema(value, property, `${location}.${field}`);
      else if (schema.additionalProperties === false) {
        throw new Error(`${location}.${field} is not allowed`);
      }
    }
  }
}

const callDetail = {
  call_id: '018f2d2d-bc00-7cc8-8ad2-f147d6a2e77a',
  provider: 'twilio',
  provider_call: { provider_call_id_present: true, provider_call_id_len: 34 },
  started_at: '2026-07-14T12:00:00Z',
  ended_at: null,
  end_reason: null,
  duration_secs: null,
  asr_backend_len: 7,
  remote_party_present: true,
  remote_party_len: 12,
  archive_id: null,
  metadata_class: 'object',
  metadata_len: 22,
  segment_count: 1,
  segments: [{
    id: '018f2d2d-bc00-7cc8-8ad2-f147d6a2e77b',
    call_id: '018f2d2d-bc00-7cc8-8ad2-f147d6a2e77a',
    text: 'hello',
    sequence: 0,
    created_at: '2026-07-14T12:00:01Z',
    speaker_label: null,
    start_ts: 0,
    end_ts: 2.5,
    confidence: 0.98,
  }],
  pagination: { total: 1, limit: 1, offset: 0, has_more: false },
};

describe('delivered Fortemi OpenAPI boundary', () => {
  const operation = contract.paths['/api/v1/calls/{id}'].get;
  const responseSchema = operation.responses?.['200'].content?.['application/json'].schema;
  const rateLimitSchema =
    operation.responses?.['429'].content?.['application/problem+json'].schema;

  it('serializes the producer path and query parameters and accepts its response schema', async () => {
    expect(operation.parameters?.map(({ name, in: location, required }) => ({
      name,
      location,
      required: Boolean(required),
    }))).toEqual([
      { name: 'id', location: 'path', required: true },
      { name: 'limit', location: 'query', required: false },
      { name: 'offset', location: 'query', required: false },
    ]);
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(responseSchema).toBeDefined();

    const get = vi.fn().mockResolvedValue(callDetail);
    const api = createCallsApi({ get } as unknown as ApiClient);
    const response = await api.getCall('call/id', { limit: 1, offset: 0 });

    expect(get).toHaveBeenCalledWith('/calls/call%2Fid', { limit: '1', offset: '0' });
    expect(() => validateSchema(response, responseSchema as Schema)).not.toThrow();
  });

  it('rejects a transcript segment that omits a producer-required field', () => {
    const malformed = structuredClone(callDetail);
    const { sequence: _sequence, ...withoutSequence } = malformed.segments[0];
    malformed.segments = [withoutSequence as typeof malformed.segments[number]];

    expect(() => validateSchema(malformed, responseSchema as Schema)).toThrow(
      '$.segments[0].sequence is required',
    );
  });

  it('accepts the producer ProblemDetails error boundary and rejects malformed errors', () => {
    const problem = {
      type: 'https://fortemi.com/problems/rate-limit-exceeded',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many requests. Please wait before retrying.',
      instance: null,
    };

    expect(rateLimitSchema?.$ref).toBe('#/components/schemas/ProblemDetails');
    expect(() => validateSchema(problem, rateLimitSchema as Schema)).not.toThrow();
    expect(() => validateSchema({ ...problem, status: '429' }, rateLimitSchema as Schema)).toThrow(
      '$.status must be integer',
    );
  });
});

describe('manual-note-link-v1 delivered boundary', () => {
  const operation = contract.paths['/api/v1/notes/{id}/links'].post;
  const requestSchema = operation.requestBody?.content?.['application/json'].schema as Schema;
  const createdSchema = operation.responses?.['201'].content?.['application/json'].schema as Schema;
  const replaySchema = operation.responses?.['200'].content?.['application/json'].schema as Schema;

  it('binds the immutable producer and records every deferred platform cell', () => {
    expect(manualLinkReceipt).toEqual(expect.objectContaining({
      contract: 'manual-note-link-v1',
      producer: expect.objectContaining({
        commit: '0dd28a9255e2b53363f93e2e288777631709eb05',
        openapiSha256: '652bcce252719e5c0ced015beae02e41380c56dccaa5dc071d369b3ac6fdd858',
        contractRevision: '2',
        contractVersion: '2026.9.0',
      }),
    }));
    expect(manualLinkReceipt.platformCells.map(({ platform }) => platform)).toEqual([
      'linux-x86_64', 'linux-arm64', 'macos-arm64',
    ]);
    expect(manualLinkReceipt.platformCells).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'deferred', owner: 'Fortemi/HotM#10' }),
    ]));
    expect(manualLinkReceipt.claimBoundary).toEqual(expect.objectContaining({
      fullCompatibility: false,
      suiteParity: false,
      portableBackup: false,
      liveMutationConformance: false,
    }));
  });

  it('pins typed request, response, bearer, and hosted authorization metadata', async () => {
    const source = '018fd1a0-0000-7000-8000-000000000001';
    const target = '018fd1a0-0000-7000-8000-000000000002';
    const request = { to_note_id: target, kind: 'explicit' as const, score: 0.75 };
    const response = {
      id: '018fd1a0-0000-7000-8000-000000000003',
      from_note_id: source,
      to_note_id: target,
      kind: 'explicit',
      score: 0.75,
      created_at_utc: '2026-09-01T20:00:00Z',
      created: true,
    };
    const post = vi.fn().mockResolvedValue(response);
    const api = createLinksApi({ post } as unknown as ApiClient);

    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation['x-fortemi-authorization']).toEqual(expect.objectContaining({
      policy_class: 'tenant_object',
      required_scopes: ['write'],
      target_visibility_check: true,
      tenant_transaction_required: true,
    }));
    expect(operation['x-fortemi-operation-disposition']).toEqual(expect.objectContaining({
      contract: 'manual-note-link-v1',
      status: 'supported',
    }));
    expect(() => validateSchema(request, requestSchema)).not.toThrow();
    expect(() => validateSchema({ ...request, metadata: { token: 'private' } }, requestSchema))
      .toThrow('$.metadata is not allowed');
    await expect(api.createManualLink(source, request)).resolves.toEqual(response);
    expect(post).toHaveBeenCalledWith(`/notes/${source}/links`, request);
    expect(() => validateSchema(response, createdSchema)).not.toThrow();
    expect(() => validateSchema({ ...response, created: false }, replaySchema)).not.toThrow();
  });

  it('declares and consumes every success and ProblemDetails status without null drift', () => {
    expect(Object.keys(operation.responses ?? {}).sort()).toEqual([
      '200', '201', '400', '401', '403', '404', '409', '429', '500',
    ]);
    for (const status of ['400', '401', '403', '404', '409', '429', '500']) {
      expect(operation.responses?.[status].content?.['application/problem+json'].schema?.$ref)
        .toBe('#/components/schemas/ProblemDetails');
    }
    expect(() => validateSchema({
      to_note_id: '018fd1a0-0000-7000-8000-000000000002',
      kind: 'explicit',
      score: null,
    }, requestSchema)).not.toThrow();
    expect(() => validateSchema({
      id: '018fd1a0-0000-7000-8000-000000000003',
      from_note_id: '018fd1a0-0000-7000-8000-000000000001',
      to_note_id: '018fd1a0-0000-7000-8000-000000000002',
      kind: 'explicit',
      score: null,
      created_at_utc: '2026-09-01T20:00:00Z',
      created: true,
    }, createdSchema)).toThrow('$.score cannot be null');
  });
});
