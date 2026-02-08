/**
 * Main Rate Service
 * Provides a clean interface for rate shopping across multiple carriers
 */

import { RateRequest, RateResponse } from '../types/domain';
import { CarrierIntegrationError, ErrorCode } from '../types/errors';
import { rateRequestSchema } from '../validation/schemas';
import { Carrier } from '../carriers/carrier';

export class RateService {
  constructor(private carriers: Carrier[]) {
    if (carriers.length === 0) {
      throw new CarrierIntegrationError(
        ErrorCode.CONFIG_ERROR,
        'At least one carrier must be configured'
      );
    }
  }

  /**
   * Get rates from all configured carriers
   * Validates input before making any external calls
   */
  async getRates(request: RateRequest): Promise<RateResponse[]> {
    // Validate input
    const validationResult = rateRequestSchema.safeParse(request);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => 
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');
      throw new CarrierIntegrationError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid rate request: ${errors}`,
        { validationErrors: validationResult.error.errors }
      );
    }

    // If a specific service level is requested, filter carriers that support it
    const eligibleCarriers = request.serviceLevel
      ? this.carriers.filter(c => 
          !c.supportsServiceLevel || c.supportsServiceLevel(request.serviceLevel!)
        )
      : this.carriers;

    if (eligibleCarriers.length === 0) {
      throw new CarrierIntegrationError(
        ErrorCode.VALIDATION_ERROR,
        `No carriers support the requested service level: ${request.serviceLevel}`
      );
    }

    // Fetch rates from all eligible carriers in parallel
    const ratePromises = eligibleCarriers.map(carrier =>
      carrier.getRates(request).catch(error => {
        // Log error but don't fail entire request if one carrier fails
        // In production, you might want to log this to a monitoring service
        // Using console.error for now - in production, use proper logging service
        if (process.env.NODE_ENV !== 'test') {
          console.error(`Error fetching rates from ${carrier.getName()}:`, error);
        }
        return null;
      })
    );

    const results = await Promise.all(ratePromises);
    
    // Filter out null results (failed carriers)
    const successfulResults = results.filter((r): r is RateResponse => r !== null);

    if (successfulResults.length === 0) {
      throw new CarrierIntegrationError(
        ErrorCode.API_ERROR,
        'All carriers failed to return rates'
      );
    }

    return successfulResults;
  }

  /**
   * Get rates from a specific carrier
   */
  async getRatesFromCarrier(carrierName: string, request: RateRequest): Promise<RateResponse> {
    // Validate input
    const validationResult = rateRequestSchema.safeParse(request);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => 
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');
      throw new CarrierIntegrationError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid rate request: ${errors}`,
        { validationErrors: validationResult.error.errors }
      );
    }

    const carrier = this.carriers.find(c => c.getName().toLowerCase() === carrierName.toLowerCase());
    if (!carrier) {
      throw new CarrierIntegrationError(
        ErrorCode.CONFIG_ERROR,
        `Carrier not found: ${carrierName}`
      );
    }

    return carrier.getRates(request);
  }
}
