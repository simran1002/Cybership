import { createPinoLogger } from '../../infrastructure/logging/pino-logger';

describe('Pino logger adapter', () => {
  it('implements the Logger interface without throwing', () => {
    const logger = createPinoLogger({ level: 'silent', name: 'test' });
    logger.debug({ a: 1 }, 'debug');
    logger.info({ a: 1 }, 'info');
    logger.warn({ a: 1 }, 'warn');
    logger.error({ a: 1 }, 'error');

    const child = logger.child({ requestId: 'req_1' });
    child.info({ ok: true }, 'child');
  });
});

