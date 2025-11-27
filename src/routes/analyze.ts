import { FastifyPluginAsync } from 'fastify';
import { GeminiService } from '../services/gemini.js';
import { ApplicationError } from '../types/errors.js';
import type { AnalyzeRequest } from '../types/api.js';
import { validateImage } from '../utils/image-validation.js';
import { createServiceFactory } from '../utils/service-factory.js';
import { categorizeApiError } from '../utils/error-categorization.js';

export const analyzeRoutes: FastifyPluginAsync = async (app) => {
  const getGeminiService = createServiceFactory(
    () => new GeminiService(app.config.GEMINI_API_KEY, app.log),
  );

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
      const { base64Data } = validateImage(
        context.image,
        { maxSize: app.config?.MAX_IMAGE_SIZE },
      );
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

      throw categorizeApiError(error, {
        context: 'analyze',
        isDevelopment: process.env.NODE_ENV === 'development',
      });
    }
  });
};
