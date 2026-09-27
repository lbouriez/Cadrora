import type { PhotoVariantName } from '../../shared/constants';

export const ACCEPTED_SOURCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AcceptedSourceImageType = (typeof ACCEPTED_SOURCE_IMAGE_TYPES)[number];
export type EncodedImageType = 'image/jpeg' | 'image/webp';

export interface ValidatedImageFile {
  capturedAt?: string;
  contentType: AcceptedSourceImageType;
  file: File;
  height: number;
  orientation: ExifOrientation;
  width: number;
}

export interface EncodedVariant<Name extends string = PhotoVariantName | 'original'> {
  blob: Blob;
  byteSize: number;
  checksumSha256: string;
  contentType: AcceptedSourceImageType;
  height: number;
  name: Name;
  width: number;
}

export interface EncodedPhoto<Name extends string = PhotoVariantName | 'original'> {
  height: number;
  sourceContentType: AcceptedSourceImageType;
  variants: EncodedVariant<Name>[];
  width: number;
}

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export class ImageProcessingError extends Error {
  constructor(
    readonly code: 'CORRUPT_IMAGE' | 'UNSUPPORTED_IMAGE' | 'ENCODE_FAILED',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ImageProcessingError';
  }
}
