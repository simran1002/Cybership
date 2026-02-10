import { RetryingCarrierClient } from '../../infrastructure/retry/retrying-carrier-client';
import { ExponentialBackoffRetryPolicy } from '../../infrastructure/retry/retry-policy';
import { CarrierClient } from '../../integrations/shared/carrier-client';
import { ErrorCode, ServiceError } from '../../domain/errors';
import { HttpResponse } from '../../application/ports/http-client';

describe('RetryingCarrierClient', () => {
  it('retries retryable failures and returns the eventual response', async () => {
    const policy = new ExponentialBackoffRetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      jitterRatio: 0
    });

    let calls = 0;
    const inner: CarrierClient<{ x: number }> = {
      async send(): Promise<HttpResponse> {
        calls += 1;
        if (calls < 3) {
          throw new ServiceError('temporary', {
            code: ErrorCode.NETWORK_ERROR,
            carrier: 'UPS',
            retryable: true
          });
        }
        return { status: 200, headers: {}, bodyText: '{}' };
      }
    };

    const client = new RetryingCarrierClient('UPS', policy, inner);
    const res = await client.send({ x: 1 }, { requestId: 'req_1' });

    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });
});

