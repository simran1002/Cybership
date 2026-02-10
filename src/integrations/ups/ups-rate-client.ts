import { HttpClient, HttpResponse } from '../../application/ports/http-client';
import { AuthProvider } from '../../application/ports/auth-provider';
import { CarrierClient } from '../shared/carrier-client';
import { UpsConfig } from './ups-config';
import { UpsRateRequest } from './ups-types';
import { AuthError, ErrorCode, RateLimitError, CarrierError } from '../../domain/errors';

export class UpsRateClient implements CarrierClient<UpsRateRequest> {
  private readonly carrierName = 'UPS';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly auth: AuthProvider,
    private readonly config: Pick<UpsConfig, 'baseUrl' | 'timeoutMs'>
  ) {}

  async send(request: UpsRateRequest, context: { requestId: string }): Promise<HttpResponse> {
    const url = `${this.config.baseUrl}/api/rating/v1/Rate`;

    const attempt = async (): Promise<HttpResponse> => {
      const authorization = await this.auth.getAuthorizationHeader();
      return this.httpClient.request({
        method: 'POST',
        url,
        timeoutMs: this.config.timeoutMs,
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
          transId: context.requestId,
          transactionSrc: 'Cybership'
        },
        body: JSON.stringify(request)
      });
    };

    const first = await attempt();

    if (first.status === 401 || first.status === 403) {
      this.auth.invalidate();
      const retry = await attempt();
      if (retry.status === 401 || retry.status === 403) {
        throw new AuthError(
          ErrorCode.AUTH_TOKEN_INVALID,
          'Authentication token invalid or expired',
          this.carrierName,
          { status: retry.status, body: retry.bodyText }
        );
      }
      return retry;
    }

    if (first.status === 429) {
      throw new RateLimitError(
        'Rate limit exceeded. Please retry after some time.',
        this.carrierName,
        { status: first.status, body: first.bodyText }
      );
    }

    if (first.status >= 500) {
      throw new CarrierError(
        ErrorCode.API_ERROR,
        `Carrier service unavailable (HTTP ${first.status})`,
        this.carrierName,
        { retryable: true, details: { status: first.status, body: first.bodyText } }
      );
    }

    if (first.status < 200 || first.status >= 300) {
      throw new CarrierError(
        ErrorCode.API_ERROR,
        `UPS API request failed (HTTP ${first.status})`,
        this.carrierName,
        { retryable: false, details: { status: first.status, body: first.bodyText } }
      );
    }

    return first;
  }
}

