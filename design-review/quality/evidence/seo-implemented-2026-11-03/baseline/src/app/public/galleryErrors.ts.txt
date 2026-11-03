import { GalleryApiError } from './api';

/** Access decisions are final until the visitor supplies a new grant. Only reads use this policy. */
export function retryPublicGalleryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof GalleryApiError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  // fetch rejects with TypeError for a network failure; schema/programming errors are not transient.
  return error instanceof TypeError;
}

export function galleryUnlockErrorKey(error: unknown): string {
  if (!(error instanceof GalleryApiError)) return 'gallery.unlockError';
  if (error.status === 401) return 'gallery.unlockPasswordError';
  if (error.status === 429) return 'gallery.unlockRateLimitError';
  if (error.code === 'EVENT_PASSWORD_UNAVAILABLE' || error.code === 'EVENT_GRANT_UNAVAILABLE') {
    return 'gallery.unlockServiceError';
  }
  if (error.code?.startsWith('TURNSTILE_') || error.status === 403) return 'gallery.unlockSecurityError';
  return 'gallery.unlockError';
}
