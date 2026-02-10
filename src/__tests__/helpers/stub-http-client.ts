import { HttpClient, HttpRequest, HttpResponse } from '../../application/ports/http-client';

export function createStubHttpClient(
  handler: (request: HttpRequest) => Promise<HttpResponse>
): HttpClient & { getRequests: () => HttpRequest[] } {
  const requests: HttpRequest[] = [];

  return {
    async request(request: HttpRequest): Promise<HttpResponse> {
      requests.push(request);
      return handler(request);
    },
    getRequests: () => [...requests]
  };
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = { 'content-type': 'application/json' }
): HttpResponse {
  return { status, headers, bodyText: JSON.stringify(body) };
}

export function textResponse(
  status: number,
  bodyText: string,
  headers: Record<string, string> = { 'content-type': 'text/plain' }
): HttpResponse {
  return { status, headers, bodyText };
}

