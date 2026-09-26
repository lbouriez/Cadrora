import { z } from '../zod';

/** Only the fields used from Photon suggestions cross into the admin UI. */
export const PlaceSuggestionSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
  properties: z.object({
    name: z.string().min(1),
    state: z.string().optional(),
    country: z.string().optional(),
  }),
});

export const PlaceSuggestionsResponseSchema = z.object({
  features: z.array(PlaceSuggestionSchema).max(50),
});
