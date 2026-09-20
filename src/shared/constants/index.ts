export const PHOTO_VARIANT_WIDTHS = {
  thumb: 480,
  small: 960,
  medium: 1600,
  large: 2560,
  download: 3840,
} as const;

export type PhotoVariantName = keyof typeof PHOTO_VARIANT_WIDTHS;

export const DEFAULT_SESSION_TTL_HOURS = 8;
export const IMPORT_CHUNK_SIZE = 50;
export const FACE_PARTITION_SIZE = 100;
export const MAX_WEB_SEARCH_RESULTS = 5;

export const DEFAULT_LIMITS = {
  events: 50,
  photosPerEvent: 2_000,
  storageBytes: 10 * 1024 * 1024 * 1024,
  facesPerEvent: 10_000,
} as const;

export const API_PREFIX = '/api/v1';
export const REQUEST_ID_HEADER = 'X-Request-Id';

