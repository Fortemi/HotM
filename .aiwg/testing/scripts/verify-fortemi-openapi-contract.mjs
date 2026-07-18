#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const hotmRoot = resolve(import.meta.dirname, '../../..');
const fortemiRoot = resolve(process.argv[2]?.startsWith('--') ? '../fortemi' : process.argv[2] ?? '../fortemi');
const contractsRoot = resolve(hotmRoot, 'ui/src/api/contracts');
const receiptPath = resolve(contractsRoot, 'fortemi-openapi-receipt.json');
const contractPath = resolve(contractsRoot, 'fortemi-openapi.yaml');
const skewPath = resolve(contractsRoot, 'fortemi-openapi-skew-fixtures.json');
const require = createRequire(resolve(hotmRoot, 'ui/package.json'));
const YAML = require('yaml');

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const PROBLEM_SCHEMA_REF = '#/components/schemas/ProblemDetails';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function semanticView(document) {
  const paths = {};
  for (const pathName of Object.keys(document.paths ?? {}).sort()) {
    const pathItem = document.paths[pathName];
    const operations = {};
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      operations[method] = {
        operationId: operation.operationId,
        parameters: [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])],
        requestBody: operation.requestBody ?? null,
        responses: operation.responses ?? null,
        security: operation.security ?? null,
      };
    }
    paths[pathName] = operations;
  }

  return stable({
    openapi: document.openapi,
    contractRevision: document['x-fortemi-contract']?.contract_revision,
    errorContract: document['x-fortemi-error-contract'],
    securitySchemes: document.components?.securitySchemes,
    schemas: document.components?.schemas,
    paths,
  });
}

function semanticHash(document) {
  return sha256(JSON.stringify(semanticView(document)));
}

function walkSchemas(value, stats) {
  if (Array.isArray(value)) {
    for (const entry of value) walkSchemas(entry, stats);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value.type) && value.type.includes('null')) stats.nullableSchemas += 1;
  if (Array.isArray(value.enum)) stats.enumSchemas += 1;
  for (const child of Object.values(value)) walkSchemas(child, stats);
}

function contractStatistics(document) {
  const stats = {
    paths: Object.keys(document.paths ?? {}).length,
    operations: 0,
    parameters: 0,
    requestBodies: 0,
    responses: 0,
    responseSchemas: 0,
    schemaBearingOperations: 0,
    problemResponses: 0,
    nullableSchemas: 0,
    enumSchemas: 0,
    publicOperations: 0,
    protectedOperations: 0,
  };

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      stats.operations += 1;
      stats.parameters += (pathItem.parameters?.length ?? 0) + (operation.parameters?.length ?? 0);
      if (operation.requestBody) stats.requestBodies += 1;
      const responses = Object.values(operation.responses ?? {});
      const schemaResponses = responses.filter((response) =>
        Object.values(response?.content ?? {}).some((media) => media?.schema),
      );
      stats.responses += responses.length;
      stats.responseSchemas += schemaResponses.length;
      if (schemaResponses.length > 0) stats.schemaBearingOperations += 1;
      if (
        operation.responses?.['429']?.content?.['application/problem+json']?.schema?.$ref ===
        PROBLEM_SCHEMA_REF
      ) {
        stats.problemResponses += 1;
      }
      if (Array.isArray(operation.security) && operation.security.length === 0) {
        stats.publicOperations += 1;
      } else {
        stats.protectedOperations += 1;
      }
    }
  }
  walkSchemas(document.components?.schemas, stats);
  return stats;
}

function validateDocument(document, receipt) {
  if (document.openapi !== '3.1.0') throw new Error(`unsupported OpenAPI version: ${document.openapi}`);
  if (!receipt.consumer.acceptedContractRevisions.includes(document['x-fortemi-contract']?.contract_revision)) {
    throw new Error('unsupported contract revision');
  }
  if (document.info?.version !== receipt.producer.contractVersion) {
    throw new Error(`producer contract version mismatch: ${document.info?.version}`);
  }
  const bearer = document.components?.securitySchemes?.bearerAuth;
  if (bearer?.type !== 'http' || bearer?.scheme !== 'bearer') {
    throw new Error('missing HTTP bearer security scheme');
  }
  const problem = document.components?.schemas?.ProblemDetails;
  if (!problem || !['type', 'title', 'status', 'detail'].every((field) => problem.required?.includes(field))) {
    throw new Error('ProblemDetails error schema is incomplete');
  }
  if (!Array.isArray(document['x-fortemi-error-contract']?.problem_types)) {
    throw new Error('problem error catalog is missing');
  }

  for (const [pathName, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      if (!operation.operationId) throw new Error(`missing operationId: ${method} ${pathName}`);
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        throw new Error(`missing responses: ${method} ${pathName}`);
      }
      const rateLimitSchema =
        operation.responses['429']?.content?.['application/problem+json']?.schema?.$ref;
      if (rateLimitSchema !== PROBLEM_SCHEMA_REF) {
        throw new Error(`missing shared 429 ProblemDetails response: ${method} ${pathName}`);
      }
      if (!Array.isArray(operation.security)) {
        throw new Error(`missing explicit security: ${method} ${pathName}`);
      }
    }
  }
}

