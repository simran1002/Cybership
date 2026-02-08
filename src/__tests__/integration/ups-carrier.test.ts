/**
 * Integration tests for UPS Carrier
 * Tests end-to-end logic with stubbed HTTP responses
 */

import { UpsCarrier } from '../../carriers/ups/ups-carrier';
import { TokenManager } from '../../auth/token-manager';
import { HttpClient } from '../../http/client';
import { RateRequest, Address, Package } from '../../types/domain';
import { CarrierIntegrationError } from '../../types/errors';
import { UpsRateResponse, UpsRateRequest } from '../../carriers/ups/types';
import { UpsConfig } from '../../config';

// Mock global fetch for OAuth token requests
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

// Mock HTTP client for testing
class MockHttpClient implements HttpClient {
  private responses: Map<string, unknown> = new Map();
  private requests: Array<{ url: string; body: unknown; headers?: Record<string, string> }> = [];

  setResponse(url: string, response: unknown): void {
    this.responses.set(url, response);
  }

  getRequests(): Array<{ url: string; body: unknown; headers?: Record<string, string> }> {
    return this.requests;
  }

  async post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    this.requests.push({ url, body, headers });
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response set for ${url}`);
    }
    return response as T;
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    this.requests.push({ url, body: null, headers });
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response set for ${url}`);
    }
    return response as T;
  }
}

