import { RateRequest, RateResponse } from '../../domain/rates';
import { rateRequestSchema } from '../../domain/validation/schemas';
import { CarrierRegistry } from '../registry/carrier-registry';
import { Carrier } from '../ports/carrier';
import { Logger } from '../ports/logger';
import { Tracer } from '../ports/tracer';
import { RateCache } from '../ports/rate-cache';
import {
  ServiceError,
  ValidationError,
  UnknownError,
  ConfigError
} from '../../domain/errors';

export interface CarrierRateResult {
  carrier: string;
  response?: RateResponse;
  error?: ServiceError;
}

export interface RateServiceOptions {
  logger: Logger;
  tracer: Tracer;
  cache?: RateCache;
  cacheTtlMs?: number;
}

function formatZodErrors(errors: { path: (string | number)[]; message: string }[]): string {
  return errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
}

export class RateService {
  constructor(
    private readonly registry: CarrierRegistry,
    private readonly options: RateServiceOptions
  ) {
    const carriers = registry.listCarriers();
    if (carriers.length === 0) {
      throw new ConfigError('At least one carrier must be registered');
    }
  }

  listCarriers(): Carrier[] {
    return this.registry.listCarriers();
  }

  async getRates(request: RateRequest): Promise<RateResponse[]> {
    const validated = this.validateRequest(request);
    const cacheKey = this.options.cache ? buildRateCacheKey(validated) : undefined;
    if (cacheKey) {
      const cached = this.options.cache?.get(cacheKey);
      if (cached) return cached;
    }

    const detailed = await this.getRatesDetailedValidated(validated);
    const responses = detailed
      .map((r) => r.response)
      .filter((r): r is RateResponse => Boolean(r));

    if (responses.length === 0) {
      const firstError = detailed.find((r) => r.error)?.error;
      throw firstError ?? new UnknownError('All carriers failed to return rates');
    }

    if (cacheKey) {
      this.options.cache?.set(cacheKey, responses, this.options.cacheTtlMs ?? 30000);
    }
    return responses;
  }

  async getRatesDetailed(request: RateRequest): Promise<CarrierRateResult[]> {
    const validated = this.validateRequest(request);
    return this.getRatesDetailedValidated(validated);
  }

  async getRatesFromCarrier(name: string, request: RateRequest): Promise<RateResponse> {
    const validated = this.validateRequest(request);

    const carrier = this.registry.getCarrier(name);
    if (!carrier) {
      throw new ValidationError(`Carrier not found: ${name}`);
    }

    return carrier.getRates(validated);
  }

  private async getRatesDetailedValidated(request: RateRequest): Promise<CarrierRateResult[]> {
    const carriers = this.selectEligibleCarriers(request);
    if (carriers.length === 0) {
      throw new ValidationError(
        `No carriers support the requested service level: ${request.serviceLevel}`
      );
    }

    return this.options.tracer.startSpan(
      'RateService.getRates',
      { carriers: carriers.length, hasServiceLevel: Boolean(request.serviceLevel) },
      async (span) => {
        try {
          const results = await Promise.all(
            carriers.map(async (carrier) => this.getRatesFromCarrierSafe(carrier, request))
          );
          return results;
        } catch (error) {
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  private validateRequest(request: RateRequest): RateRequest {
    const validation = rateRequestSchema.safeParse(request);
    if (!validation.success) {
      throw new ValidationError(
        `Invalid rate request: ${formatZodErrors(validation.error.errors)}`,
        { validationErrors: validation.error.errors }
      );
    }
    const { serviceLevel, ...rest } = validation.data;
    return serviceLevel ? { ...rest, serviceLevel } : rest;
  }

  private selectEligibleCarriers(request: RateRequest): Carrier[] {
    const carriers = this.registry.listCarriers();
    if (!request.serviceLevel) return carriers;

    return carriers.filter(
      (c) => !c.supportsServiceLevel || c.supportsServiceLevel(request.serviceLevel!)
    );
  }

  private async getRatesFromCarrierSafe(
    carrier: Carrier,
    request: RateRequest
  ): Promise<CarrierRateResult> {
    const carrierName = carrier.getName();
    const log = this.options.logger.child({ carrier: carrierName });

    try {
      const response = await carrier.getRates(request);
      return { carrier: carrierName, response };
    } catch (error) {
      const serviceError =
        error instanceof ServiceError
          ? error
          : new UnknownError('Unexpected error while fetching rates', carrierName, undefined, error);

      log.error({ err: serviceError.toJSON() }, 'carrier.getRates failed');
      return { carrier: carrierName, error: serviceError };
    }
  }
}

function buildRateCacheKey(request: RateRequest): string {
  const o = request.origin;
  const d = request.destination;
  const pkgKey = request.packages
    .map((p) => `${p.weight}x${p.length}x${p.width}x${p.height}`)
    .join('|');
  const sl = request.serviceLevel ?? '';
  return [
    o.country,
    o.state,
    o.postalCode,
    o.city,
    o.street.join('|'),
    d.country,
    d.state,
    d.postalCode,
    d.city,
    d.street.join('|'),
    pkgKey,
    sl
  ].join('::');
}

