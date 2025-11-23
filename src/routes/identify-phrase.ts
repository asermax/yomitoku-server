import { FastifyPluginAsync } from 'fastify';
import { GeminiService } from '../services/gemini.js';
import { ApplicationError } from '../types/errors.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export const identifyPhraseRoutes: FastifyPluginAsync = async (app) => {
  // Initialize GeminiService lazily inside route handler
  let geminiService: GeminiService | null = null;

  const getGeminiService = () => {
    if (!geminiService) {
      geminiService = new GeminiService(app.config.GEMINI_API_KEY, app.log);
    }
    return geminiService;
  };

  app.post('/identify-phrase', {
    schema: {
      body: {
        type: 'object',
        required: ['image', 'selection'],
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded PNG screenshot',
          },
          selection: {
            type: 'object',
            required: ['x', 'y', 'width', 'height'],
            properties: {
              x: { type: 'number', minimum: 0 },
              y: { type: 'number', minimum: 0 },
              width: { type: 'number', minimum: 1 },
              height: { type: 'number', minimum: 1 },
              devicePixelRatio: { type: 'number', minimum: 0.1 },
            },
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
    const { image, selection, metadata } = request.body as {
      image: string;
      selection: {
        x: number;
        y: number;
        width: number;
        height: number;
        devicePixelRatio?: number;
      };
      metadata?: {
        url?: string;
        title?: string;
      };
    };

    // Validate base64 image format
    if (!image.startsWith('data:image/png;base64,') && !image.match(/^[A-Za-z0-9+/=]+$/)) {
      throw new ApplicationError(
        'INVALID_REQUEST',
        'Image must be base64-encoded PNG',
        400,
      );
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = image.startsWith('data:')
      ? image.split(',')[1]
      : image;

    // Validate image size
    const imageSize = Buffer.from(base64Data, 'base64').length;

    if (imageSize > MAX_IMAGE_SIZE) {
      throw new ApplicationError(
        'IMAGE_TOO_LARGE',
        `Image size (${(imageSize / 1024 / 1024).toFixed(2)}MB) exceeds limit of 5MB`,
        413,
      );
    }

    // Calculate image dimensions from selection
    // The selection coordinates are in CSS pixels, we need actual image dimensions
    const devicePixelRatio = selection.devicePixelRatio || 1;
    const imageWidth = (selection.x + selection.width) * devicePixelRatio;
    const imageHeight = (selection.y + selection.height) * devicePixelRatio;

    try {
      const result = await getGeminiService().identifyPhrase({
        screenshot: base64Data,
        selectionRegion: {
          x: selection.x * devicePixelRatio,
          y: selection.y * devicePixelRatio,
          width: selection.width * devicePixelRatio,
          height: selection.height * devicePixelRatio,
        },
        imageWidth: Math.ceil(imageWidth),
        imageHeight: Math.ceil(imageHeight),
      });

      return result;
    }
    catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      app.log.error({ error }, 'Unexpected error in identify-phrase');

      throw new ApplicationError(
        'API_ERROR',
        'Failed to identify phrase from screenshot',
        500,
      );
    }
  });
};
