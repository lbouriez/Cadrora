// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFaceSearchResults, saveFaceSearchResults } from '../../../src/app/public/faceSearchSession';

describe('face search session results', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T18:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('persists only unique photo identifiers for one gallery and one browser session', () => {
    saveFaceSearchResults('find-your-photos', ['photo-2', 'photo-1', 'photo-2']);

    expect(readFaceSearchResults('find-your-photos')).toEqual(['photo-2', 'photo-1']);
    expect(readFaceSearchResults('another-gallery')).toEqual([]);
    expect(sessionStorage.getItem('cadrora:face-search:find-your-photos')).toBe(
      '{"photoIds":["photo-2","photo-1"],"savedAt":"2026-09-21T18:00:00.000Z"}',
    );
  });

  it('fails closed when session storage contains malformed data', () => {
    sessionStorage.setItem('cadrora:face-search:find-your-photos', '{"photoIds":[42]}');

    expect(readFaceSearchResults('find-your-photos')).toEqual([]);
  });
});
