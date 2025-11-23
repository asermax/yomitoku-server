import { FastifyPluginAsync } from 'fastify';
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
  },
} as const;

export const envPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyEnv, {
    confKey: 'config',
    schema,
    dotenv: true,
    data: process.env,
  });
};

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
    };
  }
}
