import { ConfigError } from '../domain/errors';

export interface EnvReader {
  get(name: string): string | undefined;
}

export const processEnv: EnvReader = {
  get: (name: string) => process.env[name]
};

export function requireEnv(name: string, env: EnvReader = processEnv): string {
  const value = env.get(name);
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, env: EnvReader = processEnv): string | undefined {
  return env.get(name);
}

export function envNumber(
  name: string,
  defaultValue: number,
  env: EnvReader = processEnv
): number {
  const value = env.get(name);
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`Invalid number for environment variable ${name}: ${value}`);
  }
  return parsed;
}

