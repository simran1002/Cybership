import { createStubHttpClient, jsonResponse, textResponse } from '../helpers/stub-http-client';
import { OAuthClient } from '../../infrastructure/auth/oauth-client';
import { ClientCredentialsAuthProvider } from '../../infrastructure/auth/client-credentials-auth-provider';
import { UpsRateClient } from '../../integrations/ups/ups-rate-client';
import { UpsRateMapper } from '../../integrations/ups/ups-rate-mapper';
import { UpsRateCarrier } from '../../integrations/ups/ups-rate-carrier';
import { ErrorCode, NetworkError, RateLimitError, ServiceError, TimeoutError } from '../../domain/errors';
import { RateRequest } from '../../domain/rates';

const upsConfig = {
  clientId: 'test-client',
  clientSecret: 'test-secret',
  baseUrl: 'https://api.ups.com',
  authUrl: 'https://auth.ups.com/token',
  timeoutMs: 30000,
  accountNumber: 'A1B2C3'
};

const validRequest: RateRequest = {
  origin: {
    street: ['123 Main St'],
    city: 'Atlanta',
    state: 'GA',
    postalCode: '30339',
    country: 'US'
  },
  destination: {
    street: ['456 Oak Ave'],
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90001',
    country: 'US'
  },
  packages: [{ weight: 5, length: 10, width: 8, height: 6 }]
};

type UpsRateRequestPayload = {
  RateRequest: {
    Request: { RequestOption: string };
    Shipment: {
      Shipper: { ShipperNumber?: string; Address: { City: string } };
      ShipTo: { Address: { City: string } };
      Package: Array<{ Weight: { Value: string } }>;
      Service?: { Code: string };
    };
  };
};

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function rateSuccessResponse() {
  return {
    RateResponse: {
      Response: {
        ResponseStatus: { Code: '1', Description: 'Success' }
      },
      RatedShipment: [
        {
          Service: { Code: '03', Description: 'UPS Ground' },
          TotalCharges: { CurrencyCode: 'USD', MonetaryValue: '18.42' },
          GuaranteedDelivery: { Date: futureDate(5) }
        },
        {
          Service: { Code: '01', Description: 'UPS Next Day Air' },
          TotalCharges: { CurrencyCode: 'USD', MonetaryValue: '89.50' },
          GuaranteedDelivery: { Date: futureDate(1) }
        }
      ]
    }
  };
}

function rateErrorStatusResponse() {
  return {
    RateResponse: {
      Response: {
        ResponseStatus: { Code: '0', Description: 'Failure' },
        Alert: [{ Code: '123', Description: 'Invalid address' }]
      }
    }
  };
}

function buildCarrier(httpHandler: Parameters<typeof createStubHttpClient>[0]) {
  const httpClient = createStubHttpClient(httpHandler);
  const oauthClient = new OAuthClient(httpClient, {
    authUrl: upsConfig.authUrl,
    clientId: upsConfig.clientId,
    clientSecret: upsConfig.clientSecret,
    timeoutMs: upsConfig.timeoutMs
  });
  const authProvider = new ClientCredentialsAuthProvider(oauthClient);
  const rateClient = new UpsRateClient(httpClient, authProvider, upsConfig);
  const mapper = new UpsRateMapper({ accountNumber: upsConfig.accountNumber });
  const carrier = new UpsRateCarrier(rateClient, mapper);
  return { httpClient, carrier };
}

