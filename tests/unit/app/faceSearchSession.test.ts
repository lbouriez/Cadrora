// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFaceSearchResults, saveFaceSearchResults } from '../../../src/app/public/faceSearchSession';

describe('face search session results', () => {
  const match = {
    capturedAt: '2026-09-20T16:00:00.000Z',
    momentId: 'ceremony',
    photoId: 'photo-2',
    revision: 2,
    thumbnailUrl: '/media/event/photo-2/2/thumb',
  };
  const nearby = {
    ...match,
    momentId: 'portraits',
    photoId: 'photo-1',
    thumbnailUrl: '/media/event/photo-1/2/thumb',
  };

  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T18:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('persists separate match and nearby references without face scores', () => {
    const scoredMatches = [{ ...match, score: 0.92 }, { ...match, score: 0.61 }];
    const scoredNearby = [nearby, { ...match, score: 0.8 }];
    saveFaceSearchResults(
      'find-your-photos',
      scoredMatches,
      scoredNearby,
    );

    expect(readFaceSearchResults('find-your-photos')).toEqual({
      matchedPhotoIds: ['photo-2'],
      matchedPhotos: [match],
      nearbyPhotoIds: ['photo-1'],
      nearbyPhotos: [nearby],
    });
    expect(readFaceSearchResults('another-gallery')).toEqual({
      matchedPhotoIds: [], matchedPhotos: [], nearbyPhotoIds: [], nearbyPhotos: [],
    });
    expect(sessionStorage.getItem('cadrora:face-search:find-your-photos')).not.toContain('score');
  });

  it('keeps legacy match identifiers readable after an upgrade', () => {
    sessionStorage.setItem('cadrora:face-search:find-your-photos', '{"photoIds":["photo-2"],"savedAt":"2026-09-21T18:00:00.000Z"}');

    expect(readFaceSearchResults('find-your-photos').matchedPhotoIds).toEqual(['photo-2']);
  });

  it('fails closed when session storage contains malformed data', () => {
    sessionStorage.setItem('cadrora:face-search:find-your-photos', '{"photoIds":[42]}');

    expect(readFaceSearchResults('find-your-photos')).toEqual({
      matchedPhotoIds: [], matchedPhotos: [], nearbyPhotoIds: [], nearbyPhotos: [],
    });
  });
});
