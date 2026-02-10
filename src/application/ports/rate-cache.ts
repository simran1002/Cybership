import { RateResponse } from '../../domain/rates';

export interface RateCache {
  get(key: string): RateResponse[] | undefined;
  set(key: string, value: RateResponse[], ttlMs: number): void;
}

