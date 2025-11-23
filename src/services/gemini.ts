import { GoogleGenAI } from '@google/genai';
import { FastifyInstance } from 'fastify';
import { callWithRetry } from './retry.js';
import { ApplicationError } from '../types/errors.js';

// Gemini 3.0 Pro pricing (as of November 2024)
const GEMINI_PRICING = {
  INPUT_PER_MILLION: 2.00,  // USD per 1M input tokens
  OUTPUT_PER_MILLION: 12.00, // USD per 1M output tokens
  LAST_UPDATED: '2024-11-23',
} as const;

export class GeminiService {
  private ai: GoogleGenAI;
  private logger: FastifyInstance['log'];

  constructor(apiKey: string, logger: FastifyInstance['log']) {
    this.ai = new GoogleGenAI({ apiKey });
    this.logger = logger;
  }

  async identifyPhrase(params: {
    screenshot: string;
    selectionRegion: { x: number; y: number; width: number; height: number };
    imageWidth: number;
    imageHeight: number;
  }) {
    const prompt = this.buildIdentifyPrompt(params);
    const schema = this.getPhraseSchema();

    return callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{
          parts: [
            {
              inlineData: {
                data: params.screenshot,
                mimeType: 'image/png',
              },
            },
            { text: prompt },
          ],
        }],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: schema,
          temperature: 0.2,
          media_resolution: 'media_resolution_high',
        },
      });

      this.logUsage('identify-phrase', response.usageMetadata);

      if (!response.text) {
        throw new ApplicationError(
          'API_ERROR',
          'Gemini API returned empty response',
          502,
        );
      }

      try {
        return JSON.parse(response.text);
      }
      catch (parseError) {
        this.logger.error({
          responseText: response.text,
          parseError,
        }, 'Failed to parse Gemini API response');

        throw new ApplicationError(
          'API_ERROR',
          'Invalid JSON response from Gemini API',
          502,
        );
      }
    });
  }

  async analyzeContent(params: {
    phrase: string;
    action: string;
    context?: {
      fullPhrase?: string;
      image?: string;
    };
  }) {
    const prompt = this.buildAnalysisPrompt(params);
    const schema = this.getAnalysisSchema(params.action);

    return callWithRetry(async () => {
      const parts: any[] = [{ text: prompt }];

      if (params.context?.image) {
        parts.unshift({
          inlineData: {
            data: params.context.image,
            mimeType: 'image/png',
          },
        });
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: schema,
          temperature: 0.3,
          ...(params.context?.image && { media_resolution: 'media_resolution_high' }),
        },
      });

      this.logUsage('analyze', response.usageMetadata);

      if (!response.text) {
        throw new ApplicationError(
          'API_ERROR',
          'Gemini API returned empty response',
          502,
        );
      }

      try {
        return JSON.parse(response.text);
      }
      catch (parseError) {
        this.logger.error({
          responseText: response.text,
          parseError,
        }, 'Failed to parse Gemini API response');

        throw new ApplicationError(
          'API_ERROR',
          'Invalid JSON response from Gemini API',
          502,
        );
      }
    });
  }

  private buildIdentifyPrompt(params: any): string {
    return `
You are analyzing a screenshot of a Japanese webpage.
User selected region: x=${params.selectionRegion.x}, y=${params.selectionRegion.y},
width=${params.selectionRegion.width}, height=${params.selectionRegion.height}
Image size: ${params.imageWidth}x${params.imageHeight}

Identify the Japanese phrase in or near this region.
Provide precise bounding box coordinates (normalized 0-1000).
Tokenize the phrase into words with readings and romaji.
    `.trim();
  }

  private buildAnalysisPrompt(params: any): string {
    const basePrompt = `Analyze this Japanese phrase: "${params.phrase}"`;

    switch (params.action) {
      case 'translate':
        return `${basePrompt}\nProvide accurate English translation with context.`;
      case 'explain':
        return `${basePrompt}\nExplain the meaning, usage, and nuance.`;
      case 'grammar':
        return `${basePrompt}\nBreak down the grammar patterns and structures.`;
      case 'vocabulary':
        return `${basePrompt}\nProvide vocabulary analysis including definitions, JLPT level, and examples.`;
      default:
        throw new ApplicationError('INVALID_ACTION', `Unknown action: ${params.action}`, 400);
    }
  }

  private getPhraseSchema() {
    return {
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
              partOfSpeech: { type: 'array', items: { type: 'string' } },
              hasKanji: { type: 'boolean' },
              isCommon: { type: 'boolean' },
            },
            required: ['word', 'reading', 'romaji'],
          },
        },
      },
      required: ['phrase', 'romaji', 'boundingBox', 'tokens'],
    };
  }

  private getAnalysisSchema(action: string) {
    // Placeholder for different action schemas
    // In a real implementation, each action would have its own schema
    return {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
      required: ['result'],
    };
  }

  private logUsage(endpoint: string, usage: any) {
    const inputCost = (usage.promptTokenCount / 1_000_000) * GEMINI_PRICING.INPUT_PER_MILLION;
    const outputCost = (usage.candidatesTokenCount / 1_000_000) * GEMINI_PRICING.OUTPUT_PER_MILLION;

    this.logger.info({
      endpoint,
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
      costs: {
        input: inputCost.toFixed(6),
        output: outputCost.toFixed(6),
        total: (inputCost + outputCost).toFixed(6),
      },
    }, 'Gemini API call completed');
  }
}
