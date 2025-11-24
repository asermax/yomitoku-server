import { vi } from 'vitest';
import { build } from '../src/app.js';

/**
 * Mock GeminiService for integration tests
 * Use this to avoid real API calls while testing full request/response flow
 */
export const mockGeminiService = {
  identifyPhrase: vi.fn(),
  analyzeContent: vi.fn(),
};

// Mock the GeminiService module before app initialization
vi.mock('../src/services/gemini.js', () => ({
  GeminiService: vi.fn(() => mockGeminiService),
}));

/**
 * Build a test Fastify app with mocked external dependencies
 * This creates a real app instance for integration testing
 */
export const buildTestApp = async () => {
  const app = await build();
  await app.ready();
  return app;
};

/**
 * Valid PNG base64 (1x1 transparent PNG) for testing image uploads
 */
export const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Valid JPEG base64 (for negative testing)
 */
export const validJpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQ/9k=';

/**
 * Create a valid identify-phrase request payload
 * Image is pre-cropped to selection on client side
 */
export const createIdentifyPhrasePayload = (overrides?: any) => ({
  image: `data:image/png;base64,${validPngBase64}`,
  selection: {
    x: 100,
    y: 200,
    width: 300,
    height: 100,
    devicePixelRatio: 2,
  },
  ...overrides,
});

/**
 * Create a valid analyze request payload
 */
export const createAnalyzePayload = (overrides?: any) => ({
  phrase: 'こんにちは',
  action: 'translate' as const,
  ...overrides,
});
