import { GoogleGenAI, ThinkingLevel } from '@google/genai';
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
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.2,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
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
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.3,
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
    const baseContext = params.context?.fullPhrase
      ? `The phrase appears in this full context: "${params.context.fullPhrase}"\n`
      : '';

    const imageContext = params.context?.image
      ? 'The phrase appears in the provided screenshot.\n'
      : '';

    const basePrompt = `You are analyzing Japanese text for a language learner.
${imageContext}${baseContext}
Selected phrase: "${params.phrase}"
`;

    switch (params.action) {
      case 'translate':
        return `${basePrompt}
Provide an accurate English translation with the following:
1. Natural English translation considering the context
2. Literal translation if significantly different
3. Brief explanation of any contextual nuances or cultural notes

Be concise but complete.`;

      case 'explain':
        return `${basePrompt}
Provide a comprehensive explanation including:
1. Core meaning and how the phrase is used
2. How it functions in this specific context
3. Common situations where this phrase appears
4. Important nuances, connotations, or formality level

Focus on helping the learner understand practical usage.`;

      case 'grammar':
        return `${basePrompt}
Provide a grammatical breakdown:
1. Identify all grammatical elements (particles, verb forms, conjugations, etc.)
2. Explain the grammatical structure step-by-step
3. Explain why each element is used in this context
4. Common variations or alternative constructions
5. Tips for learners (common mistakes, similar patterns)

Be clear and educational.`;

      case 'vocabulary':
        return `${basePrompt}
Provide vocabulary information:
1. Reading (hiragana/katakana) and romaji
2. Kanji breakdown (if applicable) with individual meanings
3. Word type (noun, verb, adjective, etc.)
4. Primary meaning and alternative meanings
5. Common collocations and phrases using this word
6. 2-3 example sentences with translations
7. JLPT level if applicable

Format your response to be clear and structured.`;

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
    switch (action) {
      case 'translate':
        return {
          type: 'object',
          properties: {
            translation: {
              type: 'string',
              description: 'Natural English translation',
            },
            literalTranslation: {
              type: 'string',
              description: 'Literal translation if significantly different from natural translation',
            },
            notes: {
              type: 'string',
              description: 'Contextual nuances or cultural notes',
            },
          },
          required: ['translation'],
        };

      case 'explain':
        return {
          type: 'object',
          properties: {
            meaning: {
              type: 'string',
              description: 'Core meaning and usage',
            },
            contextUsage: {
              type: 'string',
              description: 'How it functions in this specific context',
            },
            commonSituations: {
              type: 'string',
              description: 'Common situations where this phrase appears',
            },
            nuances: {
              type: 'string',
              description: 'Important nuances, connotations, or formality level',
            },
          },
          required: ['meaning', 'contextUsage'],
        };

      case 'grammar':
        return {
          type: 'object',
          properties: {
            breakdown: {
              type: 'string',
              description: 'Step-by-step grammatical breakdown',
            },
            elements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  element: { type: 'string' },
                  type: { type: 'string' },
                  explanation: { type: 'string' },
                },
              },
              description: 'Individual grammatical elements with explanations',
            },
            variations: {
              type: 'string',
              description: 'Common variations or alternative constructions',
            },
            learnerTips: {
              type: 'string',
              description: 'Tips for learners, common mistakes',
            },
          },
          required: ['breakdown'],
        };

      case 'vocabulary':
        return {
          type: 'object',
          properties: {
            reading: {
              type: 'string',
              description: 'Hiragana/katakana reading',
            },
            romaji: {
              type: 'string',
              description: 'Romaji reading',
            },
            kanjiBreakdown: {
              type: 'string',
              description: 'Kanji breakdown with individual meanings',
            },
            wordType: {
              type: 'string',
              description: 'Part of speech (noun, verb, adjective, etc.)',
            },
            meanings: {
              type: 'array',
              items: { type: 'string' },
              description: 'Primary and alternative meanings',
            },
            collocations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Common collocations and phrases',
            },
            examples: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  japanese: { type: 'string' },
                  english: { type: 'string' },
                },
              },
              description: 'Example sentences with translations',
            },
            jlptLevel: {
              type: 'string',
              description: 'JLPT level if applicable (N5, N4, N3, N2, N1)',
            },
          },
          required: ['reading', 'meanings'],
        };

      default:
        // Fallback generic schema
        return {
          type: 'object',
          properties: {
            result: { type: 'string' },
          },
          required: ['result'],
        };
    }
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
