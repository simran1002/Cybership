import { ServiceError } from '../../domain/errors';

export interface RetryPolicy {
  maxAttempts: number;
  shouldRetry(error: unknown, attempt: number): boolean;
  getDelayMs(attempt: number, error: unknown): number;
}

export interface ExponentialBackoffOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  constructor(private readonly options: ExponentialBackoffOptions) {}

  get maxAttempts(): number {
    return this.options.maxAttempts;
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.options.maxAttempts) return false;
    if (error instanceof ServiceError) return error.retryable;
    return false;
  }

  getDelayMs(attempt: number): number {
    const exp = Math.pow(2, attempt - 1);
    const raw = this.options.baseDelayMs * exp;
    const capped = Math.min(raw, this.options.maxDelayMs);
    return applyJitter(capped, this.options.jitterRatio);
  }
}

function applyJitter(delayMs: number, jitterRatio: number): number {
  const jitter = delayMs * jitterRatio;
  const min = delayMs - jitter;
  const max = delayMs + jitter;
  return Math.max(0, Math.floor(min + Math.random() * (max - min)));
}

