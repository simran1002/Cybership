import { loadUpsConfig } from '../../integrations/ups/ups-config';
import { ConfigError } from '../../domain/errors';

describe('UPS config loader', () => {
  it('loads required fields and defaults optional ones', () => {
    const env = {
      get: (name: string) => {
        if (name === 'UPS_CLIENT_ID') return 'id';
        if (name === 'UPS_CLIENT_SECRET') return 'secret';
        return undefined;
      }
    };

    const cfg = loadUpsConfig(env);
    expect(cfg.clientId).toBe('id');
    expect(cfg.clientSecret).toBe('secret');
    expect(cfg.baseUrl).toBe('https://onlinetools.ups.com');
    expect(cfg.authUrl).toContain('oauth/token');
    expect(cfg.timeoutMs).toBe(30000);
  });

  it('includes accountNumber only when present', () => {
    const env = {
      get: (name: string) => {
        if (name === 'UPS_CLIENT_ID') return 'id';
        if (name === 'UPS_CLIENT_SECRET') return 'secret';
        if (name === 'UPS_ACCOUNT_NUMBER') return 'ACCT';
        return undefined;
      }
    };

    const cfg = loadUpsConfig(env);
    expect(cfg.accountNumber).toBe('ACCT');
  });

  it('throws ConfigError when required env vars are missing', () => {
    const env = { get: (_: string) => undefined };
    expect(() => loadUpsConfig(env)).toThrow(ConfigError);
  });
});

