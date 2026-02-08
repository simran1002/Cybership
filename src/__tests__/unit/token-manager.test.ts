/**
 * Unit tests for Token Manager
 * Tests OAuth token lifecycle in isolation
 */

import { TokenManager } from '../../auth/token-manager';
import { CarrierIntegrationError, ErrorCode } from '../../types/errors';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

describe('TokenManager Unit Tests', () => {
  let tokenManager: TokenManager;
  const authUrl = 'https://test.com/oauth/token';
  const clientId = 'test_client_id';
  const clientSecret = 'test_client_secret';

  beforeEach(() => {
    tokenManager = new TokenManager(
      {} as any, // HttpClient not used for OAuth (uses fetch directly)
      authUrl,
      clientId,
      clientSecret
    );
    mockFetch.mockClear();
  });

  describe('Token Acquisition', () => {
    it('should acquire token successfully', async () => {
      const tokenResponse = {
        access_token: 'test_token_123',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse
      });

      const token = await tokenManager.getAccessToken();

      expect(token).toBe('test_token_123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        authUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    it('should cache token and reuse it', async () => {
      const tokenResponse = {
        access_token: 'cached_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => tokenResponse
      });

      const token1 = await tokenManager.getAccessToken();
      const token2 = await tokenManager.getAccessToken();

      expect(token1).toBe('cached_token');
      expect(token2).toBe('cached_token');
      // Should only fetch once due to caching
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

    it('should handle concurrent requests with single refresh', async () => {
      const tokenResponse = {
        access_token: 'concurrent_token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => tokenResponse
      });

      // Clear cache first
      tokenManager.clearCache();

      // Make concurrent requests
      const [token1, token2, token3] = await Promise.all([
        tokenManager.getAccessToken(),
        tokenManager.getAccessToken(),
        tokenManager.getAccessToken()
      ]);

      expect(token1).toBe('concurrent_token');
      expect(token2).toBe('concurrent_token');
      expect(token3).toBe('concurrent_token');
      // Should only fetch once despite concurrent calls
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Clear cache before each error test to ensure fresh state
      tokenManager.clearCache();
    });

    it('should handle 401 authentication failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      try {
        await tokenManager.getAccessToken();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CarrierIntegrationError);
        expect((error as CarrierIntegrationError).code).toBe(ErrorCode.AUTH_FAILED);
      }
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout after 30000ms'));

      try {
        await tokenManager.getAccessToken();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CarrierIntegrationError);
        expect((error as CarrierIntegrationError).code).toBe(ErrorCode.TIMEOUT);
      }
    });

    it('should handle missing access_token in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token_type: 'Bearer', expires_in: 3600 })
      });

      try {
        await tokenManager.getAccessToken();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CarrierIntegrationError);
        expect((error as CarrierIntegrationError).code).toBe(ErrorCode.AUTH_FAILED);
      }
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      const tokenResponse = {
        access_token: 'token_to_clear',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => tokenResponse
      });

      await tokenManager.getAccessToken();
      tokenManager.clearCache();

      // Next call should fetch again
      await tokenManager.getAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
