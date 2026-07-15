/**
 * Webhooks API client
 * Manages outbound HTTP webhooks for external integrations
 */

import type { ApiClient } from './client';

export interface Webhook {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string | null;
  failure_count: number;
  max_retries: number;
}

export interface CreateWebhookRequest {
  url: string;
  secret?: string;
  events: string[];
  max_retries?: number;
}

export interface UpdateWebhookRequest {
  url?: string;
  secret?: string;
  events?: string[];
  is_active?: boolean;
  max_retries?: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code?: number;
  response_body?: string;
  delivered_at: string;
  success: boolean;
}

export interface IncomingWebhookReceiver {
  id: string;
  slug_len: number;
  provider_len: number;
  schema_ref_len: number;
  signature_header_class: string;
  signature_header_len: number;
  secret_set: boolean;
  is_active: boolean;
  schema_doc_class?: string | null;
  schema_doc_len?: number | null;
  schema_doc_secret_candidate: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateIncomingWebhookReceiverRequest {
  slug: string;
  provider: string;
  schema_ref: string;
  hmac_secret: string;
  signature_header?: string;
  is_active?: boolean;
  schema_doc?: Record<string, unknown> | null;
}

export interface UpdateIncomingWebhookReceiverRequest {
  schema_ref?: string;
  schema_doc?: Record<string, unknown> | null;
  signature_header?: string;
  is_active?: boolean;
}

export interface IncomingWebhookValidationResponse {
  valid: boolean;
  schema_ref: string;
  errors: string[];
}

export interface InboundSource {
  id: string;
  name_len: number;
  kind_len: number;
  config_class: string;
  config_len: number;
  config_secret_candidate: boolean;
  config_key_count?: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateInboundSourceRequest {
  name: string;
  kind: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export function createWebhooksApi(client: ApiClient) {
  return {
    /**
     * List all registered webhooks
     */
    async list(): Promise<Webhook[]> {
      const response = await client.get<{ webhooks?: Webhook[] } | Webhook[]>(
        '/webhooks'
      );
      return Array.isArray(response) ? response : (response.webhooks ?? []);
    },

    /**
     * Get a specific webhook by ID
     */
    async get(webhookId: string): Promise<Webhook> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      return client.get<Webhook>(`/webhooks/${webhookId}`);
    },

    /**
     * Register a new webhook
     */
    async create(request: CreateWebhookRequest): Promise<Webhook> {
      if (!request.url || request.url.trim() === '') {
        throw new Error('Webhook URL is required');
      }

      if (!request.events || request.events.length === 0) {
        throw new Error('At least one event type is required');
      }

      const created = await client.post<{ id?: string } | Webhook>('/webhooks', request);
      if (typeof (created as Webhook).id === 'string' && 'url' in (created as Webhook)) {
        return created as Webhook;
      }
      const id = (created as { id?: string }).id;
      if (!id) {
        throw new Error('Webhook create response missing id');
      }
      return this.get(id);
    },

    /**
     * Update an existing webhook
     */
    async update(
      webhookId: string,
      request: UpdateWebhookRequest
    ): Promise<Webhook> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      return client.patch<Webhook>(
        `/webhooks/${webhookId}`,
        request
      );
    },

    /**
     * Delete a webhook
     */
    async delete(webhookId: string): Promise<void> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      await client.delete(`/webhooks/${webhookId}`);
    },

    /**
     * Get delivery history for a webhook
     */
    async getDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      const response = await client.get<{ deliveries?: WebhookDelivery[] } | WebhookDelivery[]>(
        `/webhooks/${webhookId}/deliveries`
      );
      return Array.isArray(response) ? response : (response.deliveries ?? []);
    },

    /**
     * Send a test event to a webhook
     */
    async test(webhookId: string): Promise<WebhookDelivery> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      return client.post<WebhookDelivery>(
        `/webhooks/${webhookId}/test`
      );
    },

    async listIncomingReceivers(): Promise<IncomingWebhookReceiver[]> {
      const response = await client.get<{ receivers?: IncomingWebhookReceiver[] } | IncomingWebhookReceiver[]>(
        '/webhooks/incoming'
      );
      return Array.isArray(response) ? response : (response.receivers ?? []);
    },

    async createIncomingReceiver(request: CreateIncomingWebhookReceiverRequest): Promise<IncomingWebhookReceiver> {
      if (!request.slug || request.slug.trim() === '') {
        throw new Error('Incoming receiver slug is required');
      }
      if (!request.provider || request.provider.trim() === '') {
        throw new Error('Incoming receiver provider is required');
      }
      if (!request.schema_ref || request.schema_ref.trim() === '') {
        throw new Error('Incoming receiver schema_ref is required');
      }
      if (!request.hmac_secret || request.hmac_secret.trim() === '') {
        throw new Error('Incoming receiver HMAC secret is required');
      }

      return client.post<IncomingWebhookReceiver>('/webhooks/incoming', request);
    },

    async getIncomingReceiver(slug: string): Promise<IncomingWebhookReceiver> {
      if (!slug || slug.trim() === '') {
        throw new Error('Incoming receiver slug is required');
      }

      return client.get<IncomingWebhookReceiver>(`/webhooks/incoming/${encodeURIComponent(slug)}`);
    },

    async updateIncomingReceiver(
      slug: string,
      request: UpdateIncomingWebhookReceiverRequest
    ): Promise<IncomingWebhookReceiver> {
      if (!slug || slug.trim() === '') {
        throw new Error('Incoming receiver slug is required');
      }

      return client.patch<IncomingWebhookReceiver>(`/webhooks/incoming/${encodeURIComponent(slug)}`, request);
    },

    async deleteIncomingReceiver(slug: string): Promise<void> {
      if (!slug || slug.trim() === '') {
        throw new Error('Incoming receiver slug is required');
      }

      await client.delete(`/webhooks/incoming/${encodeURIComponent(slug)}`);
    },

    async validateIncomingPayload(
      schemaRef: string,
      payload: Record<string, unknown>
    ): Promise<IncomingWebhookValidationResponse> {
      if (!schemaRef || schemaRef.trim() === '') {
        throw new Error('Incoming receiver schema_ref is required');
      }

      return client.post<IncomingWebhookValidationResponse>('/webhooks/incoming/validate', {
        schema_ref: schemaRef,
        payload,
      });
    },

    async listInboundSources(): Promise<InboundSource[]> {
      const response = await client.get<{ sources?: InboundSource[] } | InboundSource[]>(
        '/inbound-sources'
      );
      return Array.isArray(response) ? response : (response.sources ?? []);
    },

    async createInboundSource(request: CreateInboundSourceRequest): Promise<{ id: string }> {
      if (!request.name || request.name.trim() === '') {
        throw new Error('Inbound source name is required');
      }
      if (!request.kind || request.kind.trim() === '') {
        throw new Error('Inbound source kind is required');
      }

      return client.post<{ id: string }>('/inbound-sources', request);
    },

    async deleteInboundSource(name: string): Promise<void> {
      if (!name || name.trim() === '') {
        throw new Error('Inbound source name is required');
      }

      await client.delete(`/inbound-sources/${encodeURIComponent(name)}`);
    },
  };
}

export type WebhooksApi = ReturnType<typeof createWebhooksApi>;
