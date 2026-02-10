import { redactHeaders } from '../../infrastructure/logging/redaction';

describe('redaction', () => {
  it('redacts Authorization header values', () => {
    const redacted = redactHeaders({
      Authorization: 'Bearer secret',
      'x-test': '1'
    });

    expect(redacted?.['Authorization']).toBe('[REDACTED]');
    expect(redacted?.['x-test']).toBe('1');
  });
});

