#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(resolve(import.meta.dirname, '../../../ui/package.json'));
const { parse } = require('yaml');

const hotmRoot = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2] ?? resolve(hotmRoot, '../fortemi'));
const eventCatalogPath = resolve(hotmRoot, 'ui/src/api/contracts/fortemi-event-catalog.json');
const fixturePath = resolve(hotmRoot, 'ui/src/api/contracts/fortemi-asyncapi-event-fixtures.json');
const rulesPath = resolve(hotmRoot, 'ui/src/api/contracts/fortemi-asyncapi-event-validation-rules.json');
const receiptPath = resolve(hotmRoot, '.aiwg/evidence/fortemi-asyncapi-payload-conformance-receipt.json');
const sidecarReceiptPath = resolve(hotmRoot, 'release/sidecar-provenance.json');

const UUIDS = {
  event: '019508a0-1234-7def-8000-abcdef123456',
  note: '019508a0-1234-7def-8000-abcdef123457',
  job: '019508a0-1234-7def-8000-abcdef123458',
  attachment: '019508a0-1234-7def-8000-abcdef123459',
  collection: '019508a0-1234-7def-8000-abcdef12345a',
  archive: '019508a0-1234-7def-8000-abcdef12345b',
  concept: '019508a0-1234-7def-8000-abcdef12345c',
  scheme: '019508a0-1234-7def-8000-abcdef12345d',
  correlation: '019508a0-1234-7def-8000-abcdef12345e',
  causation: '019508a0-1234-7def-8000-abcdef12345f',
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function getByPointer(document, pointer) {
  if (!pointer.startsWith('#/')) {
    throw new Error(`unsupported ref: ${pointer}`);
  }
  return pointer.slice(2).split('/').reduce((node, segment) => {
    if (!node || typeof node !== 'object') {
      throw new Error(`unresolvable ref segment ${segment} in ${pointer}`);
    }
    return node[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
  }, document);
}

function resolveSchema(document, schema) {
  if (schema?.$ref) return resolveSchema(document, getByPointer(document, schema.$ref));
  return schema;
}

function typeMatches(type, value) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

function validateSchema(document, schema, value, path = '$') {
  const resolved = resolveSchema(document, schema);
  const errors = [];

  if (resolved.allOf) {
    for (const item of resolved.allOf) {
      errors.push(...validateSchema(document, item, value, path));
    }
  }

  if (resolved.oneOf) {
    const results = resolved.oneOf.map((item) => validateSchema(document, item, value, path));
    const passing = results.filter((result) => result.length === 0);
    if (passing.length !== 1) {
      errors.push(`${path} must match exactly one schema, matched ${passing.length}`);
    }
  }

  if (resolved.enum && !resolved.enum.includes(value)) {
    errors.push(`${path} must equal one of ${resolved.enum.join(', ')}`);
  }

  if (resolved.type) {
    const types = Array.isArray(resolved.type) ? resolved.type : [resolved.type];
    if (!types.some((type) => typeMatches(type, value))) {
      errors.push(`${path} must be ${types.join(' or ')}`);
      return errors;
    }
  }

  if (resolved.format === 'uuid' && value !== null && typeof value === 'string' && !uuidPattern.test(value)) {
    errors.push(`${path} must be a uuid`);
  }

  if (resolved.format === 'date-time' && typeof value === 'string' && Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be date-time`);
  }

  if (typeof resolved.minimum === 'number' && typeof value === 'number' && value < resolved.minimum) {
    errors.push(`${path} must be >= ${resolved.minimum}`);
  }

  if (resolved.type === 'object' || resolved.properties) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path} must be object`);
      return errors;
    }
    for (const key of resolved.required ?? []) {
      if (!(key in value)) {
        errors.push(`${path}.${key} is required`);
      }
    }
    for (const [key, childSchema] of Object.entries(resolved.properties ?? {})) {
      if (key in value) {
        errors.push(...validateSchema(document, childSchema, value[key], `${path}.${key}`));
      }
    }
  }

  if (resolved.type === 'array' || resolved.items) {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be array`);
    } else {
      value.forEach((item, index) => {
        errors.push(...validateSchema(document, resolved.items ?? {}, item, `${path}[${index}]`));
      });
    }
  }

  return errors;
}

function sampleString(key, schema) {
  if (schema.format === 'uuid') {
    if (key.includes('note')) return UUIDS.note;
    if (key.includes('job')) return UUIDS.job;
    if (key.includes('attachment')) return UUIDS.attachment;
    if (key.includes('collection')) return UUIDS.collection;
    if (key.includes('archive')) return UUIDS.archive;
    if (key.includes('concept')) return UUIDS.concept;
    if (key.includes('scheme')) return UUIDS.scheme;
    if (key.includes('correlation')) return UUIDS.correlation;
    if (key.includes('causation')) return UUIDS.causation;
    return UUIDS.event;
  }
  if (schema.format === 'date-time') return '2026-07-17T12:00:00.000Z';
  if (key === 'type') return 'SampleEvent';
  if (key === 'job_type') return 'Embedding';
  if (key === 'message') return 'Processing schema-derived AsyncAPI fixture';
  if (key === 'error') return 'fixture failure';
  if (key === 'title') return 'AsyncAPI fixture note';
  if (key === 'filename') return 'fixture.pdf';
  if (key === 'name') return 'Default';
  if (key === 'relation_type') return 'broader';
  if (key === 'scope') return 'global';
  if (key === 'default_backend') return 'ollama';
  if (key === 'embedding_backend') return 'ollama';
  if (key.includes('tag')) return 'fixture-tag';
  return `fixture-${key.replaceAll('_', '-')}`;
}

function sampleValue(document, key, schema) {
  const resolved = resolveSchema(document, schema);
  if (resolved.enum) return resolved.enum[0];
  if (resolved.allOf) return sampleValue(document, key, resolved.allOf[0]);
  if (resolved.oneOf) return sampleValue(document, key, resolved.oneOf[0]);

  const types = Array.isArray(resolved.type) ? resolved.type.filter((type) => type !== 'null') : [resolved.type];
  const type = types[0] ?? (resolved.properties ? 'object' : 'string');
  if (type === 'object') {
    const object = {};
    for (const childKey of resolved.required ?? Object.keys(resolved.properties ?? {})) {
      object[childKey] = sampleValue(document, childKey, resolved.properties[childKey]);
    }
    return object;
  }
  if (type === 'array') {
    return key === 'changed_fields' ? ['default_backend'] : ['fixture'];
  }
  if (type === 'integer') return resolved.minimum ?? 1;
  if (type === 'boolean') return false;
  return sampleString(key, resolved);
}

function buildPayloadExample(document, variantSchema) {
  const payload = {};
  const propertyNames = new Set([
    ...(variantSchema.required ?? []),
    ...Object.keys(variantSchema.properties ?? {}),
  ]);
  for (const key of propertyNames) {
    payload[key] = sampleValue(document, key, variantSchema.properties[key]);
  }
  return payload;
}

function entityIdForPayload(payload) {
  return payload.note_id
    ?? payload.attachment_id
    ?? payload.collection_id
    ?? payload.archive_id
    ?? payload.concept_id
    ?? payload.scheme_id
    ?? payload.job_id
    ?? null;
}

function buildEnvelope(message, payload, index) {
  return {
    actor: { kind: 'system', id: 'asyncapi-payload-verifier', name: 'AsyncAPI payload verifier' },
    causation_id: UUIDS.causation,
    correlation_id: UUIDS.correlation,
    entity_id: entityIdForPayload(payload),
    entity_type: message['x-entity-type'] ?? null,
    event_id: `${UUIDS.event.slice(0, -2)}${index.toString(16).padStart(2, '0')}`,
    event_type: message['x-event-type'],
    memory: 'default',
    occurred_at: '2026-07-17T12:00:00.000Z',
    payload,
    payload_version: 1,
    tenant_id: null,
  };
}

function mutatePayload(payload, requiredKeys) {
  const mutated = structuredClone(payload);
  const key = requiredKeys.find((item) => item !== 'type') ?? 'type';
  delete mutated[key];
  return {
    category: 'missing_required_field',
    name: `missing_required_payload_${key}`,
    payload: mutated,
  };
}

function schemaTypes(schema) {
  const type = schema?.type;
  return Array.isArray(type) ? type : [type].filter(Boolean);
}

function isNullable(schema) {
  return schemaTypes(schema).includes('null');
}

function findField(variant, predicate) {
  for (const [key, schema] of Object.entries(variant.properties ?? {})) {
    if (predicate(key, schema)) return [key, schema];
  }
  return null;
}

function wrongTypeValue(types) {
  if (types.includes('string')) return 42;
  if (types.includes('integer')) return 'not-an-integer';
  if (types.includes('boolean')) return 'not-a-boolean';
  if (types.includes('array')) return 'not-an-array';
  if (types.includes('object')) return 'not-an-object';
  return null;
}

function buildNegativeMutations(envelope, variant) {
  const payload = envelope.payload;
  const mutations = [];
  mutations.push({
    category: 'missing_required_field',
    ...mutatePayload(payload, variant.required ?? {}),
  });

  const enumField = findField(variant, (_key, schema) => Array.isArray(schema.enum));
  if (enumField) {
    const [key] = enumField;
    const mutated = structuredClone(envelope);
    mutated.payload[key] = '__invalid_enum__';
    mutations.push({
      category: 'enum_violation',
      name: `invalid_enum_payload_${key}`,
      envelope: mutated,
    });
  }

  const nullabilityField = findField(variant, (key, schema) => (
    key !== 'type'
    && (variant.required ?? []).includes(key)
    && !isNullable(schema)
  )) ?? enumField;
  if (nullabilityField) {
    const [key] = nullabilityField;
    const mutated = structuredClone(envelope);
    mutated.payload[key] = null;
    mutations.push({
      category: 'nullability_violation',
      name: `invalid_null_payload_${key}`,
      envelope: mutated,
    });
  }

  const identifierField = findField(variant, (_key, schema) => schema.format === 'uuid');
  if (identifierField) {
    const [key] = identifierField;
    const mutated = structuredClone(envelope);
    mutated.payload[key] = 'not-a-uuid';
    mutations.push({
      category: 'identifier_format_violation',
      name: `invalid_uuid_payload_${key}`,
      envelope: mutated,
    });
  } else {
    const mutated = structuredClone(envelope);
    mutated.event_id = 'not-a-uuid';
    mutations.push({
      category: 'identifier_format_violation',
      name: 'invalid_uuid_envelope_event_id',
      websocketExpectedUnknown: false,
      envelope: mutated,
    });
  }

  return mutations.map((mutation) => {
    if (!mutation.envelope) {
      mutation.envelope = { ...envelope, payload: mutation.payload };
      delete mutation.payload;
    }
    mutation.websocketExpectedUnknown ??= true;
    return mutation;
  });
}

function typeRule(schema) {
  const types = schemaTypes(schema);
  return {
    types,
    nullable: types.includes('null'),
    enum: schema.enum ?? undefined,
    format: schema.format ?? undefined,
    items: schema.items ? typeRule(schema.items) : undefined,
  };
}

function buildValidationRule(message, variant) {
  return {
    eventType: message['x-event-type'],
    legacyType: variant.properties.type.enum[0],
    required: variant.required ?? [],
    fields: Object.fromEntries(
      Object.entries(variant.properties ?? {}).map(([key, schema]) => [key, typeRule(schema)]),
    ),
  };
}

function assertNoErrors(label, errors) {
  if (errors.length > 0) {
    throw new Error(`${label}: ${errors.join('; ')}`);
  }
}

const [eventCatalogText, sidecarReceiptText] = await Promise.all([
  readFile(eventCatalogPath, 'utf8'),
  readFile(sidecarReceiptPath, 'utf8'),
]);
const eventCatalog = JSON.parse(eventCatalogText);
const sidecarReceipt = JSON.parse(sidecarReceiptText);

if (eventCatalog.producer.repository !== sidecarReceipt.source_repository) {
  throw new Error(`producer repository mismatch: ${eventCatalog.producer.repository} != ${sidecarReceipt.source_repository}`);
}
if (eventCatalog.producer.commit !== sidecarReceipt.target_commitish) {
  throw new Error(`producer commit mismatch: ${eventCatalog.producer.commit} != ${sidecarReceipt.target_commitish}`);
}

const asyncApiPath = resolve(fortemiRoot, eventCatalog.producer.asyncApi.artifactPath);
const producerEventSourcePath = resolve(fortemiRoot, eventCatalog.producer.sourcePath);
const producerApiSourcePath = resolve(fortemiRoot, 'crates/matric-api/src/main.rs');
const [asyncApiText, producerEventSourceText, producerApiSourceText] = await Promise.all([
  readFile(asyncApiPath, 'utf8'),
  readFile(producerEventSourcePath, 'utf8'),
  readFile(producerApiSourcePath, 'utf8'),
]);
const asyncApiSha256 = sha256(asyncApiText);
if (asyncApiSha256 !== eventCatalog.producer.asyncApi.sha256) {
  throw new Error(`AsyncAPI sha mismatch: ${asyncApiSha256} != ${eventCatalog.producer.asyncApi.sha256}`);
}
if (Buffer.byteLength(asyncApiText) !== eventCatalog.producer.asyncApi.sizeBytes) {
  throw new Error('AsyncAPI byte length mismatch');
}

const asyncApi = parse(asyncApiText);
const messages = asyncApi.channels?.events?.messages ?? {};
const variants = asyncApi.components?.schemas?.ServerEvent?.oneOf ?? [];
const variantByType = new Map(variants.map((variant) => [variant.properties?.type?.enum?.[0], variant]));
const eventTypes = Object.values(messages).map((message) => message['x-event-type']).sort();

if (JSON.stringify(eventTypes) !== JSON.stringify([...eventCatalog.eventTypes].sort())) {
  throw new Error('AsyncAPI channel event types differ from pinned event catalog');
}

const cases = [];
const negatives = [];
const negativeCountsByCategory = {};
const validationRules = [];
let index = 1;
for (const [messageKey, message] of Object.entries(messages).sort(([a], [b]) => a.localeCompare(b))) {
  const payloadType = message.title;
  const variant = variantByType.get(payloadType);
  if (!variant) {
    throw new Error(`missing ServerEvent schema for ${payloadType}`);
  }

  const payload = buildPayloadExample(asyncApi, variant);
  const envelope = buildEnvelope(message, payload, index);
  assertNoErrors(`${messageKey} envelope`, validateSchema(asyncApi, message.payload, envelope));
  assertNoErrors(`${messageKey} payload`, validateSchema(asyncApi, variant, payload));

  const mutations = buildNegativeMutations(envelope, variant);
  for (const mutation of mutations) {
    const errors = validateSchema(asyncApi, message.payload, mutation.envelope);
    if (errors.length === 0) {
      throw new Error(`${messageKey} ${mutation.name} unexpectedly passed`);
    }
    negativeCountsByCategory[mutation.category] = (negativeCountsByCategory[mutation.category] ?? 0) + 1;
    negatives.push({
      messageKey,
      eventType: message['x-event-type'],
      legacyType: payloadType,
      category: mutation.category,
      mutation: mutation.name,
      envelope: mutation.envelope,
      websocketPayload: mutation.envelope.payload,
      websocketExpectedUnknown: mutation.websocketExpectedUnknown,
      errors,
    });
  }

  cases.push({
    messageKey,
    eventType: message['x-event-type'],
    legacyType: payloadType,
    expectedBucket: payloadType,
    priority: message['x-priority'],
    entityType: message['x-entity-type'] ?? null,
    envelope,
    websocketPayload: payload,
    sseFrame: {
      event: message['x-event-type'],
      id: envelope.event_id,
      data: stableJson(envelope),
    },
  });
  validationRules.push(buildValidationRule(message, variant));
  index += 1;
}

const fixture = {
  schemaVersion: 1,
  description: 'Schema-derived fixture corpus for Fortemi AsyncAPI EventEnvelope and ServerEvent payload conformance. This is not producer-owned example material; it is derived from @tests ../fortemi/contracts/asyncapi/asyncapi.yaml for Gitea HotM issue #288.',
  producer: eventCatalog.producer,
  generatedAt: new Date().toISOString(),
  sourceKind: 'schema-derived',
  producerOwnedExamples: {
    found: false,
    inspectedSources: [
      {
        path: eventCatalog.producer.sourcePath,
        sha256: sha256(producerEventSourceText),
        material: 'Rust ServerEvent/EventEnvelope unit tests and metadata, not pinned JSON example corpus',
      },
      {
        path: 'crates/matric-api/src/main.rs',
        sha256: sha256(producerApiSourceText),
        material: 'Rust SSE flow tests collect runtime JSON values, not pinned reusable example corpus',
      },
      {
        path: eventCatalog.producer.asyncApi.artifactPath,
        sha256: asyncApiSha256,
        material: 'Pinned AsyncAPI schema artifact used to derive fixtures',
      },
    ],
    acceptanceGap: 'No producer-owned pinned JSON/YAML positive example corpus for every event payload was found in the pinned Fortemi checkout.',
  },
  cases,
  negativeMutations: negatives,
  negativeMutationCountsByCategory: negativeCountsByCategory,
  unknownEventCase: {
    eventType: 'future.domain.changed',
    envelope: {
      actor: { kind: 'system' },
      event_id: UUIDS.event,
      event_type: 'future.domain.changed',
      occurred_at: '2026-07-17T12:00:00.000Z',
      payload_version: 1,
      payload: {
        type: 'FutureDomainChanged',
        important: 'preserve me',
        nested: { value: 7 },
      },
    },
  },
};
const fixtureText = `${JSON.stringify(fixture, null, 2)}\n`;
const fixtureSha256 = sha256(fixtureText);
const websocketMalformedKnownEventsExpectedUnknown = negatives.filter(
  (mutation) => mutation.websocketExpectedUnknown,
).length;
const rules = {
  schemaVersion: 1,
  description: 'Schema-derived runtime validation rules for known Fortemi AsyncAPI event payloads.',
  producer: eventCatalog.producer,
  sourceKind: 'schema-derived',
  generatedAt: fixture.generatedAt,
  rules: validationRules,
};
const rulesText = `${JSON.stringify(rules, null, 2)}\n`;
const rulesSha256 = sha256(rulesText);

const receipt = {
  schemaVersion: 1,
  issue: 'Fortemi/HotM#288',
  generatedAt: fixture.generatedAt,
  producer: eventCatalog.producer,
  verifier: '.aiwg/testing/scripts/verify-fortemi-asyncapi-payloads.mjs',
  asyncApi: {
    path: eventCatalog.producer.asyncApi.artifactPath,
    sha256: asyncApiSha256,
    sizeBytes: Buffer.byteLength(asyncApiText),
    version: asyncApi.asyncapi,
  },
  corpus: {
    fixturePath: 'ui/src/api/contracts/fortemi-asyncapi-event-fixtures.json',
    sha256: fixtureSha256,
    sourceKind: 'schema-derived',
    producerOwnedExamplesFound: false,
    positiveCases: cases.length,
    negativeMutations: negatives.length,
    negativeMutationCountsByCategory: negativeCountsByCategory,
    eventTypes,
  },
  validationRules: {
    path: 'ui/src/api/contracts/fortemi-asyncapi-event-validation-rules.json',
    sha256: rulesSha256,
    rules: validationRules.length,
  },
  producerExampleInspection: fixture.producerOwnedExamples,
  decoderResults: {
    sse: {
      positiveCasesExpected: cases.length,
      malformedKnownEventsExpectedUnknown: negatives.length,
      unknownRawPreservationExpected: true,
      verifiedBy: 'npm run test -- --run src/api/__tests__/events.test.ts src/services/__tests__/realtimeEventBus.test.ts',
    },
    websocket: {
      positiveCasesExpected: cases.length,
      malformedKnownEventsExpectedUnknown: websocketMalformedKnownEventsExpectedUnknown,
      envelopeOnlyIdentifierMutationsNotApplicable: negatives.length - websocketMalformedKnownEventsExpectedUnknown,
      unknownRawPreservationExpected: true,
      verifiedBy: 'npm run test -- --run src/api/__tests__/events.test.ts src/services/__tests__/realtimeEventBus.test.ts',
    },
  },
  acceptanceGaps: [
    'No producer-owned pinned JSON/YAML positive example corpus for every event payload was found in the pinned Fortemi checkout; corpus remains schema-derived.',
  ],
  assertions: {
    sidecarProvenanceMatchesPinnedProducer: true,
    channelMessagesMatchPinnedCatalog: true,
    allMessagePayloadRefsResolveToEventEnvelope: cases.length === Object.keys(messages).length,
    allServerEventVariantsHavePositivePayloads: cases.length === variants.length,
    allPositiveEnvelopesValidate: true,
    allPositivePayloadsValidate: true,
    allNegativeMutationsFailValidation: true,
    everyApplicableNegativeCategoryCovered: Object.keys(negativeCountsByCategory).sort().join(',') === [
      'enum_violation',
      'identifier_format_violation',
      'missing_required_field',
      'nullability_violation',
    ].sort().join(','),
  },
};

await mkdir(dirname(fixturePath), { recursive: true });
await mkdir(dirname(receiptPath), { recursive: true });
await Promise.all([
  writeFile(fixturePath, fixtureText),
  writeFile(rulesPath, rulesText),
  writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`),
]);

console.log(
  `Fortemi AsyncAPI payload conformance verified: ${cases.length} schema-derived positive envelopes, ${negatives.length} negative mutations, fixture sha256 ${fixtureSha256}`,
);
