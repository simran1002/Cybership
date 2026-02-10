import { OAuthClient } from '../../infrastructure/auth/oauth-client';
import { ClientCredentialsAuthProvider } from '../../infrastructure/auth/client-credentials-auth-provider';
import { createStubHttpClient, jsonResponse, textResponse } from '../helpers/stub-http-client';
import { AuthError, ErrorCode } from '../../domain/errors';

describe('OAuthClient + ClientCredentialsAuthProvider', () => {
  const authUrl = 'https://auth.ups.com/token';
  const clientId = 'test_client';
  const clientSecret = 'test_secret';

  it('acquires a token using client_credentials', async () => {
    const httpClient = createStubHttpClient(async (req) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe(authUrl);
      expect(req.headers?.['Authorization']).toContain('Basic ');
      expect(req.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(req.body).toContain('grant_type=client_credentials');
      return jsonResponse(200, { access_token: 'token_xyz', token_type: 'Bearer', expires_in: 3600 });
    });

    const client = new OAuthClient(httpClient, { authUrl, clientId, clientSecret });
    const token = await client.acquireToken();
    expect(token.accessToken).toBe('token_xyz');
    expect(token.expiresInSeconds).toBe(3600);
  });

  it('throws AuthError on non-2xx token response', async () => {
    const httpClient = createStubHttpClient(async () => textResponse(401, 'Unauthorized'));
    const client = new OAuthClient(httpClient, { authUrl, clientId, clientSecret });

    await expect(client.acquireToken()).rejects.toBeInstanceOf(AuthError);
    await expect(client.acquireToken()).rejects.toMatchObject({ code: ErrorCode.AUTH_FAILED });
  });

  it('throws AuthError when token response is invalid JSON', async () => {
    const httpClient = createStubHttpClient(async () => textResponse(200, '<html>nope</html>'));
    const client = new OAuthClient(httpClient, { authUrl, clientId, clientSecret });

    await expect(client.acquireToken()).rejects.toBeInstanceOf(AuthError);
  });

  it('caches the token and avoids duplicate token calls', async () => {
    let calls = 0;
    const httpClient = createStubHttpClient(async () => {
      calls += 1;
      return jsonResponse(200, { access_token: 'cached_token', expires_in: 3600 });
    });

    const client = new OAuthClient(httpClient, { authUrl, clientId, clientSecret });
    const provider = new ClientCredentialsAuthProvider(client);

    const h1 = await provider.getAuthorizationHeader();
    const h2 = await provider.getAuthorizationHeader();

    expect(h1).toBe('Bearer cached_token');
    expect(h2).toBe('Bearer cached_token');
    expect(calls).toBe(1);
  });

  it('invalidates cache and fetches a new token', async () => {
    let calls = 0;
    const httpClient = createStubHttpClient(async () => {
      calls += 1;
      return jsonResponse(200, { access_token: calls === 1 ? 't1' : 't2', expires_in: 3600 });
    });

    const client = new OAuthClient(httpClient, { authUrl, clientId, clientSecret });
    const provider = new ClientCredentialsAuthProvider(client);

    const h1 = await provider.getAuthorizationHeader();
    provider.invalidate();
    const h2 = await provider.getAuthorizationHeader();

    expect(h1).toBe('Bearer t1');
    expect(h2).toBe('Bearer t2');
    expect(calls).toBe(2);
  });

  it('deduplicates concurrent refreshes', async () => {
    let resolveToken: (() => void) | undefined;
    let calls = 0;
    const gate = new Promise<void>((resolve) => {
      resolveToken = resolve;
    });

    const httpClient = createStubHttpClient(async () => {
      calls += 1;
      await gate;
      return jsonResponse(200, { access_token: 'shared', expires_in: 3600 });
    });

    const client = new OAuthClient(httpClient, { authUrl, clientId, clientSecret });
    const provider = new ClientCredentialsAuthProvider(client);

    const p1 = provider.getAuthorizationHeader();
    const p2 = provider.getAuthorizationHeader();
    resolveToken?.();

    const [h1, h2] = await Promise.all([p1, p2]);
    expect(h1).toBe('Bearer shared');
    expect(h2).toBe('Bearer shared');
    expect(calls).toBe(1);
  });

  it('refreshes immediately when token expires within the refresh buffer', async () => {
    let calls = 0;
    const httpClient = createStubHttpClient(async () => {
      calls += 1;
      return jsonResponse(200, { access_token: `t${calls}`, expires_in: 1 });
    });

    const client = new OAuthClient(httpClient, { authUrl, clientId, clientSecret });
    const provider = new ClientCredentialsAuthProvider(client);

    const h1 = await provider.getAuthorizationHeader();
    const h2 = await provider.getAuthorizationHeader();

    expect(h1).toBe('Bearer t1');
    expect(h2).toBe('Bearer t2');
    expect(calls).toBe(2);
  });
});

