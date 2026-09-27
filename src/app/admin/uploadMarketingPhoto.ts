import { createImageEncoder, variantUploadHeaders } from '../../browser/images';
import { SERVICE_VARIANT_WIDTHS } from '../../shared/constants';
import {
  PortfolioItemSchema, ServiceCardSchema, ServiceImageRevisionSchema, ServiceImageUploadResponseSchema,
} from '../../shared/schemas';

export type MarketingPhotoDestination = { kind: 'portfolio'; id: string } |
  { kind: 'service'; id: string } | { kind: 'home-hero' };

async function requestJson<T>(url: string, schema: { parse(value: unknown): T }, init: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  if (!response.ok) throw new Error(`Marketing image request returned ${response.status}`);
  return schema.parse(await response.json());
}

/** One encode/upload sequence; only the destination revision and publish contracts differ. */
export async function uploadMarketingPhoto(file: File, destination: MarketingPhotoDestination): Promise<void> {
  const encoder = createImageEncoder();
  try {
    const encoded = await encoder.encodeService(file);
    if (destination.kind === 'home-hero' && encoded.width < SERVICE_VARIANT_WIDTHS.large) {
      throw new Error('HOME_HERO_IMAGE_TOO_SMALL');
    }
    const id = destination.kind === 'home-hero' ? 'home-hero' : destination.id;
    const revision = destination.kind === 'portfolio' ? null : (await requestJson(
      `/api/v1/admin/services/${encodeURIComponent(id)}/image-revision`, ServiceImageRevisionSchema, { method: 'POST' },
    )).revision;
    const variantBase = destination.kind === 'portfolio'
      ? `/api/v1/admin/portfolio/${encodeURIComponent(id)}/image`
      : `/api/v1/admin/services/${encodeURIComponent(id)}/image/${revision}`;
    for (const variant of encoded.variants) {
      await requestJson(`${variantBase}/${variant.name}`, ServiceImageUploadResponseSchema, {
        method: 'PUT', body: variant.blob, headers: variantUploadHeaders(variant),
      });
    }
    if (destination.kind === 'portfolio') {
      await requestJson(`/api/v1/admin/portfolio/${encodeURIComponent(id)}/publish`, PortfolioItemSchema, { method: 'POST' });
    } else if (destination.kind === 'home-hero') {
      await requestJson(`${variantBase}/publish`, ServiceImageRevisionSchema, { method: 'POST' });
    } else {
      await requestJson(`${variantBase}/publish`, ServiceCardSchema, { method: 'POST' });
    }
  } finally {
    encoder.dispose();
  }
}
