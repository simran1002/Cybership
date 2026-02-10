import { CarrierRegistry } from '../../application/registry/carrier-registry';
import { Logger } from '../../application/ports/logger';
import { Tracer } from '../../application/ports/tracer';
import { HttpClient } from '../../application/ports/http-client';
import { NoopLogger } from '../../infrastructure/logging/noop-logger';
import { NoopTracer } from '../../infrastructure/tracing/noop-tracer';
import { FetchHttpClient } from '../../infrastructure/http/fetch-http-client';
import { InstrumentedHttpClient } from '../../infrastructure/http/instrumented-http-client';
import { OAuthClient } from '../../infrastructure/auth/oauth-client';
import { ClientCredentialsAuthProvider } from '../../infrastructure/auth/client-credentials-auth-provider';
import { ExponentialBackoffRetryPolicy } from '../../infrastructure/retry/retry-policy';
import { RetryPolicy } from '../../infrastructure/retry/retry-policy';
import { RetryingCarrierClient } from '../../infrastructure/retry/retrying-carrier-client';
import { CircuitBreaker } from '../../infrastructure/circuit-breaker/circuit-breaker';
import { CircuitBreakerCarrierClient } from '../../infrastructure/circuit-breaker/circuit-breaker-carrier-client';
import { InMemoryRateCache } from '../../infrastructure/caching/in-memory-rate-cache';
import { RateCache } from '../../application/ports/rate-cache';
import { UpsConfig, loadUpsConfig } from './ups-config';
import { UpsRateClient } from './ups-rate-client';
import { UpsRateMapper } from './ups-rate-mapper';
import { UpsRateCarrier } from './ups-rate-carrier';

export interface UpsPluginOptions {
  config?: UpsConfig;
  httpClient?: HttpClient;
  logger?: Logger;
  tracer?: Tracer;
  instrumentHttp?: boolean;
  enableRetry?: boolean;
  retryPolicy?: RetryPolicy;
  enableCircuitBreaker?: boolean;
  circuitBreaker?: CircuitBreaker;
  enableRateCache?: boolean;
  rateCache?: RateCache;
}

export function registerUpsRateCarrier(registry: CarrierRegistry, options: UpsPluginOptions = {}): {
  cache?: RateCache;
} {
  const config = options.config ?? loadUpsConfig();
  const logger = options.logger ?? new NoopLogger();
  const tracer = options.tracer ?? new NoopTracer();

  const baseHttp = options.httpClient ?? new FetchHttpClient(config.timeoutMs);
  const httpClient =
    options.instrumentHttp === false
      ? baseHttp
      : new InstrumentedHttpClient(baseHttp, { logger, tracer });

  const oauthClient = new OAuthClient(httpClient, {
    authUrl: config.authUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    timeoutMs: config.timeoutMs
  });

  const authProvider = new ClientCredentialsAuthProvider(oauthClient);
  const upsClient = new UpsRateClient(httpClient, authProvider, config);

  const retryPolicy =
    options.retryPolicy ??
    new ExponentialBackoffRetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 200,
      maxDelayMs: 2000,
      jitterRatio: 0.2
    });

  const retryWrapped =
    options.enableRetry === false
      ? upsClient
      : new RetryingCarrierClient('UPS', retryPolicy, upsClient, logger);

  const breaker = options.circuitBreaker ?? new CircuitBreaker({ failureThreshold: 5, openDurationMs: 30000 });
  const resilientClient =
    options.enableCircuitBreaker === false
      ? retryWrapped
      : new CircuitBreakerCarrierClient('UPS', breaker, retryWrapped);

  const mapper = new UpsRateMapper(config.accountNumber ? { accountNumber: config.accountNumber } : {});
  const carrier = new UpsRateCarrier(resilientClient, mapper);
  registry.registerCarrier(carrier);

  const cache =
    options.enableRateCache === true
      ? options.rateCache ?? new InMemoryRateCache({ maxEntries: 500 })
      : undefined;

  return cache ? { cache } : {};
}

