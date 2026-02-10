import { HttpClient, HttpRequest, HttpResponse } from '../../application/ports/http-client';
import { NetworkError, TimeoutError } from '../../domain/errors';

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export class FetchHttpClient implements HttpClient {
  constructor(private readonly defaultTimeoutMs = 30000) {}

  async request(request: HttpRequest): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const init: RequestInit = {
        method: request.method,
        signal: controller.signal
      };
      if (request.headers) init.headers = request.headers;
      if (request.body !== undefined) init.body = request.body;

      const res = await fetch(request.url, init);

      const bodyText = await res.text().catch(() => '');
      return {
        status: res.status,
        headers: headersToRecord(res.headers),
        bodyText
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${timeoutMs}ms`, undefined, { url: request.url }, error);
      }
      throw new NetworkError('Network error while making HTTP request', undefined, { url: request.url }, error);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

