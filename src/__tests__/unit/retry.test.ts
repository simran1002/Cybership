import { ExponentialBackoffRetryPolicy } from '../../infrastructure/retry/retry-policy';
import { withRetry } from '../../infrastructure/retry/with-retry';
import { ErrorCode, ServiceError } from '../../domain/errors';

describe('retry', () => {
  it('retries retryable ServiceErrors and eventually succeeds', async () => {
    const policy = new ExponentialBackoffRetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      jitterRatio: 0
    });

    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new ServiceError('temporary', {
            code: ErrorCode.NETWORK_ERROR,
            carrier: 'UPS',
            retryable: true
          });
        }
        return 'ok';
      },
      policy
    );

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry non-retryable errors', async () => {
    const policy = new ExponentialBackoffRetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      jitterRatio: 0
    });

    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new ServiceError('bad request', {
            code: ErrorCode.VALIDATION_ERROR,
            carrier: 'UPS',
            retryable: false
          });
        },
        policy
      )
    ).rejects.toBeInstanceOf(ServiceError);

    expect(calls).toBe(1);
  });
});

