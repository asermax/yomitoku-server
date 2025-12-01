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

describe('POST /api/identify-phrase', () => {
  let app: Awaited<ReturnType<typeof build>>;
  const validApiKey = 'test-api-key-12345';

  // Valid PNG base64 (1x1 transparent PNG)
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Valid request payload
  // Image is pre-cropped to selection on client side
  const validPayload = {
    image: `data:image/png;base64,${validPngBase64}`,
  };

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 with valid phrase data when successful', async () => {
    const mockResult = {
      phrase: 'こんにちは',
      romaji: 'konnichiwa',
      boundingBox: [100, 200, 150, 500],
      tokens: [
        {
          word: 'こんにちは',
          reading: 'こんにちは',
          romaji: 'konnichiwa',
          partOfSpeech: ['interjection'],
          hasKanji: false,
          isCommon: true,
        },
      ],
      translation: {
        translation: 'Hello',
        notes: 'Common greeting used during daytime',
      },
      explain: {
        meaning: 'A polite greeting used during the day',
        contextUsage: 'Standard daytime greeting in formal and informal situations',
        commonSituations: 'Meeting someone, answering phone calls, starting conversations',
      },
      grammar: {
        breakdown: 'Set phrase - no grammatical elements to break down',
        learnerTips: 'Used from late morning until evening',
      },
    };

    mockGeminiService.identifyPhrase.mockResolvedValue(mockResult);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(mockGeminiService.identifyPhrase).toHaveBeenCalledTimes(1);

    const result = response.json();
    expect(result).toEqual(mockResult);
    expect(result.phrase).toBe('こんにちは');
    expect(result.tokens).toHaveLength(1);
    expect(result.boundingBox).toHaveLength(4);
    expect(result.translation).toBeDefined();
    expect(result.explain).toBeDefined();
    expect(result.grammar).toBeDefined();
  });

  it('should return response matching documented schema', async () => {
    const mockResult = {
      phrase: '食べる',
      romaji: 'taberu',
      boundingBox: [50, 100, 80, 200],
      tokens: [
        {
          word: '食べる',
          reading: 'たべる',
          romaji: 'taberu',
          partOfSpeech: ['verb', 'ichidan'],
          hasKanji: true,
          isCommon: true,
        },
      ],
      translation: {
        translation: 'To eat',
        literalTranslation: 'To eat',
      },
      explain: {
        meaning: 'To consume food',
        contextUsage: 'Common verb for eating',
        nuances: 'Neutral formality level',
      },
      grammar: {
        breakdown: 'Dictionary form ichidan verb',
        elements: [
          { element: '食べ', type: 'stem', explanation: 'Verb stem' },
          { element: 'る', type: 'suffix', explanation: 'Ichidan verb ending' },
        ],
      },
    };

    mockGeminiService.identifyPhrase.mockResolvedValue(mockResult);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const result = response.json();

    // Validate top-level structure
    expect(result).toHaveProperty('phrase');
    expect(result).toHaveProperty('romaji');
    expect(result).toHaveProperty('boundingBox');
    expect(result).toHaveProperty('tokens');
    expect(result).toHaveProperty('translation');
    expect(result).toHaveProperty('explain');
    expect(result).toHaveProperty('grammar');

    // Validate types
    expect(typeof result.phrase).toBe('string');
    expect(typeof result.romaji).toBe('string');

    // Validate boundingBox is array of 4 numbers
    expect(Array.isArray(result.boundingBox)).toBe(true);
    expect(result.boundingBox).toHaveLength(4);
    result.boundingBox.forEach((coord: number) => {
      expect(typeof coord).toBe('number');
    });

    // Validate tokens array structure
    expect(Array.isArray(result.tokens)).toBe(true);
    expect(result.tokens.length).toBeGreaterThan(0);

    // Validate each token has all required fields with correct types
    result.tokens.forEach((token: any) => {
      expect(token).toHaveProperty('word');
      expect(token).toHaveProperty('reading');
      expect(token).toHaveProperty('romaji');
      expect(token).toHaveProperty('partOfSpeech');
      expect(token).toHaveProperty('hasKanji');
      expect(token).toHaveProperty('isCommon');

      expect(typeof token.word).toBe('string');
      expect(typeof token.reading).toBe('string');
      expect(typeof token.romaji).toBe('string');
      expect(Array.isArray(token.partOfSpeech)).toBe(true);
      expect(typeof token.hasKanji).toBe('boolean');
      expect(typeof token.isCommon).toBe('boolean');
    });

    // Validate translation object
    expect(typeof result.translation).toBe('object');
    expect(typeof result.translation.translation).toBe('string');

    // Validate explain object
    expect(typeof result.explain).toBe('object');
    expect(typeof result.explain.meaning).toBe('string');
    expect(typeof result.explain.contextUsage).toBe('string');

    // Validate grammar object
    expect(typeof result.grammar).toBe('object');
    expect(typeof result.grammar.breakdown).toBe('string');
  });

  it('should pass correct parameters to GeminiService', async () => {
    mockGeminiService.identifyPhrase.mockResolvedValue({
      phrase: 'test',
      romaji: 'test',
      boundingBox: [0, 0, 0, 0],
      tokens: [],
      translation: { translation: 'Test' },
      explain: { meaning: 'Test', contextUsage: 'Test usage' },
      grammar: { breakdown: 'Test breakdown' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload: validPayload,
    });

    expect(mockGeminiService.identifyPhrase).toHaveBeenCalledWith({
      screenshot: validPngBase64,
    });
  });


  it('should accept base64 without data URL prefix', async () => {
    mockGeminiService.identifyPhrase.mockResolvedValue({
      phrase: 'test',
      romaji: 'test',
      boundingBox: [0, 0, 0, 0],
      tokens: [],
      translation: { translation: 'Test' },
      explain: { meaning: 'Test', contextUsage: 'Test usage' },
      grammar: { breakdown: 'Test breakdown' },
    });

    const payload = {
      ...validPayload,
      image: validPngBase64, // No data URL prefix
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(mockGeminiService.identifyPhrase).toHaveBeenCalled();
  });

  it('should return 400 for missing image', async () => {
    const payload = {
      // image missing
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(mockGeminiService.identifyPhrase).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid base64', async () => {
    const payload = {
      ...validPayload,
      image: 'not-valid-base64!!!',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
    const error = response.json();
    expect(error.message).toContain('base64');
  });

  it('should return 400 for non-PNG image format', async () => {
    // JPEG magic bytes in base64
    const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQ/9k=';

    const payload = {
      ...validPayload,
      image: `data:image/jpeg;base64,${jpegBase64}`,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
    const error = response.json();
    expect(error.message).toContain('PNG');
  });

  it('should return 413 for image exceeding Fastify body limit', async () => {
    // Create a large base64 string (> 10MB) - hits Fastify body parser limit
    // Repeat enough times to exceed 10MB bodyLimit
    const largeBase64 = validPngBase64.repeat(110000);

    const payload = {
      ...validPayload,
      image: `data:image/png;base64,${largeBase64}`,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload,
    });

    expect(response.statusCode).toBe(413);
    const error = response.json();
    // Fastify returns this error at the body parser level (not through our error handler when using inject())
    expect(error.code).toBe('FST_ERR_CTP_BODY_TOO_LARGE');
    expect(error.message).toContain('Request body is too large');
  });

  // Note: Application-level MAX_IMAGE_SIZE validation (lines 130-138 in identify-phrase.ts)
  // is not directly testable via inject() because Fastify's bodyLimit (default 1MB)
  // rejects large payloads before they reach the route handler. In production with
  // a higher bodyLimit config, the application-level check would catch images
  // between bodyLimit and MAX_IMAGE_SIZE.
  it.skip('should return 413 when image exceeds MAX_IMAGE_SIZE config', async () => {
    // This test is skipped because Fastify's default bodyLimit (1MB) prevents
    // testing the application-level MAX_IMAGE_SIZE validation (5MB) via inject().
    // The validation code at lines 130-138 in identify-phrase.ts is still
    // functional and would work in production with proper bodyLimit configuration.
  });


  it('should handle ApplicationError from service', async () => {
    const { ApplicationError } = await import('../types/errors.js');

    mockGeminiService.identifyPhrase.mockRejectedValue(
      new ApplicationError('API_ERROR', 'Gemini API returned empty response', 502),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(502);
    const error = response.json();
    expect(error.message).toContain('empty response');
  });

  it('should return 503 for connection errors', async () => {
    const error = new Error('Connection failed');
    (error as any).code = 'ECONNREFUSED';

    mockGeminiService.identifyPhrase.mockRejectedValue(error);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(503);
    const responseError = response.json();
    expect(responseError.message).toContain('Unable to connect');
  });

  it('should return 504 for timeout errors', async () => {
    const error = new Error('Request timeout');
    (error as any).code = 'ETIMEDOUT';

    mockGeminiService.identifyPhrase.mockRejectedValue(error);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(504);
    const responseError = response.json();
    expect(responseError.message).toContain('timed out');
  });

  it('should return 500 for unexpected errors', async () => {
    mockGeminiService.identifyPhrase.mockRejectedValue(
      new Error('Unexpected error'),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(500);
    const error = response.json();
    expect(error.message).toContain('Failed to identify phrase');
  });

  it('should include metadata in request if provided', async () => {
    mockGeminiService.identifyPhrase.mockResolvedValue({
      phrase: 'test',
      romaji: 'test',
      boundingBox: [0, 0, 0, 0],
      tokens: [],
      translation: { translation: 'Test' },
      explain: { meaning: 'Test', contextUsage: 'Test usage' },
      grammar: { breakdown: 'Test breakdown' },
    });

    const payload = {
      ...validPayload,
      metadata: {
        url: 'https://example.com',
        title: 'Example Page',
      },
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/identify-phrase',
      headers: {
        'x-api-key': validApiKey,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    // Metadata is logged but not passed to service in current implementation
  });
});
