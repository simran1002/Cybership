import { z } from 'zod';

export const addressSchema = z.object({
  street: z.array(z.string().min(1)).min(1).max(3),
  city: z.string().min(1).max(50),
  state: z.string().length(2),
  postalCode: z.string().min(5).max(10),
  country: z.string().length(2)
});

export const packageSchema = z.object({
  weight: z.number().positive().max(150),
  length: z.number().positive().max(108),
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
  packages: z.array(packageSchema).min(1).max(50),
  serviceLevel: serviceLevelSchema.optional()
});

export type ValidatedAddress = z.infer<typeof addressSchema>;
export type ValidatedPackage = z.infer<typeof packageSchema>;
export type ValidatedRateRequest = z.infer<typeof rateRequestSchema>;

