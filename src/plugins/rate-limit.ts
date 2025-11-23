import { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  // Access config inside the plugin function after env plugin has loaded
  const maxRequests = app.config?.RATE_LIMIT_MAX_REQUESTS ?? 100;
  const windowMs = app.config?.RATE_LIMIT_WINDOW_MS ?? 3600000;
  const isDevelopment = app.config?.NODE_ENV === 'development';

  await app.register(rateLimit, {
    global: false, // Apply per-route instead
    max: maxRequests,
    timeWindow: windowMs,
    cache: 10000,
    allowList: isDevelopment ? ['127.0.0.1'] : [],

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
            retryAfter: context.after,
            ttl: context.ttl,
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
