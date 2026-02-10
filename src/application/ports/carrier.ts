import { RateRequest, RateResponse, ServiceLevel } from '../../domain/rates';

export interface Carrier {
  getName(): string;
  getRates(request: RateRequest): Promise<RateResponse>;
  supportsServiceLevel?(serviceLevel: ServiceLevel): boolean;
}