function semanticDifferences(expected, actual) {
  const differences = [];
  const expectedView = semanticView(expected);
  const actualView = semanticView(actual);
  for (const category of ['openapi', 'contractRevision', 'errorContract', 'securitySchemes', 'schemas']) {
    if (JSON.stringify(expectedView[category]) !== JSON.stringify(actualView[category])) {
      differences.push(category);
    }
  }
  const paths = new Set([...Object.keys(expectedView.paths), ...Object.keys(actualView.paths)]);
  for (const pathName of [...paths].sort()) {
    const expectedPath = expectedView.paths[pathName];
    const actualPath = actualView.paths[pathName];
    if (!expectedPath || !actualPath) {
      differences.push(`path:${pathName}`);
      continue;
    }
    for (const method of HTTP_METHODS) {
      const expectedOperation = expectedPath[method];
      const actualOperation = actualPath[method];
      if (!expectedOperation && !actualOperation) continue;
      if (!expectedOperation || !actualOperation) {
        differences.push(`operation:${method}:${pathName}`);
        continue;
      }
      for (const category of ['operationId', 'parameters', 'requestBody', 'responses', 'security']) {
        if (
          JSON.stringify(expectedOperation[category]) !==
          JSON.stringify(actualOperation[category])
        ) {
          differences.push(`${category}:${method}:${pathName}`);
        }
      }
    }
  }
  return differences;
}

function applyFixtureMutation(document, mutation) {
  if (mutation === 'none' || mutation === 'version-only') return;
  if (mutation === 'remove-call-response-schema') {
    delete document.paths['/api/v1/calls/{id}'].get.responses['200'].content;
    return;
  }
  throw new Error(`unknown fixture mutation: ${mutation}`);
}

function assessCompatibility(document, receipt) {
  if (!receipt.consumer.acceptedContractVersions.includes(document.info?.version)) {
    return { result: 'incompatible', reason: 'unsupported-contract-version' };
  }
  if (semanticHash(document) !== receipt.consumer.semanticSha256) {
    return { result: 'incompatible', reason: 'semantic-breaking-change' };
  }
  return { result: 'compatible' };
}

function assertSemanticMutationRejected(document, receipt, name, mutate) {
  const fixture = structuredClone(document);
  mutate(fixture);
  const result = assessCompatibility(fixture, receipt);
  if (result.result !== 'incompatible' || result.reason !== 'semantic-breaking-change') {
    throw new Error(`${name} negative fixture was not rejected as a semantic change`);
  }
}

function assertValidationMutationRejected(document, receipt, name, expectedMessage, mutate) {
  const fixture = structuredClone(document);
  mutate(fixture);
  try {
    validateDocument(fixture, receipt);
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return;
    throw error;
  }
  throw new Error(`${name} negative fixture passed document validation`);
}

function runFocusedNegativeFixtures(document, receipt) {
  assertSemanticMutationRejected(document, receipt, 'parameter', (fixture) => {
    fixture.paths['/api/v1/calls/{id}'].get.parameters.pop();
  });
  assertSemanticMutationRejected(document, receipt, 'request body', (fixture) => {
    delete fixture.paths['/api/v1/notes'].post.requestBody;
  });
  assertSemanticMutationRejected(document, receipt, 'response schema', (fixture) => {
    delete fixture.paths['/api/v1/calls/{id}'].get.responses['200'].content;
  });
  assertSemanticMutationRejected(document, receipt, 'response status', (fixture) => {
    delete fixture.paths['/api/v1/calls/{id}'].get.responses['404'];
  });
  assertSemanticMutationRejected(document, receipt, 'shared error response', (fixture) => {
    delete fixture.paths['/health/live'].get.responses['429'].content;
  });
  assertValidationMutationRejected(
    document,
    receipt,
    'shared error response',
    'missing shared 429 ProblemDetails response: get /health/live',
    (fixture) => {
      delete fixture.paths['/health/live'].get.responses['429'].content;
    },
  );
  assertSemanticMutationRejected(document, receipt, 'error payload', (fixture) => {
    fixture['x-fortemi-error-contract'].problem_types.pop();
  });
  assertSemanticMutationRejected(document, receipt, 'nullability', (fixture) => {
    fixture.components.schemas.ProblemDetails.properties.instance.type = 'string';
  });
  assertSemanticMutationRejected(document, receipt, 'enum', (fixture) => {
    fixture.components.schemas.ChunkingStrategy.enum.pop();
  });
  assertSemanticMutationRejected(document, receipt, 'security', (fixture) => {
    fixture.paths['/api/v1/calls/{id}'].get.security = [];
  });
}

