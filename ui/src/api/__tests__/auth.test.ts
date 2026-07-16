import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../index';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  };
}

function emptyResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    text: () => Promise.resolve(''),
  };
}

describe('auth API root OAuth routes', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fetches OAuth discovery metadata from the Fortemi server root', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ issuer: 'http://localhost:3000' }))
      .mockResolvedValueOnce(jsonResponse({ resource: 'http://localhost:3000' }));

    const api = createApi('http://localhost:3000/api/v1');

    await expect(api.auth.getAuthServerMetadata()).resolves.toEqual({
      issuer: 'http://localhost:3000',
    });
    await expect(api.auth.getProtectedResourceMetadata()).resolves.toEqual({
      resource: 'http://localhost:3000',
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/.well-known/oauth-authorization-server',
      expect.objectContaining({ method: 'GET' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/.well-known/oauth-protected-resource',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('builds and fetches the OAuth authorize consent route with PKCE parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html>Authorize</html>'),
    });
    const api = createApi('http://localhost:3000/api/v1');

    const request = {
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'http://127.0.0.1/callback',
      scope: 'read mcp',
      state: 'csrf-state',
      code_challenge: 'pkce-challenge',
      code_challenge_method: 'S256',
    };

    const url = api.auth.getAuthorizeUrl(request);
    expect(url).toContain('http://localhost:3000/oauth/authorize?');
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=client-1');
    expect(url).toContain('redirect_uri=http%3A%2F%2F127.0.0.1%2Fcallback');
    expect(url).toContain('scope=read+mcp');
    expect(url).toContain('code_challenge=pkce-challenge');

    await expect(api.auth.getAuthorizationConsentPage(request)).resolves.toBe('<html>Authorize</html>');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/oauth/authorize?'),
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'text/html,*/*' },
      })
    );
  });

  it('posts authorize, register, token, introspect, and revoke requests with server-compatible forms', async () => {
    mockFetch
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(jsonResponse({ client_id: 'client-1', client_secret: 'secret-1' }, 201))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-1', token_type: 'Bearer', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-2', token_type: 'Bearer', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ active: true, scope: 'read' }))
      .mockResolvedValueOnce(emptyResponse());

    const api = createApi('http://localhost:3000/api/v1');

    await api.auth.submitAuthorization({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'http://127.0.0.1/callback',
      scope: 'read',
      state: 'state-1',
      code_challenge: 'challenge-1',
      code_challenge_method: 'S256',
      action: 'approve',
    });
    await api.auth.registerClient({
      client_name: 'HotM Desktop',
      redirect_uris: ['http://127.0.0.1/callback'],
      grant_types: ['authorization_code', 'client_credentials'],
      response_types: ['code'],
      scope: 'read mcp',
    });
    await api.auth.requestToken('client-1', 'secret-1', 'authorization_code', {
      code: 'code-1',
      redirect_uri: 'http://127.0.0.1/callback',
      code_verifier: 'verifier-1',
    });
    await api.auth.refreshToken('client-1', 'secret-1', 'refresh-1');
    await api.auth.introspectToken('token-1', 'client-1', 'secret-1');
    await api.auth.revokeToken('token-1', 'client-1', 'secret-1', 'access_token');

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/oauth/authorize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        body: expect.stringContaining('action=approve'),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/oauth/register',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"client_name":"HotM Desktop"'),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('grant_type=authorization_code'),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      'http://localhost:3000/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('refresh_token=refresh-1'),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      5,
      'http://localhost:3000/oauth/introspect',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('token=token-1'),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      6,
      'http://localhost:3000/oauth/revoke',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('token_type_hint=access_token'),
      })
    );
  });

  it('validates required OAuth authorize fields before building a route', () => {
    const api = createApi('http://localhost:3000/api/v1');

    expect(() => api.auth.getAuthorizeUrl({
      response_type: 'code',
      client_id: '',
      redirect_uri: 'http://127.0.0.1/callback',
    })).toThrow('Client ID is required');
  });
});
