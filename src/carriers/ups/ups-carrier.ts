/**
 * UPS Carrier Implementation
 * Implements the Carrier interface for UPS Rating API
 */

import { Carrier } from '../carrier';
import { RateRequest, RateResponse, RateQuote, ServiceLevel, Address, Package } from '../../types/domain';
import { CarrierIntegrationError, ErrorCode } from '../../types/errors';
import { TokenManager } from '../../auth/token-manager';
import { HttpClient } from '../../http/client';
import { UpsConfig } from '../../config';
import {
  UpsRateRequest,
  UpsRateResponse,
  UPS_SERVICE_CODES,
  UPS_SERVICE_NAMES,
  UpsAddress,
  UpsPackage
} from './types';

export class UpsCarrier implements Carrier {
  constructor(
    private httpClient: HttpClient,
    private tokenManager: TokenManager,
    private config: UpsConfig
  ) {}

  getName(): string {
    return 'UPS';
  }

  /**
   * Convert domain Address to UPS Address format
   */
  private toUpsAddress(address: Address): UpsAddress {
    return {
      AddressLine: address.street,
      City: address.city,
      StateProvinceCode: address.state,
      PostalCode: address.postalCode,
      CountryCode: address.country
    };
  }

  /**
   * Convert domain Package to UPS Package format
   */
  private toUpsPackage(pkg: Package): UpsPackage {
    return {
      Weight: {
        Value: pkg.weight.toString(),
        UnitOfMeasurement: {
          Code: 'LBS'
        }
      },
      Dimensions: {
        Length: pkg.length.toString(),
        Width: pkg.width.toString(),
        Height: pkg.height.toString(),
        UnitOfMeasurement: {
          Code: 'IN'
        }
      },
      Packaging: {
        Code: '02', // Customer Supplied Package
        Description: 'Package'
      }
    };
  }

