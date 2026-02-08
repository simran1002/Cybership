/**
 * Domain models for the carrier integration service
 * These represent our internal domain, independent of any carrier's API
 */

export interface Address {
  street: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Package {
  weight: number; // in pounds
  length: number; // in inches
  width: number; // in inches
  height: number; // in inches
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
  serviceLevel?: ServiceLevel; // Optional: if not provided, return all available rates
}

export interface RateQuote {
  serviceLevel: ServiceLevel;
  serviceName: string;
  totalCost: number; // in USD
  currency: string;
  estimatedDays?: number; // transit time estimate
  carrier: string;
}

export interface RateResponse {
  quotes: RateQuote[];
  requestId: string; // for tracking/debugging
}
