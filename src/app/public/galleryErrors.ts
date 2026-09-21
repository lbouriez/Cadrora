import { GalleryApiError } from './api';

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
