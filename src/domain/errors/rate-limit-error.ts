import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export class RateLimitError extends ServiceError {
  constructor(
    message: string,
    carrier?: string,
    details?: unknown,
    cause?: unknown
  ) {
    super(message, {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      carrier: carrier ?? 'SYSTEM',
      retryable: true,
      details,
      cause
    });
  }
}