describe('UpsRateCarrier (UPS Rating)', () => {
  it('exposes carrier name and supported service levels', () => {
    const { carrier } = buildCarrier(async (req) => {
      if (req.url === upsConfig.authUrl) {
        return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
      }
      return jsonResponse(200, rateSuccessResponse());
    });

    expect(carrier.getName()).toBe('UPS');
    expect(carrier.supportsServiceLevel('ground')).toBe(true);
    expect(carrier.supportsServiceLevel('nextDayAir')).toBe(true);
  });

  describe('request building', () => {
    it('builds a correct UPS payload and includes auth + request id headers', async () => {
      const { httpClient, carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', token_type: 'Bearer', expires_in: 3600 });
        }
        return jsonResponse(200, rateSuccessResponse());
      });

      const result = await carrier.getRates(validRequest);
      const requests = httpClient.getRequests();

      const rateReq = requests.find((r) => r.url.includes('/api/rating/v1/Rate'));
      expect(rateReq).toBeDefined();
      expect(rateReq!.headers?.['Authorization']).toBe('Bearer token_1');
      expect(rateReq!.headers?.['transId']).toBe(result.requestId);

      const body = JSON.parse(rateReq!.body ?? '{}') as UpsRateRequestPayload;
      expect(body.RateRequest.Request.RequestOption).toBe('Shop');
      expect(body.RateRequest.Shipment.Shipper.ShipperNumber).toBe(upsConfig.accountNumber);
      expect(body.RateRequest.Shipment.Shipper.Address.City).toBe('Atlanta');
      expect(body.RateRequest.Shipment.ShipTo.Address.City).toBe('Los Angeles');
      expect(body.RateRequest.Shipment.Package).toHaveLength(1);
      expect(body.RateRequest.Shipment.Package[0]!.Weight.Value).toBe('5');
    });

    it('uses Rate + service code when a service level is requested', async () => {
      const { httpClient, carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return jsonResponse(200, rateSuccessResponse());
      });

      await carrier.getRates({ ...validRequest, serviceLevel: 'ground' });
      const rateReq = httpClient.getRequests().find((r) => r.url.includes('/api/rating/v1/Rate'))!;
      const body = JSON.parse(rateReq.body ?? '{}') as UpsRateRequestPayload;
      expect(body.RateRequest.Request.RequestOption).toBe('Rate');
      expect(body.RateRequest.Shipment.Service?.Code).toBe('03');
    });
  });

  describe('response parsing', () => {
    it('normalizes UPS response into RateResponse', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return jsonResponse(200, rateSuccessResponse());
      });

      const result = await carrier.getRates(validRequest);
      expect(result.quotes).toHaveLength(2);
      expect(result.requestId).toMatch(/^req_\d+_/);

      const ground = result.quotes.find((q) => q.serviceLevel === 'ground');
      expect(ground?.totalCost).toBe(18.42);
      expect(ground?.currency).toBe('USD');
      expect(ground?.carrier).toBe('UPS');
      expect(ground?.estimatedDays).toBeGreaterThan(0);
    });

    it('prefers negotiated rates when present', async () => {
      const negotiated = {
        RateResponse: {
          Response: { ResponseStatus: { Code: '1', Description: 'Success' } },
          RatedShipment: [
            {
              Service: { Code: '03', Description: 'UPS Ground' },
              TotalCharges: { CurrencyCode: 'USD', MonetaryValue: '25.00' },
              NegotiatedRateCharges: {
                TotalCharge: { CurrencyCode: 'USD', MonetaryValue: '18.00' }
              }
            }
          ]
        }
      };

      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return jsonResponse(200, negotiated);
      });

      const result = await carrier.getRates(validRequest);
      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0]!.totalCost).toBe(18);
    });
  });

  describe('auth lifecycle (401 retry)', () => {
    it('refreshes the token and retries once on 401', async () => {
      let tokenCalls = 0;
      let rateCalls = 0;

      const { httpClient, carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          tokenCalls += 1;
          return jsonResponse(200, { access_token: tokenCalls === 1 ? 'token_1' : 'token_2', expires_in: 3600 });
        }
        rateCalls += 1;
        if (rateCalls === 1) return textResponse(401, 'Unauthorized');
        return jsonResponse(200, rateSuccessResponse());
      });

      const result = await carrier.getRates(validRequest);
      expect(result.quotes).toHaveLength(2);
      expect(tokenCalls).toBe(2);
      expect(rateCalls).toBe(2);

      const rateRequests = httpClient.getRequests().filter((r) => r.url.includes('/api/rating/v1/Rate'));
      expect(rateRequests).toHaveLength(2);
      expect(rateRequests[0]!.headers?.['Authorization']).toBe('Bearer token_1');
      expect(rateRequests[1]!.headers?.['Authorization']).toBe('Bearer token_2');
    });

    it('throws AUTH_TOKEN_INVALID after a second 401', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return textResponse(401, 'Unauthorized');
      });

      await expect(carrier.getRates(validRequest)).rejects.toMatchObject({
        code: ErrorCode.AUTH_TOKEN_INVALID,
        carrier: 'UPS'
      });
    });
  });

  describe('error handling', () => {
    it('throws API_ERROR when UPS returns failure status in body', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return jsonResponse(200, rateErrorStatusResponse());
      });

      await expect(carrier.getRates(validRequest)).rejects.toMatchObject({
        code: ErrorCode.API_ERROR,
        carrier: 'UPS'
      });
    });

    it('throws RateLimitError on 429', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return textResponse(429, 'Too Many Requests');
      });

      await expect(carrier.getRates(validRequest)).rejects.toBeInstanceOf(RateLimitError);
    });

    it('throws retryable API_ERROR on 5xx', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return textResponse(503, 'Service Unavailable');
      });

      await expect(carrier.getRates(validRequest)).rejects.toMatchObject({
        code: ErrorCode.API_ERROR,
        carrier: 'UPS',
        retryable: true
      });
    });

    it('throws non-retryable API_ERROR on other non-2xx responses', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return textResponse(400, 'Bad Request');
      });

      await expect(carrier.getRates(validRequest)).rejects.toMatchObject({
        code: ErrorCode.API_ERROR,
        carrier: 'UPS',
        retryable: false
      });
    });

    it('throws MALFORMED_RESPONSE on invalid JSON', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        return textResponse(200, '<html>not json</html>');
      });

      await expect(carrier.getRates(validRequest)).rejects.toMatchObject({
        code: ErrorCode.MALFORMED_RESPONSE,
        carrier: 'UPS'
      });
    });

    it('attaches carrier context to network errors', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        throw new NetworkError('socket hang up');
      });

      await expect(carrier.getRates(validRequest)).rejects.toMatchObject({
        code: ErrorCode.NETWORK_ERROR,
        carrier: 'UPS'
      });
    });

    it('wraps unexpected non-ServiceError failures as UNKNOWN_ERROR', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        throw new Error('boom');
      });

      await expect(carrier.getRates(validRequest)).rejects.toMatchObject({
        code: ErrorCode.UNKNOWN_ERROR,
        carrier: 'UPS'
      });
    });

    it('attaches carrier context to timeout errors', async () => {
      const { carrier } = buildCarrier(async (req) => {
        if (req.url === upsConfig.authUrl) {
          return jsonResponse(200, { access_token: 'token_1', expires_in: 3600 });
        }
        throw new TimeoutError('Request timeout after 30000ms');
      });

      try {
        await carrier.getRates(validRequest);
        throw new Error('expected to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(ServiceError);
        const err = e as ServiceError;
        expect(err.code).toBe(ErrorCode.TIMEOUT);
        expect(err.carrier).toBe('UPS');
      }
    });
  });
});
