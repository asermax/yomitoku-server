import { describe, it, expect } from 'vitest';
import { categorizeApiError } from './error-categorization.js';
import { ApplicationError } from '../types/errors.js';

describe('categorizeApiError', () => {
  describe('Gemini API authentication errors', () => {
    it('should categorize 401 error code as API_UNAVAILABLE', () => {
      const error = { code: 401, message: 'Unauthorized' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result).toBeInstanceOf(ApplicationError);
      expect(result.code).toBe('API_UNAVAILABLE');
      expect(result.message).toBe('Service temporarily unavailable. Please contact support.');
      expect(result.statusCode).toBe(503);
    });

    it('should categorize API key message as API_UNAVAILABLE', () => {
      const error = { message: 'Invalid API key provided' };

      const result = categorizeApiError(error, { context: 'identify phrase' });

      expect(result.code).toBe('API_UNAVAILABLE');
      expect(result.statusCode).toBe(503);
    });

    it('should categorize INVALID_ARGUMENT message as API_UNAVAILABLE', () => {
      const error = { message: 'INVALID_ARGUMENT: API key not valid' };

      const result = categorizeApiError(error, { context: 'identify phrases' });

      expect(result.code).toBe('API_UNAVAILABLE');
      expect(result.statusCode).toBe(503);
    });
  });

  describe('Gemini API quota/rate limit errors', () => {
    it('should categorize 429 error code as API_QUOTA_EXCEEDED', () => {
      const error = { code: 429, message: 'Too many requests' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result).toBeInstanceOf(ApplicationError);
      expect(result.code).toBe('API_QUOTA_EXCEEDED');
      expect(result.message).toBe('Service temporarily unavailable due to high demand. Please try again later.');
      expect(result.statusCode).toBe(503);
    });

    it('should categorize quota message as API_QUOTA_EXCEEDED', () => {
      const error = { message: 'Quota exceeded for requests' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result.code).toBe('API_QUOTA_EXCEEDED');
      expect(result.statusCode).toBe(503);
    });

    it('should categorize rate limit message as API_QUOTA_EXCEEDED', () => {
      const error = { message: 'Rate limit exceeded' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result.code).toBe('API_QUOTA_EXCEEDED');
      expect(result.statusCode).toBe(503);
    });
  });

  describe('Gemini API content filtering errors', () => {
    it('should categorize content filter message as CONTENT_FILTERED', () => {
      const error = { message: 'Content was filtered by safety settings' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result).toBeInstanceOf(ApplicationError);
      expect(result.code).toBe('CONTENT_FILTERED');
      expect(result.message).toBe('Unable to process this content. Please try different text.');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('network connectivity errors', () => {
    it('should categorize ECONNREFUSED as API_UNAVAILABLE', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };

      const result = categorizeApiError(error, { context: 'identify phrase' });

      expect(result).toBeInstanceOf(ApplicationError);
      expect(result.code).toBe('API_UNAVAILABLE');
      expect(result.message).toBe('Unable to connect to analysis service. Please try again.');
      expect(result.statusCode).toBe(503);
    });

    it('should categorize ENOTFOUND as API_UNAVAILABLE', () => {
      const error = { code: 'ENOTFOUND', message: 'Host not found' };

      const result = categorizeApiError(error, { context: 'identify phrases' });

      expect(result.code).toBe('API_UNAVAILABLE');
      expect(result.statusCode).toBe(503);
    });
  });

  describe('timeout errors', () => {
    it('should categorize ETIMEDOUT as TIMEOUT', () => {
      const error = { code: 'ETIMEDOUT', message: 'Request timeout' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result).toBeInstanceOf(ApplicationError);
      expect(result.code).toBe('TIMEOUT');
      expect(result.statusCode).toBe(504);
    });

    it('should categorize timeout message as TIMEOUT', () => {
      const error = { message: 'Request timeout exceeded' };

      const result = categorizeApiError(error, { context: 'identify phrase' });

      expect(result.code).toBe('TIMEOUT');
      expect(result.statusCode).toBe(504);
    });

    it('should use context-specific timeout message for identify phrase', () => {
      const error = { code: 'ETIMEDOUT' };

      const result = categorizeApiError(error, { context: 'identify phrase' });

      expect(result.message).toBe('Request timed out. Please try again with a smaller image or selection.');
    });

    it('should use context-specific timeout message for identify phrases', () => {
      const error = { code: 'ETIMEDOUT' };

      const result = categorizeApiError(error, { context: 'identify phrases' });

      expect(result.message).toBe('Request timed out. Please try again with a smaller image or fewer phrases.');
    });

    it('should use context-specific timeout message for analyze', () => {
      const error = { code: 'ETIMEDOUT' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result.message).toBe('Request timed out. Please try again.');
    });
  });

  describe('generic errors', () => {
    it('should categorize unknown error as API_ERROR', () => {
      const error = { message: 'Unexpected error occurred' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result).toBeInstanceOf(ApplicationError);
      expect(result.code).toBe('API_ERROR');
      expect(result.statusCode).toBe(500);
    });

    it('should use context-specific message for identify phrase', () => {
      const error = new Error('Unknown');

      const result = categorizeApiError(error, { context: 'identify phrase' });

      expect(result.message).toBe('Failed to identify phrase from screenshot');
    });

    it('should use context-specific message for identify phrases', () => {
      const error = new Error('Unknown');

      const result = categorizeApiError(error, { context: 'identify phrases' });

      expect(result.message).toBe('Failed to identify phrases from screenshot');
    });

    it('should use context-specific message for analyze', () => {
      const error = new Error('Unknown');

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result.message).toBe('Failed to analyze phrase');
    });
  });

  describe('development mode error details', () => {
    it('should include originalError in development mode', () => {
      const error = { message: 'Detailed error message' };

      const result = categorizeApiError(error, {
        context: 'analyze',
        isDevelopment: true,
      });

      expect(result.details).toEqual({ originalError: 'Detailed error message' });
    });

    it('should not include originalError in production mode', () => {
      const error = { message: 'Detailed error message' };

      const result = categorizeApiError(error, {
        context: 'analyze',
        isDevelopment: false,
      });

      expect(result.details).toBeUndefined();
    });

    it('should default to production mode (no details)', () => {
      const error = { message: 'Detailed error message' };

      const result = categorizeApiError(error, { context: 'analyze' });

      expect(result.details).toBeUndefined();
    });
  });

  describe('error priority (first match wins)', () => {
    it('should prioritize auth error over network error', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'API key invalid: connection refused',
      };

      const result = categorizeApiError(error, { context: 'analyze' });

      // Should match on "API key" before ECONNREFUSED
      expect(result.code).toBe('API_UNAVAILABLE');
      expect(result.message).toBe('Service temporarily unavailable. Please contact support.');
    });

    it('should prioritize quota error over timeout', () => {
      const error = {
        code: 'ETIMEDOUT',
        message: 'Request timeout due to quota exceeded',
      };

      const result = categorizeApiError(error, { context: 'analyze' });

      // Should match on "quota" before ETIMEDOUT
      expect(result.code).toBe('API_QUOTA_EXCEEDED');
    });
  });
});
