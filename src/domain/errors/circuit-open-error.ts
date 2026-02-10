import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export class CircuitOpenError extends ServiceError {
  constructor(message: string, carrier: string, details?: unknown, cause?: unknown) {
    super(message, {
      code: ErrorCode.CIRCUIT_OPEN,
      carrier,
      retryable: true,
      details,
      cause
    });
  }
}

