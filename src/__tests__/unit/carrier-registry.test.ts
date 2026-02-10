import { CarrierRegistry } from '../../application/registry/carrier-registry';
import { ConfigError } from '../../domain/errors';

describe('CarrierRegistry', () => {
  it('rejects carriers with an empty name', () => {
    const registry = new CarrierRegistry();
    expect(() =>
      registry.registerCarrier({
        getName: () => '   ',
        getRates: async () => ({ requestId: 'x', quotes: [] })
      })
    ).toThrow(ConfigError);
  });

  it('rejects duplicate carrier registrations (case-insensitive)', () => {
    const registry = new CarrierRegistry();
    registry.registerCarrier({
      getName: () => 'UPS',
      getRates: async () => ({ requestId: 'x', quotes: [] })
    });

    expect(() =>
      registry.registerCarrier({
        getName: () => 'ups',
        getRates: async () => ({ requestId: 'y', quotes: [] })
      })
    ).toThrow(ConfigError);
  });

  it('finds carriers case-insensitively', () => {
    const registry = new CarrierRegistry();
    const carrier = {
      getName: () => 'UPS',
      getRates: async () => ({ requestId: 'x', quotes: [] })
    };
    registry.registerCarrier(carrier);

    expect(registry.getCarrier('ups')).toBe(carrier);
    expect(registry.getCarrier('UPS')).toBe(carrier);
  });
});

