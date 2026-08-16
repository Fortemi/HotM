#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const sourcePath = resolve(root, '.aiwg/api/compatibility/fortemi-v2026-07-operation-coverage.json');
const outputPath = resolve(root, 'ui/src/api/contracts/fortemi-operation-dispositions.json');
const sensitiveDecisionPath = resolve(root, '.aiwg/security/fortemi-sensitive-operation-decisions-2026-08.md');

const CURATED_AGENT_OPERATIONS = new Set([
  'search_notes',
  'create_note',
  'get_note',
  'create_job',
  'set_note_tags',
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

const TYPED_TUS_OPERATIONS = new Set([
  'tus_create_upload',
  'tus_options',
  'tus_delete_upload',
  'tus_head_upload',
  'tus_patch_upload',
]);

const EXTERNAL_MEDIA_HANDOFFS = new Set([
  'download_attachment',
  'get_sprite_sheet',
  'get_attachment_subtitles',
  'get_attachment_thumbnail',
  'get_sprite_vtt',
]);

function sensitiveDecisionFor(operation) {
  if (!isProtocolExclusion(operation)) return null;

  if (TYPED_TUS_OPERATIONS.has(operation.operation_id)) {
    return {
      decision: 'typed_ui_workflow',
      owner: 'HotM transfer UI',
      enabled: true,
      surface: 'ui_workflow',
      rationale: 'Typed tus-js-client workflow uses browser/Tauri byte transport with resumable offsets, bounded chunks, cancellation, and redacted failures.',
      blockers: [],
      evidence_paths: [
        'ui/src/services/tusUploader.ts',
        'ui/src/services/uploadStore.ts',
        'ui/src/services/__tests__/tusUploader.test.ts',
        'ui/src/services/__tests__/uploadStore.test.ts',
      ],
    };
  }

  if (EXTERNAL_MEDIA_HANDOFFS.has(operation.operation_id)) {
    return {
      decision: 'external_browser_protocol_handoff',
      owner: 'HotM media UI',
      enabled: true,
      surface: 'external_protocol_handoff',
      rationale: 'Authenticated media bytes are handled by browser/Tauri fetch and media primitives; payloads and local paths never enter generic agent input.',
      blockers: [],
      evidence_paths: [
        'ui/src/api/attachments.ts',
        'ui/src/api/__tests__/attachments.test.ts',
        'ui/src/components/attachments/__tests__/StreamingMedia.test.tsx',
      ],
    };
  }

  let owner = 'Fortemi contract owner and HotM security';
  let blocker = 'Pinned request, response, and auth evidence is incomplete for promotion.';
  if (operation.path.startsWith('/oauth/')) {
    owner = 'fortemi-auth and HotM security';
    blocker = 'fortemi-auth is specification-only and has no qualifying release or shared Rust/Node fixture receipt.';
  } else if (operation.path.startsWith('/api/v1/pke')) {
    owner = 'Fortemi PKE and HotM security';
    blocker = 'Pinned PKE success responses are not schema-bearing; private-key custody and redaction conformance is unverified.';
  } else if (operation.path.startsWith('/api/v1/api-keys')) {
    owner = 'Fortemi auth and HotM security';
    blocker = 'Pinned API-key success responses are not schema-bearing; secret receipt and lifecycle conformance is unverified.';
  } else if (operation.path.startsWith('/api/v1/backup')) {
    owner = 'Fortemi backup and HotM recovery UI';
    blocker = 'Pinned binary media types, response headers, or upload request schemas are incomplete for this route.';
  } else if (operation.operation_id === 'upload_attachment_multipart') {
    owner = 'Fortemi attachments and HotM transfer UI';
    blocker = 'Pinned multipart request and success response schemas are absent; remote uploads use the typed TUS workflow instead.';
  } else if (operation.operation_id === 'upload_attachment') {
    owner = 'Fortemi attachments and HotM transfer UI';
    blocker = 'Legacy JSON attachment upload is not used by HotM; binary content is not base64-routed through the agent or UI client.';
  }

  return {
    decision: 'continued_exclusion',
    owner,
    enabled: false,
    surface: 'documented_exclusion',
    rationale: blocker,
    blockers: [blocker],
    evidence_paths: [
      'ui/src/api/contracts/fortemi-openapi-receipt.json',
      '.aiwg/security/fortemi-sensitive-operation-decisions-2026-08.md',
    ],
  };
}

function dispositionFor(operation) {
  const sensitiveDecision = sensitiveDecisionFor(operation);
  if (sensitiveDecision) return sensitiveDecision;
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
      ...(disposition.decision ? {
        security_decision: disposition.decision,
        decision_owner: disposition.owner,
        enabled: disposition.enabled,
        promotion_blockers: disposition.blockers,
      } : {}),
      conformance_disposition: operation.disposition,
      tracker: '#287',
    };
  });
  const count = (field) => Object.fromEntries(
    [...new Set(operations.map((operation) => operation[field]).filter((value) => value !== undefined))]
      .sort()
      .map((value) => [value, operations.filter((operation) => operation[field] === value).length]),
  );
  return {
    schema_version: 2,
    source: sourcePath.slice(root.length + 1),
    openapi: source.openapi,
    operation_count: operations.length,
    summary: {
      privileges: count('privilege'),
      surfaces: count('surface'),
      security_decisions: count('security_decision'),
    },
    evidence_boundary: 'Product disposition and privilege classification only; this ledger does not establish request, response, auth, event, portable-data, compatibility, or live conformance.',
    operations,
  };
}

