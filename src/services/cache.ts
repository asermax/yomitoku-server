import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export class AnalyzeCacheService {
  private cache: LRUCache<string, any>;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries: number, ttlSeconds: number) {
    this.cache = new LRUCache<string, any>({
      max: maxEntries,
      ttl: ttlSeconds * 1000,
      ttlAutopurge: false,
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
  }

  generateKey(phrase: string, actionType: string, fullPhrase?: string): string {
    const cacheData = fullPhrase ? `${phrase}:${actionType}:${fullPhrase}` : `${phrase}:${actionType}`;

    return crypto.createHash('sha256').update(cacheData).digest('hex');
  }

  set(key: string, value: any, ttlSeconds?: number): void {
    const options = ttlSeconds ? { ttl: ttlSeconds * 1000 } : undefined;
    this.cache.set(key, value, options);
  }

  get(key: string): any | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      this.hits++;
    }
    else {
      this.misses++;
    }

    return value;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;

    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  getRemainingTTL(key: string): number {
    const ms = this.cache.getRemainingTTL(key);
    return Math.max(0, Math.floor(ms / 1000));
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
