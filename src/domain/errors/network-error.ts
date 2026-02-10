import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export class NetworkError extends ServiceError {
  constructor(message: string, carrier?: string, details?: unknown, cause?: unknown) {
    super(message, {
      code: ErrorCode.NETWORK_ERROR,
      carrier: carrier ?? 'SYSTEM',
      retryable: true,
      details,
      cause
    });
  }
}

