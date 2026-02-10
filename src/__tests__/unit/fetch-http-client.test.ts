import { FetchHttpClient } from '../../infrastructure/http/fetch-http-client';
import { NetworkError, TimeoutError } from '../../domain/errors';

describe('FetchHttpClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as unknown as { fetch: typeof originalFetch }).fetch = originalFetch;
  });

  it('returns status, headers, and bodyText without throwing on non-2xx', async () => {
    const mockFetch = jest.fn(async () => {
      return new Response('hello', {
        status: 201,
        headers: { 'X-Test': '1' }
      });
    }) as unknown as typeof fetch;

    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

    const client = new FetchHttpClient(5000);
    const res = await client.request({ method: 'GET', url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.bodyText).toBe('hello');
    expect(res.headers['x-test']).toBe('1');
  });

  it('throws TimeoutError on AbortError', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';

    const mockFetch = jest.fn(async () => {
      throw abortErr;
    }) as unknown as typeof fetch;

    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

    const client = new FetchHttpClient(1);
    await expect(client.request({ method: 'GET', url: 'https://example.com' })).rejects.toBeInstanceOf(
      TimeoutError
    );
  });

  it('throws NetworkError on other fetch failures', async () => {
    const mockFetch = jest.fn(async () => {
      throw new Error('dns');
    }) as unknown as typeof fetch;

    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

    const client = new FetchHttpClient(5000);
    await expect(client.request({ method: 'GET', url: 'https://example.com' })).rejects.toBeInstanceOf(
      NetworkError
    );
  });
});

