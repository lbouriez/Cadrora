import { encodePhoto, encodeServicePhoto } from './encoder';
import type { ServiceVariantName } from '../../shared/constants';
import type { EncodedPhoto } from './types';
import type { MarketingPhotoCompression } from './marketingCompression';

interface EncodeRequest {
  compression?: MarketingPhotoCompression;
  file: File;
  id: string;
  recipe: 'gallery' | 'service';
  type: 'encode';
}

interface GalleryEncodeSuccess {
  id: string;
  photo: Awaited<ReturnType<typeof encodePhoto>>;
  recipe: 'gallery';
  type: 'success';
}
interface ServiceEncodeSuccess {
  id: string;
  photo: EncodedPhoto<ServiceVariantName>;
  recipe: 'service';
  type: 'success';
}

interface EncodeFailure {
  code: string;
  id: string;
  message: string;
  type: 'failure';
}

function isEncodeRequest(value: unknown): value is EncodeRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<EncodeRequest>;
  return candidate.type === 'encode' && typeof candidate.id === 'string' && (candidate.recipe === 'gallery' || candidate.recipe === 'service') && candidate.file instanceof File;
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isEncodeRequest(event.data)) return;
  void encode(event.data);
});

async function encode(request: EncodeRequest): Promise<void> {
  try {
    const response: GalleryEncodeSuccess | ServiceEncodeSuccess = request.recipe === 'service'
      ? { id: request.id, photo: await encodeServicePhoto(request.file, request.compression), recipe: 'service', type: 'success' }
      : { id: request.id, photo: await encodePhoto(request.file), recipe: 'gallery', type: 'success' };
    self.postMessage(response);
  } catch (error) {
    const response: EncodeFailure = {
      code: error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'ENCODE_FAILED',
      id: request.id,
      message: error instanceof Error ? error.message : 'Image encoding failed.',
      type: 'failure',
    };
    self.postMessage(response);
  }
}
