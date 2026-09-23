/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_EMBED_KEY?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_CONTACT_ADDRESS?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_CONTACT_PHONE?: string;
  readonly VITE_PHOTOGRAPHER_NAME?: string;
  readonly VITE_SERVICE_AREA?: string;
  readonly VITE_SITE_DEFAULT_LANG?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __CADRORA_SHOWCASE_DEMO__: boolean;
