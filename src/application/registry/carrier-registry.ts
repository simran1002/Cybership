import { Carrier } from '../ports/carrier';
import { ConfigError } from '../../domain/errors';

export class CarrierRegistry {
  private readonly carriersByName = new Map<string, Carrier>();

  registerCarrier(carrier: Carrier): void {
    const name = carrier.getName().trim();
    if (!name) {
      throw new ConfigError('Carrier name must be non-empty');
    }
    const key = name.toLowerCase();
    if (this.carriersByName.has(key)) {
      throw new ConfigError(`Carrier already registered: ${name}`);
    }
    this.carriersByName.set(key, carrier);
  }

  listCarriers(): Carrier[] {
    return [...this.carriersByName.values()];
  }

  getCarrier(name: string): Carrier | undefined {
    return this.carriersByName.get(name.toLowerCase());
  }
}

