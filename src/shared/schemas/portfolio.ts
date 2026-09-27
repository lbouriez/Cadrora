import { z } from '../zod';

import { IdSchema } from './primitives';
import { ServiceIdSchema, ServiceVariantSchema } from './services';

export const PortfolioImageSourceSchema = z.object({
  url: z.string().startsWith('/portfolio-media/'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict();

export const PortfolioAltSchema = z.object({
  fr: z.string().min(1).max(200),
  en: z.string().min(1).max(200),
}).strict();

export const PortfolioItemSchema = z.object({
  id: IdSchema,
  serviceId: ServiceIdSchema,
  alt: PortfolioAltSchema,
  sortOrder: z.number().int().nonnegative(),
  state: z.enum(['pending', 'published']),
  imageSources: z.array(PortfolioImageSourceSchema).max(4),
}).strict();

export const PortfolioItemsSchema = z.array(PortfolioItemSchema).max(200);
export const CreatePortfolioItemSchema = z.object({
  serviceId: ServiceIdSchema,
  alt: PortfolioAltSchema,
}).strict();
export const UpdatePortfolioItemSchema = CreatePortfolioItemSchema.extend({
  sortOrder: z.number().int().nonnegative(),
}).strict();
export const PortfolioVariantSchema = ServiceVariantSchema;
export const DeletePortfolioItemResponseSchema = z.object({ deleted: z.literal(true) }).strict();
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
