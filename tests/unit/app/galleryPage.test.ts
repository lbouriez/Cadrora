import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { GalleryApiError } from '../../../src/app/public/api';
import { galleryUnlockErrorKey, retryPublicGalleryRead } from '../../../src/app/public/galleryErrors';

describe('public gallery read recovery', () => {
  it.each([401, 403, 404])('surfaces HTTP %s immediately, without replaying an access decision', async (status) => {
    const client = new QueryClient();
    const error = new GalleryApiError(status);
    const read = vi.fn().mockRejectedValue(error);
    try {
      await expect(client.fetchQuery({ queryKey: ['gallery'], queryFn: read,
        retry: retryPublicGalleryRead, retryDelay: 0 })).rejects.toBe(error);
      expect(read).toHaveBeenCalledTimes(1);
    } finally { client.clear(); }
  });

  it.each([new GalleryApiError(503), new TypeError('Failed to fetch')])('recovers from one transient read failure', async (error) => {
    const client = new QueryClient();
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('published gallery');
    try {
      await expect(client.fetchQuery({ queryKey: ['gallery'], queryFn: read,
        retry: retryPublicGalleryRead, retryDelay: 0 })).resolves.toBe('published gallery');
      expect(read).toHaveBeenCalledTimes(2);
    } finally { client.clear(); }
  });

  it('bounds a persistent outage and does not retry a malformed response', async () => {
    const client = new QueryClient();
    const outage = vi.fn().mockRejectedValue(new GalleryApiError(503));
    const malformed = vi.fn().mockRejectedValue(new Error('Invalid response schema'));
    try {
      await expect(client.fetchQuery({ queryKey: ['outage'], queryFn: outage,
        retry: retryPublicGalleryRead, retryDelay: 0 })).rejects.toBeInstanceOf(GalleryApiError);
      expect(outage).toHaveBeenCalledTimes(2);
      await expect(client.fetchQuery({ queryKey: ['malformed'], queryFn: malformed,
        retry: retryPublicGalleryRead, retryDelay: 0 })).rejects.toThrow('Invalid response schema');
      expect(malformed).toHaveBeenCalledTimes(1);
    } finally { client.clear(); }
  });
});

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
