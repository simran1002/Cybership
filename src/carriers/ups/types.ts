/**
 * UPS API-specific types
 * These represent UPS's raw API request/response formats
 * Separate from our domain models to maintain clear boundaries
 */

// UPS Address format
export interface UpsAddress {
  AddressLine?: string[];
  City: string;
  StateProvinceCode: string;
  PostalCode: string;
  CountryCode: string;
}

// UPS Package format
export interface UpsPackage {
  Weight: {
    Value: string;
    UnitOfMeasurement: {
      Code: string;
    };
  };
  Dimensions?: {
    Length: string;
    Width: string;
    Height: string;
    UnitOfMeasurement: {
      Code: string;
    };
  };
  Packaging?: {
    Code: string;
    Description?: string;
  };
}

// UPS Service Code mapping
export const UPS_SERVICE_CODES: Record<string, string> = {
  ground: '03',
  nextDayAir: '01',
  secondDayAir: '02',
  threeDaySelect: '12',
  nextDayAirEarly: '14',
  secondDayAirAM: '59',
  worldwideExpress: '07',
  worldwideExpressPlus: '54',
  worldwideExpedited: '08',
  standard: '11',
  express: '07'
};

// UPS Service Name mapping
export const UPS_SERVICE_NAMES: Record<string, string> = {
  ground: 'UPS Ground',
  nextDayAir: 'UPS Next Day Air',
  secondDayAir: 'UPS 2nd Day Air',
  threeDaySelect: 'UPS 3 Day Select',
  nextDayAirEarly: 'UPS Next Day Air Early',
  secondDayAirAM: 'UPS 2nd Day Air A.M.',
  worldwideExpress: 'UPS Worldwide Express',
  worldwideExpressPlus: 'UPS Worldwide Express Plus',
  worldwideExpedited: 'UPS Worldwide Expedited',
  standard: 'UPS Standard',
  express: 'UPS Express'
};

// UPS Rating API Request
export interface UpsRateRequest {
  RateRequest: {
    Request: {
      RequestOption: string;
      TransactionReference?: {
        CustomerContext?: string;
      };
    };
    Shipment: {
      Shipper: {
        Name?: string;
        ShipperNumber?: string;
        Address: UpsAddress;
      };
      ShipTo: {
        Name?: string;
        Address: UpsAddress;
      };
      ShipFrom?: {
        Name?: string;
        Address: UpsAddress;
      };
      Service?: {
        Code: string;
        Description?: string;
      };
      Package: UpsPackage[];
      ShipmentRatingOptions?: {
        NegotiatedRatesIndicator?: string;
      };
    };
  };
}

// UPS Rating API Response
export interface UpsRateResponse {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: string;
        Description: string;
      };
      Alert?: Array<{
        Code: string;
        Description: string;
      }>;
      TransactionReference?: {
        CustomerContext: string;
      };
    };
    RatedShipment?: Array<{
      Service: {
        Code: string;
        Description: string;
      };
      RatedShipmentAlert?: Array<{
        Code: string;
        Description: string;
      }>;
      TotalCharges: {
        CurrencyCode: string;
        MonetaryValue: string;
      };
      TransportationCharges?: {
        CurrencyCode: string;
        MonetaryValue: string;
      };
      ServiceOptionsCharges?: {
        CurrencyCode: string;
        MonetaryValue: string;
      };
      TotalChargesWithTaxes?: {
        CurrencyCode: string;
        MonetaryValue: string;
      };
      NegotiatedRateCharges?: {
        TotalCharge: {
          CurrencyCode: string;
          MonetaryValue: string;
        };
      };
      GuaranteedDelivery?: {
        Date: string;
        Time?: string;
      };
      RatedPackage?: Array<{
        TransportationCharges: {
          CurrencyCode: string;
          MonetaryValue: string;
        };
        BaseServiceCharge: {
          CurrencyCode: string;
          MonetaryValue: string;
        };
        ItemizedCharges?: Array<{
          Code: string;
          Description?: string;
          MonetaryValue: string;
        }>;
      }>;
    }>;
  };
}
