import { HttpClient, HttpRequest, HttpResponse } from '../../application/ports/http-client';
import { Logger } from '../../application/ports/logger';
import { Tracer } from '../../application/ports/tracer';
import { redactHeaders } from '../logging/redaction';

export interface InstrumentedHttpClientOptions {
  logger: Logger;
  tracer: Tracer;
}

export class InstrumentedHttpClient implements HttpClient {
  constructor(
    private readonly inner: HttpClient,
    private readonly options: InstrumentedHttpClientOptions
  ) {}

  async request(request: HttpRequest): Promise<HttpResponse> {
    const start = Date.now();
    const log = this.options.logger.child({ url: request.url, method: request.method });
    const safeHeaders = redactHeaders(request.headers);

    return this.options.tracer.startSpan(
      'http.request',
      { 'http.method': request.method, 'http.url': request.url },
      async (span) => {
        log.debug(
          { headers: safeHeaders, timeoutMs: request.timeoutMs, bodyBytes: request.body?.length ?? 0 },
          'http request'
        );

        try {
          const res = await this.inner.request(request);
          const durationMs = Date.now() - start;
          span.setAttribute('http.status_code', res.status);
          span.setAttribute('duration_ms', durationMs);

          log.info({ status: res.status, durationMs }, 'http response');
          return res;
        } catch (error) {
          const durationMs = Date.now() - start;
          span.recordException(error);
          span.setAttribute('duration_ms', durationMs);
          log.error({ err: error, durationMs }, 'http request failed');
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }
}

