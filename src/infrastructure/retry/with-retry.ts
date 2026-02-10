import { RetryPolicy } from './retry-policy';

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
): Promise<T> {
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!policy.shouldRetry(error, attempt)) {
        throw error;
      }
      const nextAttempt = attempt + 1;
      const delayMs = policy.getDelayMs(nextAttempt, error);
      onRetry?.({ attempt: nextAttempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw new Error('Retry attempts exhausted');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

