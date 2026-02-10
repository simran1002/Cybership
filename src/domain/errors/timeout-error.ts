import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export class TimeoutError extends ServiceError {
  constructor(message: string, carrier?: string, details?: unknown, cause?: unknown) {
    super(message, {
      code: ErrorCode.TIMEOUT,
      carrier: carrier ?? 'SYSTEM',
      retryable: true,
      details,
      cause
    });
  }
}

