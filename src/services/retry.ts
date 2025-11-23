import { ApplicationError } from '../types/errors.js';

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 32000,
  backoffMultiplier: 2,
};

function getErrorStatus(error: any): number | undefined {
  // Try different error properties (statusCode, status, code)
  return error.statusCode || error.status || error.code;
}

function isTransientError(error: any): boolean {
  const transientCodes = [429, 500, 503];
  const status = getErrorStatus(error);

  if (status && transientCodes.includes(status)) {
    return true;
  }

  // Some SDKs use error messages or names for transient errors
  const transientPatterns = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND/i;
  return transientPatterns.test(error.message || error.name || '');
}

function isPermanentError(error: any): boolean {
  const permanentCodes = [400, 401, 403, 404];
  const status = getErrorStatus(error);
  return status ? permanentCodes.includes(status) : false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: any;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    }
    catch (error: any) {
      lastError = error;

      if (isPermanentError(error)) {
        throw new ApplicationError(
          'API_ERROR',
          error.message,
          error.status || 500,
        );
      }

      if (attempt === config.maxRetries || !isTransientError(error)) {
        break;
      }

      const retryAfter = error.headers?.['retry-after'];
      const waitTime = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.min(delay, config.maxDelay);

      await sleep(waitTime);
      delay *= config.backoffMultiplier;
    }
  }

  throw new ApplicationError(
    'API_ERROR',
    lastError.message || 'Gemini API request failed',
    lastError.status || 500,
  );
}
