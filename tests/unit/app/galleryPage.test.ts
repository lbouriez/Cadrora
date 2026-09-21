import { describe, expect, it } from 'vitest';

import { GalleryApiError } from '../../../src/app/public/api';
import { galleryUnlockErrorKey } from '../../../src/app/public/galleryErrors';

describe('gallery unlock error copy', () => {
  it('distinguishes password, security, service, and rate-limit failures', () => {
    expect(galleryUnlockErrorKey(new GalleryApiError(401, 'INVALID_EVENT_PASSWORD')))
      .toBe('gallery.unlockPasswordError');
    expect(galleryUnlockErrorKey(new GalleryApiError(403, 'TURNSTILE_FAILED')))
      .toBe('gallery.unlockSecurityError');
    expect(galleryUnlockErrorKey(new GalleryApiError(503, 'TURNSTILE_UNAVAILABLE')))
      .toBe('gallery.unlockSecurityError');
    expect(galleryUnlockErrorKey(new GalleryApiError(503, 'EVENT_PASSWORD_UNAVAILABLE')))
      .toBe('gallery.unlockServiceError');
    expect(galleryUnlockErrorKey(new GalleryApiError(503, 'EVENT_GRANT_UNAVAILABLE')))
      .toBe('gallery.unlockServiceError');
    expect(galleryUnlockErrorKey(new GalleryApiError(429, 'RATE_LIMITED')))
      .toBe('gallery.unlockRateLimitError');
  });
});
