import { Logger } from '../../application/ports/logger';

export class NoopLogger implements Logger {
  debug(_obj: Record<string, unknown>, _msg?: string): void {}
  info(_obj: Record<string, unknown>, _msg?: string): void {}
  warn(_obj: Record<string, unknown>, _msg?: string): void {}
  error(_obj: Record<string, unknown>, _msg?: string): void {}
  child(_bindings: Record<string, unknown>): Logger {
    return this;
  }
}

