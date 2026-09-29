import { SiteSettingsSchema } from '../../shared/schemas';

export interface SiteSettingsRow {
  analytics_measurement_id: string | null;
  contact_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  default_language: 'fr' | 'en';
  enabled_languages: string;
  enabled_services: string;
  construction_notice_enabled: number | null;
  gallery_directory_enabled: number;
  home_galleries_enabled: number;
  home_galleries_limit: number;
  home_services_limit: number;
  home_hero_copy: string | null;
  home_hero_image_revision: number | null;
  home_hero_image_medium_width: number | null;
  home_hero_image_large_width: number | null;
  about_enabled: number;
  about_copy: string | null;
  about_image_revision: number | null;
  about_image_medium_width: number | null;
  about_image_large_width: number | null;
  map_center_latitude: number | null;
  map_center_longitude: number | null;
  map_radius_km: number | null;
  service_area: string | null;
  site_name: string;
  site_copy: string | null;
  theme_mode: 'dark' | 'light' | 'both' | 'system';
  updated_at: string;
}

export const SITE_SETTINGS_SELECT = `SELECT site_name, site_copy, default_language, enabled_languages,
  enabled_services, construction_notice_enabled, gallery_directory_enabled, home_galleries_enabled, home_galleries_limit, home_services_limit,
  home_hero_copy, (SELECT NULLIF(image_revision, 0) FROM site_services WHERE id = 'home-hero' AND site_settings.home_hero_image_enabled = 1) AS home_hero_image_revision,
  (SELECT v.width FROM site_service_variants v JOIN site_services s ON s.id = v.service_id
    WHERE v.service_id = 'home-hero' AND v.variant = 'medium' AND v.revision = s.image_revision
      AND site_settings.home_hero_image_enabled = 1) AS home_hero_image_medium_width,
  (SELECT v.width FROM site_service_variants v JOIN site_services s ON s.id = v.service_id
    WHERE v.service_id = 'home-hero' AND v.variant = 'large' AND v.revision = s.image_revision
      AND site_settings.home_hero_image_enabled = 1) AS home_hero_image_large_width,
  about_enabled, about_copy,
  (SELECT NULLIF(image_revision, 0) FROM site_services WHERE id = 'about-hero' AND site_settings.about_image_enabled = 1) AS about_image_revision,
  (SELECT v.width FROM site_service_variants v JOIN site_services s ON s.id = v.service_id
    WHERE v.service_id = 'about-hero' AND v.variant = 'medium' AND v.revision = s.image_revision
      AND site_settings.about_image_enabled = 1) AS about_image_medium_width,
  (SELECT v.width FROM site_service_variants v JOIN site_services s ON s.id = v.service_id
    WHERE v.service_id = 'about-hero' AND v.variant = 'large' AND v.revision = s.image_revision
      AND site_settings.about_image_enabled = 1) AS about_image_large_width,
  contact_email, contact_phone, contact_address, service_area,
  map_center_latitude, map_center_longitude, map_radius_km,
  theme_mode, analytics_measurement_id, updated_at FROM site_settings WHERE id = 1`;

/** Shared D1-to-public contract conversion for owner and visitor routes. */
export function siteSettingsFromRow(row: SiteSettingsRow) {
  return SiteSettingsSchema.parse({
    analyticsMeasurementId: row.analytics_measurement_id,
    contactAddress: row.contact_address,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    defaultLanguage: row.default_language,
    enabledLanguages: JSON.parse(row.enabled_languages) as unknown,
    enabledServices: JSON.parse(row.enabled_services) as unknown,
    constructionNoticeEnabled: row.construction_notice_enabled === 1,
    galleryDirectoryEnabled: row.gallery_directory_enabled !== 0,
    homeGalleries: {
      enabled: row.home_galleries_enabled === 1,
      limit: row.home_galleries_limit,
    },
    homeServicesLimit: row.home_services_limit,
    homeHeroCopy: row.home_hero_copy ? JSON.parse(row.home_hero_copy) as unknown : null,
    homeHeroImageRevision: row.home_hero_image_revision,
    homeHeroImageMediumWidth: row.home_hero_image_medium_width,
    homeHeroImageLargeWidth: row.home_hero_image_large_width,
    aboutEnabled: row.about_enabled !== 0,
    aboutCopy: row.about_copy ? JSON.parse(row.about_copy) as unknown : null,
    aboutImageRevision: row.about_image_revision,
    aboutImageMediumWidth: row.about_image_medium_width,
    aboutImageLargeWidth: row.about_image_large_width,
    map: {
      centerLatitude: row.map_center_latitude,
      centerLongitude: row.map_center_longitude,
      radiusKm: row.map_radius_km,
    },
    serviceArea: row.service_area,
    siteName: row.site_name,
    siteCopy: row.site_copy ? JSON.parse(row.site_copy) as unknown : null,
    themeMode: row.theme_mode,
    updatedAt: row.updated_at,
  });
}
