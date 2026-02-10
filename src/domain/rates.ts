export interface Address {
  street: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Package {
  weight: number;
  length: number;
  width: number;
  height: number;
}

export type ServiceLevel =
  | 'ground'
  | 'nextDayAir'
  | 'secondDayAir'
  | 'threeDaySelect'
  | 'nextDayAirEarly'
  | 'secondDayAirAM'
  | 'worldwideExpress'
  | 'worldwideExpressPlus'
  | 'worldwideExpedited'
  | 'standard'
  | 'express';

export interface RateRequest {
  origin: Address;
  destination: Address;
  packages: Package[];
  serviceLevel?: ServiceLevel;
}

export interface RateQuote {
  serviceLevel: ServiceLevel;
  serviceName: string;
  totalCost: number;
  currency: string;
  estimatedDays?: number;
  carrier: string;
}

export interface RateResponse {
  quotes: RateQuote[];
  requestId: string;
}

