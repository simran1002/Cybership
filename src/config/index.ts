/**
 * Configuration management
 * All secrets and environment-specific values come from environment variables
 */

import { CarrierIntegrationError, ErrorCode } from '../types/errors';

export interface UpsConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  authUrl: string;
  accountNumber?: string;
  timeout: number;
}

export interface Config {
  ups: UpsConfig;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new CarrierIntegrationError(
      ErrorCode.CONFIG_ERROR,
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new CarrierIntegrationError(
      ErrorCode.CONFIG_ERROR,
      `Invalid number for environment variable ${name}: ${value}`
    );
  }
  return parsed;
}

export function loadConfig(): Config {
  return {
    ups: {
      clientId: getEnvVar('UPS_CLIENT_ID'),
      clientSecret: getEnvVar('UPS_CLIENT_SECRET'),
      baseUrl: getEnvVar('UPS_BASE_URL', 'https://onlinetools.ups.com'),
      authUrl: getEnvVar('UPS_AUTH_URL', 'https://onlinetools.ups.com/security/v1/oauth/token'),
      accountNumber: process.env.UPS_ACCOUNT_NUMBER,
      timeout: getEnvNumber('UPS_TIMEOUT_MS', 30000)
    }
  };
}
