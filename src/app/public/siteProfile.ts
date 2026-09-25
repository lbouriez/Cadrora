import { activeSite } from '../site/activeSite';

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
  id: activeSite.id,
  siteName: optionalValue(import.meta.env.VITE_APP_NAME) ?? activeSite.name,
  photographerName: optionalValue(import.meta.env.VITE_PHOTOGRAPHER_NAME),
  logoUrl: activeSite.logoUrl,
  heroImageUrl: activeSite.heroImageUrl,
  heroAccentImageUrl: activeSite.heroAccentImageUrl,
  mapPreviewUrl: activeSite.mapPreviewUrl,
  privateGalleryCoverUrl: activeSite.privateGalleryCoverUrl,
  serviceImages: activeSite.serviceImages,
  home: activeSite.home,
  pages: activeSite.pages,
  contact: {
    phone: optionalValue(import.meta.env.VITE_CONTACT_PHONE),
    email: optionalValue(import.meta.env.VITE_CONTACT_EMAIL),
    address: optionalValue(import.meta.env.VITE_CONTACT_ADDRESS),
    serviceArea: optionalValue(import.meta.env.VITE_SERVICE_AREA),
  },
  mapsEmbedKey: optionalValue(import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY),
  demo: {
    enabled: __CADRORA_SHOWCASE_DEMO__ && activeSite.demo !== null,
    adminPassword: activeSite.demo?.adminPassword ?? '',
    adminUsername: activeSite.demo?.adminUsername ?? '',
    privateGalleryPassword: activeSite.demo?.privateGalleryPassword ?? '',
    privateGallerySlug: activeSite.demo?.privateGallerySlug ?? '',
    publicGallerySlug: activeSite.demo?.publicGallerySlug ?? '',
  },
} as const;
