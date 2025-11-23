import { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    global: false, // Apply per-route instead
    max: app.config.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: app.config.RATE_LIMIT_WINDOW_MS,
    cache: 10000,
    allowList: app.config.NODE_ENV === 'development' ? ['127.0.0.1'] : [],

    keyGenerator: (request) => {
      return request.ip;
    },

    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: `Rate limit exceeded. Retry after ${context.after}`,
          details: {
            limit: context.max,
            current: context.current,
            retryAfter: context.after,
          },
        },
      };
    },

    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });
};
