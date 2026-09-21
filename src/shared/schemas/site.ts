import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema, LanguageSchema } from './primitives';

export const ThemeModeSchema = z.enum(['light', 'dark', 'both', 'system']);

export const SiteSettingsSchema = z.object({
  siteName: z.string().min(1).max(120),
  defaultLanguage: LanguageSchema,
  contactEmail: z.email().nullable(),
  themeMode: ThemeModeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const UpdateSiteSettingsSchema = z.object({
  defaultLanguage: LanguageSchema,
  themeMode: ThemeModeSchema,
}).strict();

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
export type Language = z.infer<typeof LanguageSchema>;
export type ThemeMode = z.infer<typeof ThemeModeSchema>;
export type UsageSnapshot = z.infer<typeof UsageSnapshotSchema>;
export type ModelManifest = z.infer<typeof ModelManifestSchema>;
