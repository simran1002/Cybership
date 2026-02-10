import { ErrorCode } from './error-code';
import { ServiceError } from './service-error';

export class ConfigError extends ServiceError {
  constructor(message: string, details?: unknown, cause?: unknown) {
    super(message, {
      code: ErrorCode.CONFIG_ERROR,
      carrier: 'SYSTEM',
      retryable: false,
      details,
      cause
    });
  }
}

