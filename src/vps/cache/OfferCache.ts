import { OfferSet } from '../types';

export interface OfferCache {
  get(key: string): Promise<OfferSet | null>;
  set(key: string, value: OfferSet, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class InMemoryOfferCache implements OfferCache {
  private readonly map = new Map<string, { value: OfferSet; expiresAt: number }>();

  async get(key: string): Promise<OfferSet | null> {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() >= hit.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: OfferSet, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}
