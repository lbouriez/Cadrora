import { z } from 'zod';

export const IdSchema = z.string().min(1).max(128);
export const SlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const LanguageSchema = z.enum(['fr', 'en']);
export const CursorSchema = z.string().min(1).max(2_048);

