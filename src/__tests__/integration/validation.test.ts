import { rateRequestSchema } from '../../domain/validation/schemas';

const validRequest = {
  origin: {
    street: ['123 Main St'],
    city: 'Atlanta',
    state: 'GA',
    postalCode: '30339',
    country: 'US'
  },
  destination: {
    street: ['456 Oak Ave'],
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90001',
    country: 'US'
  },
  packages: [{ weight: 5, length: 10, width: 8, height: 6 }]
};

describe('validation schemas', () => {
  describe('rateRequestSchema', () => {
    it('accepts valid request', () => {
      const result = rateRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('accepts valid request with service level', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        serviceLevel: 'ground'
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid state (must be 2 chars)', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        origin: { ...validRequest.origin, state: 'Georgia' }
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid country (must be 2 chars)', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        destination: { ...validRequest.destination, country: 'USA' }
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty street', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        origin: { ...validRequest.origin, street: [] }
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid package weight', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        packages: [{ weight: -1, length: 10, width: 8, height: 6 }]
      });
      expect(result.success).toBe(false);
    });

    it('rejects package exceeding max weight', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        packages: [{ weight: 200, length: 10, width: 8, height: 6 }]
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty packages array', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        packages: []
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid service level', () => {
      const result = rateRequestSchema.safeParse({
        ...validRequest,
        serviceLevel: 'overnight'
      });
      expect(result.success).toBe(false);
    });
  });
});
