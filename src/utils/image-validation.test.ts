import { describe, it, expect } from 'vitest';
import { validateImage } from './image-validation.js';
import { ApplicationError } from '../types/errors.js';

describe('validateImage', () => {
  // Valid PNG base64 (1x1 transparent PNG)
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  describe('data URL prefix handling', () => {
    it('should accept base64 with data URL prefix', () => {
      const result = validateImage(`data:image/png;base64,${validPngBase64}`);

      expect(result.base64Data).toBe(validPngBase64);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should accept base64 without data URL prefix', () => {
      const result = validateImage(validPngBase64);

      expect(result.base64Data).toBe(validPngBase64);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('base64 format validation', () => {
    it('should throw for empty base64 data', () => {
      expect(() => validateImage('')).toThrow(ApplicationError);
      expect(() => validateImage('')).toThrow('Image must be valid base64-encoded data');
    });

    it('should throw for invalid base64 characters', () => {
      expect(() => validateImage('not-valid-base64!!!')).toThrow(ApplicationError);
      expect(() => validateImage('not-valid-base64!!!')).toThrow('Image must be valid base64-encoded data');
    });

    it('should throw for base64 with spaces', () => {
      expect(() => validateImage('abc def 123')).toThrow(ApplicationError);
      expect(() => validateImage('abc def 123')).toThrow('Image must be valid base64-encoded data');
    });

    it('should throw for data URL with empty base64 part', () => {
      expect(() => validateImage('data:image/png;base64,')).toThrow(ApplicationError);
      expect(() => validateImage('data:image/png;base64,')).toThrow('Image must be valid base64-encoded data');
    });
  });

  describe('PNG format validation', () => {
    it('should throw for non-PNG image (JPEG)', () => {
      // JPEG magic bytes in base64
      const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQ/9k=';

      expect(() => validateImage(jpegBase64)).toThrow(ApplicationError);
      expect(() => validateImage(jpegBase64)).toThrow('Image must be PNG format');
    });

    it('should throw for truncated image (less than 4 bytes)', () => {
      const truncatedBase64 = 'AA=='; // Only 1 byte when decoded

      expect(() => validateImage(truncatedBase64)).toThrow(ApplicationError);
      expect(() => validateImage(truncatedBase64)).toThrow('Image must be PNG format');
    });

    it('should throw for image with wrong magic bytes', () => {
      // Valid base64 but not PNG magic bytes
      const invalidMagicBytes = 'AQIDBA=='; // [1, 2, 3, 4] - not PNG

      expect(() => validateImage(invalidMagicBytes)).toThrow(ApplicationError);
      expect(() => validateImage(invalidMagicBytes)).toThrow('Image must be PNG format');
    });
  });

  describe('size validation', () => {
    it('should accept image within default size limit (5MB)', () => {
      const result = validateImage(validPngBase64);

      expect(result.size).toBeLessThan(5242880); // Less than 5MB
    });

    it('should throw when image exceeds default size limit', () => {
      // Create a buffer larger than 5MB and encode it
      // Use a valid PNG header + large data
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const largeData = Buffer.alloc(5242881); // Just over 5MB
      pngHeader.copy(largeData, 0);
      const largeBase64 = largeData.toString('base64');

      try {
        validateImage(largeBase64);
        expect.fail('Should have thrown');
      }
      catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        const appError = error as ApplicationError;
        expect(appError.code).toBe('IMAGE_TOO_LARGE');
        expect(appError.statusCode).toBe(413);
      }
    });

    it('should respect custom maxSize option', () => {
      const customMaxSize = 50; // 50 bytes (validPngBase64 decodes to 70 bytes)

      try {
        validateImage(validPngBase64, { maxSize: customMaxSize });
        expect.fail('Should have thrown');
      }
      catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        const appError = error as ApplicationError;
        expect(appError.code).toBe('IMAGE_TOO_LARGE');
        expect(appError.statusCode).toBe(413);
      }
    });

    it('should include size details in error message', () => {
      const customMaxSize = 50;

      try {
        validateImage(validPngBase64, { maxSize: customMaxSize });
        expect.fail('Should have thrown');
      }
      catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        const appError = error as ApplicationError;
        expect(appError.message).toContain('MB');
        expect(appError.message).toContain('exceeds limit');
        expect(appError.statusCode).toBe(413);
      }
    });
  });

  describe('successful validation', () => {
    it('should return all expected properties', () => {
      const result = validateImage(validPngBase64);

      expect(result).toHaveProperty('base64Data');
      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('size');
    });

    it('should return correct base64Data property', () => {
      const result = validateImage(`data:image/png;base64,${validPngBase64}`);

      expect(result.base64Data).toBe(validPngBase64);
    });

    it('should return Buffer instance', () => {
      const result = validateImage(validPngBase64);

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should return correct size matching buffer length', () => {
      const result = validateImage(validPngBase64);

      expect(result.size).toBe(result.buffer.length);
    });
  });
});
