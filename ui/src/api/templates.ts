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

export function createTemplatesApi(client: ApiClient) {
  return {
    /**
     * List all templates
     */
    async list(): Promise<Template[]> {
      const response = await client.get<Template[] | { templates: Template[] }>(
        '/templates'
      );
      return Array.isArray(response) ? response : (response?.templates ?? []);
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

      return client.post<Template>('/templates', request);
    },

    /**
     * Get a specific template
     */
    async get(templateId: string): Promise<Template> {
      if (!templateId || templateId.trim() === '') {
        throw new Error('Template ID is required');
      }

      return client.get<Template>(`/templates/${templateId}`);
    },

    /**
     * Update a template
     */
    async update(
      templateId: string,
      updates: Partial<CreateTemplateRequest>
    ): Promise<Template> {
      if (!templateId || templateId.trim() === '') {
        throw new Error('Template ID is required');
      }

      return client.patch<Template>(
        `/templates/${templateId}`,
        updates
      );
    },

    /**
     * Delete a template
     */
    async delete(templateId: string): Promise<void> {
      if (!templateId || templateId.trim() === '') {
        throw new Error('Template ID is required');
      }

      await client.delete(`/templates/${templateId}`);
    },

    /**
     * Instantiate a template with variables
     * Creates a new note from the template
     */
    async instantiate(
      templateId: string,
      request: InstantiateTemplateRequest
    ): Promise<CreateNoteResponse> {
      if (!templateId || templateId.trim() === '') {
        throw new Error('Template ID is required');
      }

      if (!request.variables || Object.keys(request.variables).length === 0) {
        throw new Error('Template variables are required');
      }

      return client.post<CreateNoteResponse>(
        `/templates/${templateId}/instantiate`,
        request
      );
    },
  };
}

export type TemplatesApi = ReturnType<typeof createTemplatesApi>;
