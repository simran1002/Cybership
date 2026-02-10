import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { Span, Tracer } from '../../application/ports/tracer';

class OtelSpan implements Span {
  private ended = false;

  constructor(private readonly inner: import('@opentelemetry/api').Span) {}

  setAttribute(key: string, value: string | number | boolean): void {
    this.inner.setAttribute(key, value);
  }

  recordException(error: unknown): void {
    if (error instanceof Error) {
      this.inner.recordException(error);
    } else {
      this.inner.recordException({ message: String(error) });
    }
    this.inner.setStatus({ code: SpanStatusCode.ERROR });
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.inner.end();
  }
}

export interface OpenTelemetryTracerOptions {
  serviceName: string;
}

export class OpenTelemetryTracer implements Tracer {
  private readonly tracer: import('@opentelemetry/api').Tracer;

  constructor(options: OpenTelemetryTracerOptions) {
    this.tracer = trace.getTracer(options.serviceName);
  }

  async startSpan<T>(
    name: string,
    attributes: Record<string, string | number | boolean>,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(name);
    for (const [k, v] of Object.entries(attributes)) {
      span.setAttribute(k, v);
    }

    const wrapped = new OtelSpan(span);
    try {
      return await context.with(trace.setSpan(context.active(), span), () => fn(wrapped));
    } catch (error) {
      wrapped.recordException(error);
      throw error;
    } finally {
      wrapped.end();
    }
  }
}

