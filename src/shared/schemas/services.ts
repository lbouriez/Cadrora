import { z } from '../zod';
import { MAX_SITE_SERVICES } from '../constants';

export const ServiceIdSchema = z.string().regex(/^(?:[a-z][a-z0-9-]{0,63}|[0-9a-f]{8}-[0-9a-f-]{27,})$/u);
export const ServiceVariantSchema = z.enum(['preview', 'small', 'medium', 'large']);
export const ServiceCopyLanguageSchema = z.object({
  title: z.string().min(1).max(120),
  shortDescription: z.string().min(1).max(180),
  description: z.string().min(1).max(600),
  points: z.array(z.string().min(1).max(200)).max(5),
  duration: z.string().max(120).optional(),
  priceRange: z.string().max(160).optional(),
  details: z.string().max(2000).optional(),
}).strict();
export const ServiceCopySchema = z.object({ fr: ServiceCopyLanguageSchema, en: ServiceCopyLanguageSchema }).strict();
export const ServiceImageSourceSchema = z.object({ url: z.string().startsWith('/service-media/'), width: z.number().int().positive(), height: z.number().int().positive() }).strict();
export const ServiceCardSchema = z.object({
  id: ServiceIdSchema,
  isBuiltin: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
  showOnHome: z.boolean(),
  copy: ServiceCopySchema.nullable(),
  imageRevision: z.number().int().positive().nullable(),
  imageSources: z.array(ServiceImageSourceSchema),
}).strict();
export const ServiceCardsSchema = z.array(ServiceCardSchema).max(MAX_SITE_SERVICES);
export const ServiceCardUpdateSchema = z.object({
  enabled: z.boolean(),
  showOnHome: z.boolean(),
  sortOrder: z.number().int().min(0).max(MAX_SITE_SERVICES - 1),
  copy: ServiceCopySchema.nullable(),
}).strict();
export const ServiceImageUploadHeadersSchema = z.object({
  byteSize: z.coerce.number().int().min(1).max(8_000_000),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  contentType: z.enum(['image/jpeg', 'image/webp']),
  width: z.coerce.number().int().min(1).max(4000),
  height: z.coerce.number().int().min(1).max(8000),
}).strict();
export const ServiceImageRevisionSchema = z.object({ revision: z.number().int().positive() }).strict();
export const ServiceImageUploadResponseSchema = z.object({ variant: ServiceVariantSchema }).strict();
export type ServiceCard = z.infer<typeof ServiceCardSchema>;
export type ServiceCopy = z.infer<typeof ServiceCopySchema>;
export type ServiceVariant = z.infer<typeof ServiceVariantSchema>;
