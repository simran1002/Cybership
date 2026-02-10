import { RateCache } from '../../application/ports/rate-cache';
import { RateResponse } from '../../domain/rates';

interface Entry {
  value: RateResponse[];
  expiresAtMs: number;
}

export interface InMemoryRateCacheOptions {
  maxEntries: number;
}

export class InMemoryRateCache implements RateCache {
  private readonly store = new Map<string, Entry>();

  constructor(private readonly options: InMemoryRateCacheOptions = { maxEntries: 500 }) {}

  get(key: string): RateResponse[] | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAtMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: RateResponse[], ttlMs: number): void {
    if (this.store.size >= this.options.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAtMs: Date.now() + ttlMs });
  }
}

