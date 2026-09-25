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
declare const __CADRORA_SITE_ID__: string;
declare module '@site-theme';
declare module '@site-definition' {
  // The ambient alias cannot use a top-level import without changing this file's global declarations.
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const site: import('./site/types').SiteDefinition;
  export default site;
}
