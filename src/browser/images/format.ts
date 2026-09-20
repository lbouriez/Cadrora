import type { AcceptedSourceImageType, ExifOrientation, ValidatedImageFile } from './types';
import { ACCEPTED_SOURCE_IMAGE_TYPES, ImageProcessingError } from './types';

const JPEG_SOI = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export function sniffImageType(bytes: Uint8Array): AcceptedSourceImageType | undefined {
  if (JPEG_SOI.every((value, index) => bytes[index] === value)) return 'image/jpeg';
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return undefined;
}

export function isAcceptedSourceImageType(value: string): value is AcceptedSourceImageType {
  return (ACCEPTED_SOURCE_IMAGE_TYPES as readonly string[]).includes(value);
}

/**
 * Reads only TIFF IFD0 orientation from JPEG APP1. All malformed metadata is
 * ignored; decoding remains the authority for whether an image is usable.
 */
export function readExifOrientation(bytes: Uint8Array): ExifOrientation {
  if (sniffImageType(bytes) !== 'image/jpeg') return 1;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return 1;
    const marker = bytes[offset + 1];
    if (marker === undefined || marker === 0xda || marker === 0xd9) return 1;
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2 || offset + 2 + length > bytes.length) return 1;

    if (marker === 0xe1 && hasExifSignature(bytes, offset + 4)) {
      return readTiffOrientation(bytes, offset + 10, offset + 2 + length);
    }
    offset += 2 + length;
  }
  return 1;
}

function hasExifSignature(bytes: Uint8Array, offset: number): boolean {
  return (
    bytes[offset] === 0x45 &&
    bytes[offset + 1] === 0x78 &&
    bytes[offset + 2] === 0x69 &&
    bytes[offset + 3] === 0x66 &&
    bytes[offset + 4] === 0x00 &&
    bytes[offset + 5] === 0x00
  );
}

function readTiffOrientation(bytes: Uint8Array, start: number, end: number): ExifOrientation {
  if (start + 8 > end) return 1;
  const byteOrder = String.fromCharCode(bytes[start] ?? 0, bytes[start + 1] ?? 0);
  const littleEndian = byteOrder === 'II';
  if (!littleEndian && byteOrder !== 'MM') return 1;

  const readUint16 = (offset: number): number | undefined => {
    if (offset + 2 > end) return undefined;
    const a = bytes[offset];
    const b = bytes[offset + 1];
    if (a === undefined || b === undefined) return undefined;
    return littleEndian ? a | (b << 8) : (a << 8) | b;
  };
  const readUint32 = (offset: number): number | undefined => {
    if (offset + 4 > end) return undefined;
    const a = bytes[offset];
    const b = bytes[offset + 1];
    const c = bytes[offset + 2];
    const d = bytes[offset + 3];
    if (a === undefined || b === undefined || c === undefined || d === undefined) return undefined;
    return littleEndian
      ? a | (b << 8) | (c << 16) | (d << 24)
      : (a << 24) | (b << 16) | (c << 8) | d;
  };

  if (readUint16(start + 2) !== 42) return 1;
  const ifdOffset = readUint32(start + 4);
  if (ifdOffset === undefined || ifdOffset < 8) return 1;
  const ifdStart = start + ifdOffset;
  const entryCount = readUint16(ifdStart);
  if (entryCount === undefined || ifdStart + 2 + entryCount * 12 > end) return 1;

  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (readUint16(entry) !== 0x0112 || readUint16(entry + 2) !== 3 || readUint32(entry + 4) !== 1) {
      continue;
    }
    const value = readUint16(entry + 8);
    return value && value >= 1 && value <= 8 ? (value as ExifOrientation) : 1;
  }
  return 1;
}

export async function validateImageFile(file: File): Promise<ValidatedImageFile> {
  const prefix = new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer());
  const contentType = sniffImageType(prefix);
  if (!contentType || !isAcceptedSourceImageType(contentType)) {
    throw new ImageProcessingError('UNSUPPORTED_IMAGE', 'Only JPEG, PNG, and WebP files are supported.');
  }

  const orientation = readExifOrientation(prefix);
  let bitmap: ImageBitmap;
  try {
    // `none` is essential: the renderer below is the single orientation pass.
    bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
  } catch (error) {
    throw new ImageProcessingError('CORRUPT_IMAGE', 'The image cannot be decoded.', { cause: error });
  }

  try {
    const swapsDimensions = orientation >= 5;
    return {
      contentType,
      file,
      height: swapsDimensions ? bitmap.width : bitmap.height,
      orientation,
      width: swapsDimensions ? bitmap.height : bitmap.width,
    };
  } finally {
    bitmap.close();
  }
}
