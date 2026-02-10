import { ErrorCode } from './error-code';

export interface ServiceErrorOptions {
  code: ErrorCode;
  carrier: string;
  retryable: boolean;
  details?: unknown | undefined;
  cause?: unknown | undefined;
}

export class ServiceError extends Error {
  readonly code: ErrorCode;
  readonly carrier: string;
  readonly retryable: boolean;
  readonly details: unknown | undefined;
  readonly cause: unknown | undefined;

  constructor(message: string, options: ServiceErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.carrier = options.carrier;
    this.retryable = options.retryable;
    this.details = options.details;
    this.cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      carrier: this.carrier,
      retryable: this.retryable,
      message: this.message,
      details: this.details
    };
  }
}

