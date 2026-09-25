import { describe, expect, it } from 'vitest';

import { PlaceSuggestionsResponseSchema } from '../../../src/shared/schemas';

describe('city lookup boundary', () => {
  it('accepts a bounded place result with valid map coordinates', () => {
    expect(PlaceSuggestionsResponseSchema.parse({ features: [{
      geometry: { coordinates: [-73.34, 45.59] },
      properties: { name: 'Sainte-Julie', state: 'Québec', country: 'Canada' },
    }] }).features).toHaveLength(1);
  });

  it('rejects coordinates outside the valid map range', () => {
    expect(PlaceSuggestionsResponseSchema.safeParse({ features: [{
      geometry: { coordinates: [-200, 45.59] },
      properties: { name: 'Sainte-Julie' },
    }] }).success).toBe(false);
  });
});
