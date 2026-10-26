import sharp, { type Metadata } from 'sharp';
import crypto from 'node:crypto';

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ValidatedImageResult {
  buffer: Buffer;
  mimeType: 'image/webp';
  extension: 'webp';
  width: number;
  height: number;
  randomObjectKey: string;
}

/**
 * Inspects file magic bytes (signatures) strictly on the server before decoding.
 * Rejects executables, SVGs, HTML, polyglots, or spoofed Content-Type headers.
 */
export function detectImageSignature(buffer: Buffer): SupportedImageMime | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export interface ProcessImageOptions {
  maxBytes: number;
  maxDimension: number;
  prefix: 'attachments' | 'avatars';
}

/**
 * Validates file size, magic bytes, image dimensions (protecting against decompression bombs),
 * strips all EXIF/GPS metadata, and safely re-encodes into clean WebP with a randomized storage name.
 */
export async function validateAndReencodeImage(
  inputBuffer: Buffer,
  options: ProcessImageOptions
): Promise<ValidatedImageResult> {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new ImageValidationError('Uploaded image file is empty.', 400);
  }

  if (inputBuffer.length > options.maxBytes) {
    const mb = Math.round((options.maxBytes / (1024 * 1024)) * 10) / 10;
    throw new ImageValidationError(`Image exceeds the ${mb} MB size limit.`, 413);
  }

  const detectedMime = detectImageSignature(inputBuffer);
  if (!detectedMime) {
    throw new ImageValidationError(
      'Unsupported or invalid file format. Only genuine JPG, PNG, and WebP images are accepted.',
      415
    );
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(inputBuffer, { limitInputPixels: 25_000_000 }).metadata();
  } catch {
    throw new ImageValidationError('Corrupted or unreadable image file.', 400);
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageValidationError('Unable to determine image dimensions.', 400);
  }

  if (metadata.width > 8000 || metadata.height > 8000) {
    throw new ImageValidationError('Image dimensions exceed the maximum allowed safety bounds (8000x8000px).', 400);
  }

  try {
    const pipeline = sharp(inputBuffer, { limitInputPixels: 25_000_000 })
      .rotate() // Auto-orient then strip EXIF metadata by default
      .resize({
        width: options.maxDimension,
        height: options.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 84 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    const randomId = crypto.randomBytes(18).toString('hex');
    const randomObjectKey = `${options.prefix}/${randomId}.webp`;

    return {
      buffer: data,
      mimeType: 'image/webp',
      extension: 'webp',
      width: info.width,
      height: info.height,
      randomObjectKey,
    };
  } catch {
    throw new ImageValidationError('Failed to decode and sanitize image safely.', 400);
  }
}

export class ImageValidationError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ImageValidationError';
    this.statusCode = statusCode;
  }
}
