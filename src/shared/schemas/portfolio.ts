import { z } from '../zod';

import { IdSchema, SlugSchema } from './primitives';
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
  collectionId: IdSchema,
  serviceId: ServiceIdSchema,
  alt: PortfolioAltSchema,
  sortOrder: z.number().int().nonnegative(),
  state: z.enum(['pending', 'published']),
  imageSources: z.array(PortfolioImageSourceSchema).max(4),
}).strict();

export const PortfolioItemsSchema = z.array(PortfolioItemSchema).max(200);
export const CreatePortfolioItemSchema = z.object({
  collectionId: IdSchema,
  alt: PortfolioAltSchema,
}).strict();
export const UpdatePortfolioItemSchema = z.object({
  alt: PortfolioAltSchema,
  sortOrder: z.number().int().nonnegative(),
}).strict();
export const PortfolioVariantSchema = ServiceVariantSchema;
export const DeletePortfolioItemResponseSchema = z.object({ deleted: z.literal(true) }).strict();

export const PortfolioCollectionCopySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000),
}).strict();
export const PortfolioCollectionTextSchema = z.object({
  fr: PortfolioCollectionCopySchema,
  en: PortfolioCollectionCopySchema,
}).strict();
export const PortfolioCollectionSchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  serviceId: ServiceIdSchema,
  copy: PortfolioCollectionTextSchema,
  sortOrder: z.number().int().nonnegative(),
  published: z.boolean(),
  coverPhotoId: IdSchema.nullable(),
  coverSources: z.array(PortfolioImageSourceSchema).max(4),
  photoCount: z.number().int().nonnegative(),
}).strict();
export const PortfolioCollectionsSchema = z.array(PortfolioCollectionSchema).max(100);
export const PortfolioSitemapRowsSchema = z.array(z.object({ slug: SlugSchema }).strict()).max(100);
export const PortfolioCollectionDetailSchema = PortfolioCollectionSchema.extend({
  photos: PortfolioItemsSchema,
}).strict();
export const CreatePortfolioCollectionSchema = z.object({
  slug: SlugSchema,
  serviceId: ServiceIdSchema,
  copy: PortfolioCollectionTextSchema,
}).strict();
export const UpdatePortfolioCollectionSchema = CreatePortfolioCollectionSchema.extend({
  sortOrder: z.number().int().nonnegative(),
  published: z.boolean(),
  coverPhotoId: IdSchema.nullable(),
}).strict();
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
export type PortfolioCollection = z.infer<typeof PortfolioCollectionSchema>;
export type PortfolioCollectionDetail = z.infer<typeof PortfolioCollectionDetailSchema>;
