import { RateMapper } from '../shared/rate-mapper';
import { RateRequest, RateResponse, RateQuote, ServiceLevel, Address, Package } from '../../domain/rates';
import { CarrierError, ErrorCode, ValidationError } from '../../domain/errors';
import { UpsRateRequest, UPS_SERVICE_CODES, UPS_SERVICE_NAMES, UpsAddress, UpsPackage } from './ups-types';
import { UpsRateResponse } from './ups-schemas';

const SERVICE_CODE_TO_LEVEL: Record<string, ServiceLevel> = {
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

const MS_PER_DAY = 86400000;

export class UpsRateMapper implements RateMapper<UpsRateRequest, UpsRateResponse> {
  private readonly carrierName = 'UPS';

  constructor(private readonly config: { accountNumber?: string }) {}

  toCarrierRequest(request: RateRequest): UpsRateRequest {
    const upsRequest: UpsRateRequest = {
      RateRequest: {
        Request: {
          RequestOption: request.serviceLevel ? 'Rate' : 'Shop'
        },
        Shipment: {
          Shipper: {
            Address: this.toUpsAddress(request.origin),
            ...(this.config.accountNumber && { ShipperNumber: this.config.accountNumber })
          },
          ShipTo: {
            Address: this.toUpsAddress(request.destination)
          },
          Package: request.packages.map((pkg) => this.toUpsPackage(pkg))
        }
      }
    };

    if (request.serviceLevel) {
      const serviceCode = UPS_SERVICE_CODES[request.serviceLevel];
      if (!serviceCode) {
        throw new ValidationError(`Unsupported service level: ${request.serviceLevel}`);
      }
      const description = UPS_SERVICE_NAMES[request.serviceLevel];
      upsRequest.RateRequest.Shipment.Service = description
        ? { Code: serviceCode, Description: description }
        : { Code: serviceCode };
    }

    return upsRequest;
  }

  fromCarrierResponse(response: UpsRateResponse, requestId: string): RateResponse {
    const { Response, RatedShipment } = response.RateResponse;

    if (Response.ResponseStatus.Code !== '1') {
      const alerts = Response.Alert || [];
      const errorMessages = alerts.map((a) => a.Description).join('; ');
      throw new CarrierError(
        ErrorCode.API_ERROR,
        `UPS API error: ${Response.ResponseStatus.Description}. ${errorMessages}`,
        this.carrierName,
        { details: { code: Response.ResponseStatus.Code } }
      );
    }

    const ratedShipments = RatedShipment || [];
    if (ratedShipments.length === 0) {
      throw new CarrierError(
        ErrorCode.API_ERROR,
        'UPS API returned no rate quotes',
        this.carrierName
      );
    }

    const quotes: RateQuote[] = ratedShipments.map((shipment) => {
      const serviceLevel = SERVICE_CODE_TO_LEVEL[shipment.Service.Code] ?? 'express';
      const charges =
        shipment.NegotiatedRateCharges?.TotalCharge ??
        shipment.TotalChargesWithTaxes ??
        shipment.TotalCharges;

      let estimatedDays: number | undefined;
      if (shipment.GuaranteedDelivery?.Date) {
        const deliveryDate = new Date(shipment.GuaranteedDelivery.Date);
        estimatedDays = Math.ceil((deliveryDate.getTime() - Date.now()) / MS_PER_DAY);
      }

      return {
        serviceLevel,
        serviceName: shipment.Service.Description ?? UPS_SERVICE_NAMES[serviceLevel] ?? 'Unknown',
        totalCost: parseFloat(charges.MonetaryValue),
        currency: charges.CurrencyCode,
        ...(estimatedDays !== undefined ? { estimatedDays } : {}),
        carrier: this.carrierName
      };
    });

    return { quotes, requestId };
  }

  private toUpsAddress(address: Address): UpsAddress {
    return {
      AddressLine: address.street,
      City: address.city,
      StateProvinceCode: address.state,
      PostalCode: address.postalCode,
      CountryCode: address.country
    };
  }

  private toUpsPackage(pkg: Package): UpsPackage {
    return {
      Weight: {
        Value: pkg.weight.toString(),
        UnitOfMeasurement: { Code: 'LBS' }
      },
      Dimensions: {
        Length: pkg.length.toString(),
        Width: pkg.width.toString(),
        Height: pkg.height.toString(),
        UnitOfMeasurement: { Code: 'IN' }
      },
      Packaging: { Code: '02', Description: 'Package' }
    };
  }
}

