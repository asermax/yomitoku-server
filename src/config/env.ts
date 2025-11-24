import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyEnv from '@fastify/env';

const schema = {
  type: 'object',
  required: ['GEMINI_API_KEY'],
  properties: {
    GEMINI_API_KEY: { type: 'string', minLength: 1 },
    GEMINI_API_VERSION: { type: 'string', default: 'v1' },
    PORT: { type: 'number', default: 3000 },
    HOST: { type: 'string', default: '0.0.0.0' },
    NODE_ENV: {
      type: 'string',
      enum: ['development', 'production', 'test'],
      default: 'development',
    },
    RATE_LIMIT_WINDOW_MS: { type: 'number', default: 3600000 },
    RATE_LIMIT_MAX_REQUESTS: { type: 'number', default: 100 },
    LOG_LEVEL: {
      type: 'string',
      enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
      default: 'info',
    },
    CHROME_EXTENSION_ID: { type: 'string' },
    MAX_IMAGE_SIZE: { type: 'number', default: 5242880 },
    CACHE_TTL_SECONDS: { type: 'number', default: 3600 },
    CACHE_MAX_ENTRIES: { type: 'number', default: 1000 },
  },
} as const;

const envPluginImpl: FastifyPluginAsync = async (app) => {
  await app.register(fastifyEnv, {
    confKey: 'config',
    schema,
    dotenv: true,
    data: process.env,
  });

  // Validate production requirements after plugin is loaded
  // NOTE: This must run in onReady hook (not inline) because:
  // 1. app.config is not available until plugin finishes loading
  // 2. onReady ensures all plugins are ready before server starts
  // 3. Validation failures here prevent server startup cleanly
  app.addHook('onReady', async () => {
    if (app.config.NODE_ENV === 'production' && !app.config.CHROME_EXTENSION_ID) {
      throw new Error('CHROME_EXTENSION_ID is required in production');
    }
  });
};

// Wrap with fastify-plugin to expose config decorator to parent scope
export const envPlugin = fastifyPlugin(envPluginImpl);

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      GEMINI_API_KEY: string;
      GEMINI_API_VERSION: string;
      PORT: number;
      HOST: string;
      NODE_ENV: 'development' | 'production' | 'test';
      RATE_LIMIT_WINDOW_MS: number;
      RATE_LIMIT_MAX_REQUESTS: number;
      LOG_LEVEL: string;
      CHROME_EXTENSION_ID: string;
      MAX_IMAGE_SIZE: number;
      CACHE_TTL_SECONDS: number;
      CACHE_MAX_ENTRIES: number;
    };
  }
}