function runSkewFixtures(document, receipt, skew) {
  for (const fixture of skew.fixtures) {
    const candidate = structuredClone(document);
    candidate.info.version = fixture.contractVersion;
    applyFixtureMutation(candidate, fixture.mutation);
    const assessment = assessCompatibility(candidate, receipt);
    if (
      assessment.result !== fixture.expected ||
      (fixture.reason && assessment.reason !== fixture.reason)
    ) {
      throw new Error(
        `${fixture.name} expected ${fixture.expected}/${fixture.reason ?? '-'}, got ${assessment.result}/${assessment.reason ?? '-'}`,
      );
    }
  }
}

async function main() {
  const [receiptText, contractBytes, skewText] = await Promise.all([
    readFile(receiptPath, 'utf8'),
    readFile(contractPath),
    readFile(skewPath, 'utf8'),
  ]);
  const receipt = JSON.parse(receiptText);
  const skew = JSON.parse(skewText);
  const document = YAML.parse(contractBytes.toString('utf8'));
  const stats = contractStatistics(document);
  const currentSemanticHash = semanticHash(document);

  if (process.argv.includes('--inspect')) {
    console.log(JSON.stringify({ semanticSha256: currentSemanticHash, statistics: stats }, null, 2));
    return;
  }

  validateDocument(document, receipt);
  if (sha256(contractBytes) !== receipt.producer.sha256) {
    throw new Error('vendored OpenAPI checksum does not match receipt');
  }
  if (currentSemanticHash !== receipt.consumer.semanticSha256) {
    throw new Error('vendored OpenAPI semantic fingerprint does not match receipt');
  }
  if (JSON.stringify(stats) !== JSON.stringify(receipt.statistics)) {
    throw new Error(`OpenAPI statistics drift: ${JSON.stringify(stats)}`);
  }

  const producerBytes = execFileSync(
    'git',
    ['-C', fortemiRoot, 'show', `${receipt.producer.commit}:${receipt.producer.path}`],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  const producerDocument = YAML.parse(producerBytes.toString('utf8'));
  if (sha256(producerBytes) !== receipt.producer.sha256 || !contractBytes.equals(producerBytes)) {
    const differences = semanticDifferences(document, producerDocument);
    throw new Error(
      `pinned producer artifact drift; semantic differences=[${differences.join(', ')}]`,
    );
  }

  runFocusedNegativeFixtures(document, receipt);
  runSkewFixtures(document, receipt, skew);

  const receiptArg = process.argv.indexOf('--write-ci-receipt');
  if (receiptArg >= 0) {
    const output = process.argv[receiptArg + 1];
    const consumerCommit = process.env.GITHUB_SHA;
    if (!output || !/^[0-9a-f]{40,64}$/i.test(consumerCommit ?? '')) {
      throw new Error('--write-ci-receipt requires output path and exact GITHUB_SHA');
    }
    await writeFile(
      output,
      `${JSON.stringify({
        schemaVersion: 1,
        producer: receipt.producer,
        consumer: {
          repository: 'Fortemi/HotM',
          commit: consumerCommit,
          semanticProfile: receipt.consumer.semanticProfile,
          semanticSha256: receipt.consumer.semanticSha256,
        },
        statistics: stats,
        skewFixtures: skew.fixtures.map(({ name, expected, reason }) => ({
          name,
          expected,
          ...(reason ? { reason } : {}),
        })),
      }, null, 2)}\n`,
    );
  }

  console.log(
    `Fortemi OpenAPI verified: producer=${receipt.producer.commit} sha256=${receipt.producer.sha256} semantic=${currentSemanticHash} paths=${stats.paths} operations=${stats.operations}`,
  );
}

await main();
