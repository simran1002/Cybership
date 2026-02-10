import { CarrierRegistry } from '../../application/registry/carrier-registry';
import { RateService } from '../../application/services/rate-service';
import { NoopLogger } from '../../infrastructure/logging/noop-logger';
import { NoopTracer } from '../../infrastructure/tracing/noop-tracer';
import { InMemoryRateCache } from '../../infrastructure/caching/in-memory-rate-cache';
import { RateRequest, RateResponse, ServiceLevel } from '../../domain/rates';
import { ConfigError, ServiceError, ValidationError } from '../../domain/errors';
import { Tracer, Span } from '../../application/ports/tracer';

const validRequest: RateRequest = {
  origin: {
    street: ['123 Main St'],
    city: 'Atlanta',
    state: 'GA',
    postalCode: '30339',
    country: 'US'
  },
  destination: {
    street: ['456 Oak Ave'],
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90001',
    country: 'US'
  },
  packages: [{ weight: 5, length: 10, width: 8, height: 6 }]
};

function createServiceWithCarriers(carriers: Array<{
  name: string;
  getRates: (request: RateRequest) => Promise<RateResponse>;
  supports?: (serviceLevel: ServiceLevel) => boolean;
}>): RateService {
  const registry = new CarrierRegistry();
  carriers.forEach((c) =>
    registry.registerCarrier({
      getName: () => c.name,
      getRates: c.getRates,
      ...(c.supports && { supportsServiceLevel: c.supports })
    })
  );
  return new RateService(registry, { logger: new NoopLogger(), tracer: new NoopTracer() });
}

