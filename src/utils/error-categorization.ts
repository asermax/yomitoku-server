import { ApplicationError } from '../types/errors.js';

export type ErrorContext = 'identify phrase' | 'identify phrases' | 'analyze';

export interface ErrorCategorizationOptions {
  /** Context for the generic error message */
  context: ErrorContext;
  /** Whether to include original error in development mode */
  isDevelopment?: boolean;
}

/**
 * Categorizes unknown errors from Gemini API calls into ApplicationErrors.
 *
 * Error categories (in priority order):
 * 1. Gemini API authentication errors -> 503
 * 2. Gemini API quota/rate limit errors -> 503
 * 3. Gemini API content filtering errors -> 400
 * 4. Network connectivity errors -> 503
 * 5. Timeout errors -> 504
 * 6. Generic/unknown errors -> 500
 */
export const categorizeApiError = (
  error: unknown,
  options: ErrorCategorizationOptions,
): ApplicationError => {
  const errorCode = (error as any)?.code;
  const errorMessage = ((error as any)?.message || '').toLowerCase();
  const { context, isDevelopment = false } = options;

  // Gemini API authentication errors - hide from clients
  if (
    errorCode === 401
    || errorMessage.includes('api key')
    || errorMessage.includes('invalid_argument')
  ) {
    return new ApplicationError(
      'API_UNAVAILABLE',
      'Service temporarily unavailable. Please contact support.',
      503,
    );
  }

  // Gemini API rate limit or quota errors
  if (
    errorCode === 429
    || errorMessage.includes('quota')
    || errorMessage.includes('rate limit')
  ) {
    return new ApplicationError(
      'API_QUOTA_EXCEEDED',
      'Service temporarily unavailable due to high demand. Please try again later.',
      503,
    );
  }

  // Gemini API content filtering errors
  if (errorMessage.includes('content') && errorMessage.includes('filter')) {
    return new ApplicationError(
      'CONTENT_FILTERED',
      'Unable to process this content. Please try different text.',
      400,
    );
  }

  // Network connectivity errors
  if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
    return new ApplicationError(
      'API_UNAVAILABLE',
      'Unable to connect to analysis service. Please try again.',
      503,
    );
  }

  // Timeout errors
  if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
    const timeoutMessages = {
      'identify phrase': 'Request timed out. Please try again with a smaller image or selection.',
      'identify phrases': 'Request timed out. Please try again with a smaller image or fewer phrases.',
      'analyze': 'Request timed out. Please try again.',
    } as const;

    return new ApplicationError('TIMEOUT', timeoutMessages[context], 504);
  }

  // Generic error - different messages per context
  const contextMessages = {
    'identify phrase': 'Failed to identify phrase from screenshot',
    'identify phrases': 'Failed to identify phrases from screenshot',
    'analyze': 'Failed to analyze phrase',
  } as const;

  return new ApplicationError(
    'API_ERROR',
    contextMessages[context],
    500,
    isDevelopment ? { originalError: (error as any)?.message || '' } : undefined,
  );
};
