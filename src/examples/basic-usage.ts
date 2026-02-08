/**
 * Example usage of the Carrier Integration Service
 * Demonstrates how to initialize and use the service
 */

import { RateService } from '../services/rate-service';
import { UpsCarrier } from '../carriers/ups/ups-carrier';
import { TokenManager } from '../auth/token-manager';
import { FetchHttpClient } from '../http/client';
import { loadConfig } from '../config';
import { RateRequest } from '../types/domain';
import { CarrierIntegrationError } from '../types/errors';

async function main() {
  try {
    // Load configuration from environment variables
    const config = loadConfig();

    // Initialize HTTP client
    const httpClient = new FetchHttpClient(config.ups.timeout);

    // Initialize token manager for OAuth 2.0 authentication
    const tokenManager = new TokenManager(
      httpClient,
      config.ups.authUrl,
      config.ups.clientId,
      config.ups.clientSecret
    );

    // Initialize UPS carrier
    const upsCarrier = new UpsCarrier(httpClient, tokenManager, config.ups);

    // Initialize rate service with carriers
    const rateService = new RateService([upsCarrier]);

    // Create a rate request
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
      // Optionally specify a service level:
      // serviceLevel: 'ground'
    };

    console.log('Fetching rates from all carriers...\n');

    // Get rates from all carriers
    const responses = await rateService.getRates(request);

    // Display results
    responses.forEach(response => {
      console.log(`Carrier: ${response.quotes[0].carrier}`);
      console.log(`Request ID: ${response.requestId}\n`);
      
      response.quotes.forEach(quote => {
        console.log(`  Service: ${quote.serviceName}`);
        console.log(`  Cost: $${quote.totalCost.toFixed(2)} ${quote.currency}`);
        if (quote.estimatedDays) {
          console.log(`  Estimated Days: ${quote.estimatedDays}`);
        }
        console.log('');
      });
    });

    // Example: Get rates from a specific carrier
    console.log('Fetching rates from UPS only...\n');
    const upsResponse = await rateService.getRatesFromCarrier('UPS', request);
    console.log(`Found ${upsResponse.quotes.length} rate(s) from UPS`);

  } catch (error) {
    if (error instanceof CarrierIntegrationError) {
      console.error('Carrier Integration Error:');
      console.error(`  Code: ${error.code}`);
      console.error(`  Message: ${error.message}`);
      if (error.details) {
        console.error(`  Details:`, error.details);
      }
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

// Run example if executed directly
if (require.main === module) {
  main().catch(console.error);
}
