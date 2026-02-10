import { z } from 'zod';
import { HttpClient } from '../../application/ports/http-client';
import { AuthError, ErrorCode } from '../../domain/errors';

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    token_type: z.string().optional(),
    expires_in: z.coerce.number().int().positive().optional()
  })
  .passthrough();

export interface OAuthToken {
  accessToken: string;
  tokenType?: string;
  expiresInSeconds: number;
}

export interface OAuthClientCredentials {
  authUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
}

export class OAuthClient {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly creds: OAuthClientCredentials
  ) {}

  async acquireToken(): Promise<OAuthToken> {
    const credentials = Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString(
      'base64'
    );

    const request = {
      method: 'POST' as const,
      url: this.creds.authUrl,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    };
    const response = await this.httpClient.request(
      this.creds.timeoutMs !== undefined ? { ...request, timeoutMs: this.creds.timeoutMs } : request
    );

    if (response.status < 200 || response.status >= 300) {
      throw new AuthError(
        ErrorCode.AUTH_FAILED,
        `OAuth token request failed with HTTP ${response.status}`,
        undefined,
        { status: response.status, body: response.bodyText }
      );
    }

    const parsedJson = safeJsonParse(response.bodyText);
    const parsed = tokenResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AuthError(
        ErrorCode.AUTH_FAILED,
        'OAuth token response failed validation',
        undefined,
        { issues: parsed.error.issues }
      );
    }

    const token: OAuthToken = {
      accessToken: parsed.data.access_token,
      expiresInSeconds: parsed.data.expires_in ?? 3600
    };
    if (parsed.data.token_type) token.tokenType = parsed.data.token_type;
    return token;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

