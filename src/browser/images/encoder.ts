import { PHOTO_VARIANT_WIDTHS, type PhotoVariantName } from '../../shared/constants';
import { readExifOrientation, sniffImageType } from './format';
import type { EncodedImageType, EncodedPhoto, EncodedVariant, ExifOrientation } from './types';
import { ImageProcessingError } from './types';

type EncodableCanvas = HTMLCanvasElement | OffscreenCanvas;
type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export async function encodePhoto(file: File): Promise<EncodedPhoto> {
  const header = new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer());
  const sourceContentType = sniffImageType(header);
  if (!sourceContentType) {
    throw new ImageProcessingError('UNSUPPORTED_IMAGE', 'Only JPEG, PNG, and WebP files are supported.');
  }

  const orientation = readExifOrientation(header);
  let bitmap: ImageBitmap;
  try {
    // Do not allow browser-default EXIF orientation and our canvas pass to stack.
    bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
  } catch (error) {
    throw new ImageProcessingError('CORRUPT_IMAGE', 'The image cannot be decoded.', { cause: error });
  }

  try {
    const normalized = renderOrientedBitmap(bitmap, orientation);
    const variants: EncodedVariant[] = [];
    for (const [name, maximumWidth] of Object.entries(PHOTO_VARIANT_WIDTHS) as [
      PhotoVariantName,
      number,
    ][]) {
      const dimensions = constrainedDimensions(normalized.width, normalized.height, maximumWidth);
      const scaled = renderScaledCanvas(normalized, dimensions.width, dimensions.height);
      const encoded = await encodeVariant(scaled, name);
      variants.push({ ...encoded, ...dimensions, name });
    }

    return {
      height: normalized.height,
      sourceContentType,
      variants,
      width: normalized.width,
    };
  } finally {
    bitmap.close();
  }
}

export function constrainedDimensions(width: number, height: number, maximumWidth: number) {
  if (width <= maximumWidth) return { height, width };
  const ratio = maximumWidth / width;
  return { height: Math.max(1, Math.round(height * ratio)), width: maximumWidth };
}

/** Applies all eight EXIF orientations exactly once onto a metadata-free canvas. */
export function renderOrientedBitmap(bitmap: ImageBitmap, orientation: ExifOrientation): EncodableCanvas {
  const swapsDimensions = orientation >= 5;
  const canvas = createCanvas(swapsDimensions ? bitmap.height : bitmap.width, swapsDimensions ? bitmap.width : bitmap.height);
  const context = getContext(canvas);
  applyOrientationTransform(context, orientation, bitmap.width, bitmap.height);
  context.drawImage(bitmap, 0, 0);
  return canvas;
}

export function applyOrientationTransform(
  context: CanvasContext,
  orientation: ExifOrientation,
  width: number,
  height: number,
): void {
  switch (orientation) {
    case 2:
      context.setTransform(-1, 0, 0, 1, width, 0);
      return;
    case 3:
      context.setTransform(-1, 0, 0, -1, width, height);
      return;
    case 4:
      context.setTransform(1, 0, 0, -1, 0, height);
      return;
    case 5:
      context.setTransform(0, 1, 1, 0, 0, 0);
      return;
    case 6:
      context.setTransform(0, 1, -1, 0, height, 0);
      return;
    case 7:
      context.setTransform(0, -1, -1, 0, height, width);
      return;
    case 8:
      context.setTransform(0, -1, 1, 0, 0, width);
      return;
    default:
      context.setTransform(1, 0, 0, 1, 0, 0);
  }
}

function renderScaledCanvas(source: EncodableCanvas, width: number, height: number): EncodableCanvas {
  if (source.width === width && source.height === height) return source;
  const canvas = createCanvas(width, height);
  const context = getContext(canvas);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function encodeVariant(canvas: EncodableCanvas, name: PhotoVariantName): Promise<Omit<EncodedVariant, 'height' | 'name' | 'width'>> {
  if (name === 'download') {
    return encodeAs(canvas, 'image/jpeg');
  }

  try {
    return await encodeAs(canvas, 'image/webp');
  } catch {
    return encodeAs(canvas, 'image/jpeg');
  }
}

async function encodeAs(canvas: EncodableCanvas, requestedType: EncodedImageType): Promise<Omit<EncodedVariant, 'height' | 'name' | 'width'>> {
  const blob = await canvasToBlob(canvas, requestedType);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const actualType = sniffImageType(bytes);
  if (blob.type !== requestedType || actualType !== requestedType) {
    throw new ImageProcessingError('ENCODE_FAILED', `The browser did not produce ${requestedType}.`);
  }

  return {
    blob,
    byteSize: blob.size,
    checksumSha256: await sha256(bytes),
    contentType: requestedType,
  };
}

function createCanvas(width: number, height: number): EncodableCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new ImageProcessingError('ENCODE_FAILED', 'Canvas support is unavailable in this browser.');
}

function getContext(canvas: EncodableCanvas): CanvasContext {
  const context = canvas.getContext('2d');
  if (!context) throw new ImageProcessingError('ENCODE_FAILED', 'Canvas rendering is unavailable.');
  return context;
}

function canvasToBlob(canvas: EncodableCanvas, type: EncodedImageType): Promise<Blob> {
  const quality = 0.9;
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ quality, type });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ImageProcessingError('ENCODE_FAILED', 'The browser could not encode the image.'));
    }, type, quality);
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  // Blob-backed views can be ArrayBufferLike under TS 6; copy to the
  // ArrayBuffer-backed view required by the Web Crypto overload.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}
