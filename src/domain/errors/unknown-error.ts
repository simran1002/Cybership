import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export class UnknownError extends ServiceError {
  constructor(message: string, carrier?: string, details?: unknown, cause?: unknown) {
    super(message, {
      code: ErrorCode.UNKNOWN_ERROR,
      carrier: carrier ?? 'SYSTEM',
      retryable: false,
      details,
      cause
    });
  }
}

