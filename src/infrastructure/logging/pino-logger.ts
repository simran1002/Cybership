import pino, { Logger as Pino } from 'pino';
import { Logger } from '../../application/ports/logger';

export interface PinoLoggerOptions {
  level?: string;
  name?: string;
}

export function createPinoLogger(options: PinoLoggerOptions = {}): Logger {
  const inner = pino({
    level: options.level ?? 'info',
    base: options.name ? { service: options.name } : null,
    redact: {
      paths: [
        '*.Authorization',
        '*.authorization',
        '*.clientSecret',
        '*.UPS_CLIENT_SECRET',
        '*.UPS_CLIENT_ID'
      ],
      censor: '[REDACTED]'
    }
  });
  return new PinoLogger(inner);
}

class PinoLogger implements Logger {
  constructor(private readonly inner: Pino) {}

  debug(obj: Record<string, unknown>, msg?: string): void {
    this.inner.debug(obj, msg);
  }

  info(obj: Record<string, unknown>, msg?: string): void {
    this.inner.info(obj, msg);
  }

  warn(obj: Record<string, unknown>, msg?: string): void {
    this.inner.warn(obj, msg);
  }

  error(obj: Record<string, unknown>, msg?: string): void {
    this.inner.error(obj, msg);
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.inner.child(bindings));
  }
}

