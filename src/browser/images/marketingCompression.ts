import type { ServiceVariantName } from '../../shared/constants';

export type MarketingPhotoCompression = 'balanced' | 'lighter';

/** Display-only recipes. Gallery downloads and unchanged originals use their own pipeline. */
export const MARKETING_PHOTO_QUALITY: Record<MarketingPhotoCompression, Record<ServiceVariantName, number>> = {
  balanced: { preview: 0.45, small: 0.65, medium: 0.72, large: 0.78 },
  lighter: { preview: 0.35, small: 0.5, medium: 0.58, large: 0.65 },
};

export function isMarketingPhotoCompression(value: unknown): value is MarketingPhotoCompression {
  return value === 'balanced' || value === 'lighter';
}
