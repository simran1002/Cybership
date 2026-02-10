import { Span, Tracer } from '../../application/ports/tracer';

class NoopSpan implements Span {
  setAttribute(_key: string, _value: string | number | boolean): void {}
  recordException(_error: unknown): void {}
  end(): void {}
}

export class NoopTracer implements Tracer {
  async startSpan<T>(
    _name: string,
    _attributes: Record<string, string | number | boolean>,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    return fn(new NoopSpan());
  }
}

