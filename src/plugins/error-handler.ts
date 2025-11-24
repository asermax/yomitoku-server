import { FastifyPluginAsync, FastifyError } from 'fastify';
import { ApplicationError } from '../types/errors.js';

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError | ApplicationError, request, reply) => {
    request.log.error({
      err: error,
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }, 'Request error');

    // Handle body too large errors (must be before validation check)
    if ('code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: error.message,
        },
      });
    }

    // Handle validation errors
    if ('validation' in error && error.validation) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: error.validation,
        },
      });
    }

    // Handle rate limit errors
    if (error.statusCode === 429) {
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: error.message,
        },
      });
    }

    // Handle custom application errors
    if (error instanceof ApplicationError) {
      return reply.code(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      });
    }

    // Default to 500 for unexpected errors
    const statusCode = error.statusCode || 500;
    const errorResponse: any = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: app.config.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      },
    };

    // Include stack in development
    if (app.config.NODE_ENV !== 'production') {
      errorResponse.error.stack = error.stack;
    }

    return reply.code(statusCode).send(errorResponse);
  });
};
