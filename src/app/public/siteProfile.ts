function optionalValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * Public, build-time-only content for the photographer website.
 * These values are deliberately separate from Worker secrets and may be
 * changed through Cloudflare Pages/Workers build variables.
 */
export const siteProfile = {
  siteName: optionalValue(import.meta.env.VITE_APP_NAME) ?? 'Cadrora',
  photographerName: optionalValue(import.meta.env.VITE_PHOTOGRAPHER_NAME) ?? 'Camille Laurent',
  contact: {
    phone: optionalValue(import.meta.env.VITE_CONTACT_PHONE),
    email: optionalValue(import.meta.env.VITE_CONTACT_EMAIL),
    address: optionalValue(import.meta.env.VITE_CONTACT_ADDRESS),
    serviceArea: optionalValue(import.meta.env.VITE_SERVICE_AREA),
  },
  mapsEmbedKey: optionalValue(import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY),
  demo: {
    enabled: __CADRORA_SHOWCASE_DEMO__,
    adminPassword: 'cadrora-demo',
    adminUsername: 'demo',
    privateGalleryPassword: 'cadrora-demo',
    privateGallerySlug: 'instants-en-famille',
    publicGallerySlug: 'lumiere-et-promesses',
  },
} as const;