describe('RateService', () => {
  it('returns rates from all registered carriers', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'A',
        getRates: async () => ({ requestId: 'r1', quotes: [{ carrier: 'A', currency: 'USD', serviceLevel: 'ground', serviceName: 'Ground', totalCost: 1 }] })
      },
      {
        name: 'B',
        getRates: async () => ({ requestId: 'r2', quotes: [{ carrier: 'B', currency: 'USD', serviceLevel: 'ground', serviceName: 'Ground', totalCost: 2 }] })
      }
    ]);

    const results = await service.getRates(validRequest);
    expect(results).toHaveLength(2);
    const carriers = results.flatMap((r) => r.quotes.map((q) => q.carrier)).sort();
    expect(carriers).toEqual(['A', 'B']);
  });

  it('caches rate results when a cache is configured', async () => {
    let calls = 0;
    const registry = new CarrierRegistry();
    registry.registerCarrier({
      getName: () => 'UPS',
      getRates: async () => {
        calls += 1;
        return {
          requestId: `r${calls}`,
          quotes: [{ carrier: 'UPS', currency: 'USD', serviceLevel: 'ground', serviceName: 'Ground', totalCost: 1 }]
        };
      }
    });

    const cache = new InMemoryRateCache({ maxEntries: 50 });
    const service = new RateService(registry, {
      logger: new NoopLogger(),
      tracer: new NoopTracer(),
      cache,
      cacheTtlMs: 60000
    });

    const r1 = await service.getRates(validRequest);
    const r2 = await service.getRates(validRequest);

    expect(calls).toBe(1);
    expect(r1[0]!.requestId).toBe(r2[0]!.requestId);
  });

  it('lists registered carriers', () => {
    const registry = new CarrierRegistry();
    registry.registerCarrier({
      getName: () => 'UPS',
      getRates: async () => ({ requestId: 'x', quotes: [] })
    });

    const service = new RateService(registry, { logger: new NoopLogger(), tracer: new NoopTracer() });
    expect(service.listCarriers().map((c) => c.getName())).toEqual(['UPS']);
  });

  it('validates the request before calling carriers', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'A',
        getRates: async () => ({ requestId: 'r1', quotes: [] })
      }
    ]);

    const invalidRequest = {
      ...validRequest,
      origin: { ...validRequest.origin, state: 'TOOLONG' }
    };

    await expect(service.getRates(invalidRequest as RateRequest)).rejects.toBeInstanceOf(ValidationError);
  });

  it('filters carriers by service level when specified', async () => {
    const called: string[] = [];
    const service = createServiceWithCarriers([
      {
        name: 'A',
        supports: () => true,
        getRates: async () => {
          called.push('A');
          return { requestId: 'r1', quotes: [] };
        }
      },
      {
        name: 'B',
        supports: () => false,
        getRates: async () => {
          called.push('B');
          return { requestId: 'r2', quotes: [] };
        }
      }
    ]);

    await service.getRatesDetailed({ ...validRequest, serviceLevel: 'ground' });
    expect(called).toEqual(['A']);
  });

  it('throws when no carrier supports requested service level', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'A',
        supports: () => false,
        getRates: async () => ({ requestId: 'r1', quotes: [] })
      }
    ]);

    await expect(service.getRatesDetailed({ ...validRequest, serviceLevel: 'ground' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('getRatesFromCarrier returns rates for the requested carrier', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'UPS',
        getRates: async () => ({ requestId: 'r1', quotes: [{ carrier: 'UPS', currency: 'USD', serviceLevel: 'ground', serviceName: 'Ground', totalCost: 1 }] })
      }
    ]);

    const result = await service.getRatesFromCarrier('UPS', validRequest);
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]!.carrier).toBe('UPS');
  });

  it('getRatesFromCarrier validates request input', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'UPS',
        getRates: async () => ({ requestId: 'r1', quotes: [] })
      }
    ]);

    const invalidRequest = {
      ...validRequest,
      destination: { ...validRequest.destination, country: 'USA' }
    };

    await expect(service.getRatesFromCarrier('UPS', invalidRequest as RateRequest)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('getRatesFromCarrier throws a ValidationError when carrier not found', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'UPS',
        getRates: async () => ({ requestId: 'r1', quotes: [] })
      }
    ]);

    await expect(service.getRatesFromCarrier('FedEx', validRequest)).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns partial results when one carrier fails (and surfaces the error in detailed results)', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'Failing',
        getRates: async () => {
          throw new Error('boom');
        }
      },
      {
        name: 'OK',
        getRates: async () => ({ requestId: 'r1', quotes: [{ carrier: 'OK', currency: 'USD', serviceLevel: 'ground', serviceName: 'Ground', totalCost: 1 }] })
      }
    ]);

    const detailed = await service.getRatesDetailed(validRequest);
    expect(detailed).toHaveLength(2);
    expect(detailed.find((r) => r.carrier === 'OK')?.response).toBeDefined();
    expect(detailed.find((r) => r.carrier === 'Failing')?.error).toBeInstanceOf(ServiceError);

    const results = await service.getRates(validRequest);
    expect(results).toHaveLength(1);
    expect(results[0]!.quotes).toHaveLength(1);
    expect(results[0]!.quotes[0]!.carrier).toBe('OK');
  });

  it('throws when all carriers fail', async () => {
    const service = createServiceWithCarriers([
      {
        name: 'Failing',
        getRates: async () => {
          throw new Error('boom');
        }
      }
    ]);

    await expect(service.getRates(validRequest)).rejects.toBeInstanceOf(ServiceError);
  });

  it('throws ConfigError when registry is empty', () => {
    const registry = new CarrierRegistry();
    expect(() => new RateService(registry, { logger: new NoopLogger(), tracer: new NoopTracer() })).toThrow(
      ConfigError
    );
  });

  it('records and rethrows unexpected errors during execution', async () => {
    class TestSpan implements Span {
      readonly exceptions: unknown[] = [];
      setAttribute(): void {}
      recordException(error: unknown): void {
        this.exceptions.push(error);
      }
      end(): void {}
    }

    class TestTracer implements Tracer {
      readonly span = new TestSpan();
      async startSpan<T>(
        _name: string,
        _attributes: Record<string, string | number | boolean>,
        fn: (span: Span) => Promise<T>
      ): Promise<T> {
        return fn(this.span);
      }
    }

    const registry = new CarrierRegistry();
    let nameCalls = 0;
    registry.registerCarrier({
      getName: () => {
        nameCalls += 1;
        if (nameCalls === 1) return 'UPS';
        throw new Error('boom in metadata');
      },
      getRates: async () => ({ requestId: 'x', quotes: [] })
    });

    const tracer = new TestTracer();
    const service = new RateService(registry, { logger: new NoopLogger(), tracer });

    await expect(service.getRatesDetailed(validRequest)).rejects.toThrow('boom in metadata');
    expect(tracer.span.exceptions).toHaveLength(1);
  });
});
