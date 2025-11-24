import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockGeminiService, createAnalyzePayload } from '../helper.js';

describe('GET /api/cache/stats - Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear cache and reset mocks before each test
    app.analyzeCache.clear();
    mockGeminiService.analyzeContent.mockReset();
  });

  it('should return 200 with cache statistics', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
    });

    expect(response.statusCode).toBe(200);

    const stats = response.json();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('maxSize');
    expect(stats).toHaveProperty('hits');
    expect(stats).toHaveProperty('misses');
    expect(stats).toHaveProperty('hitRate');
  });

  it('should return correct types for all stats fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
    });

    const stats = response.json();
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.maxSize).toBe('number');
    expect(typeof stats.hits).toBe('number');
    expect(typeof stats.misses).toBe('number');
    expect(typeof stats.hitRate).toBe('number');
  });

  it('should return 0 hitRate when no cache activity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
    });

    const stats = response.json();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRate).toBe(0);
    expect(stats.size).toBe(0);
  });

  it('should reflect cache size after analyze requests', async () => {
    mockGeminiService.analyzeContent.mockResolvedValue({
      translation: 'Hello',
    });

    // Make a request that will be cached
    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: createAnalyzePayload({
        phrase: 'こんにちは',
        action: 'translate',
      }),
    });

    // Check stats
    const response = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
    });

    const stats = response.json();
    expect(stats.size).toBe(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
  });

  it('should show increased hits on cache hits', async () => {
    mockGeminiService.analyzeContent.mockResolvedValue({
      translation: 'Hello',
    });

    const payload = createAnalyzePayload({
      phrase: 'こんにちは',
      action: 'translate',
    });

    // First request (cache miss)
    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload,
    });

    // Second identical request (cache hit)
    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload,
    });

    // Check stats
    const response = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
    });

    const stats = response.json();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  it('should calculate hitRate correctly', async () => {
    mockGeminiService.analyzeContent.mockResolvedValue({
      translation: 'Test',
    });

    const payload = createAnalyzePayload({
      phrase: 'テスト',
      action: 'translate',
    });

    // First request (miss)
    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload,
    });

    // Second identical request (hit)
    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
    });

    const stats = response.json();

    // hitRate = hits / (hits + misses)
    const expectedHitRate = stats.hits / (stats.hits + stats.misses);
    expect(stats.hitRate).toBeCloseTo(expectedHitRate, 5);
  });

  it('should have correct content-type header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
  });
});
