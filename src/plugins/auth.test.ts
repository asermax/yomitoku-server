import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../app.js';

describe('Authentication plugin', () => {
  const validApiKey = 'test-api-key-12345';
  let app: Awaited<ReturnType<typeof build>>;

  beforeAll(async () => {
    // Set API_KEY environment variable for tests
    process.env.API_KEY = validApiKey;
    app = await build();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_KEY;
  });

  describe('Valid authentication', () => {
    it('should allow request with valid API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'x-api-key': validApiKey,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      // Should not be 401 (may be 400 due to invalid request, but not auth error)
      expect(response.statusCode).not.toBe(401);
    }, { timeout: 30000 }); // Increase timeout since this actually calls Gemini API

    it('should preserve case sensitivity in API key comparison', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'x-api-key': validApiKey.toUpperCase(), // Different case
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('should preserve whitespace in API key (no trimming)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'x-api-key': ` ${validApiKey} `, // Added whitespace
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });
  });

  describe('Invalid authentication', () => {
    it('should reject request with invalid API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'x-api-key': 'invalid-key',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('should reject request with missing x-api-key header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('should reject request with empty x-api-key value', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'x-api-key': '',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    // Note: Fastify's inject() doesn't support multiple header values the same way real HTTP does
    // The array handling in auth plugin is defensive programming for edge cases
    it.skip('should handle multiple x-api-key headers (uses first)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'x-api-key': [validApiKey, 'invalid-key'],
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      // Should not be 401 (first header is valid)
      expect(response.statusCode).not.toBe(401);
    }, { timeout: 30000 });
  });

  describe('Opt-out configuration', () => {
    it('should allow health endpoint without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
        // No x-api-key header
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('Protected endpoints', () => {
    it('should protect /api/analyze endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Error response format', () => {
    it('should return consistent error format for all auth failures', async () => {
      const scenarios = [
        { headers: { 'x-api-key': 'wrong-key' } },
        { headers: {} }, // missing key
        { headers: { 'x-api-key': '' } }, // empty key
      ];

      for (const scenario of scenarios) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/analyze',
          headers: {
            ...scenario.headers,
            'content-type': 'application/json',
          },
          payload: JSON.stringify({ phrase: 'test', action: 'translate' }),
        });

        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.body);
        expect(body).toEqual({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }
    });
  });
});
