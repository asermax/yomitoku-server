import Fastify, { FastifyServerOptions } from 'fastify';
import { envPlugin } from './config/env.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { multipartPlugin } from './plugins/multipart.js';
import { healthRoutes } from './routes/health.js';
import { identifyPhraseRoutes } from './routes/identify-phrase.js';
import { analyzeRoutes } from './routes/analyze.js';

export async function build(opts: FastifyServerOptions = {}) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const app = Fastify({
    trustProxy: !isDevelopment, // Trust X-Forwarded-For in production
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      ...(isDevelopment && {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true,
          },
        },
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-api-key"]',
          'config.GEMINI_API_KEY',
        ],
        censor: '[REDACTED]',
      },
    },
    ...opts,
  });

  // Load environment configuration first
  await app.register(envPlugin);
  await app.after();

  // Register plugins
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(multipartPlugin);

  // Register routes
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(identifyPhraseRoutes, { prefix: '/api' });
  await app.register(analyzeRoutes, { prefix: '/api' });

  return app;
}
