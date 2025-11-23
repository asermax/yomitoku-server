import { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';

export const corsPlugin: FastifyPluginAsync = async (app) => {
  await app.register(cors, {
    origin: (origin, callback) => {
      const isDevelopment = app.config.NODE_ENV === 'development';

      // Handle requests with no origin (same-origin, direct requests, health checks)
      if (!origin) {
        return callback(null, true);
      }

      // Development: Allow any chrome-extension origin
      if (isDevelopment && origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }

      // Production: Specific extension ID only
      const allowedOrigin = `chrome-extension://${app.config.CHROME_EXTENSION_ID}`;
      if (origin === allowedOrigin) {
        return callback(null, true);
      }

      // Also allow localhost in development
      if (isDevelopment && origin.startsWith('http://localhost')) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400,
    preflight: true,
    strictPreflight: true,
  });
};
