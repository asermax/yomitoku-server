import { FastifyPluginAsync } from 'fastify';
import { GeminiService } from '../services/gemini.js';
import { ApplicationError } from '../types/errors.js';
import type { IdentifyPhrasesRequest, PhraseData } from '../types/api.js';

export const identifyPhrasesRoutes: FastifyPluginAsync = async (app) => {
  // Initialize GeminiService lazily inside route handler
  let geminiService: GeminiService | null = null;

  const getGeminiService = () => {
    if (!geminiService) {
      geminiService = new GeminiService(app.config.GEMINI_API_KEY, app.log);
    }
    return geminiService;
  };

  app.post('/identify-phrases', {
    config: {
      rateLimit: {
        max: 50,
        timeWindow: '1 hour',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['image'],
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded PNG screenshot (full viewport)',
          },
          maxPhrases: {
            type: 'number',
            description: 'Maximum number of phrases to identify (default: 25, max: 100)',
            minimum: 1,
            maximum: 100,
          },
          metadata: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            phrases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  phrase: { type: 'string' },
                  romaji: { type: 'string' },
                  boundingBox: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 4,
                    maxItems: 4,
                  },
                  tokens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        word: { type: 'string' },
                        reading: { type: 'string' },
                        romaji: { type: 'string' },
                        partOfSpeech: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                        hasKanji: { type: 'boolean' },
                        isCommon: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { image, maxPhrases, metadata } = request.body as IdentifyPhrasesRequest;

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = image.startsWith('data:')
      ? image.split(',')[1]
      : image;

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

    try {
      const phrases = await getGeminiService().identifyPhrases({
        screenshot: base64Data,
        maxPhrases,
      }) as PhraseData[];

      return { phrases };
    }
    catch (error) {
      // Re-throw ApplicationError as-is
      if (error instanceof ApplicationError) {
        throw error;
      }

      // Log with context for debugging
      app.log.error({
        error,
        imageSize,
        maxPhrases,
        metadata,
      }, 'Unexpected error in identify-phrases');

      // Categorize errors for better user feedback
      const errorCode = (error as any)?.code;
      const errorMessage = (error as any)?.message || '';

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
          'Request timed out. Please try again with a smaller image or fewer phrases.',
          504,
        );
      }

      // Generic API error with some context
      throw new ApplicationError(
        'API_ERROR',
        'Failed to identify phrases from screenshot',
        500,
        { originalError: errorMessage },
      );
    }
  });
};
