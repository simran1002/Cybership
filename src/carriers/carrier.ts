/**
 * Carrier abstraction interface
 * All carrier implementations must implement this interface
 * This allows for easy extension to support additional carriers (FedEx, USPS, DHL)
 */

import { RateRequest, RateResponse } from '../types/domain';

export interface Carrier {
  /**
   * Get the name of this carrier
   */
  getName(): string;

  /**
   * Get shipping rates for a given request
   * @param request Rate request with origin, destination, and packages
   * @returns Normalized rate quotes
   */
  getRates(request: RateRequest): Promise<RateResponse>;

  /**
   * Check if this carrier supports a specific service level
   * @param serviceLevel The service level to check
   * @returns True if supported, false otherwise
   */
  supportsServiceLevel?(serviceLevel: string): boolean;
}
