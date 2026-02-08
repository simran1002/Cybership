/**
 * Runtime validation schemas using Zod
 * Validates domain models before making external API calls
 */

import { z } from 'zod';

export const addressSchema = z.object({
  street: z.array(z.string().min(1)).min(1).max(3),
  city: z.string().min(1).max(50),
  state: z.string().length(2), // US state codes are 2 characters
  postalCode: z.string().min(5).max(10),
  country: z.string().length(2) // ISO country codes are 2 characters
});

export const packageSchema = z.object({
  weight: z.number().positive().max(150), // UPS max weight is typically 150 lbs
  length: z.number().positive().max(108), // UPS max dimension is 108 inches
  width: z.number().positive().max(108),
  height: z.number().positive().max(108)
});

export const serviceLevelSchema = z.enum([
  'ground',
  'nextDayAir',
  'secondDayAir',
  'threeDaySelect',
  'nextDayAirEarly',
  'secondDayAirAM',
  'worldwideExpress',
  'worldwideExpressPlus',
  'worldwideExpedited',
  'standard',
  'express'
]);

export const rateRequestSchema = z.object({
  origin: addressSchema,
  destination: addressSchema,
  packages: z.array(packageSchema).min(1).max(50), // UPS allows up to 50 packages
  serviceLevel: serviceLevelSchema.optional()
});

export type ValidatedAddress = z.infer<typeof addressSchema>;
export type ValidatedPackage = z.infer<typeof packageSchema>;
export type ValidatedRateRequest = z.infer<typeof rateRequestSchema>;
