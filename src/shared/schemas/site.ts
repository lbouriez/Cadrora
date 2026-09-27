import { z } from '../zod';

import { IdSchema, IsoDateTimeSchema, LanguageSchema } from './primitives';

export const ThemeModeSchema = z.enum(['light', 'dark', 'both', 'system']);
export const AnalyticsMeasurementIdSchema = z.string().regex(/^G-[A-Z0-9]{6,20}$/u).nullable();
export const ServiceKeySchema = z.enum(['wedding', 'family', 'brand', 'corporate', 'children']);
export const EnabledServicesSchema = z.array(ServiceKeySchema).min(1).max(5).refine(
  (services) => new Set(services).size === services.length,
  { message: 'services must be unique' },
);
export const MapSettingsSchema = z.object({
  centerLatitude: z.number().min(-90).max(90).nullable(),
  centerLongitude: z.number().min(-180).max(180).nullable(),
  radiusKm: z.number().int().min(1).max(2000).nullable(),
}).refine((map) => [map.centerLatitude, map.centerLongitude, map.radiusKm].every((value) => value === null)
  || [map.centerLatitude, map.centerLongitude, map.radiusKm].every((value) => value !== null), {
  message: 'map center and radius must be configured together',
});
export const ContactEmailSchema = z.union([z.email(), z.literal('')]).nullable();
export const HomeGalleriesSchema = z.object({
  enabled: z.boolean(),
  limit: z.number().int().min(1).max(12),
});
export const HomeServicesLimitSchema = z.number().int().min(1).max(12);

export const HomeHeroDestinationSchema = z.enum([
  '/contact', '/services', '/portfolio', '/galleries', '#services', '#galleries', '/e/find-your-photos/find',
]);
export const HomeHeroLanguageSchema = z.object({
  label: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  caption: z.string().max(120),
  imageAlt: z.string().min(1).max(180),
}).strict();
export const HomeHeroButtonSchema = z.object({
  labels: z.object({ fr: z.string().min(1).max(60), en: z.string().min(1).max(60) }).strict(),
  href: HomeHeroDestinationSchema,
  variant: z.enum(['primary', 'secondary']),
}).strict();
const CurrentHomeHeroCopySchema = z.object({
  fr: HomeHeroLanguageSchema,
  en: HomeHeroLanguageSchema,
  buttons: z.array(HomeHeroButtonSchema).max(6),
}).strict();
const LegacyHomeHeroLanguageSchema = HomeHeroLanguageSchema.extend({
  primaryButtonLabel: z.string().min(1).max(60),
  secondaryButtonLabel: z.string().min(1).max(60),
}).strict();
const LegacyHomeHeroCopySchema = z.object({
  fr: LegacyHomeHeroLanguageSchema,
  en: LegacyHomeHeroLanguageSchema,
  primaryHref: HomeHeroDestinationSchema,
  secondaryHref: HomeHeroDestinationSchema,
  showSecondary: z.boolean(),
}).strict();
/** Old D1 documents stay readable and are returned in the current action-list shape. */
export const HomeHeroCopySchema = z.union([CurrentHomeHeroCopySchema, LegacyHomeHeroCopySchema.transform((legacy) => {
  const { primaryButtonLabel: primaryFr, secondaryButtonLabel: secondaryFr, ...fr } = legacy.fr;
  const { primaryButtonLabel: primaryEn, secondaryButtonLabel: secondaryEn, ...en } = legacy.en;
  return {
    fr, en,
    buttons: [
      { labels: { fr: primaryFr, en: primaryEn }, href: legacy.primaryHref, variant: 'primary' as const },
      ...(legacy.showSecondary ? [{ labels: { fr: secondaryFr, en: secondaryEn }, href: legacy.secondaryHref, variant: 'secondary' as const }] : []),
    ],
  };
})]);

export const SiteCopyLanguageSchema = z.object({
  description: z.string().min(1).max(300).optional(),
  footerTagline: z.string().max(160).optional(),
}).strict();
export const SiteCopySchema = z.object({
  fr: SiteCopyLanguageSchema,
  en: SiteCopyLanguageSchema,
}).strict();

export const QuotaLimitsSchema = z.object({
  faceLimit: z.number().int().positive(),
  storageLimitBytes: z.number().int().positive(),
});

export const QuotaUsageSchema = z.object({
  faces: z.number().int().nonnegative(),
  storageBytes: z.number().int().nonnegative(),
});

