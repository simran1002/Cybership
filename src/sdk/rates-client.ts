import { CarrierRegistry } from '../application/registry/carrier-registry';
import { RateService, RateServiceOptions } from '../application/services/rate-service';
import { Logger } from '../application/ports/logger';
import { Tracer } from '../application/ports/tracer';
import { RateCache } from '../application/ports/rate-cache';
import { NoopLogger } from '../infrastructure/logging/noop-logger';
import { NoopTracer } from '../infrastructure/tracing/noop-tracer';
import { createPinoLogger } from '../infrastructure/logging/pino-logger';
import { OpenTelemetryTracer } from '../infrastructure/tracing/opentelemetry-tracer';
import { registerUpsRateCarrier, UpsPluginOptions } from '../integrations/ups/register';

export interface CreateRatesClientOptions extends UpsPluginOptions {
  logger?: Logger;
  tracer?: Tracer;
  cache?: RateCache;
  cacheTtlMs?: number;
  usePino?: boolean;
  useOpenTelemetry?: boolean;
  serviceName?: string;
  logLevel?: string;
  registerCarriers?: (registry: CarrierRegistry, deps: { logger: Logger; tracer: Tracer }) => {
    cache?: RateCache;
  } | void;
}

export class CybershipRatesClient {
  constructor(
    public readonly registry: CarrierRegistry,
    public readonly service: RateService
  ) {}
}

export function createCybershipRatesClient(options: CreateRatesClientOptions = {}): CybershipRatesClient {
  const logger = resolveLogger(options);
  const tracer = resolveTracer(options);

  const registry = new CarrierRegistry();
  let cacheFromRegistration: RateCache | undefined;
  if (options.registerCarriers) {
    const result = options.registerCarriers(registry, { logger, tracer });
    cacheFromRegistration = result?.cache;
  } else {
    const result = registerUpsRateCarrier(registry, {
      ...options,
      logger,
      tracer
    });
    cacheFromRegistration = result.cache;
  }

  const resolvedCache = options.cache ?? cacheFromRegistration;
  const serviceOptions: RateServiceOptions = {
    logger,
    tracer,
    ...(resolvedCache ? { cache: resolvedCache } : {}),
    ...(options.cacheTtlMs !== undefined ? { cacheTtlMs: options.cacheTtlMs } : {})
  };

  const service = new RateService(registry, serviceOptions);
  return new CybershipRatesClient(registry, service);
}

function resolveLogger(options: CreateRatesClientOptions): Logger {
  if (options.logger) return options.logger;
  if (options.usePino) {
    return createPinoLogger({
      name: options.serviceName ?? 'cybership',
      ...(options.logLevel ? { level: options.logLevel } : {})
    });
  }
  return new NoopLogger();
}

function resolveTracer(options: CreateRatesClientOptions): Tracer {
  if (options.tracer) return options.tracer;
  if (options.useOpenTelemetry) {
    return new OpenTelemetryTracer({ serviceName: options.serviceName ?? 'cybership' });
  }
  return new NoopTracer();
}