function buildSensitiveDecisionMarkdown(ledger) {
  const rows = ledger.operations.filter(({ security_decision }) => security_decision);
  const escape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const lines = [
    '---',
    'title: Fortemi Sensitive Operation Decisions',
    'artifact_type: security-decision-ledger',
    'status: approved',
    'date: 2026-08-16',
    'issue: "#297"',
    '---',
    '',
    '# Fortemi Sensitive Operation Decisions',
    '',
    `This table classifies exactly ${rows.length} credential, PKE, binary-transfer, media, and TUS operations from the pinned Fortemi OpenAPI receipt. Route disposition is not request, response, auth, protocol, portable-data, compatibility, or live conformance evidence.`,
    '',
    '| Operation | Method and path | Decision | Enabled | Owner | Rationale / blocker |',
    '|---|---|---|---:|---|---|',
    ...rows.map((row) => `| \`${escape(row.operation_id)}\` | \`${row.method} ${escape(row.path)}\` | \`${row.security_decision}\` | ${row.enabled ? 'yes' : 'no'} | ${escape(row.decision_owner)} | ${escape(row.rationale)} |`),
    '',
    '## Promotion Rules',
    '',
    '- Promotion requires producer-owned request, response, and auth artifacts at the pinned revision plus focused consumer verification.',
    '- `fortemi-auth` remains specification-only until its Rust workspace, CI, release, and shared Rust/Node fixture receipts all exist.',
    '- Generic agent tools never receive credential material, private keys, upload URLs, tenant identifiers, local paths, or binary payloads.',
    '- Browser/Tauri primitives carry bytes directly. Large payloads are not base64-encoded through the agent or React client.',
    '- Unknown compatibility or auth claim-contract revisions fail closed while local-only workflows remain available.',
    '',
  ];
  return lines.join('\n');
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const ledger = buildLedger(source);
const serialized = `${JSON.stringify(ledger, null, 2)}\n`;

if (ledger.operation_count !== 251 || new Set(ledger.operations.map(({ key }) => key)).size !== ledger.operation_count) {
  throw new Error('operation disposition ledger is incomplete or contains duplicate keys');
}
if (ledger.operations.some(({ method, path }) => (
  path === '/api/v1/notes/{id}/links' && method !== 'GET'
))) {
  throw new Error('removed explicit note-link mutations must not appear in the pinned operation ledger');
}
const sensitiveRows = ledger.operations.filter(({ security_decision }) => security_decision);
if (sensitiveRows.length !== 41 || sensitiveRows.filter(({ enabled }) => !enabled).some(({ surface }) => surface !== 'documented_exclusion')) {
  throw new Error('sensitive operation decision ledger must contain exactly 41 rows and fail closed when disabled');
}
if (sensitiveRows.some(({ surface, enabled }) => surface === 'documented_exclusion' && enabled)) {
  throw new Error('documented exclusions must remain disabled');
}
const sensitiveMarkdown = buildSensitiveDecisionMarkdown(ledger);
if (process.argv.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== serialized) {
    throw new Error('Fortemi operation disposition ledger is stale; run this script without --check');
  }
  if (readFileSync(sensitiveDecisionPath, 'utf8') !== sensitiveMarkdown) {
    throw new Error('Fortemi sensitive operation decision table is stale; run this script without --check');
  }
  console.log(`verified ${ledger.operation_count} Fortemi operation dispositions`);
} else {
  writeFileSync(outputPath, serialized);
  writeFileSync(sensitiveDecisionPath, sensitiveMarkdown);
  console.log(`wrote ${outputPath.slice(root.length + 1)} (${ledger.operation_count} operations)`);
}
