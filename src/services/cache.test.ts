import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyzeCacheService } from './cache.js';

describe('AnalyzeCacheService', () => {
  let cache: AnalyzeCacheService;

  beforeEach(() => {
    cache = new AnalyzeCacheService(1000, 3600);
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = cache.generateKey('こんにちは', 'translate');
      const key2 = cache.generateKey('こんにちは', 'translate');

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different phrases', () => {
      const key1 = cache.generateKey('こんにちは', 'translate');
      const key2 = cache.generateKey('さようなら', 'translate');

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different action types', () => {
      const key1 = cache.generateKey('こんにちは', 'translate');
      const key2 = cache.generateKey('こんにちは', 'explain');

      expect(key1).not.toBe(key2);
    });

    it('should include fullPhrase in key generation when provided', () => {
      const key1 = cache.generateKey('こんにちは', 'translate');
      const key2 = cache.generateKey('こんにちは', 'translate', 'こんにちは、世界');

      expect(key1).not.toBe(key2);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      const key = cache.generateKey('こんにちは', 'translate');
      const value = { translation: 'Hello', confidence: 0.95 };

      cache.set(key, value);
      const result = cache.get(key);

      expect(result).toEqual(value);
    });

    it('should return undefined for non-existent keys', () => {
      const key = cache.generateKey('こんにちは', 'translate');
      const result = cache.get(key);

      expect(result).toBeUndefined();
    });

    it('should track hits and misses', () => {
      const key = cache.generateKey('こんにちは', 'translate');
      cache.set(key, { translation: 'Hello' });

      cache.get(key);
      cache.get('non-existent-key');

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should allow custom TTL for specific entries', () => {
      const key = cache.generateKey('こんにちは', 'translate');
      cache.set(key, { translation: 'Hello' }, 10);

      const ttl = cache.getRemainingTTL(key);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      const key = cache.generateKey('こんにちは', 'translate');
      cache.set(key, { translation: 'Hello' });

      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      const key = cache.generateKey('こんにちは', 'translate');

      expect(cache.has(key)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const key1 = cache.generateKey('こんにちは', 'translate');
      const key2 = cache.generateKey('さようなら', 'translate');

      cache.set(key1, { translation: 'Hello' });
      cache.set(key2, { translation: 'Goodbye' });

      cache.get(key1);
      cache.get('non-existent');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(1000);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();

      expect(stats.hitRate).toBe(0);
    });
  });

  describe('getRemainingTTL', () => {
    it('should return remaining TTL for existing key', () => {
      const key = cache.generateKey('こんにちは', 'translate');
      cache.set(key, { translation: 'Hello' });

      const ttl = cache.getRemainingTTL(key);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for non-existent key', () => {
      const key = cache.generateKey('こんにちは', 'translate');
      const ttl = cache.getRemainingTTL(key);

      expect(ttl).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries and stats', () => {
      const key1 = cache.generateKey('こんにちは', 'translate');
      const key2 = cache.generateKey('さようなら', 'translate');

      cache.set(key1, { translation: 'Hello' });
      cache.set(key2, { translation: 'Goodbye' });
      cache.get(key1);

      cache.clear();

      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(cache.has(key1)).toBe(false);
      expect(cache.has(key2)).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset hit/miss counters without clearing cache', () => {
      const key = cache.generateKey('こんにちは', 'translate');

      cache.set(key, { translation: 'Hello' });
      cache.get(key);
      cache.get('non-existent');

      cache.resetStats();

      const stats = cache.getStats();

      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(cache.has(key)).toBe(true);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when max size reached', () => {
      const smallCache = new AnalyzeCacheService(3, 3600);

      const key1 = smallCache.generateKey('1', 'translate');
      const key2 = smallCache.generateKey('2', 'translate');
      const key3 = smallCache.generateKey('3', 'translate');
      const key4 = smallCache.generateKey('4', 'translate');

      smallCache.set(key1, { data: '1' });
      smallCache.set(key2, { data: '2' });
      smallCache.set(key3, { data: '3' });
      smallCache.set(key4, { data: '4' });

      const stats = smallCache.getStats();

      expect(stats.size).toBe(3);
      expect(smallCache.has(key1)).toBe(false);
      expect(smallCache.has(key2)).toBe(true);
      expect(smallCache.has(key3)).toBe(true);
      expect(smallCache.has(key4)).toBe(true);
    });
  });

  describe('TTL expiration', () => {
    it('should return undefined for expired entries', async () => {
      const shortTTLCache = new AnalyzeCacheService(1000, 1);
      const key = shortTTLCache.generateKey('こんにちは', 'translate');

      shortTTLCache.set(key, { translation: 'Hello' });

      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = shortTTLCache.get(key);

      expect(result).toBeUndefined();
    });
  });
});
