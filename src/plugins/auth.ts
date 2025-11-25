import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { timingSafeEqual } from 'crypto';
import { ApplicationError } from '../types/errors.js';

const authPluginImpl: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    // Check if route has opted out of authentication
    const routeConfig = request.routeOptions.config as { skipAuth?: boolean } | undefined;
    if (routeConfig?.skipAuth) {
      return;
    }

    // Get API key from header
    const providedKey = request.headers['x-api-key'];

    // Handle missing or empty key
    if (!providedKey || providedKey === '') {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Handle multiple header values (use first)
    const keyToCompare = Array.isArray(providedKey) ? providedKey[0] : providedKey;

    // Get expected API key from config
    const expectedKey = app.config.API_KEY;

    // Perform constant-time comparison to prevent timing attacks
    // Both strings must be same length for timingSafeEqual
    const isValid = constantTimeCompare(keyToCompare, expectedKey);

    if (!isValid) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }
  });
};

/**
 * Constant-time string comparison using crypto.timingSafeEqual
 * Prevents timing attacks by ensuring comparison takes the same time
 * regardless of where the strings differ
 */
function constantTimeCompare(a: string, b: string): boolean {
  // timingSafeEqual requires buffers of equal length
  // If lengths differ, still perform a comparison to avoid timing leak
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  // If lengths are different, compare against a dummy buffer
  // to maintain constant time behavior
  if (bufferA.length !== bufferB.length) {
    // Create dummy buffer with same length as bufferB to compare against
    const dummyBuffer = Buffer.alloc(bufferB.length);
    timingSafeEqual(bufferB, dummyBuffer);
    return false;
  }

  // Perform constant-time comparison
  try {
    return timingSafeEqual(bufferA, bufferB);
  } catch {
    // timingSafeEqual throws if buffers are different lengths
    // This shouldn't happen due to our length check above, but handle it anyway
    return false;
  }
}

// Wrap with fastify-plugin to make hooks apply globally
export const authPlugin = fastifyPlugin(authPluginImpl);
