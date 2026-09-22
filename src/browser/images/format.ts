import type { AcceptedSourceImageType, ExifOrientation, ValidatedImageFile } from './types';
import { ACCEPTED_SOURCE_IMAGE_TYPES, ImageProcessingError } from './types';

const JPEG_SOI = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

interface ExifMetadata {
  capturedAtLocal?: string;
  capturedAtOffset?: string;
  orientation: ExifOrientation;
}

interface DateTimeParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

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

export function readExifOrientation(bytes: Uint8Array): ExifOrientation {
  return readExifMetadata(bytes).orientation;
}

/**
 * Retains only the real capture instant needed for chronological browsing.
 * DateTimeOriginal is preferred and OffsetTimeOriginal wins when present;
 * otherwise the gallery's configured IANA timezone interprets the camera's
 * local wall clock. Malformed or impossible values are ignored.
 */
export function readExifCapturedAt(bytes: Uint8Array, timeZone: string): string | undefined {
  const metadata = readExifMetadata(bytes);
  if (!metadata.capturedAtLocal) return undefined;
  return exifDateTimeToIso(metadata.capturedAtLocal, metadata.capturedAtOffset, timeZone);
}

function readExifMetadata(bytes: Uint8Array): ExifMetadata {
  if (sniffImageType(bytes) !== 'image/jpeg') return { orientation: 1 };

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return { orientation: 1 };
    const marker = bytes[offset + 1];
    if (marker === undefined || marker === 0xda || marker === 0xd9) return { orientation: 1 };
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2 || offset + 2 + length > bytes.length) return { orientation: 1 };

    if (marker === 0xe1 && hasExifSignature(bytes, offset + 4)) {
      return readTiffMetadata(bytes, offset + 10, offset + 2 + length);
    }
    offset += 2 + length;
  }
  return { orientation: 1 };
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

