import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { build } from '../app.js';

// Mock GeminiService BEFORE importing app
const { mockGeminiService } = vi.hoisted(() => {
  return {
    mockGeminiService: {
      identifyPhrase: vi.fn(),
      analyzeContent: vi.fn(),
    },
  };
});

vi.mock('../services/gemini.js', () => ({
  GeminiService: vi.fn(() => mockGeminiService),
}));

describe('POST /api/analyze', () => {
  let app: Awaited<ReturnType<typeof build>>;

  // Valid PNG base64 (1x1 transparent PNG)
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  beforeAll(async () => {
    app = await build();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('translate action', () => {
    it('should return 200 with translation data', async () => {
      const mockResult = {
        translation: 'Hello',
        literalTranslation: 'Good day',
        notes: 'Common greeting used during daytime',
      };

      mockGeminiService.analyzeContent.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(1);

      const result = response.json();
      expect(result).toHaveProperty('translation');
      expect(result.translation).toBe('Hello');
    });

    it('should pass phrase and action to service', async () => {
      mockGeminiService.analyzeContent.mockResolvedValue({
        translation: 'test',
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'ありがとう',
          action: 'translate',
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledWith({
        phrase: 'ありがとう',
        action: 'translate',
        context: {
          fullPhrase: undefined,
          image: undefined,
        },
      });
    });
  });

  describe('explain action', () => {
    it('should return 200 with explanation data', async () => {
      const mockResult = {
        meaning: 'Expression of gratitude',
        contextUsage: 'Used to thank someone for their help or kindness',
        commonSituations: 'After receiving a gift, after someone helps you',
        nuances: 'More formal than ありがと',
      };

      mockGeminiService.analyzeContent.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'ありがとうございます',
          action: 'explain',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('meaning');
      expect(result).toHaveProperty('contextUsage');
    });
  });

  describe('grammar action', () => {
    it('should return 200 with grammar breakdown', async () => {
      const mockResult = {
        breakdown: 'This is a te-form verb + います construction',
        elements: [
          {
            element: '食べ',
            type: 'verb stem',
            explanation: 'Stem of 食べる (to eat)',
          },
          {
            element: 'て',
            type: 'conjunction particle',
            explanation: 'Connects actions in sequence',
          },
          {
            element: 'います',
            type: 'auxiliary verb',
            explanation: 'Indicates ongoing action or state',
          },
        ],
        variations: 'Can also use 食べている in casual speech',
        learnerTips: 'Remember to use te-form, not dictionary form',
      };

      mockGeminiService.analyzeContent.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: '食べています',
          action: 'grammar',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('elements');
      expect(Array.isArray(result.elements)).toBe(true);
    });
  });

  describe('vocabulary action', () => {
    it('should return 200 with vocabulary data', async () => {
      const mockResult = {
        reading: 'たべる',
        romaji: 'taberu',
        kanjiBreakdown: '食 (food, eat) + べる (auxiliary)',
        wordType: 'ichidan verb',
        meanings: ['to eat', 'to consume'],
        collocations: ['ご飯を食べる', 'パンを食べる'],
        examples: [
          {
            japanese: '朝ご飯を食べます',
            english: 'I eat breakfast',
          },
        ],
        jlptLevel: 'N5',
      };

      mockGeminiService.analyzeContent.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: '食べる',
          action: 'vocabulary',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('reading');
      expect(result).toHaveProperty('meanings');
      expect(Array.isArray(result.meanings)).toBe(true);
    });
  });

  describe('context handling', () => {
    beforeEach(() => {
      app.analyzeCache.clear();
    });

    it('should accept and pass fullPhrase context', async () => {
      mockGeminiService.analyzeContent.mockResolvedValue({
        translation: 'test',
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: '食べる',
          action: 'translate',
          context: {
            fullPhrase: 'ご飯を食べる',
          },
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledWith({
        phrase: '食べる',
        action: 'translate',
        context: {
          fullPhrase: 'ご飯を食べる',
          image: undefined,
        },
      });
    });

    it('should accept and pass image context', async () => {
      mockGeminiService.analyzeContent.mockResolvedValue({
        translation: 'test',
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: '食べる',
          action: 'translate',
          context: {
            image: `data:image/png;base64,${validPngBase64}`,
          },
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledWith({
        phrase: '食べる',
        action: 'translate',
        context: {
          fullPhrase: undefined,
          image: validPngBase64,
        },
      });
    });

    it('should accept image without data URL prefix', async () => {
      mockGeminiService.analyzeContent.mockResolvedValue({
        translation: 'test',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: '食べる',
          action: 'translate',
          context: {
            image: validPngBase64,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGeminiService.analyzeContent).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should return 400 for missing phrase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockGeminiService.analyzeContent).not.toHaveBeenCalled();
    });

    it('should return 400 for missing action', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockGeminiService.analyzeContent).not.toHaveBeenCalled();
    });

    it('should return 400 for empty phrase after trimming', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: '   ',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(400);
      const error = response.json();
      expect(error.message).toContain('empty');
    });

    it('should return 400 for phrase exceeding max length', async () => {
      const longPhrase = 'あ'.repeat(1001);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: longPhrase,
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid action type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'invalid_action',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when fullPhrase equals phrase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
          context: {
            fullPhrase: 'こんにちは',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const error = response.json();
      expect(error.message).toContain('fullPhrase must be different');
    });

    it('should return 400 for invalid base64 image', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
          context: {
            image: 'not-valid-base64!!!',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const error = response.json();
      expect(error.message).toContain('base64');
    });

    it('should return 400 for non-PNG image format', async () => {
      // JPEG magic bytes in base64
      const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQ/9k=';

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
          context: {
            image: `data:image/jpeg;base64,${jpegBase64}`,
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const error = response.json();
      expect(error.message).toContain('PNG');
    });

    it('should return 413 for image exceeding size limit', async () => {
      // Repeat enough times to exceed 10MB bodyLimit
      const largeBase64 = validPngBase64.repeat(110000);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
          context: {
            image: `data:image/png;base64,${largeBase64}`,
          },
        },
      });

      expect(response.statusCode).toBe(413);
      const error = response.json();
      // Fastify returns this error at the body parser level (not through our error handler when using inject())
      expect(error.code).toBe('FST_ERR_CTP_BODY_TOO_LARGE');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      app.analyzeCache.clear();
    });

    it('should handle ApplicationError from service', async () => {
      const { ApplicationError } = await import('../types/errors.js');

      mockGeminiService.analyzeContent.mockRejectedValue(
        new ApplicationError('API_ERROR', 'Gemini API returned empty response', 502),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(502);
      const error = response.json();
      expect(error.message).toContain('empty response');
    });

    it('should return 503 for API authentication errors', async () => {
      const error = new Error('INVALID_ARGUMENT: API key invalid');
      (error as any).code = 401;

      mockGeminiService.analyzeContent.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(503);
      const responseError = response.json();
      expect(responseError.message).toContain('temporarily unavailable');
      // Should not expose API key error details
      expect(responseError.message).not.toContain('API key');
    });

    it('should return 503 for rate limit errors', async () => {
      const error = new Error('Quota exceeded');
      (error as any).code = 429;

      mockGeminiService.analyzeContent.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(503);
      const responseError = response.json();
      expect(responseError.message).toContain('high demand');
    });

    it('should return 400 for content filtering errors', async () => {
      const error = new Error('content blocked by filter');

      mockGeminiService.analyzeContent.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'test phrase',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(400);
      const responseError = response.json();
      expect(responseError.message).toContain('Unable to process');
    });

    it('should return 503 for connection errors', async () => {
      const error = new Error('Connection failed');
      (error as any).code = 'ECONNREFUSED';

      mockGeminiService.analyzeContent.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(503);
      const responseError = response.json();
      expect(responseError.message).toContain('Unable to connect');
    });

    it('should return 504 for timeout errors', async () => {
      const error = new Error('Request timeout');
      (error as any).code = 'ETIMEDOUT';

      mockGeminiService.analyzeContent.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(504);
      const responseError = response.json();
      expect(responseError.message).toContain('timed out');
    });

    it('should return 500 for unexpected errors', async () => {
      mockGeminiService.analyzeContent.mockRejectedValue(
        new Error('Unexpected error'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response.statusCode).toBe(500);
      const error = response.json();
      expect(error.message).toContain('Failed to analyze');
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      app.analyzeCache.clear();
    });

    it('should cache successful analyze results', async () => {
      const mockResult = {
        translation: 'Hello',
        literalTranslation: 'Good day',
      };

      mockGeminiService.analyzeContent.mockResolvedValue(mockResult);

      const response1 = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response1.statusCode).toBe(200);
      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(1);

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(response2.statusCode).toBe(200);
      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(1);
      expect(response2.json()).toEqual(mockResult);
    });

    it('should use different cache keys for different phrases', async () => {
      mockGeminiService.analyzeContent.mockResolvedValueOnce({ translation: 'Hello' });
      mockGeminiService.analyzeContent.mockResolvedValueOnce({ translation: 'Goodbye' });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'さようなら',
          action: 'translate',
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(2);
    });

    it('should use different cache keys for different action types', async () => {
      mockGeminiService.analyzeContent.mockResolvedValueOnce({ translation: 'Hello' });
      mockGeminiService.analyzeContent.mockResolvedValueOnce({ meaning: 'Greeting' });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'explain',
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(2);
    });

    it('should include fullPhrase in cache key', async () => {
      mockGeminiService.analyzeContent.mockResolvedValueOnce({ translation: 'Hello' });
      mockGeminiService.analyzeContent.mockResolvedValueOnce({ translation: 'Hello (with context)' });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
          context: {
            fullPhrase: 'こんにちは、世界',
          },
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(2);
    });

    it('should NOT include image in cache key', async () => {
      const mockResult = { translation: 'Hello' };
      mockGeminiService.analyzeContent.mockResolvedValue(mockResult);

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
          context: {
            image: `data:image/png;base64,${validPngBase64}`,
          },
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(1);
    });

    it('should NOT cache failed requests', async () => {
      const { ApplicationError } = await import('../types/errors.js');

      mockGeminiService.analyzeContent.mockRejectedValue(
        new ApplicationError('API_ERROR', 'Test error', 500),
      );

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      expect(mockGeminiService.analyzeContent).toHaveBeenCalledTimes(2);
    });

    it('should track cache statistics', async () => {
      mockGeminiService.analyzeContent.mockResolvedValue({ translation: 'Hello' });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      const stats = app.analyzeCache.getStats();

      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('GET /api/cache/stats', () => {
    beforeEach(() => {
      app.analyzeCache.clear();
    });

    it('should return cache statistics', async () => {
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

    it('should show correct statistics after cache usage', async () => {
      mockGeminiService.analyzeContent.mockResolvedValue({ translation: 'Hello' });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/analyze',
        payload: {
          phrase: 'こんにちは',
          action: 'translate',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/stats',
      });

      const stats = response.json();

      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });
});
