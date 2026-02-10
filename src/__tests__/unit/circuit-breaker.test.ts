import { CircuitBreaker } from '../../infrastructure/circuit-breaker/circuit-breaker';
import { CircuitOpenError } from '../../domain/errors';

describe('CircuitBreaker', () => {
  it('opens after the failure threshold and fast-fails until openDuration passes', async () => {
    let now = 1000;
    const breaker = new CircuitBreaker(
      { failureThreshold: 2, openDurationMs: 5000 },
      () => now
    );

    const failing = async () => {
      throw new Error('fail');
    };

    await expect(breaker.execute('UPS', failing)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('closed');

    await expect(breaker.execute('UPS', failing)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('open');

    await expect(breaker.execute('UPS', async () => 'ok')).rejects.toBeInstanceOf(CircuitOpenError);

    now += 5001;
    const result = await breaker.execute('UPS', async () => 'ok');
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('closed');
  });
});

