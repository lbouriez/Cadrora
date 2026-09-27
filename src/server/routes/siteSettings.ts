import { SiteSettingsSchema } from '../../shared/schemas';

export interface SiteSettingsRow {
  analytics_measurement_id: string | null;
  contact_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  default_language: 'fr' | 'en';
  enabled_languages: string;
  enabled_services: string;
  home_galleries_enabled: number;
  home_galleries_limit: number;
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
  enabled_services, home_galleries_enabled, home_galleries_limit,
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
    homeGalleries: {
      enabled: row.home_galleries_enabled === 1,
      limit: row.home_galleries_limit,
    },
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
