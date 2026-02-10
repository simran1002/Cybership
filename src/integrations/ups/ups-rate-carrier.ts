import { Carrier } from '../../application/ports/carrier';
import { RateRequest, RateResponse, ServiceLevel } from '../../domain/rates';
import { upsRateResponseSchema } from './ups-schemas';
import { UpsRateMapper } from './ups-rate-mapper';
import { CarrierClient } from '../shared/carrier-client';
import { UpsRateRequest } from './ups-types';
import { UPS_SERVICE_CODES } from './ups-types';
import {
  CarrierError,
  ErrorCode,
  NetworkError,
  ServiceError,
  TimeoutError,
  UnknownError
} from '../../domain/errors';

export class UpsRateCarrier implements Carrier {
  private readonly carrierName = 'UPS';

  constructor(
    private readonly client: CarrierClient<UpsRateRequest>,
    private readonly mapper: UpsRateMapper
  ) {}

  getName(): string {
    return this.carrierName;
  }

  supportsServiceLevel(serviceLevel: ServiceLevel): boolean {
    return serviceLevel in UPS_SERVICE_CODES;
  }

  async getRates(request: RateRequest): Promise<RateResponse> {
    const requestId = createRequestId();
    try {
      const upsRequest = this.mapper.toCarrierRequest(request);
      const res = await this.client.send(upsRequest, { requestId });

      const parsedJson = safeJsonParse(res.bodyText);
      const parsed = upsRateResponseSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new CarrierError(
          ErrorCode.MALFORMED_RESPONSE,
          'UPS response failed validation',
          this.carrierName,
          { retryable: false, details: { issues: parsed.error.issues } }
        );
      }

      return this.mapper.fromCarrierResponse(parsed.data, requestId);
    } catch (error) {
      throw this.withCarrierContext(error);
    }
  }

  private withCarrierContext(error: unknown): ServiceError {
    if (error instanceof ServiceError) {
      if (error instanceof TimeoutError) {
        return error.carrier === this.carrierName
          ? error
          : new TimeoutError(error.message, this.carrierName, error.details, error);
      }
      if (error instanceof NetworkError) {
        return error.carrier === this.carrierName
          ? error
          : new NetworkError(error.message, this.carrierName, error.details, error);
      }
      if (error.carrier === this.carrierName) return error;
      return new ServiceError(error.message, {
        code: error.code,
        carrier: this.carrierName,
        retryable: error.retryable,
        details:
          error.carrier === 'SYSTEM'
            ? error.details
            : { originalCarrier: error.carrier, details: error.details },
        cause: error
      });
    }

    return new UnknownError('Unexpected error while fetching rates', this.carrierName, undefined, error);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