describe('UPS Carrier Integration Tests', () => {
  let mockHttpClient: MockHttpClient;
  let tokenManager: TokenManager;
  let upsCarrier: UpsCarrier;
  let config: UpsConfig;

  const sampleAddress: Address = {
    street: ['123 Main St'],
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  };

  const samplePackage: Package = {
    weight: 5,
    length: 10,
    width: 8,
    height: 6
  };

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    mockFetch.mockClear();
    config = {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      baseUrl: 'https://onlinetools.ups.com',
      authUrl: 'https://onlinetools.ups.com/security/v1/oauth/token',
      timeout: 30000
    };
    tokenManager = new TokenManager(
      mockHttpClient,
      config.authUrl,
      config.clientId,
      config.clientSecret
    );
    upsCarrier = new UpsCarrier(mockHttpClient, tokenManager, config);
  });

  describe('Authentication', () => {
    it('should acquire and cache access token', async () => {
      const tokenResponse = {
        access_token: 'test_access_token_123',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });

      const token = await tokenManager.getAccessToken();
      expect(token).toBe('test_access_token_123');

      // Verify fetch was called with correct OAuth parameters
      expect(mockFetch).toHaveBeenCalledWith(
        config.authUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    it('should reuse cached token when valid', async () => {
      const tokenResponse = {
        access_token: 'test_access_token_123',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => tokenResponse
      });

      // First call
      const token1 = await tokenManager.getAccessToken();
      expect(token1).toBe('test_access_token_123');

      // Second call should reuse cached token
      const token2 = await tokenManager.getAccessToken();
      expect(token2).toBe('test_access_token_123');

      // Should only have made one auth request
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh token when expired', async () => {
      const tokenResponse1 = {
        access_token: 'token_1',
        token_type: 'Bearer',
        expires_in: 1 // Very short expiration
      };

      const tokenResponse2 = {
        access_token: 'token_2',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => tokenResponse1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => tokenResponse2
        });

      await tokenManager.getAccessToken();

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const newToken = await tokenManager.getAccessToken();
      expect(newToken).toBe('token_2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle auth failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      await expect(tokenManager.getAccessToken()).rejects.toThrow(CarrierIntegrationError);
    });
  });

  describe('Rate Request Building', () => {
    it('should build correct UPS request for single package', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '1',
              Description: 'Success'
            }
          },
          RatedShipment: [{
            Service: {
              Code: '03',
              Description: 'UPS Ground'
            },
            TotalCharges: {
              CurrencyCode: 'USD',
              MonetaryValue: '15.50'
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await upsCarrier.getRates(request);

      const requests = mockHttpClient.getRequests();
      const rateRequest = requests.find(r => r.url.includes('/api/rating/v1/Rate'));
      
      expect(rateRequest).toBeDefined();
      const body = rateRequest!.body as UpsRateRequest;
      
      expect(body.RateRequest.Shipment.Shipper.Address.City).toBe('New York');
      expect(body.RateRequest.Shipment.ShipTo.Address.City).toBe('New York');
      expect(body.RateRequest.Shipment.Package).toHaveLength(1);
      expect(body.RateRequest.Shipment.Package[0].Weight.Value).toBe('5');
      expect(body.RateRequest.Shipment.Package[0].Dimensions?.Length).toBe('10');
    });

    it('should include service code when service level specified', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '1',
              Description: 'Success'
            }
          },
          RatedShipment: [{
            Service: {
              Code: '01',
              Description: 'UPS Next Day Air'
            },
            TotalCharges: {
              CurrencyCode: 'USD',
              MonetaryValue: '45.00'
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage],
        serviceLevel: 'nextDayAir'
      };

      await upsCarrier.getRates(request);

      const requests = mockHttpClient.getRequests();
      const rateRequest = requests.find(r => r.url.includes('/api/rating/v1/Rate'));
      const body = rateRequest!.body as UpsRateRequest;
      
      expect(body.RateRequest.Shipment.Service?.Code).toBe('01');
      expect(body.RateRequest.Request.RequestOption).toBe('Rate');
    });

    it('should use Shop option when no service level specified', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '1',
              Description: 'Success'
            }
          },
          RatedShipment: [{
            Service: {
              Code: '03',
              Description: 'UPS Ground'
            },
            TotalCharges: {
              CurrencyCode: 'USD',
              MonetaryValue: '15.50'
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await upsCarrier.getRates(request);

      const requests = mockHttpClient.getRequests();
      const rateRequest = requests.find(r => r.url.includes('/api/rating/v1/Rate'));
      const body = rateRequest!.body as UpsRateRequest;
      
      expect(body.RateRequest.Request.RequestOption).toBe('Shop');
    });
  });

  describe('Response Parsing', () => {
    it('should parse successful response with single rate', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '1',
              Description: 'Success'
            }
          },
          RatedShipment: [{
            Service: {
              Code: '03',
              Description: 'UPS Ground'
            },
            TotalCharges: {
              CurrencyCode: 'USD',
              MonetaryValue: '15.50'
            },
            GuaranteedDelivery: {
              Date: '2026-02-10'
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      const response = await upsCarrier.getRates(request);

      expect(response.quotes).toHaveLength(1);
      expect(response.quotes[0].serviceLevel).toBe('ground');
      expect(response.quotes[0].serviceName).toBe('UPS Ground');
      expect(response.quotes[0].totalCost).toBe(15.50);
      expect(response.quotes[0].currency).toBe('USD');
      expect(response.quotes[0].carrier).toBe('UPS');
      expect(response.quotes[0].estimatedDays).toBeDefined();
    });

    it('should parse response with multiple rates', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '1',
              Description: 'Success'
            }
          },
          RatedShipment: [
            {
              Service: {
                Code: '03',
                Description: 'UPS Ground'
              },
              TotalCharges: {
                CurrencyCode: 'USD',
                MonetaryValue: '15.50'
              }
            },
            {
              Service: {
                Code: '01',
                Description: 'UPS Next Day Air'
              },
              TotalCharges: {
                CurrencyCode: 'USD',
                MonetaryValue: '45.00'
              }
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      const response = await upsCarrier.getRates(request);

      expect(response.quotes).toHaveLength(2);
      expect(response.quotes[0].serviceLevel).toBe('ground');
      expect(response.quotes[1].serviceLevel).toBe('nextDayAir');
    });

    it('should prefer negotiated rates when available', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '1',
              Description: 'Success'
            }
          },
          RatedShipment: [{
            Service: {
              Code: '03',
              Description: 'UPS Ground'
            },
            TotalCharges: {
              CurrencyCode: 'USD',
              MonetaryValue: '15.50'
            },
            NegotiatedRateCharges: {
              TotalCharge: {
                CurrencyCode: 'USD',
                MonetaryValue: '12.00'
              }
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      const response = await upsCarrier.getRates(request);

      expect(response.quotes[0].totalCost).toBe(12.00); // Should use negotiated rate
    });
  });

  describe('Error Handling', () => {
    it('should handle API error responses', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '0',
              Description: 'Failure'
            },
            Alert: [{
              Code: '110537',
              Description: 'The postal code 12345 is invalid for the country US.'
            }]
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(upsCarrier.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should handle HTTP 401 errors', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      
      mockHttpClient.post = jest.fn().mockImplementation(async (url: string, _body?: unknown) => {
        if (url.includes('/api/rating/v1/Rate')) {
          throw new Error('HTTP 401: Unauthorized');
        }
        throw new Error(`No mock response set for ${url}`);
      });

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(upsCarrier.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should handle HTTP 429 rate limiting', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      
      mockHttpClient.post = jest.fn().mockImplementation(async (url: string, _body?: unknown) => {
        if (url.includes('/api/rating/v1/Rate')) {
          throw new Error('HTTP 429: Too Many Requests');
        }
        throw new Error(`No mock response set for ${url}`);
      });

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(upsCarrier.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should handle timeout errors', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      
      mockHttpClient.post = jest.fn().mockImplementation(async (url: string, _body?: unknown) => {
        if (url.includes('/api/rating/v1/Rate')) {
          throw new Error('Request timeout after 30000ms');
        }
        throw new Error(`No mock response set for ${url}`);
      });

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(upsCarrier.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should handle malformed JSON responses', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      
      mockHttpClient.post = jest.fn().mockImplementation(async (url: string, _body?: unknown) => {
        if (url.includes('/api/rating/v1/Rate')) {
          throw new Error('Invalid JSON response');
        }
        throw new Error(`No mock response set for ${url}`);
      });

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(upsCarrier.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should handle empty rate responses', async () => {
      const tokenResponse = {
        access_token: 'test_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const upsRateResponse: UpsRateResponse = {
        RateResponse: {
          Response: {
            ResponseStatus: {
              Code: '1',
              Description: 'Success'
            }
          },
          RatedShipment: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });
      mockHttpClient.setResponse(`${config.baseUrl}/api/rating/v1/Rate`, upsRateResponse);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(upsCarrier.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });
  });
});
