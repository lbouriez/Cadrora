import { describe, expect, it } from 'vitest';

import { CACHE_CONTROL_BY_POLICY } from '../../../src/server/middleware/cacheHeaders';
import {
  hashEventPassword,
  verifyEventPassword,
  verifyEventPasswordDetailed,
} from '../../../src/server/routes/public/credentials';
import { photosFromRows } from '../../../src/server/routes/public/data';
import { decodePhotoCursor, encodePhotoCursor } from '../../../src/server/routes/public/events';

describe('public gallery contracts', () => {
  it('round trips a stable sort key, id, and revision cursor', () => {
    const cursor = { sortKey: '2026-09-20T10:00:00.000Z', id: 'photo-2', revision: 7 };
    expect(decodePhotoCursor(encodePhotoCursor(cursor))).toEqual(cursor);
    expect(() => decodePhotoCursor('not-json')).toThrowError('errors.invalidCursor');
  });

  it('hashes event passwords with a salt and verifies without storing plaintext', async () => {
    const encoded = await hashEventPassword('correct horse battery staple');
    expect(encoded).not.toContain('correct horse battery staple');
    await expect(verifyEventPassword('correct horse battery staple', encoded)).resolves.toBe(true);
    await expect(verifyEventPassword('wrong password', encoded)).resolves.toBe(false);
    await expect(verifyEventPasswordDetailed('wrong password', encoded)).resolves.toBe('mismatch');
    await expect(verifyEventPasswordDetailed('password', 'not-a-supported-hash')).resolves.toBe('invalid-hash');
  });

  it('builds revisioned responsive sources and hides downloads when disabled', () => {
    const rows = [
      {
        id: 'photo-1', event_id: 'event-1', filename: 'moment.jpg', width: 1600, height: 1200,
        captured_at: null, sort_key: '001', revision: 3, variant: 'thumb' as const,
        content_type: 'image/jpeg' as const, variant_width: 480, variant_height: 360,
      },
      {
        id: 'photo-1', event_id: 'event-1', filename: 'moment.jpg', width: 1600, height: 1200,
        captured_at: null, sort_key: '001', revision: 3, variant: 'download' as const,
        content_type: 'image/jpeg' as const, variant_width: 1600, variant_height: 1200,
      },
    ];
    const photo = photosFromRows(rows, false)[0];
    expect(photo?.sources[0]?.url).toBe('/media/event-1/photo-1/3/thumb');
    expect(photo?.downloadUrl).toBeNull();
    expect(photosFromRows(rows, true)[0]?.downloadUrl).toBe('/media/event-1/photo-1/3/download');
  });

  it('keeps the frozen cache matrix exact', () => {
    expect(CACHE_CONTROL_BY_POLICY).toEqual({
      admin: 'no-store',
      asset: 'public, max-age=31536000, immutable',
      'event-protected': 'private, no-store',
      'event-public': 'public, max-age=60',
      'media-protected': 'private, max-age=3600',
      'media-public': 'public, max-age=31536000, immutable',
    });
  });
});
