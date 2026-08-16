/**
 * Templates API client
 * Handles note template management and instantiation
 */

import type { ApiClient } from './client';
import type {
  Template,
  CreateTemplateRequest,
  InstantiateTemplateRequest,
} from './types-extended';
import type { CreateNoteResponse } from './types';
import { asRecord, ContractDecodeError, optionalString, requiredString, stringArray } from './contract-codecs';

const MAX_TEMPLATE_CONTENT_CHARS = 1024 * 1024;
const MAX_TEMPLATE_LIST_ITEMS = 100;

export interface InstantiateTemplateResult extends CreateNoteResponse {
  id: string;
}

function requireTemplateId(templateId: string): void {
  if (!templateId || templateId.trim() === '') throw new Error('Template ID is required');
}

function decodeTemplate(payload: unknown, operationId: string): Template {
  const raw = asRecord(payload, operationId);
  const content = requiredString(raw, 'content', operationId);
  if (content.length > MAX_TEMPLATE_CONTENT_CHARS) {
    throw new ContractDecodeError(operationId, `content exceeds ${MAX_TEMPLATE_CONTENT_CHARS} characters`);
  }
  const defaultTags = stringArray(raw.default_tags);
  const variables = stringArray(raw.variables);
  if (defaultTags.length > MAX_TEMPLATE_LIST_ITEMS || variables.length > MAX_TEMPLATE_LIST_ITEMS) {
    throw new ContractDecodeError(operationId, `template arrays exceed ${MAX_TEMPLATE_LIST_ITEMS} entries`);
  }
  return {
    id: requiredString(raw, 'id', operationId),
    name: requiredString(raw, 'name', operationId),
    content,
    description: optionalString(raw, 'description'),
    format: optionalString(raw, 'format'),
    collection_id: typeof raw.collection_id === 'string' ? raw.collection_id : null,
    default_tags: defaultTags,
    variables,
    created_at: optionalString(raw, 'created_at') ?? '',
    updated_at: optionalString(raw, 'updated_at') ?? '',
  };
}

export function createTemplatesApi(client: ApiClient) {
  return {
    /**
     * List all templates
     */
    async list(): Promise<Template[]> {
      const response = await client.get<unknown[] | { templates: unknown[] }>(
        '/templates'
      );
      const entries = Array.isArray(response) ? response : (response?.templates ?? []);
      return entries.map((entry) => decodeTemplate(entry, 'list_templates'));
    },

    /**
     * Create a new template
     */
    async create(request: CreateTemplateRequest): Promise<Template> {
      if (!request.name || request.name.trim() === '') {
        throw new Error('Template name is required');
      }

      if (!request.content || request.content.trim() === '') {
        throw new Error('Template content is required');
      }

      return decodeTemplate(await client.post<unknown>('/templates', request), 'create_template');
    },

    /**
     * Get a specific template
     */
    async get(templateId: string): Promise<Template> {
      requireTemplateId(templateId);
      return decodeTemplate(
        await client.get<unknown>(`/templates/${encodeURIComponent(templateId)}`),
        'get_template',
      );
    },

    /**
     * Update a template
     */
    async update(
      templateId: string,
      updates: Partial<CreateTemplateRequest>
    ): Promise<Template> {
      requireTemplateId(templateId);
      await client.patch(`/templates/${encodeURIComponent(templateId)}`, updates);
      return this.get(templateId);
    },

    /**
     * Delete a template
     */
    async delete(templateId: string): Promise<void> {
      requireTemplateId(templateId);

      await client.delete(`/templates/${encodeURIComponent(templateId)}`);
    },

    /**
     * Instantiate a template with variables
     * Creates a new note from the template
     */
    async instantiate(
      templateId: string,
      request: InstantiateTemplateRequest
    ): Promise<InstantiateTemplateResult> {
      requireTemplateId(templateId);
      const variables = request.variables ?? {};
      if (Object.keys(variables).length > MAX_TEMPLATE_LIST_ITEMS) {
        throw new Error(`Template variables cannot exceed ${MAX_TEMPLATE_LIST_ITEMS} entries`);
      }
      if ((request.tags?.length ?? 0) > MAX_TEMPLATE_LIST_ITEMS) {
        throw new Error(`Template tags cannot exceed ${MAX_TEMPLATE_LIST_ITEMS} entries`);
      }
      const raw = asRecord(
        await client.post<unknown>(`/templates/${encodeURIComponent(templateId)}/instantiate`, {
          variables,
          tags: request.tags ?? null,
          collection_id: request.collection_id ?? null,
          revision_mode: request.revision_mode ?? null,
        }),
        'instantiate_template',
      );
      const id = requiredString(raw, 'id', 'instantiate_template');
      return { id, note_id: id, status: optionalString(raw, 'status') ?? 'created' };
    },
  };
}

export type TemplatesApi = ReturnType<typeof createTemplatesApi>;
