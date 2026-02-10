import { OpenTelemetryTracer } from '../../infrastructure/tracing/opentelemetry-tracer';

describe('OpenTelemetryTracer', () => {
  it('executes the callback and returns its result', async () => {
    const tracer = new OpenTelemetryTracer({ serviceName: 'test-service' });
    const result = await tracer.startSpan('test-span', { a: 1 }, async (span) => {
      span.setAttribute('k', 'v');
      span.recordException(new Error('x'));
      span.end();
      return 123;
    });
    expect(result).toBe(123);
  });
});

