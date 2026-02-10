import { CarrierClient } from '../../integrations/shared/carrier-client';
import { HttpResponse } from '../../application/ports/http-client';
import { CircuitBreaker } from './circuit-breaker';

export class CircuitBreakerCarrierClient<CarrierRequest> implements CarrierClient<CarrierRequest> {
  constructor(
    private readonly carrierName: string,
    private readonly breaker: CircuitBreaker,
    private readonly inner: CarrierClient<CarrierRequest>
  ) {}

  send(request: CarrierRequest, context: { requestId: string }): Promise<HttpResponse> {
    return this.breaker.execute(this.carrierName, () => this.inner.send(request, context));
  }
}

