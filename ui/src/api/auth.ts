/**
 * Authentication API client
 * Handles OAuth2 and API key management for Fortemi
 */

import type { ApiClient } from './client';
import { getTauriFetch } from '@/lib/tauri';
import type {
  TokenResponse,
  ClientRegistration,
  ClientRegistrationRequest,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from './types-extended';

export interface OAuthAuthorizationRequest {
  response_type: 'code' | string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: 'S256' | 'plain' | string;
}

export interface OAuthAuthorizationForm extends OAuthAuthorizationRequest {
  action: 'approve' | 'deny' | string;
}

export interface OAuthTokenOptions {
  scope?: string;
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
  code_verifier?: string;
}

/**
 * Helper to make JSON requests against the server root (non-API-versioned endpoints).
 * Used for OAuth2 and well-known endpoints that live outside /api/v1/.
 */
async function serverRequest<T>(
  serverUrl: string,
  path: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  const url = `${serverUrl}${path}`;
  const defaultHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const response = await getTauriFetch()(url, {
    method,
    headers: { ...defaultHeaders, ...headers },
    body,
  });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  if (response.status === 204) {
    return null as T;
  }
  const text = await response.text();
  if (!text.trim()) {
    return null as T;
  }
  return JSON.parse(text) as T;
}

function buildAuthorizationParams(request: OAuthAuthorizationRequest): URLSearchParams {
  if (!request.response_type || request.response_type.trim() === '') {
    throw new Error('Response type is required');
  }

  if (!request.client_id || request.client_id.trim() === '') {
    throw new Error('Client ID is required');
  }

  if (!request.redirect_uri || request.redirect_uri.trim() === '') {
    throw new Error('Redirect URI is required');
  }

  const params = new URLSearchParams({
    response_type: request.response_type,
    client_id: request.client_id,
    redirect_uri: request.redirect_uri,
  });

  if (request.scope) {
    params.append('scope', request.scope);
  }
  if (request.state) {
    params.append('state', request.state);
  }
  if (request.code_challenge) {
    params.append('code_challenge', request.code_challenge);
  }
  if (request.code_challenge_method) {
    params.append('code_challenge_method', request.code_challenge_method);
  }

  return params;
}

export function createAuthApi(client: ApiClient) {
  const serverUrl = client.serverUrl;

  return {
    // ===========================
    // OAuth2 Discovery
    // ===========================

    /**
     * Get OAuth2 authorization server metadata
     */
    async getAuthServerMetadata(): Promise<Record<string, unknown>> {
      return serverRequest(serverUrl, '/.well-known/oauth-authorization-server');
    },

    /**
     * Get protected resource metadata
     */
    async getProtectedResourceMetadata(): Promise<Record<string, unknown>> {
      return serverRequest(serverUrl, '/.well-known/oauth-protected-resource');
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

      return serverRequest<ClientRegistration>(serverUrl, '/oauth/register', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    // ===========================
    // OAuth2 Authorization Code Flow
    // ===========================

    /**
     * Build the Fortemi authorization endpoint URL for browser navigation.
     */
    getAuthorizeUrl(request: OAuthAuthorizationRequest): string {
      return `${serverUrl}/oauth/authorize?${buildAuthorizationParams(request).toString()}`;
    },

    /**
     * Fetch the Fortemi authorization consent HTML.
     */
    async getAuthorizationConsentPage(request: OAuthAuthorizationRequest): Promise<string> {
      const path = `/oauth/authorize?${buildAuthorizationParams(request).toString()}`;
      const response = await getTauriFetch()(`${serverUrl}${path}`, {
        method: 'GET',
        headers: { Accept: 'text/html,*/*' },
      });
      if (!response.ok) {
        throw new Error(`${path} returned ${response.status}`);
      }
      return response.text();
    },

    /**
     * Submit the authorization consent form.
     *
     * Fortemi returns an HTTP redirect to the registered redirect_uri. Browser
     * callers normally navigate to the consent URL instead of invoking this
     * helper directly; this method exists for diagnostics and route tests.
     */
    async submitAuthorization(request: OAuthAuthorizationForm): Promise<void> {
      const params = buildAuthorizationParams(request);
      params.append('action', request.action);

      await serverRequest<void>(serverUrl, '/oauth/authorize', {
        method: 'POST',
        body: params.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
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
      scopeOrOptions?: string | OAuthTokenOptions
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

      const options = typeof scopeOrOptions === 'string'
        ? { scope: scopeOrOptions }
        : scopeOrOptions;

      if (options?.scope) {
        body.append('scope', options.scope);
      }
      if (options?.code) {
        body.append('code', options.code);
      }
      if (options?.redirect_uri) {
        body.append('redirect_uri', options.redirect_uri);
      }
      if (options?.refresh_token) {
        body.append('refresh_token', options.refresh_token);
      }
      if (options?.code_verifier) {
        body.append('code_verifier', options.code_verifier);
      }

      // OAuth2 token endpoint expects form-urlencoded
      return serverRequest<TokenResponse>(serverUrl, '/oauth/token', {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

      return this.requestToken(clientId, clientSecret, 'refresh_token', {
        refresh_token: refreshToken,
      });
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

      return serverRequest(serverUrl, '/oauth/introspect', {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

      await serverRequest(serverUrl, '/oauth/revoke', {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    },

    // ===========================
    // API Key Management
    // ===========================

    /**
     * List all API keys for the authenticated user
     */
    async listApiKeys(): Promise<ApiKey[]> {
      const response = await client.get<{ keys?: ApiKey[]; api_keys?: ApiKey[] } | ApiKey[]>(
        '/api-keys'
      );
      if (Array.isArray(response)) {
        return response;
      }
      return response.api_keys ?? response.keys ?? [];
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

      return client.post<CreateApiKeyResponse>('/api-keys', request);
    },

    /**
     * Revoke (delete) an API key
     */
    async revokeApiKey(keyId: string): Promise<void> {
      if (!keyId || keyId.trim() === '') {
        throw new Error('API key ID is required');
      }

      await client.delete(`/api-keys/${keyId}`);
    },

    /**
     * Validate API key (returns user info if valid)
     */
    async validateApiKey(apiKey: string): Promise<{ valid: boolean }> {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('API key is required');
      }

      try {
        await client.get('/health/live', undefined, {
          Authorization: `Bearer ${apiKey}`,
        });
        return { valid: true };
      } catch (error) {
        try {
          await client.get('/health', undefined, {
            Authorization: `Bearer ${apiKey}`,
          });
          return { valid: true };
        } catch {
          return { valid: false };
        }
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
