# Carrier Integration Service

A production-ready TypeScript service for integrating with shipping carriers to provide real-time rates, labels, tracking, and more. Currently implements UPS Rating API integration with an extensible architecture designed to support additional carriers (FedEx, USPS, DHL) and operations.

## Features

- ✅ **Rate Shopping**: Get normalized rate quotes from UPS without exposing carrier-specific API details
- ✅ **OAuth 2.0 Authentication**: Automatic token acquisition, caching, and refresh for UPS
- ✅ **Extensible Architecture**: Clean separation of concerns - add new carriers without modifying existing code
- ✅ **Type Safety**: Strong TypeScript types and runtime validation using Zod
- ✅ **Error Handling**: Comprehensive error handling for network issues, API errors, and validation failures
- ✅ **Integration Tests**: End-to-end tests with stubbed API responses

## Architecture

### Design Principles

1. **Domain-Driven Design**: Clear separation between internal domain models and carrier-specific API formats
2. **Dependency Injection**: HTTP client and token manager are injected, making testing easy
3. **Extensibility**: New carriers implement the `Carrier` interface without touching existing code
4. **Validation First**: All inputs are validated before making external API calls

### Project Structure

```
src/
├── types/
│   ├── domain.ts          # Internal domain models (Address, Package, RateRequest, etc.)
│   └── errors.ts          # Structured error types
├── validation/
│   └── schemas.ts         # Zod validation schemas
├── config/
│   └── index.ts           # Configuration management from environment variables
├── http/
│   └── client.ts          # HTTP client abstraction
├── auth/
│   └── token-manager.ts   # OAuth 2.0 token management with caching
├── carriers/
│   ├── carrier.ts         # Carrier interface (abstraction)
│   └── ups/
│       ├── types.ts       # UPS-specific API types
│       └── ups-carrier.ts # UPS implementation
├── services/
│   └── rate-service.ts    # Main service layer
└── __tests__/
    └── integration/       # Integration tests with stubbed responses
```

### Extensibility Pattern

To add a new carrier (e.g., FedEx):

1. Create `src/carriers/fedex/fedex-carrier.ts` implementing the `Carrier` interface
2. Create `src/carriers/fedex/types.ts` for FedEx-specific API types
3. Register the carrier in your service initialization

```typescript
import { FedExCarrier } from './carriers/fedex/fedex-carrier';
import { RateService } from './services/rate-service';

const fedExCarrier = new FedExCarrier(httpClient, fedExConfig);
const service = new RateService([upsCarrier, fedExCarrier]);
```

The existing UPS code remains untouched.

## Installation

```bash
npm install
```

## Configuration

Copy `env.example` to `.env` and fill in your UPS credentials:

```bash
cp env.example .env
```

Required environment variables:

