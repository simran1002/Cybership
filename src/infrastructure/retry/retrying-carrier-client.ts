import { CarrierClient } from '../../integrations/shared/carrier-client';
import { HttpResponse } from '../../application/ports/http-client';
import { Logger } from '../../application/ports/logger';
import { withRetry } from './with-retry';
import { RetryPolicy } from './retry-policy';

export class RetryingCarrierClient<CarrierRequest> implements CarrierClient<CarrierRequest> {
  constructor(
    private readonly carrierName: string,
    private readonly policy: RetryPolicy,
    private readonly inner: CarrierClient<CarrierRequest>,
    private readonly logger?: Logger
  ) {}

  send(request: CarrierRequest, context: { requestId: string }): Promise<HttpResponse> {
    const log = this.logger?.child({ carrier: this.carrierName, requestId: context.requestId });
    return withRetry(
      async () => this.inner.send(request, context),
      this.policy,
      ({ attempt, delayMs, error }) => {
        log?.warn({ attempt, delayMs, err: error }, 'retrying carrier request');
      }
    );
  }
}