  /**
   * Build UPS API request from domain RateRequest
   */
  private buildUpsRequest(request: RateRequest): UpsRateRequest {
    const upsRequest: UpsRateRequest = {
      RateRequest: {
        Request: {
          RequestOption: request.serviceLevel ? 'Rate' : 'Shop' // 'Shop' returns all services
        },
        Shipment: {
          Shipper: {
            Address: this.toUpsAddress(request.origin),
            ...(this.config.accountNumber && { ShipperNumber: this.config.accountNumber })
          },
          ShipTo: {
            Address: this.toUpsAddress(request.destination)
          },
          Package: request.packages.map(pkg => this.toUpsPackage(pkg))
        }
      }
    };

    // Add service code if specific service level requested
    if (request.serviceLevel) {
      const serviceCode = UPS_SERVICE_CODES[request.serviceLevel];
      if (!serviceCode) {
        throw new CarrierIntegrationError(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported service level: ${request.serviceLevel}`
        );
      }
      upsRequest.RateRequest.Shipment.Service = {
        Code: serviceCode,
        Description: UPS_SERVICE_NAMES[request.serviceLevel]
      };
    }

    return upsRequest;
  }

  /**
   * Parse UPS API response into domain RateResponse
   */
  private parseUpsResponse(upsResponse: UpsRateResponse, requestId: string): RateResponse {
    const response = upsResponse.RateResponse;

    // Check for errors in response
    if (response.Response.ResponseStatus.Code !== '1') {
      const alerts = response.Response.Alert || [];
      const errorMessages = alerts.map(a => a.Description).join('; ');
      throw new CarrierIntegrationError(
        ErrorCode.API_ERROR,
        `UPS API error: ${response.Response.ResponseStatus.Description}. ${errorMessages}`,
        { code: response.Response.ResponseStatus.Code }
      );
    }

    // Extract rated shipments
    const ratedShipments = response.RatedShipment || [];
    if (ratedShipments.length === 0) {
      throw new CarrierIntegrationError(
        ErrorCode.API_ERROR,
        'UPS API returned no rate quotes'
      );
    }

    const quotes: RateQuote[] = ratedShipments.map(shipment => {
      // Determine service level from UPS service code
      const serviceCode = shipment.Service.Code;
      const serviceLevel = this.mapServiceCodeToServiceLevel(serviceCode);

      // Get total charges (prefer negotiated rates if available)
      const charges = shipment.NegotiatedRateCharges?.TotalCharge 
        || shipment.TotalChargesWithTaxes 
        || shipment.TotalCharges;

      // Calculate estimated days from guaranteed delivery if available
      let estimatedDays: number | undefined;
      if (shipment.GuaranteedDelivery?.Date) {
        const deliveryDate = new Date(shipment.GuaranteedDelivery.Date);
        const now = new Date();
        const diffTime = deliveryDate.getTime() - now.getTime();
        estimatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        serviceLevel,
        serviceName: shipment.Service.Description || UPS_SERVICE_NAMES[serviceLevel] || 'Unknown',
        totalCost: parseFloat(charges.MonetaryValue),
        currency: charges.CurrencyCode,
        estimatedDays,
        carrier: this.getName()
      };
    });

    return {
      quotes,
      requestId
    };
  }

  /**
   * Map UPS service code back to our ServiceLevel enum
   */
  private mapServiceCodeToServiceLevel(code: string): ServiceLevel {
    const mapping: Record<string, ServiceLevel> = {
      '03': 'ground',
      '01': 'nextDayAir',
      '02': 'secondDayAir',
      '12': 'threeDaySelect',
      '14': 'nextDayAirEarly',
      '59': 'secondDayAirAM',
      '07': 'worldwideExpress',
      '54': 'worldwideExpressPlus',
      '08': 'worldwideExpedited',
      '11': 'standard'
    };

    return mapping[code] || 'express';
  }

  /**
   * Get shipping rates from UPS
   */
  async getRates(request: RateRequest): Promise<RateResponse> {
    try {
      // Get valid access token
      const accessToken = await this.tokenManager.getAccessToken();

      // Build UPS API request
      const upsRequest = this.buildUpsRequest(request);
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Make API call
      const url = `${this.config.baseUrl}/api/rating/v1/Rate`;
      const response = await this.httpClient.post<UpsRateResponse>(
        url,
        upsRequest,
        {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'transId': requestId,
          'transactionSrc': 'Cybership'
        }
      );

      // Parse and normalize response
      return this.parseUpsResponse(response, requestId);
    } catch (error) {
      // Re-throw CarrierIntegrationError as-is
      if (error instanceof CarrierIntegrationError) {
        throw error;
      }

      // Handle HTTP errors
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          // Token might be invalid, clear cache and retry once
          this.tokenManager.clearCache();
          throw new CarrierIntegrationError(
            ErrorCode.AUTH_TOKEN_INVALID,
            'Authentication token invalid or expired',
            {},
            error
          );
        }
        if (error.message.includes('429')) {
          throw new CarrierIntegrationError(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded. Please retry after some time.',
            {},
            error
          );
        }
        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
          throw new CarrierIntegrationError(
            ErrorCode.SERVICE_UNAVAILABLE,
            'UPS service temporarily unavailable',
            {},
            error
          );
        }
        if (error.message.includes('timeout')) {
          throw new CarrierIntegrationError(
            ErrorCode.TIMEOUT,
            'Request to UPS API timed out',
            {},
            error
          );
        }
        if (error.message.includes('JSON') || error.message.includes('parse')) {
          throw new CarrierIntegrationError(
            ErrorCode.MALFORMED_RESPONSE,
            'Invalid response format from UPS API',
            {},
            error
          );
        }
      }

      // Wrap unknown errors
      throw new CarrierIntegrationError(
        ErrorCode.UNKNOWN_ERROR,
        'Unexpected error while fetching rates from UPS',
        {},
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  supportsServiceLevel(serviceLevel: string): boolean {
    return serviceLevel in UPS_SERVICE_CODES;
  }
}