- `UPS_CLIENT_ID`: Your UPS API client ID
- `UPS_CLIENT_SECRET`: Your UPS API client secret
- `UPS_BASE_URL`: UPS API base URL (default: https://onlinetools.ups.com)
- `UPS_AUTH_URL`: UPS OAuth token endpoint (default: https://onlinetools.ups.com/security/v1/oauth/token)
- `UPS_ACCOUNT_NUMBER`: (Optional) Your UPS account number for negotiated rates
- `UPS_TIMEOUT_MS`: Request timeout in milliseconds (default: 30000)

## Usage

### Basic Rate Request

```typescript
import { RateService } from './services/rate-service';
import { UpsCarrier } from './carriers/ups/ups-carrier';
import { TokenManager } from './auth/token-manager';
import { FetchHttpClient } from './http/client';
import { loadConfig } from './config';

// Initialize components
const config = loadConfig();
const httpClient = new FetchHttpClient(config.ups.timeout);
const tokenManager = new TokenManager(
  httpClient,
  config.ups.authUrl,
  config.ups.clientId,
  config.ups.clientSecret
);
const upsCarrier = new UpsCarrier(httpClient, tokenManager, config.ups);
const rateService = new RateService([upsCarrier]);

// Make a rate request
const request = {
  origin: {
    street: ['123 Main St'],
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  },
  destination: {
    street: ['456 Oak Ave'],
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90001',
    country: 'US'
  },
  packages: [{
    weight: 5,
    length: 10,
    width: 8,
    height: 6
  }]
};

// Get rates from all carriers
const responses = await rateService.getRates(request);
responses.forEach(response => {
  response.quotes.forEach(quote => {
    console.log(`${quote.carrier} ${quote.serviceName}: $${quote.totalCost}`);
  });
});

// Or get rates from a specific carrier
const upsResponse = await rateService.getRatesFromCarrier('UPS', request);
```

### Requesting Specific Service Level

```typescript
const request = {
  origin: { /* ... */ },
  destination: { /* ... */ },
  packages: [/* ... */],
  serviceLevel: 'nextDayAir' // Optional: filter to specific service
};

const responses = await rateService.getRates(request);
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

### Test Strategy

The integration tests use a mock HTTP client that allows us to:
- Test request building logic with realistic UPS API payloads
- Test response parsing and normalization
- Test authentication token lifecycle (acquisition, caching, refresh)
- Test error handling for various failure modes (4xx, 5xx, timeouts, malformed responses)

All tests run without requiring actual UPS API credentials or making live API calls.

## Error Handling

The service uses structured errors with error codes:

```typescript
import { CarrierIntegrationError, ErrorCode } from './types/errors';

try {
  const rates = await rateService.getRates(request);
} catch (error) {
  if (error instanceof CarrierIntegrationError) {
    switch (error.code) {
      case ErrorCode.VALIDATION_ERROR:
        // Handle validation errors
        break;
      case ErrorCode.AUTH_FAILED:
        // Handle authentication failures
        break;
      case ErrorCode.TIMEOUT:
        // Handle timeouts
        break;
      // ... other error codes
    }
  }
}
```

## Design Decisions

### 1. Domain Models vs API Types

We maintain strict separation between our internal domain models (`Address`, `Package`, `RateRequest`) and carrier-specific API types (`UpsAddress`, `UpsPackage`, `UpsRateRequest`). This ensures:
- Callers never need to know about UPS's API structure
- Easy to swap carriers or support multiple carriers
- Clear boundaries for testing

### 2. Token Management

The `TokenManager` handles OAuth 2.0 token lifecycle transparently:
- Tokens are cached and reused until near expiration
- Automatic refresh when tokens expire
- Thread-safe: concurrent requests share the same refresh promise
- Tokens refresh 1 minute before expiration to avoid race conditions

### 3. HTTP Client Abstraction

The `HttpClient` interface allows easy stubbing in tests. The default implementation uses Node.js `fetch`, but could be swapped for axios or another HTTP library without changing business logic.

### 4. Validation Strategy

We validate inputs using Zod schemas before making any external API calls. This:
- Provides clear error messages for invalid inputs
- Prevents unnecessary API calls
- Ensures type safety at runtime

### 5. Error Handling

Errors are structured with:
- Error codes for programmatic handling
- Human-readable messages
- Optional details object for additional context
- Original error preserved for debugging

## Future Improvements

Given more time, I would:

1. **Add More Carriers**: Implement FedEx, USPS, and DHL integrations following the same pattern
2. **Add More Operations**: Extend to support label purchase, tracking, and address validation
3. **Rate Comparison**: Add a method to compare rates across carriers and recommend the best option
4. **Caching Layer**: Add Redis caching for rate quotes to reduce API calls
5. **Retry Logic**: Implement exponential backoff retry for transient failures
6. **Metrics & Monitoring**: Add Prometheus metrics and structured logging
7. **Rate Limiting**: Implement client-side rate limiting to respect carrier API limits
8. **Batch Requests**: Support batch rate requests for multiple shipments
9. **Webhook Support**: Add webhook endpoints for async operations
10. **API Documentation**: Generate OpenAPI/Swagger documentation
11. **Docker Support**: Add Dockerfile and docker-compose for easy deployment
12. **CI/CD**: Add GitHub Actions for automated testing and deployment

## Development

Build the project:

```bash
npm run build
```

Lint the code:

```bash
npm run lint
```

## License

MIT
