import { readFileSync } from 'node:fs';
import { createCybershipRatesClient } from '../sdk/rates-client';
import { RateRequest } from '../domain/rates';
import { ServiceError } from '../domain/errors';

async function main() {
  try {
    const request = readRequestFromArgs() ?? (await readRequestFromStdin());
    if (!request) {
      printHelp();
      process.exit(2);
    }

    const client = createCybershipRatesClient({
      usePino: true,
      logLevel: process.env['LOG_LEVEL'] ?? 'info',
      serviceName: 'cybership-carrier-integration'
    });

    const results = await client.service.getRatesDetailed(request);
    process.stdout.write(JSON.stringify({ results }, null, 2) + '\n');
  } catch (error) {
    if (error instanceof ServiceError) {
      process.stderr.write(JSON.stringify({ error: error.toJSON() }, null, 2) + '\n');
      process.exit(1);
    }
    process.stderr.write(String(error) + '\n');
    process.exit(1);
  }
}

function readRequestFromArgs(): RateRequest | null {
  const args = process.argv.slice(2);
  const requestIndex = args.indexOf('--request');
  if (requestIndex !== -1 && args[requestIndex + 1]) {
    return JSON.parse(args[requestIndex + 1]!) as RateRequest;
  }

  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    const text = readFileSync(args[fileIndex + 1]!, 'utf8');
    return JSON.parse(text) as RateRequest;
  }

  return null;
}

async function readRequestFromStdin(): Promise<RateRequest | null> {
  if (process.stdin.isTTY) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return null;
  return JSON.parse(text) as RateRequest;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage:',
      '  npm run cli -- --request \'{"origin":...,"destination":...,"packages":...}\'',
      '  npm run cli -- --file request.json',
      '  cat request.json | npm run cli',
      '',
      'Environment:',
      '  UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_BASE_URL, UPS_AUTH_URL, UPS_ACCOUNT_NUMBER, UPS_TIMEOUT_MS',
      '  LOG_LEVEL (optional)'
    ].join('\n') + '\n'
  );
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(String(e) + '\n');
    process.exit(1);
  });
}

