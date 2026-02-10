import { envNumber, optionalEnv, requireEnv } from '../../config/env';
import { ConfigError } from '../../domain/errors';

describe('config/env', () => {
  it('requireEnv returns the value when present', () => {
    const env = { get: (name: string) => (name === 'X' ? '123' : undefined) };
    expect(requireEnv('X', env)).toBe('123');
  });

  it('requireEnv throws ConfigError when missing', () => {
    const env = { get: (_: string) => undefined };
    expect(() => requireEnv('MISSING', env)).toThrow(ConfigError);
  });

  it('optionalEnv returns undefined when missing', () => {
    const env = { get: (_: string) => undefined };
    expect(optionalEnv('NOPE', env)).toBeUndefined();
  });

  it('envNumber returns default when missing', () => {
    const env = { get: (_: string) => undefined };
    expect(envNumber('N', 42, env)).toBe(42);
  });

  it('envNumber parses a valid number', () => {
    const env = { get: (_: string) => '30000' };
    expect(envNumber('N', 42, env)).toBe(30000);
  });

  it('envNumber throws ConfigError on invalid number', () => {
    const env = { get: (_: string) => 'not-a-number' };
    expect(() => envNumber('N', 42, env)).toThrow(ConfigError);
  });
});

