import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callWithRetry } from './retry.js';
import { ApplicationError } from '../types/errors.js';

describe('Retry service', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  describe('Successful operations', () => {
    it('should return result immediately on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should work with different return types', async () => {
      const objFn = vi.fn().mockResolvedValue({ data: 'test' });
      const numFn = vi.fn().mockResolvedValue(42);
      const arrFn = vi.fn().mockResolvedValue([1, 2, 3]);

      const objPromise = callWithRetry(objFn);
      await vi.runAllTimersAsync();
      expect(await objPromise).toEqual({ data: 'test' });

      const numPromise = callWithRetry(numFn);
      await vi.runAllTimersAsync();
      expect(await numPromise).toBe(42);

      const arrPromise = callWithRetry(arrFn);
      await vi.runAllTimersAsync();
      expect(await arrPromise).toEqual([1, 2, 3]);
    });
  });

  describe('Transient error handling', () => {
    it('should retry on 429 (rate limit) error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn, { maxRetries: 3, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 (server error)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 500, message: 'Server error' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 (service unavailable)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ code: 503, message: 'Service unavailable' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ message: 'Request timeout' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ECONNRESET errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ name: 'ECONNRESET', message: 'ECONNRESET connection reset by peer' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn, { maxRetries: 3, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ETIMEDOUT errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ message: 'ETIMEDOUT - operation timed out' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ENOTFOUND errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ message: 'ENOTFOUND - DNS lookup failed' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Permanent error handling', () => {
    it('should not retry on 400 (bad request)', async () => {
      const fn = vi.fn().mockRejectedValue({ status: 400, message: 'Bad request' });

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      await expect(promise).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Bad request',
        statusCode: 400,
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 (unauthorized)', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 401, message: 'Unauthorized' });

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 (forbidden)', async () => {
      const fn = vi.fn().mockRejectedValue({ status: 403, message: 'Forbidden' });

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 (not found)', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 404, message: 'Not found' });

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exponential backoff', () => {
    it('should use exponential backoff with default config', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);

      // First attempt - immediate
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Second attempt - after 1000ms (initialDelay)
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Third attempt - after 2000ms (initialDelay * backoffMultiplier)
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect maxDelay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn, {
        maxRetries: 5,
        initialDelay: 10000,
        maxDelay: 15000,
        backoffMultiplier: 2,
      });

      // First attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Second attempt - 10000ms
      await vi.advanceTimersByTimeAsync(10000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Third attempt - capped at 15000ms (not 20000ms)
      await vi.advanceTimersByTimeAsync(15000);
      expect(fn).toHaveBeenCalledTimes(3);

      // Fourth attempt - capped at 15000ms (not 40000ms)
      await vi.advanceTimersByTimeAsync(15000);
      expect(fn).toHaveBeenCalledTimes(4);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect retry-after header', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({
          statusCode: 429,
          message: 'Rate limited',
          headers: { 'retry-after': '5' },
        })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);

      // First attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Second attempt - after 5000ms (retry-after header)
      await vi.advanceTimersByTimeAsync(5000);
      expect(fn).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('Max retries', () => {
    it('should stop after maxRetries attempts', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 429, message: 'Rate limited' });

      const promise = callWithRetry(fn, {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 32000,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      await expect(promise).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Rate limited',
      });
      // 1 initial + 2 retries = 3 total attempts
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw ApplicationError after exhausting retries', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 503, message: 'Service unavailable' });

      const promise = callWithRetry(fn, { maxRetries: 1, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      await expect(promise).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Service unavailable',
        statusCode: 500,
      });
    });

    it('should use default error message when error has no message', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 503 });

      const promise = callWithRetry(fn, { maxRetries: 1, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      await expect(promise).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Gemini API request failed',
        statusCode: 500,
      });
    });
  });

  describe('Non-transient errors', () => {
    it('should not retry on unknown errors without status code', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Unknown error'));

      const promise = callWithRetry(fn, { maxRetries: 3, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      await expect(promise).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Unknown error',
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry when non-transient error occurs after transient ones', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockRejectedValueOnce(new Error('Something broke'));

      const promise = callWithRetry(fn, { maxRetries: 3, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      await expect(promise).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Something broke',
      });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Custom retry configuration', () => {
    it('should accept custom maxRetries', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 429, message: 'Rate limited' });

      const promise = callWithRetry(fn, {
        maxRetries: 5,
        initialDelay: 100,
        maxDelay: 32000,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(6); // 1 initial + 5 retries
    });

    it('should accept custom initialDelay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn, {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 32000,
        backoffMultiplier: 2,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should accept custom backoffMultiplier', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limited' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 32000,
        backoffMultiplier: 3,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // With multiplier of 3: 1000 * 3 = 3000ms
      await vi.advanceTimersByTimeAsync(3000);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('Edge cases', () => {
    it('should handle error with both status and statusCode properties', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({
          status: 400,
          statusCode: 429,
          message: 'Ambiguous error',
        })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn, { maxRetries: 3, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();

      // Should use statusCode (first in priority) - 429 is transient, so retries
      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle error with code property', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ code: 503, message: 'Service error' })
        .mockResolvedValue('success');

      const promise = callWithRetry(fn);
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle null/undefined error properties gracefully', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: null, message: null, name: null });

      const promise = callWithRetry(fn, { maxRetries: 1, initialDelay: 100, maxDelay: 32000, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ApplicationError);
      await expect(promise).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Gemini API request failed',
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
