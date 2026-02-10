import { createCybershipRatesClient } from '../../sdk/rates-client';
import { createStubHttpClient, jsonResponse } from '../helpers/stub-http-client';
import { RateRequest } from '../../domain/rates';

describe('SDK factory', () => {
  it('creates a working client with UPS registered', async () => {
    const config = {
      clientId: 'id',
      clientSecret: 'secret',
      baseUrl: 'https://api.ups.com',
      authUrl: 'https://auth.ups.com/token',
      timeoutMs: 30000
    };

    const httpClient = createStubHttpClient(async (req) => {
      if (req.url === config.authUrl) {
        return jsonResponse(200, { access_token: 't1', expires_in: 3600 });
      }
      return jsonResponse(200, {
        RateResponse: {
          Response: { ResponseStatus: { Code: '1', Description: 'Success' } },
          RatedShipment: [
            {
              Service: { Code: '03', Description: 'UPS Ground' },
              TotalCharges: { CurrencyCode: 'USD', MonetaryValue: '10.00' }
            }
          ]
        }
      });
    });

    const client = createCybershipRatesClient({
      config,
      httpClient,
      instrumentHttp: false,
      enableRetry: false,
      enableCircuitBreaker: false
    });

    expect(client.registry.getCarrier('UPS')).toBeDefined();

    const request: RateRequest = {
      origin: {
        street: ['1 Main'],
        city: 'Atlanta',
        state: 'GA',
        postalCode: '30339',
        country: 'US'
      },
      destination: {
        street: ['2 Main'],
        city: 'Austin',
        state: 'TX',
        postalCode: '73301',
        country: 'US'
      },
      packages: [{ weight: 1, length: 1, width: 1, height: 1 }]
    };

    const rates = await client.service.getRates(request);
    expect(rates).toHaveLength(1);
    expect(rates[0]!.quotes[0]!.carrier).toBe('UPS');
  });
});

