import { envNumber, optionalEnv, requireEnv, EnvReader, processEnv } from '../../config/env';

export interface UpsConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  authUrl: string;
  accountNumber?: string;
  timeoutMs: number;
}

export function loadUpsConfig(env: EnvReader = processEnv): UpsConfig {
  const accountNumber = optionalEnv('UPS_ACCOUNT_NUMBER', env);
  return {
    clientId: requireEnv('UPS_CLIENT_ID', env),
    clientSecret: requireEnv('UPS_CLIENT_SECRET', env),
    baseUrl: optionalEnv('UPS_BASE_URL', env) ?? 'https://onlinetools.ups.com',
    authUrl:
      optionalEnv('UPS_AUTH_URL', env) ??
      'https://onlinetools.ups.com/security/v1/oauth/token',
    ...(accountNumber ? { accountNumber } : {}),
    timeoutMs: envNumber('UPS_TIMEOUT_MS', 30000, env)
  };
}

