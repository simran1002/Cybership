/**
 * Integration tests for input validation
 * Tests that validation happens before any external API calls
 */

import { RateService } from '../../services/rate-service';
import { Carrier } from '../../carriers/carrier';
import { RateRequest, Address, Package, RateResponse } from '../../types/domain';
import { CarrierIntegrationError, ErrorCode } from '../../types/errors';

// Mock carrier that should never be called if validation works
class MockCarrier implements Carrier {
  getName(): string {
    return 'Mock';
  }

  async getRates(_request: RateRequest): Promise<RateResponse> {
    throw new Error('This should never be called if validation works');
  }
}

describe('Validation Integration Tests', () => {
  const service = new RateService([new MockCarrier()]);

  const validAddress: Address = {
    street: ['123 Main St'],
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  };

  const validPackage: Package = {
    weight: 5,
    length: 10,
    width: 8,
    height: 6
  };

  describe('Address Validation', () => {
    it('should reject empty street array', async () => {
      const request: RateRequest = {
        origin: { ...validAddress, street: [] },
        destination: validAddress,
        packages: [validPackage]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
      await expect(service.getRates(request)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
      );
    });

    it('should reject missing city', async () => {
      const request: RateRequest = {
        origin: { ...validAddress, city: '' },
        destination: validAddress,
        packages: [validPackage]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject invalid state code length', async () => {
      const request: RateRequest = {
        origin: { ...validAddress, state: 'NYC' }, // Should be 2 characters
        destination: validAddress,
        packages: [validPackage]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject invalid postal code', async () => {
      const request: RateRequest = {
        origin: { ...validAddress, postalCode: '123' }, // Too short
        destination: validAddress,
        packages: [validPackage]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject invalid country code length', async () => {
      const request: RateRequest = {
        origin: { ...validAddress, country: 'USA' }, // Should be 2 characters
        destination: validAddress,
        packages: [validPackage]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });
  });

  describe('Package Validation', () => {
    it('should reject negative weight', async () => {
      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages: [{ ...validPackage, weight: -5 }]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject zero weight', async () => {
      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages: [{ ...validPackage, weight: 0 }]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject weight exceeding maximum', async () => {
      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages: [{ ...validPackage, weight: 200 }] // Exceeds 150 lbs max
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject negative dimensions', async () => {
      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages: [{ ...validPackage, length: -10 }]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject dimensions exceeding maximum', async () => {
      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages: [{ ...validPackage, length: 150 }] // Exceeds 108 inches max
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject empty packages array', async () => {
      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages: []
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject too many packages', async () => {
      const packages: Package[] = Array(51).fill(validPackage); // Exceeds 50 max

      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });
  });

  describe('Service Level Validation', () => {
    it('should accept valid service level', async () => {
      const request: RateRequest = {
        origin: validAddress,
        destination: validAddress,
        packages: [validPackage],
        serviceLevel: 'ground'
      };

      // Should not throw validation error (will fail on carrier call, but that's expected)
      try {
        await service.getRates(request);
        fail('Should have thrown an error');
      } catch (error) {
        // Should not be a validation error - should be from the mock carrier
        expect(error).not.toHaveProperty('code', ErrorCode.VALIDATION_ERROR);
      }
    });
  });
});
