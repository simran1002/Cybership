/**
 * Integration tests for Rate Service
 * Tests the main service layer with validation and error handling
 */

import { RateService } from '../../services/rate-service';
import { Carrier } from '../../carriers/carrier';
import { RateRequest, RateResponse, Address, Package } from '../../types/domain';
import { CarrierIntegrationError, ErrorCode } from '../../types/errors';

// Mock carrier implementation
class MockCarrier implements Carrier {
  constructor(
    private name: string,
    private shouldFail: boolean = false
  ) {}

  getName(): string {
    return this.name;
  }

  async getRates(_request: RateRequest): Promise<RateResponse> {
    if (this.shouldFail) {
      throw new CarrierIntegrationError(
        ErrorCode.API_ERROR,
        `Mock ${this.name} carrier failed`
      );
    }

    return {
      quotes: [{
        serviceLevel: 'ground',
        serviceName: `${this.name} Ground`,
        totalCost: 15.50,
        currency: 'USD',
        carrier: this.name
      }],
      requestId: `req_${this.name}_123`
    };
  }

  supportsServiceLevel?(serviceLevel: string): boolean {
    return serviceLevel === 'ground' || serviceLevel === 'express';
  }
}

describe('Rate Service Integration Tests', () => {
  const sampleAddress: Address = {
    street: ['123 Main St'],
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  };

  const samplePackage: Package = {
    weight: 5,
    length: 10,
    width: 8,
    height: 6
  };

  describe('Input Validation', () => {
    it('should validate rate requests before making API calls', async () => {
      const carriers = [new MockCarrier('UPS')];
      const service = new RateService(carriers);

      const invalidRequest = {
        origin: { ...sampleAddress, street: [] }, // Invalid: empty street array
        destination: sampleAddress,
        packages: [samplePackage]
      } as RateRequest;

      await expect(service.getRates(invalidRequest)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject requests with invalid package weight', async () => {
      const carriers = [new MockCarrier('UPS')];
      const service = new RateService(carriers);

      const invalidRequest: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [{ ...samplePackage, weight: -5 }] // Invalid: negative weight
      };

      await expect(service.getRates(invalidRequest)).rejects.toThrow(CarrierIntegrationError);
    });

    it('should reject requests with empty packages array', async () => {
      const carriers = [new MockCarrier('UPS')];
      const service = new RateService(carriers);

      const invalidRequest: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: []
      };

      await expect(service.getRates(invalidRequest)).rejects.toThrow(CarrierIntegrationError);
    });
  });

  describe('Multi-Carrier Support', () => {
    it('should fetch rates from all carriers', async () => {
      const carriers = [
        new MockCarrier('UPS'),
        new MockCarrier('FedEx')
      ];
      const service = new RateService(carriers);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      const responses = await service.getRates(request);

      expect(responses).toHaveLength(2);
      expect(responses[0].quotes[0].carrier).toBe('UPS');
      expect(responses[1].quotes[0].carrier).toBe('FedEx');
    });

    it('should continue if one carrier fails', async () => {
      const carriers = [
        new MockCarrier('UPS', false),
        new MockCarrier('FedEx', true) // This one will fail
      ];
      const service = new RateService(carriers);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      const responses = await service.getRates(request);

      // Should still get response from UPS
      expect(responses).toHaveLength(1);
      expect(responses[0].quotes[0].carrier).toBe('UPS');
    });

    it('should throw error if all carriers fail', async () => {
      const carriers = [
        new MockCarrier('UPS', true),
        new MockCarrier('FedEx', true)
      ];
      const service = new RateService(carriers);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });
  });

  describe('Service Level Filtering', () => {
    it('should filter carriers by service level support', async () => {
      const carriers = [
        new MockCarrier('UPS'),
        new MockCarrier('FedEx')
      ];
      const service = new RateService(carriers);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage],
        serviceLevel: 'ground'
      };

      const responses = await service.getRates(request);

      // Both carriers support 'ground'
      expect(responses.length).toBeGreaterThan(0);
    });

    it('should throw error if no carriers support requested service level', async () => {
      const carriers = [
        new MockCarrier('UPS'),
        new MockCarrier('FedEx')
      ];
      const service = new RateService(carriers);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage],
        serviceLevel: 'nextDayAir' // Not supported by mock carriers
      };

      await expect(service.getRates(request)).rejects.toThrow(CarrierIntegrationError);
    });
  });

  describe('Single Carrier Requests', () => {
    it('should get rates from specific carrier', async () => {
      const carriers = [
        new MockCarrier('UPS'),
        new MockCarrier('FedEx')
      ];
      const service = new RateService(carriers);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      const response = await service.getRatesFromCarrier('UPS', request);

      expect(response.quotes[0].carrier).toBe('UPS');
    });

    it('should throw error for unknown carrier', async () => {
      const carriers = [new MockCarrier('UPS')];
      const service = new RateService(carriers);

      const request: RateRequest = {
        origin: sampleAddress,
        destination: sampleAddress,
        packages: [samplePackage]
      };

      await expect(service.getRatesFromCarrier('UnknownCarrier', request))
        .rejects.toThrow(CarrierIntegrationError);
    });
  });
});
