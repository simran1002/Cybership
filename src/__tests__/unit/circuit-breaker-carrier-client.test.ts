import { CircuitBreaker } from '../../infrastructure/circuit-breaker/circuit-breaker';
import { CircuitBreakerCarrierClient } from '../../infrastructure/circuit-breaker/circuit-breaker-carrier-client';
import { CarrierClient } from '../../integrations/shared/carrier-client';
import { CircuitOpenError } from '../../domain/errors';
import { HttpResponse } from '../../application/ports/http-client';

describe('CircuitBreakerCarrierClient', () => {
  it('fast-fails with CircuitOpenError when the breaker is open', async () => {
    const now = 1000;
    const breaker = new CircuitBreaker(
      { failureThreshold: 1, openDurationMs: 10000 },
      () => now
    );

    const inner: CarrierClient<{ x: number }> = {
      async send(): Promise<HttpResponse> {
        throw new Error('fail');
      }
    };

    const client = new CircuitBreakerCarrierClient('UPS', breaker, inner);
    await expect(client.send({ x: 1 }, { requestId: 'req_1' })).rejects.toThrow('fail');
    await expect(client.send({ x: 1 }, { requestId: 'req_2' })).rejects.toBeInstanceOf(CircuitOpenError);
  });
});

