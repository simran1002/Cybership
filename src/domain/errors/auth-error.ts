import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export class AuthError extends ServiceError {
  constructor(
    code: ErrorCode.AUTH_FAILED | ErrorCode.AUTH_TOKEN_INVALID,
    message: string,
    carrier?: string,
    details?: unknown,
    cause?: unknown
  ) {
    super(message, {
      code,
      carrier: carrier ?? 'SYSTEM',
      retryable: code !== ErrorCode.AUTH_FAILED,
      details,
      cause
    });
  }
}

