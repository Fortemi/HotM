import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type OpenApiSchema = {
  type?: string;
  enum?: string[];
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
  additionalProperties?: boolean | OpenApiSchema;
};

type OpenApiDocument = {
  info: {
    title: string;
  };
  servers: Array<{
    url: string;
  }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, OpenApiSchema>;
  };
};

function loadOpenApiSpec(): OpenApiDocument {
  const specPath = path.resolve(process.cwd(), '../docs/openapi.json');
  return JSON.parse(readFileSync(specPath, 'utf8')) as OpenApiDocument;
}

describe('OpenAPI Fortemi compatibility contract', () => {
  const spec = loadOpenApiSpec();

  it('documents the current Fortemi sidecar base URL', () => {
    expect(spec.info.title).toBe('HotM Fortemi API Compatibility Spec');
    expect(spec.servers.map((server) => server.url)).toContain('http://localhost:3000/api/v1');
  });

  it('documents create-note fields used by the UI client', () => {
    const schema = spec.components.schemas.CreateNoteRequest;

    expect(schema.required).toContain('content');
    expect(schema.properties).toEqual(
      expect.objectContaining({
        title: expect.any(Object),
        revision_mode: expect.any(Object),
        document_type: expect.any(Object),
        context_filter: expect.any(Object),
        processing: expect.any(Object),
      })
    );
  });

  it('documents create-note response aliases handled by the UI client', () => {
    const schema = spec.components.schemas.CreateNoteResponse;

    expect(schema.properties).toEqual(
      expect.objectContaining({
        id: expect.any(Object),
        note_id: expect.any(Object),
        noteId: expect.objectContaining({ type: 'string' }),
        status: expect.any(Object),
      })
    );
  });

  it('documents revision mode, context filter, and processing controls', () => {
    expect(spec.components.schemas.RevisionMode.enum).toEqual(
      expect.arrayContaining(['none', 'light', 'standard', 'contextual', 'contextual_filtered', 'full'])
    );

    expect(spec.components.schemas.ContextFilter.properties).toEqual(
      expect.objectContaining({
        tags: expect.any(Object),
        collection_id: expect.any(Object),
        query: expect.any(Object),
      })
    );

    expect(spec.components.schemas.ProcessingOptions.properties).toEqual(
      expect.objectContaining({
        autoTagConcepts: expect.any(Object),
        generateEmbeddings: expect.any(Object),
        autoLinkRelated: expect.any(Object),
        extractMedia: expect.any(Object),
        generateTitle: expect.any(Object),
      })
    );
  });

  it('documents bulk reprocessing and deferred backup import workflows', () => {
    expect(spec.paths['/notes/reprocess']).toHaveProperty('post');
    expect(spec.components.schemas.BulkReprocessRequest.properties).toEqual(
      expect.objectContaining({
        revision_mode: expect.any(Object),
        note_ids: expect.any(Object),
        steps: expect.any(Object),
        limit: expect.any(Object),
        model: expect.any(Object),
      })
    );

    expect(spec.paths['/backup/import']).toHaveProperty('post');
    expect(spec.components.schemas.BackupImportRequest.required).toContain('backup');
    expect(spec.components.schemas.BackupImportRequest.properties).toEqual(
      expect.objectContaining({
        backup: expect.any(Object),
        defer_inference: expect.objectContaining({ type: 'boolean' }),
      })
    );
  });

  it('documents webhook administration workflows used by the UI client', () => {
    expect(spec.paths['/webhooks']).toHaveProperty('get');
    expect(spec.paths['/webhooks']).toHaveProperty('post');
    expect(spec.paths['/webhooks/{id}']).toEqual(
      expect.objectContaining({
        get: expect.any(Object),
        patch: expect.any(Object),
        delete: expect.any(Object),
      })
    );
    expect(spec.paths['/webhooks/{id}/deliveries']).toHaveProperty('get');
    expect(spec.paths['/webhooks/{id}/test']).toHaveProperty('post');

    expect(spec.components.schemas.CreateWebhookRequest.required).toEqual(['url', 'events']);
    expect(spec.components.schemas.CreateWebhookRequest.properties).toEqual(
      expect.objectContaining({
        url: expect.any(Object),
        events: expect.any(Object),
        secret: expect.any(Object),
        max_retries: expect.any(Object),
      })
    );
    expect(spec.components.schemas.Webhook.properties).toEqual(
      expect.objectContaining({
        id: expect.any(Object),
        url: expect.any(Object),
        events: expect.any(Object),
        is_active: expect.any(Object),
        failure_count: expect.any(Object),
        max_retries: expect.any(Object),
      })
    );
    expect(spec.components.schemas.WebhookDelivery.properties).toEqual(
      expect.objectContaining({
        webhook_id: expect.any(Object),
        event_type: expect.any(Object),
        payload: expect.any(Object),
        success: expect.any(Object),
      })
    );
  });
});
