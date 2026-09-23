import { SiteSettingsSchema } from '../../shared/schemas';

export interface SiteSettingsRow {
  analytics_measurement_id: string | null;
  contact_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  default_language: 'fr' | 'en';
  enabled_languages: string;
  enabled_services: string;
  map_center_latitude: number | null;
  map_center_longitude: number | null;
  map_radius_km: number | null;
  service_area: string | null;
  site_name: string;
  theme_mode: 'dark' | 'light' | 'both' | 'system';
  updated_at: string;
}

export const SITE_SETTINGS_SELECT = `SELECT site_name, default_language, enabled_languages,
  enabled_services, contact_email, contact_phone, contact_address, service_area,
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
    map: {
      centerLatitude: row.map_center_latitude,
      centerLongitude: row.map_center_longitude,
      radiusKm: row.map_radius_km,
    },
    serviceArea: row.service_area,
    siteName: row.site_name,
    themeMode: row.theme_mode,
    updatedAt: row.updated_at,
  });
}
