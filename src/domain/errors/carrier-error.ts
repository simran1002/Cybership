import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export interface CarrierErrorOptions {
  retryable?: boolean;
  details?: unknown;
  cause?: unknown;
}

export class CarrierError extends ServiceError {
  constructor(
    code: ErrorCode.API_ERROR | ErrorCode.MALFORMED_RESPONSE,
    message: string,
    carrier: string,
    options?: CarrierErrorOptions
  ) {
    super(message, {
      code,
      carrier,
      retryable: options?.retryable ?? false,
      details: options?.details,
      cause: options?.cause
    });
  }
}

