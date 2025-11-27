import { FastifyPluginAsync } from 'fastify';
import { GeminiService } from '../services/gemini.js';
import { ApplicationError } from '../types/errors.js';
import type { IdentifyPhrasesRequest, PhraseData } from '../types/api.js';
import { validateImage } from '../utils/image-validation.js';
import { createServiceFactory } from '../utils/service-factory.js';
import { categorizeApiError } from '../utils/error-categorization.js';

export const identifyPhrasesRoutes: FastifyPluginAsync = async (app) => {
  const getGeminiService = createServiceFactory(
    () => new GeminiService(app.config.GEMINI_API_KEY, app.log),
  );

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

    const { base64Data, size: imageSize } = validateImage(
      image,
      { maxSize: app.config?.MAX_IMAGE_SIZE },
    );

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

      throw categorizeApiError(error, {
        context: 'identify phrases',
        isDevelopment: process.env.NODE_ENV === 'development',
      });
    }
  });
};
