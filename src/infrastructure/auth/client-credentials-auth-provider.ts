import { AuthProvider } from '../../application/ports/auth-provider';
import { OAuthClient, OAuthToken } from './oauth-client';

export interface CachedToken {
  token: OAuthToken;
  expiresAtMs: number;
}

const REFRESH_BUFFER_MS = 60000;

export class ClientCredentialsAuthProvider implements AuthProvider {
  private cached: CachedToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(private readonly oauthClient: OAuthClient) {}

  invalidate(): void {
    this.cached = null;
  }

  async getAuthorizationHeader(): Promise<string> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAtMs > now + REFRESH_BUFFER_MS) {
      return `Bearer ${this.cached.token.accessToken}`;
    }

    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.refresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async refresh(): Promise<string> {
    const token = await this.oauthClient.acquireToken();
    this.cached = {
      token,
      expiresAtMs: Date.now() + token.expiresInSeconds * 1000 - REFRESH_BUFFER_MS
    };
    return `Bearer ${token.accessToken}`;
  }
}

