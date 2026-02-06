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

export function createWebhooksApi(client: ApiClient) {
  return {
    /**
     * List all registered webhooks
     */
    async list(): Promise<Webhook[]> {
      const response = await client.get<{ webhooks: Webhook[] }>(
        '/api/v1/webhooks'
      );
      return response.webhooks;
    },

    /**
     * Get a specific webhook by ID
     */
    async get(webhookId: string): Promise<Webhook> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      return client.get<Webhook>(`/api/v1/webhooks/${webhookId}`);
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

      return client.post<Webhook>('/api/v1/webhooks', request);
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
        `/api/v1/webhooks/${webhookId}`,
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

      await client.delete(`/api/v1/webhooks/${webhookId}`);
    },

    /**
     * Get delivery history for a webhook
     */
    async getDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      const response = await client.get<{ deliveries: WebhookDelivery[] }>(
        `/api/v1/webhooks/${webhookId}/deliveries`
      );
      return response.deliveries;
    },

    /**
     * Send a test event to a webhook
     */
    async test(webhookId: string): Promise<WebhookDelivery> {
      if (!webhookId || webhookId.trim() === '') {
        throw new Error('Webhook ID is required');
      }

      return client.post<WebhookDelivery>(
        `/api/v1/webhooks/${webhookId}/test`
      );
    },
  };
}

export type WebhooksApi = ReturnType<typeof createWebhooksApi>;
