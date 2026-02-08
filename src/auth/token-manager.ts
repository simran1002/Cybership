/**
 * OAuth 2.0 token management with caching and automatic refresh
 * Implements UPS client-credentials flow
 */

import { HttpClient } from '../http/client';
import { CarrierIntegrationError, ErrorCode } from '../types/errors';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
}

export interface CachedToken {
  token: string;
  expiresAt: number; // timestamp in milliseconds
}

/**
 * Manages OAuth 2.0 tokens with caching and automatic refresh
 * Transparent to the caller - handles token lifecycle internally
 */
export class TokenManager {
  private cachedToken: CachedToken | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(
    _httpClient: HttpClient, // Not used - we use fetch directly for OAuth
    private authUrl: string,
    private clientId: string,
    private clientSecret: string
  ) {}

  /**
   * Get a valid access token, refreshing if necessary
   * Thread-safe: multiple concurrent calls will share the same refresh promise
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      // Refresh if token expires in less than 1 minute
      return this.cachedToken.token;
    }

    // If a refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Start a new token refresh
    this.tokenRefreshPromise = this.refreshToken();

    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Acquire a new token from the OAuth endpoint
   */
  private async refreshToken(): Promise<string> {
    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      // UPS OAuth requires form-urlencoded body, not JSON
      // We need to override the HTTP client's default JSON behavior for this request
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      
      // Create a custom fetch call since we need form-urlencoded
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
        const fetchResponse = await fetch(this.authUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString(),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${fetchResponse.status}: ${errorText}`);
        }

        const response = await fetchResponse.json() as TokenResponse;

        if (!response.access_token) {
          throw new CarrierIntegrationError(
            ErrorCode.AUTH_FAILED,
            'Invalid token response: missing access_token'
          );
        }

        // Cache the token with expiration
        const expiresIn = response.expires_in || 3600; // Default to 1 hour
        this.cachedToken = {
          token: response.access_token,
          expiresAt: Date.now() + (expiresIn * 1000) - 60000 // Refresh 1 minute early
        };

        return response.access_token;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      if (error instanceof CarrierIntegrationError) {
        throw error;
      }

      // Handle HTTP errors
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new CarrierIntegrationError(
            ErrorCode.AUTH_FAILED,
            'Authentication failed: invalid credentials',
            {},
            error
          );
        }
        if (error.message.includes('timeout')) {
          throw new CarrierIntegrationError(
            ErrorCode.TIMEOUT,
            'Authentication request timed out',
            {},
            error
          );
        }
      }

      throw new CarrierIntegrationError(
        ErrorCode.AUTH_FAILED,
        'Failed to acquire access token',
        {},
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Clear cached token (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}
