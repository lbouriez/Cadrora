import { z } from '../zod';
import { SiteSettingsSchema } from './site';
import { ServiceCardsSchema } from './services';

/** The preview renderer may serialize only these validated public DTOs. */
export const MarketingSnapshotSchema = z.object({
  version: z.literal(1),
  language: z.enum(['fr', 'en']),
  pathname: z.string().regex(/^\/(?:(?:fr|en)(?:\/services)?\/?)?$/u),
  settings: SiteSettingsSchema,
  services: ServiceCardsSchema,
}).strict();

export type MarketingSnapshot = z.infer<typeof MarketingSnapshotSchema>;
