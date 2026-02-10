import { RetryPolicy } from './retry-policy';

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
): Promise<T> {
  let attempt = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!policy.shouldRetry(error, attempt)) {
        throw error;
      }
      attempt += 1;
      const delayMs = policy.getDelayMs(attempt, error);
      onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

