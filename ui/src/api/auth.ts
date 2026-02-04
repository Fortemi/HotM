/**
 * Authentication API client
 * Handles OAuth2 and API key management for Fortemi
 */

import type { ApiClient } from './client';
import type {
  TokenResponse,
  ClientRegistration,
  ClientRegistrationRequest,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from './types-extended';

export function createAuthApi(client: ApiClient) {
  return {
    // ===========================
    // OAuth2 Discovery
    // ===========================

    /**
     * Get OAuth2 authorization server metadata
     */
    async getAuthServerMetadata(): Promise<Record<string, unknown>> {
      return client.get('/.well-known/oauth-authorization-server');
    },

    /**
     * Get protected resource metadata
     */
    async getProtectedResourceMetadata(): Promise<Record<string, unknown>> {
      return client.get('/.well-known/oauth-protected-resource');
    },

    // ===========================
    // OAuth2 Client Registration (RFC 7591)
    // ===========================

    /**
     * Register a new OAuth2 client
     */
    async registerClient(
      request: ClientRegistrationRequest
    ): Promise<ClientRegistration> {
      if (!request.client_name || request.client_name.trim() === '') {
        throw new Error('Client name is required');
      }

      if (!request.grant_types || request.grant_types.length === 0) {
        throw new Error('At least one grant type is required');
      }

      return client.post<ClientRegistration>('/oauth/register', request);
    },

    // ===========================
    // OAuth2 Token Management
    // ===========================

    /**
     * Request OAuth2 token (client credentials flow)
     */
    async requestToken(
      clientId: string,
      clientSecret: string,
      grantType: string = 'client_credentials',
      scope?: string
    ): Promise<TokenResponse> {
      if (!clientId || clientId.trim() === '') {
        throw new Error('Client ID is required');
      }

      if (!clientSecret || clientSecret.trim() === '') {
        throw new Error('Client secret is required');
      }

      const body = new URLSearchParams({
        grant_type: grantType,
        client_id: clientId,
        client_secret: clientSecret,
      });

      if (scope) {
        body.append('scope', scope);
      }

      // OAuth2 token endpoint expects form-urlencoded
      return client.post<TokenResponse>('/oauth/token', body.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      });
    },

    /**
     * Refresh OAuth2 token
     */
    async refreshToken(
      clientId: string,
      clientSecret: string,
      refreshToken: string
    ): Promise<TokenResponse> {
      if (!refreshToken || refreshToken.trim() === '') {
        throw new Error('Refresh token is required');
      }

      return this.requestToken(clientId, clientSecret, 'refresh_token');
    },

    /**
     * Introspect token (RFC 7662)
     */
    async introspectToken(
      token: string,
      clientId: string,
      clientSecret: string
    ): Promise<{ active: boolean; [key: string]: unknown }> {
      if (!token || token.trim() === '') {
        throw new Error('Token is required');
      }

      const body = new URLSearchParams({
        token,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return client.post('/oauth/introspect', body.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      });
    },

    /**
     * Revoke token (RFC 7009)
     */
    async revokeToken(
      token: string,
      clientId: string,
      clientSecret: string,
      tokenTypeHint?: 'access_token' | 'refresh_token'
    ): Promise<void> {
      if (!token || token.trim() === '') {
        throw new Error('Token is required');
      }

      const body = new URLSearchParams({
        token,
        client_id: clientId,
        client_secret: clientSecret,
      });

      if (tokenTypeHint) {
        body.append('token_type_hint', tokenTypeHint);
      }

      await client.post('/oauth/revoke', body.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      });
    },

    // ===========================
    // API Key Management
    // ===========================

    /**
     * List all API keys for the authenticated user
     */
    async listApiKeys(): Promise<ApiKey[]> {
      const response = await client.get<{ keys: ApiKey[] }>(
        '/api/v1/api-keys'
      );
      return response.keys;
    },

    /**
     * Create a new API key
     */
    async createApiKey(
      request: CreateApiKeyRequest
    ): Promise<CreateApiKeyResponse> {
      if (!request.name || request.name.trim() === '') {
        throw new Error('API key name is required');
      }

      return client.post<CreateApiKeyResponse>('/api/v1/api-keys', request);
    },

    /**
     * Revoke (delete) an API key
     */
    async revokeApiKey(keyId: string): Promise<void> {
      if (!keyId || keyId.trim() === '') {
        throw new Error('API key ID is required');
      }

      await client.delete(`/api/v1/api-keys/${keyId}`);
    },

    /**
     * Validate API key (returns user info if valid)
     */
    async validateApiKey(apiKey: string): Promise<{ valid: boolean }> {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('API key is required');
      }

      try {
        await client.get('/api/v1/health', undefined, {
          Authorization: `Bearer ${apiKey}`,
        });
        return { valid: true };
      } catch (error) {
        return { valid: false };
      }
    },

    // ===========================
    // Helper: Set Authorization Header
    // ===========================

    /**
     * Get authorization header for API requests
     */
    getAuthHeader(token: string): Record<string, string> {
      if (!token || token.trim() === '') {
        throw new Error('Token is required');
      }

      return {
        Authorization: `Bearer ${token}`,
      };
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
