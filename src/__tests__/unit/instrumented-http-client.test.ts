import { InstrumentedHttpClient } from '../../infrastructure/http/instrumented-http-client';
import { NoopTracer } from '../../infrastructure/tracing/noop-tracer';
import { Logger } from '../../application/ports/logger';
import { HttpClient, HttpRequest, HttpResponse } from '../../application/ports/http-client';

class TestLogger implements Logger {
  readonly debugCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;
  readonly infoCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;
  readonly warnCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;
  readonly errorCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;

  constructor(
    private readonly bindings: Record<string, unknown> = {},
    sink: {
      debugCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;
      infoCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;
      warnCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;
      errorCalls: Array<{ obj: Record<string, unknown>; msg: string | undefined }>;
    } = {
      debugCalls: [],
      infoCalls: [],
      warnCalls: [],
      errorCalls: []
    }
  ) {
    this.debugCalls = sink.debugCalls;
    this.infoCalls = sink.infoCalls;
    this.warnCalls = sink.warnCalls;
    this.errorCalls = sink.errorCalls;
  }

  debug(obj: Record<string, unknown>, msg?: string): void {
    this.debugCalls.push({ obj: { ...this.bindings, ...obj }, msg });
  }
  info(obj: Record<string, unknown>, msg?: string): void {
    this.infoCalls.push({ obj: { ...this.bindings, ...obj }, msg });
  }
  warn(obj: Record<string, unknown>, msg?: string): void {
    this.warnCalls.push({ obj: { ...this.bindings, ...obj }, msg });
  }
  error(obj: Record<string, unknown>, msg?: string): void {
    this.errorCalls.push({ obj: { ...this.bindings, ...obj }, msg });
  }
  child(bindings: Record<string, unknown>): Logger {
    return new TestLogger({ ...this.bindings, ...bindings }, {
      debugCalls: this.debugCalls,
      infoCalls: this.infoCalls,
      warnCalls: this.warnCalls,
      errorCalls: this.errorCalls
    });
  }
}

describe('InstrumentedHttpClient', () => {
  it('redacts sensitive headers in logs and returns the underlying response', async () => {
    const inner: HttpClient = {
      async request(_req: HttpRequest): Promise<HttpResponse> {
        return { status: 200, headers: { 'x-test': '1' }, bodyText: 'ok' };
      }
    };

    const logger = new TestLogger();
    const client = new InstrumentedHttpClient(inner, { logger, tracer: new NoopTracer() });

    const res = await client.request({
      method: 'GET',
      url: 'https://example.com',
      headers: { Authorization: 'Bearer secret' }
    });

    expect(res.status).toBe(200);
    expect(logger.debugCalls.length).toBe(1);
    const loggedHeaders = logger.debugCalls[0]!.obj['headers'] as Record<string, unknown>;
    expect(loggedHeaders['Authorization']).toBe('[REDACTED]');
  });

  it('logs and rethrows errors from the underlying client', async () => {
    const inner: HttpClient = {
      async request(): Promise<HttpResponse> {
        throw new Error('boom');
      }
    };

    const logger = new TestLogger();
    const client = new InstrumentedHttpClient(inner, { logger, tracer: new NoopTracer() });

    await expect(client.request({ method: 'GET', url: 'https://example.com' })).rejects.toThrow('boom');
    expect(logger.errorCalls.length).toBe(1);
  });
});

