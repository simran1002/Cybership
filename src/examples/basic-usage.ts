import { RateRequest } from '../domain/rates';
import { ServiceError } from '../domain/errors';
import { createCybershipRatesClient } from '../sdk/rates-client';

async function main() {
  try {
    const client = createCybershipRatesClient({
      usePino: true,
      logLevel: process.env['LOG_LEVEL'] ?? 'info',
      enableRateCache: true
    });
    const rateService = client.service;

    const request: RateRequest = {
      origin: {
        street: ['123 Main Street'],
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US'
      },
      destination: {
        street: ['456 Oak Avenue'],
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'US'
      },
      packages: [
        {
          weight: 5,
          length: 10,
          width: 8,
          height: 6
        }
      ]
    };

    console.log('Fetching rates from all carriers...\n');
    const responses = await rateService.getRates(request);

    responses.forEach((response) => {
      console.log(`Carrier: ${response.quotes[0]?.carrier ?? 'Unknown'}`);
      console.log(`Request ID: ${response.requestId}\n`);
      response.quotes.forEach((quote) => {
        console.log(`  Service: ${quote.serviceName}`);
        console.log(`  Cost: $${quote.totalCost.toFixed(2)} ${quote.currency}`);
        if (quote.estimatedDays) {
          console.log(`  Estimated Days: ${quote.estimatedDays}`);
        }
        console.log('');
      });
    });

    console.log('Fetching rates from UPS only...\n');
    const upsResponse = await rateService.getRatesFromCarrier('UPS', request);
    console.log(`Found ${upsResponse.quotes.length} rate(s) from UPS`);
  } catch (error) {
    if (error instanceof ServiceError) {
      console.error('Service Error:');
      console.error(`  Code: ${error.code}`);
      console.error(`  Message: ${error.message}`);
      console.error(`  Retryable: ${error.retryable}`);
      if (error.carrier) console.error(`  Carrier: ${error.carrier}`);
      if (error.details) console.error('  Details:', error.details);
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
