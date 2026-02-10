import { z } from 'zod';

const statusSchema = z
  .object({
    Code: z.string(),
    Description: z.string()
  })
  .passthrough();

const alertSchema = z
  .object({
    Code: z.string(),
    Description: z.string()
  })
  .passthrough();

const moneySchema = z
  .object({
    CurrencyCode: z.string(),
    MonetaryValue: z.string()
  })
  .passthrough();

const serviceSchema = z
  .object({
    Code: z.string(),
    Description: z.string().optional()
  })
  .passthrough();

const ratedShipmentSchema = z
  .object({
    Service: serviceSchema,
    TotalCharges: moneySchema,
    TotalChargesWithTaxes: moneySchema.optional(),
    NegotiatedRateCharges: z
      .object({
        TotalCharge: moneySchema
      })
      .optional(),
    GuaranteedDelivery: z
      .object({
        Date: z.string(),
        Time: z.string().optional()
      })
      .optional()
  })
  .passthrough();

export const upsRateResponseSchema = z
  .object({
    RateResponse: z
      .object({
        Response: z
          .object({
            ResponseStatus: statusSchema,
            Alert: z.array(alertSchema).optional(),
            TransactionReference: z
              .object({
                CustomerContext: z.string().optional()
              })
              .optional()
          })
          .passthrough(),
        RatedShipment: z.array(ratedShipmentSchema).optional()
      })
      .passthrough()
  })
  .passthrough();

export type UpsRateResponse = z.infer<typeof upsRateResponseSchema>;

