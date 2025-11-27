import { FastifyPluginAsync } from 'fastify';
import { GeminiService } from '../services/gemini.js';
import { ApplicationError } from '../types/errors.js';
import type { IdentifyPhraseRequest } from '../types/api.js';
import { validateImage } from '../utils/image-validation.js';
import { createServiceFactory } from '../utils/service-factory.js';
import { categorizeApiError } from '../utils/error-categorization.js';

export const identifyPhraseRoutes: FastifyPluginAsync = async (app) => {
  const getGeminiService = createServiceFactory(
    () => new GeminiService(app.config.GEMINI_API_KEY, app.log),
  );

  app.post('/identify-phrase', {
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
            description: 'Base64-encoded PNG screenshot (cropped to selection)',
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
  }, async (request, reply) => {
    const { image, metadata } = request.body as IdentifyPhraseRequest;

    const { base64Data, size: imageSize } = validateImage(
      image,
      { maxSize: app.config?.MAX_IMAGE_SIZE },
    );

    try {
      const result = await getGeminiService().identifyPhrase({
        screenshot: base64Data,
      });

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
        imageSize,
        metadata,
      }, 'Unexpected error in identify-phrase');

      throw categorizeApiError(error, {
        context: 'identify phrase',
        isDevelopment: process.env.NODE_ENV === 'development',
      });
    }
  });
};