function readTiffMetadata(bytes: Uint8Array, start: number, end: number): ExifMetadata {
  const fallback: ExifMetadata = { orientation: 1 };
  if (start + 8 > end) return fallback;
  const byteOrder = String.fromCharCode(bytes[start] ?? 0, bytes[start + 1] ?? 0);
  const littleEndian = byteOrder === 'II';
  if (!littleEndian && byteOrder !== 'MM') return fallback;

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
    return (littleEndian
      ? a | (b << 8) | (c << 16) | (d << 24)
      : (a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  };

  const readEntries = (relativeOffset: number): number[] | undefined => {
    const ifdStart = start + relativeOffset;
    const entryCount = readUint16(ifdStart);
    if (entryCount === undefined || ifdStart + 2 + entryCount * 12 > end) return undefined;
    return Array.from({ length: entryCount }, (_, index) => ifdStart + 2 + index * 12);
  };
  const readAscii = (entry: number): string | undefined => {
    if (readUint16(entry + 2) !== 2) return undefined;
    const count = readUint32(entry + 4);
    if (count === undefined || count < 2 || count > 128) return undefined;
    const valueOffset = count <= 4 ? entry + 8 : start + (readUint32(entry + 8) ?? end);
    if (valueOffset < start || valueOffset + count > end) return undefined;
    let value = '';
    for (let index = 0; index < count; index += 1) {
      const byte = bytes[valueOffset + index];
      if (byte === undefined || byte === 0) break;
      if (byte < 0x20 || byte > 0x7e) return undefined;
      value += String.fromCharCode(byte);
    }
    return value.trim() || undefined;
  };

  if (readUint16(start + 2) !== 42) return fallback;
  const ifdOffset = readUint32(start + 4);
  if (ifdOffset === undefined || ifdOffset < 8) return fallback;
  const ifdEntries = readEntries(ifdOffset);
  if (!ifdEntries) return fallback;

  let orientation: ExifOrientation = 1;
  let exifIfdOffset: number | undefined;
  for (const entry of ifdEntries) {
    const tag = readUint16(entry);
    if (tag === 0x0112 && readUint16(entry + 2) === 3 && readUint32(entry + 4) === 1) {
      const value = readUint16(entry + 8);
      if (value && value >= 1 && value <= 8) orientation = value as ExifOrientation;
    } else if (tag === 0x8769 && readUint16(entry + 2) === 4 && readUint32(entry + 4) === 1) {
      exifIfdOffset = readUint32(entry + 8);
    }
  }

  if (exifIfdOffset === undefined) return { orientation };
  const exifEntries = readEntries(exifIfdOffset);
  if (!exifEntries) return { orientation };
  let capturedAtLocal: string | undefined;
  let capturedAtOffset: string | undefined;
  for (const entry of exifEntries) {
    const tag = readUint16(entry);
    if (tag === 0x9003) capturedAtLocal = readAscii(entry);
    else if (tag === 0x9011) capturedAtOffset = readAscii(entry);
  }
  return {
    ...(capturedAtLocal ? { capturedAtLocal } : {}),
    ...(capturedAtOffset ? { capturedAtOffset } : {}),
    orientation,
  };
}

function exifDateTimeToIso(value: string, offset: string | undefined, timeZone: string): string | undefined {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const parts: DateTimeParts = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6]),
  };
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const valid = new Date(wallClock);
  if (
    valid.getUTCFullYear() !== parts.year || valid.getUTCMonth() + 1 !== parts.month
    || valid.getUTCDate() !== parts.day || valid.getUTCHours() !== parts.hour
    || valid.getUTCMinutes() !== parts.minute || valid.getUTCSeconds() !== parts.second
  ) return undefined;

  const normalizedOffset = normalizeExifOffset(offset);
  if (offset && !normalizedOffset) return undefined;
  if (normalizedOffset) {
    const isoLocal = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}${normalizedOffset}`;
    const instant = new Date(isoLocal);
    return Number.isNaN(instant.getTime()) ? undefined : instant.toISOString();
  }

  return zonedWallClockToIso(parts, timeZone);
}

function normalizeExifOffset(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === 'Z') return 'Z';
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return undefined;
  return `${match[1]}${match[2]}:${match[3]}`;
}

function zonedWallClockToIso(parts: DateTimeParts, timeZone: string): string | undefined {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-hc-h23', {
      day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit', month: '2-digit',
      second: '2-digit', timeZone, year: 'numeric',
    });
    const desiredWallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    let instant = desiredWallClock;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const formatted = formattedDateTimeParts(formatter, new Date(instant));
      if (!formatted) return undefined;
      const representedWallClock = Date.UTC(
        formatted.year, formatted.month - 1, formatted.day,
        formatted.hour, formatted.minute, formatted.second,
      );
      const adjustment = desiredWallClock - representedWallClock;
      if (adjustment === 0) break;
      instant += adjustment;
    }
    const check = formattedDateTimeParts(formatter, new Date(instant));
    if (!check) return undefined;
    if (
      check.year !== parts.year || check.month !== parts.month || check.day !== parts.day
      || check.hour !== parts.hour || check.minute !== parts.minute || check.second !== parts.second
    ) return undefined;
    return new Date(instant).toISOString();
  } catch {
    return undefined;
  }
}

function formattedDateTimeParts(formatter: Intl.DateTimeFormat, value: Date): DateTimeParts | undefined {
  const result: Partial<DateTimeParts> = {};
  for (const part of formatter.formatToParts(value)) {
    if (part.type === 'literal' || part.type === 'dayPeriod') continue;
    if (part.type === 'year' || part.type === 'month' || part.type === 'day'
      || part.type === 'hour' || part.type === 'minute' || part.type === 'second') {
      result[part.type] = Number(part.value);
    }
  }
  return result.year !== undefined && result.month !== undefined && result.day !== undefined
    && result.hour !== undefined && result.minute !== undefined && result.second !== undefined
    ? result as DateTimeParts
    : undefined;
}

export async function validateImageFile(file: File, timeZone = 'UTC'): Promise<ValidatedImageFile> {
  const prefix = new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer());
  const contentType = sniffImageType(prefix);
  if (!contentType || !isAcceptedSourceImageType(contentType)) {
    throw new ImageProcessingError('UNSUPPORTED_IMAGE', 'Only JPEG, PNG, and WebP files are supported.');
  }

  const metadata = readExifMetadata(prefix);
  const orientation = metadata.orientation;
  const capturedAt = metadata.capturedAtLocal
    ? exifDateTimeToIso(metadata.capturedAtLocal, metadata.capturedAtOffset, timeZone)
    : undefined;
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
      ...(capturedAt ? { capturedAt } : {}),
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
