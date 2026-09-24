import { ApiException } from '../../shared/errors/ApiError';

/** Safe attachment name shared by visitor and owner media downloads. */
export function downloadName(filename: string, contentType: string): string {
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : null;
  if (!extension) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
  const basename = filename.replace(/\.[^.]+$/u, '').replace(/[^A-Za-z0-9_-]/gu, '_').slice(0, 100) || 'photo';
  return `${basename}.${extension}`;
}
