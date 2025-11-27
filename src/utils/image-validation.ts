import { ApplicationError } from '../types/errors.js';

export interface ValidatedImage {
  /** Base64 data without data URL prefix */
  base64Data: string;
  /** Decoded image buffer */
  buffer: Buffer;
  /** Image size in bytes */
  size: number;
}

export interface ImageValidationOptions {
  /** Maximum image size in bytes (default: 5MB) */
  maxSize?: number;
}

/**
 * Validates and processes a base64-encoded PNG image.
 *
 * Validation steps:
 * 1. Strip data URL prefix if present
 * 2. Validate base64 format with regex
 * 3. Decode to Buffer
 * 4. Check PNG magic bytes
 * 5. Validate size against limit
 *
 * @throws ApplicationError with appropriate code for each validation failure
 */
export const validateImage = (
  image: string,
  options: ImageValidationOptions = {},
): ValidatedImage => {
  const maxSize = options.maxSize ?? 5242880; // 5MB default

  // 1. Strip data URL prefix
  const base64Data = image.startsWith('data:')
    ? image.split(',')[1]
    : image;

  // 2. Validate base64 format
  if (!base64Data || !/^[A-Za-z0-9+/]+=*$/.test(base64Data)) {
    throw new ApplicationError(
      'INVALID_REQUEST',
      'Image must be valid base64-encoded data',
      400,
    );
  }

  // 3. Decode base64
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  }
  catch {
    throw new ApplicationError(
      'INVALID_REQUEST',
      'Invalid base64 encoding',
      400,
    );
  }

  // 4. PNG magic bytes check
  const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(pngMagicBytes)) {
    throw new ApplicationError(
      'INVALID_REQUEST',
      'Image must be PNG format',
      400,
    );
  }

  // 5. Size validation
  if (buffer.length > maxSize) {
    throw new ApplicationError(
      'IMAGE_TOO_LARGE',
      `Image size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds limit of ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
      413,
    );
  }

  return { base64Data, buffer, size: buffer.length };
};
