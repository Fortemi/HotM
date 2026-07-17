import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import { createCallsApi } from '../calls';
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
};

type OpenApiDocument = {
  paths: Record<string, Record<string, {
    parameters?: Array<{ name: string; in: string; required?: boolean }>;
    responses?: Record<string, {
      content?: Record<string, { schema?: Schema }>;
    }>;
    security?: Array<Record<string, string[]>>;
  }>>;
  components: {
    schemas: Record<string, Schema>;
  };
};

const contract = parse(
  readFileSync(path.resolve(process.cwd(), 'src/api/contracts/fortemi-openapi.yaml'), 'utf8'),
) as OpenApiDocument;

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
    const problemSchema = contract.components.schemas.ProblemDetails;
    const problem = {
      type: 'https://fortemi.dev/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Call session not found',
      instance: null,
    };

    expect(() => validateSchema(problem, problemSchema)).not.toThrow();
    expect(() => validateSchema({ ...problem, status: '404' }, problemSchema)).toThrow(
      '$.status must be integer',
    );
  });
});
