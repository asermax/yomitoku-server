import { FastifyPluginAsync } from 'fastify';
import { GeminiService } from '../services/gemini.js';
import { ApplicationError } from '../types/errors.js';
import type { AnalyzeRequest } from '../types/api.js';

export const analyzeRoutes: FastifyPluginAsync = async (app) => {
  // Initialize GeminiService lazily inside route handler
  let geminiService: GeminiService | null = null;

  const getGeminiService = () => {
    if (!geminiService) {
      geminiService = new GeminiService(app.config.GEMINI_API_KEY, app.log);
    }
    return geminiService;
  };

  app.post('/analyze', {
    config: {
      rateLimit: {
        max: 50,
        timeWindow: '1 hour',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['phrase', 'action'],
        properties: {
          phrase: {
            type: 'string',
            minLength: 1,
            maxLength: 1000,
            description: 'Japanese phrase to analyze (max 1000 characters)',
          },
          action: {
            type: 'string',
            enum: ['translate', 'explain', 'grammar', 'vocabulary', 'conjugation'],
            description: 'Analysis action type',
          },
          context: {
            type: 'object',
            properties: {
              fullPhrase: {
                type: 'string',
                description: 'Full phrase if analyzing a subset',
              },
              image: {
                type: 'string',
                description: 'Base64-encoded PNG screenshot for visual context',
              },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Analysis result (structure depends on action type)',
          additionalProperties: true,
        },
      },
      // NOTE: MVP uses flexible response schema allowing any properties.
      // Each action type (translate, explain, grammar, vocabulary, conjugation) returns different structured data
      // as defined by getAnalysisSchema() in gemini.ts.
      // Future: Consider action-specific response schemas for API documentation
      // as defined in design/server-proxy.md lines 186-223
    },
  }, async (request, reply) => {
    const { phrase, action, context } = request.body as AnalyzeRequest;

    // Validate phrase is not empty after trimming
    if (!phrase.trim()) {
      throw new ApplicationError(
        'INVALID_REQUEST',
        'Phrase cannot be empty',
        400,
      );
    }

    // Validate fullPhrase context if provided
    if (context?.fullPhrase) {
      const trimmedFullPhrase = context.fullPhrase.trim();
      const trimmedPhrase = phrase.trim();

      if (trimmedFullPhrase === trimmedPhrase) {
        throw new ApplicationError(
          'INVALID_REQUEST',
          'fullPhrase must be different from phrase',
          400,
        );
      }

      if (!trimmedFullPhrase.includes(trimmedPhrase)) {
        app.log.warn({
          phrase: trimmedPhrase,
          fullPhrase: trimmedFullPhrase,
        }, 'fullPhrase does not contain phrase - unusual but allowed');
      }
    }

    // If image is provided, validate it
    let imageData: string | undefined;
    if (context?.image) {
      // Extract base64 data (remove data URL prefix if present)
      const base64Data = context.image.startsWith('data:')
        ? context.image.split(',')[1]
        : context.image;

      // Validate base64 format
      if (!base64Data || !/^[A-Za-z0-9+/]+=*$/.test(base64Data)) {
        throw new ApplicationError(
          'INVALID_REQUEST',
          'Image must be valid base64-encoded data',
          400,
        );
      }

      // Decode and validate image
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(base64Data, 'base64');
      }
      catch (error) {
        throw new ApplicationError(
          'INVALID_REQUEST',
          'Invalid base64 encoding',
          400,
        );
      }

      // Validate it's PNG format by checking magic bytes
      const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      if (imageBuffer.length < 4 || !imageBuffer.subarray(0, 4).equals(pngMagicBytes)) {
        throw new ApplicationError(
          'INVALID_REQUEST',
          'Image must be PNG format',
          400,
        );
      }

      // Validate image size
      const imageSize = imageBuffer.length;
      const maxImageSize = app.config?.MAX_IMAGE_SIZE ?? 5242880; // Default 5MB

      if (imageSize > maxImageSize) {
        throw new ApplicationError(
          'IMAGE_TOO_LARGE',
          `Image size (${(imageSize / 1024 / 1024).toFixed(2)}MB) exceeds limit of ${(maxImageSize / 1024 / 1024).toFixed(0)}MB`,
          413,
        );
      }

      imageData = base64Data;
    }

    // Generate cache key (based on phrase + action + fullPhrase, NOT image)
    const cacheKey = app.analyzeCache.generateKey(phrase, action, context?.fullPhrase);

    // Check cache first
    const cachedResult = app.analyzeCache.get(cacheKey);
    if (cachedResult) {
      app.log.debug({ cacheKey, action }, 'Cache hit for analyze request');
      return cachedResult;
    }

    app.log.debug({ cacheKey, action }, 'Cache miss for analyze request');

    try {
      const result = await getGeminiService().analyzeContent({
        phrase,
        action,
        context: {
          fullPhrase: context?.fullPhrase,
          image: imageData,
        },
      });

      // Store in cache on success
      app.analyzeCache.set(cacheKey, result);

      return result;
    }
    catch (error) {
      // Re-throw ApplicationError as-is
      if (error instanceof ApplicationError) {
        throw error;
      }

      // Log with context for debugging
      app.log.error({
        error,
        phrase,
        action,
        hasImage: !!imageData,
      }, 'Unexpected error in analyze');

      // Categorize errors for better user feedback
      const errorCode = (error as any)?.code;
      const errorMessage = (error as any)?.message || '';

      // Gemini API authentication errors
      if (errorCode === 401 || errorMessage.includes('API key') || errorMessage.includes('INVALID_ARGUMENT')) {
        throw new ApplicationError(
          'API_UNAVAILABLE',
          'Service temporarily unavailable. Please contact support.',
          503,
        );
      }

      // Gemini API rate limit or quota errors
      if (errorCode === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        throw new ApplicationError(
          'API_QUOTA_EXCEEDED',
          'Service temporarily unavailable due to high demand. Please try again later.',
          503,
        );
      }

      // Gemini API content filtering errors
      if (errorMessage.includes('content') && errorMessage.includes('filter')) {
        throw new ApplicationError(
          'CONTENT_FILTERED',
          'Unable to process this content. Please try different text.',
          400,
        );
      }

      // Network connectivity errors
      if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
        throw new ApplicationError(
          'API_UNAVAILABLE',
          'Unable to connect to analysis service. Please try again.',
          503,
        );
      }

      // Timeout errors
      if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
        throw new ApplicationError(
          'TIMEOUT',
          'Request timed out. Please try again.',
          504,
        );
      }

      // Generic API error - don't expose internal details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      throw new ApplicationError(
        'API_ERROR',
        'Failed to analyze phrase',
        500,
        isDevelopment ? { originalError: errorMessage } : undefined,
      );
    }
  });
};
