#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const sourcePath = resolve(root, '.aiwg/api/compatibility/fortemi-v2026-07-operation-coverage.json');
const outputPath = resolve(root, 'ui/src/api/contracts/fortemi-operation-dispositions.json');

const CURATED_AGENT_OPERATIONS = new Set([
  'search_notes',
  'create_note',
  'get_note',
  'create_job',
  'set_note_tags',
  'create_note_link',
  'list_collections',
  'search_concepts',
  'get_related_notes',
  'list_archives',
  'list_notes',
  'list_attachments',
]);

const ADMIN_PATHS = [
  '/api/v1/api-keys',
  '/api/v1/backup',
  '/api/v1/embeddings',
  '/api/v1/graph/diagnostics',
  '/api/v1/inbound-sources',
  '/api/v1/inference/config',
  '/api/v1/pke',
  '/api/v1/webhooks',
  '/oauth/',
];

function privilegeFor(operation) {
  if (
    ADMIN_PATHS.some((prefix) => operation.path.startsWith(prefix))
    || operation.operation_id === 'purge_note'
    || operation.operation_id.includes('jobs_global')
  ) return 'admin';
  if (operation.method === 'DELETE') return 'delete';
  if (['GET', 'HEAD', 'OPTIONS'].includes(operation.method)) return 'read';
  return 'write';
}

function isProtocolExclusion(operation) {
  return operation.path.startsWith('/oauth/')
    || operation.path.startsWith('/api/v1/api-keys')
    || operation.path.startsWith('/api/v1/pke')
    || operation.operation_id.startsWith('tus_')
    || /(upload|download|thumbnail|sprite|subtitles)/.test(operation.operation_id);
}

function dispositionFor(operation) {
  const ui = operation.dimensions.ui;
  if (ui.status !== 'gap' && ui.evidence_paths.length > 0) {
    return {
      surface: 'ui_workflow',
      rationale: 'A focused HotM workflow is recorded in the operation-level evidence.',
      evidence_paths: ui.evidence_paths,
    };
  }
  if (CURATED_AGENT_OPERATIONS.has(operation.operation_id)) {
    return {
      surface: 'agent_workflow',
      rationale: 'A curated agent tool covers this operation with server-side privilege enforcement.',
      evidence_paths: ['agent-proxy/src/tools.ts', 'agent-proxy/src/privileges.ts'],
    };
  }
  if (isProtocolExclusion(operation)) {
    return {
      surface: 'documented_exclusion',
      rationale: 'Credential, key-material, binary-transfer, or resumable-upload protocol handling is excluded from generic agent invocation pending typed workflow evidence.',
      evidence_paths: ['.aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md'],
    };
  }
  return {
    surface: 'operator_diagnostic',
    rationale: 'The pinned operation is visible in the read-only operator catalog; no request, response, auth, or live conformance is inferred.',
    evidence_paths: ['ui/src/components/admin/OperationCatalogPanel.tsx'],
  };
}

function buildLedger(source) {
  const operations = source.operations.map((operation) => {
    const disposition = dispositionFor(operation);
    return {
      key: operation.key,
      method: operation.method,
      path: operation.path,
      operation_id: operation.operation_id,
      family: operation.family,
      privilege: privilegeFor(operation),
      surface: disposition.surface,
      rationale: disposition.rationale,
      evidence_paths: disposition.evidence_paths,
      conformance_disposition: operation.disposition,
      tracker: '#287',
    };
  });
  const count = (field) => Object.fromEntries(
    [...new Set(operations.map((operation) => operation[field]))]
      .sort()
      .map((value) => [value, operations.filter((operation) => operation[field] === value).length]),
  );
  return {
    schema_version: 1,
    source: sourcePath.slice(root.length + 1),
    openapi: source.openapi,
    operation_count: operations.length,
    summary: {
      privileges: count('privilege'),
      surfaces: count('surface'),
    },
    evidence_boundary: 'Product disposition and privilege classification only; this ledger does not establish request, response, auth, event, portable-data, compatibility, or live conformance.',
    operations,
  };
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const ledger = buildLedger(source);
const serialized = `${JSON.stringify(ledger, null, 2)}\n`;

if (ledger.operation_count !== 251 || new Set(ledger.operations.map(({ key }) => key)).size !== ledger.operation_count) {
  throw new Error('operation disposition ledger is incomplete or contains duplicate keys');
}
if (process.argv.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== serialized) {
    throw new Error('Fortemi operation disposition ledger is stale; run this script without --check');
  }
  console.log(`verified ${ledger.operation_count} Fortemi operation dispositions`);
} else {
  writeFileSync(outputPath, serialized);
  console.log(`wrote ${outputPath.slice(root.length + 1)} (${ledger.operation_count} operations)`);
}
