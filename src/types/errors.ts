/**
 * Structured error types for the carrier integration service
 */

export enum ErrorCode {
  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_PACKAGE = 'INVALID_PACKAGE',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // API errors
  API_ERROR = 'API_ERROR',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Configuration errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  
  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class CarrierIntegrationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'CarrierIntegrationError';
    Object.setPrototypeOf(this, CarrierIntegrationError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      ...(this.originalError && { originalError: this.originalError.message })
    };
  }
}
