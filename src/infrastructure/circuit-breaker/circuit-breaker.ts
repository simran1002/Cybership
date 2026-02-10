import { CircuitOpenError } from '../../domain/errors';

type State = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  openDurationMs: number;
}

export class CircuitBreaker {
  private state: State = 'closed';
  private consecutiveFailures = 0;
  private openedAtMs = 0;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly now: () => number = () => Date.now()
  ) {}

  getState(): State {
    return this.state;
  }

  async execute<T>(carrier: string, operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = this.now() - this.openedAtMs;
      if (elapsed < this.options.openDurationMs) {
        throw new CircuitOpenError('Circuit breaker is open', carrier, {
          openDurationMs: this.options.openDurationMs,
          elapsedMs: elapsed
        });
      }
      this.state = 'half_open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = 'open';
      this.openedAtMs = this.now();
    } else if (this.state === 'half_open') {
      this.state = 'open';
      this.openedAtMs = this.now();
    }
  }
}