export const SiteSettingsSchema = z.object({
  siteName: z.string().min(1).max(120),
  siteCopy: SiteCopySchema.nullable().default(null),
  defaultLanguage: LanguageSchema,
  enabledLanguages: z.array(LanguageSchema).min(1).max(2).refine(
    (languages) => new Set(languages).size === languages.length,
    { message: 'languages must be unique' },
  ),
  contactEmail: ContactEmailSchema,
  contactPhone: z.string().max(60).nullable(),
  contactAddress: z.string().max(240).nullable(),
  serviceArea: z.string().max(240).nullable(),
  map: MapSettingsSchema,
  enabledServices: EnabledServicesSchema,
  constructionNoticeEnabled: z.boolean().default(false),
  galleryDirectoryEnabled: z.boolean().default(true),
  homeGalleries: HomeGalleriesSchema,
  homeServicesLimit: HomeServicesLimitSchema,
  homeHeroCopy: HomeHeroCopySchema.nullable().default(null),
  homeHeroImageRevision: z.number().int().positive().nullable().default(null),
  analyticsMeasurementId: AnalyticsMeasurementIdSchema,
  themeMode: ThemeModeSchema,
  updatedAt: IsoDateTimeSchema,
}).refine((settings) => settings.enabledLanguages.includes(settings.defaultLanguage), {
  message: 'default language must be enabled',
  path: ['defaultLanguage'],
});

export const UpdateSiteSettingsSchema = z.object({
  analyticsMeasurementId: AnalyticsMeasurementIdSchema,
  siteName: z.string().min(1).max(120),
  siteCopy: SiteCopySchema.optional(),
  contactEmail: ContactEmailSchema,
  contactPhone: z.string().max(60).nullable(),
  contactAddress: z.string().max(240).nullable(),
  serviceArea: z.string().max(240).nullable(),
  map: MapSettingsSchema,
  enabledServices: EnabledServicesSchema,
  constructionNoticeEnabled: z.boolean().optional(),
  galleryDirectoryEnabled: z.boolean().optional(),
  homeGalleries: HomeGalleriesSchema,
  homeServicesLimit: HomeServicesLimitSchema,
  defaultLanguage: LanguageSchema,
  enabledLanguages: z.array(LanguageSchema).min(1).max(2).refine(
    (languages) => new Set(languages).size === languages.length,
    { message: 'languages must be unique' },
  ),
  quotas: QuotaLimitsSchema,
  themeMode: ThemeModeSchema,
}).strict().refine((settings) => settings.enabledLanguages.includes(settings.defaultLanguage), {
  message: 'default language must be enabled',
  path: ['defaultLanguage'],
});

export const AdminSiteSettingsSchema = SiteSettingsSchema.extend({
  quotaCeilings: QuotaLimitsSchema,
  quotas: QuotaLimitsSchema,
  usage: QuotaUsageSchema,
});

export const UsageSnapshotSchema = z.object({
  capturedAt: IsoDateTimeSchema,
  events: z.number().int().nonnegative(),
  photos: z.number().int().nonnegative(),
  storageBytes: z.number().int().nonnegative(),
  faces: z.number().int().nonnegative(),
  vectorDimensionsQueried: z.number().int().nonnegative(),
});

export const ModelManifestSchema = z.object({
  id: IdSchema,
  version: z.string().min(1).max(64),
  license: z.string().min(1).max(120),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z.number().int().positive(),
  dimensions: z.number().int().positive(),
  preprocessing: z.string().min(1).max(1_000),
  metric: z.literal('cosine'),
  immutableUrl: z.url({ protocol: /^https$/ }),
});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;
export type SiteCopy = z.infer<typeof SiteCopySchema>;
export type HomeHeroCopy = z.infer<typeof HomeHeroCopySchema>;
export type AdminSiteSettings = z.infer<typeof AdminSiteSettingsSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type QuotaLimits = z.infer<typeof QuotaLimitsSchema>;
export type QuotaUsage = z.infer<typeof QuotaUsageSchema>;
export type ThemeMode = z.infer<typeof ThemeModeSchema>;
export type ServiceKey = z.infer<typeof ServiceKeySchema>;
export type UsageSnapshot = z.infer<typeof UsageSnapshotSchema>;
export type ModelManifest = z.infer<typeof ModelManifestSchema>;
