interface CloudflareBindings {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  MODELS_BUCKET: R2Bucket;
  FACE_INDEX?: VectorizeIndex;
  ADMIN_AUTH_MODE: 'password' | 'cloudflare-access';
  ADMIN_SECRET_HASH?: string;
  DEMO_ADMIN_PASSWORD?: string;
  DEMO_ADMIN_USERNAME?: string;
  DEMO_SHOWCASE_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  SESSION_TTL_H: string;
  MAX_PHOTOS_PER_EVENT: string;
  MAX_EVENTS: string;
  MAX_STORAGE_BYTES: string;
  MAX_FACES_PER_EVENT: string;
  SITE_DEFAULT_LANG: 'fr' | 'en';
}
