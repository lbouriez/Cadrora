import { encodePhoto, encodeServicePhoto } from './encoder';
import type { ServiceVariantName } from '../../shared/constants';
import type { EncodedPhoto } from './types';
import { ImageProcessingError } from './types';
import type { MarketingPhotoCompression } from './marketingCompression';

export interface ImageEncoder {
  encode(file: File): Promise<EncodedPhoto>;
  dispose(): void;
}

export interface ServiceImageEncoder extends ImageEncoder {
  encodeService(file: File, compression?: MarketingPhotoCompression): Promise<EncodedPhoto<ServiceVariantName>>;
}

interface GalleryWorkerSuccess {
  id: string;
  photo: EncodedPhoto;
  recipe: 'gallery';
  type: 'success';
}
interface ServiceWorkerSuccess {
  id: string;
  photo: EncodedPhoto<ServiceVariantName>;
  recipe: 'service';
  type: 'success';
}

interface WorkerFailure {
  code: string;
  id: string;
  message: string;
  type: 'failure';
}

type WorkerResponse = GalleryWorkerSuccess | ServiceWorkerSuccess | WorkerFailure;

class MainThreadImageEncoder implements ServiceImageEncoder {
  async encode(file: File): Promise<EncodedPhoto> {
    return encodePhoto(file);
  }

  async encodeService(file: File, compression?: MarketingPhotoCompression): Promise<EncodedPhoto<ServiceVariantName>> {
    return encodeServicePhoto(file, compression);
  }

  dispose(): void {}
}

class WebWorkerImageEncoder implements ServiceImageEncoder {
  private readonly pending = new Map<string, { reject: (reason: Error) => void; resolve: (photo: EncodedPhoto) => void }>();
  private readonly servicePending = new Map<string, { reject: (reason: Error) => void; resolve: (photo: EncodedPhoto<ServiceVariantName>) => void }>();
  private readonly worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('./imageEncoder.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => this.onMessage(event.data));
    this.worker.addEventListener('error', () => this.failPending(new Error('Image worker stopped unexpectedly.')));
  }

  encode(file: File): Promise<EncodedPhoto> {
    const id = crypto.randomUUID();
    return new Promise<EncodedPhoto>((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.worker.postMessage({ file, id, recipe: 'gallery', type: 'encode' });
    });
  }

  encodeService(file: File, compression?: MarketingPhotoCompression): Promise<EncodedPhoto<ServiceVariantName>> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.servicePending.set(id, { reject, resolve });
      this.worker.postMessage({ file, id, recipe: 'service', type: 'encode', compression });
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.failPending(new Error('Image worker was disposed.'));
  }

  private onMessage(response: WorkerResponse): void {
    const servicePending = this.servicePending.get(response.id);
    if (servicePending) {
      this.servicePending.delete(response.id);
      if (response.type === 'success' && response.recipe === 'service') servicePending.resolve(response.photo);
      else servicePending.reject(new ImageProcessingError(response.type === 'failure' && response.code === 'CORRUPT_IMAGE' ? 'CORRUPT_IMAGE' : 'ENCODE_FAILED', response.type === 'failure' ? response.message : 'Image encoding failed.'));
      return;
    }
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.type === 'success' && response.recipe === 'gallery') {
      pending.resolve(response.photo);
      return;
    }
    const code = response.type === 'failure' && (response.code === 'CORRUPT_IMAGE' || response.code === 'UNSUPPORTED_IMAGE') ? response.code : 'ENCODE_FAILED';
    pending.reject(new ImageProcessingError(code, response.type === 'failure' ? response.message : 'Image encoding failed.'));
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    for (const pending of this.servicePending.values()) pending.reject(error);
    this.servicePending.clear();
  }
}

class FallbackImageEncoder implements ServiceImageEncoder {
  private readonly mainThread = new MainThreadImageEncoder();
  private worker: WebWorkerImageEncoder | undefined;

  constructor(worker: WebWorkerImageEncoder | undefined) {
    this.worker = worker;
  }

  async encode(file: File): Promise<EncodedPhoto> {
    if (!this.worker) return this.mainThread.encode(file);
    try {
      return await this.worker.encode(file);
    } catch (error) {
      if (error instanceof ImageProcessingError && (error.code === 'CORRUPT_IMAGE' || error.code === 'UNSUPPORTED_IMAGE')) {
        throw error;
      }
      // A worker/runtime failure must not prevent an otherwise capable browser
      // from importing; retry the current natural-idempotent unit on main.
      this.worker.dispose();
      this.worker = undefined;
      return this.mainThread.encode(file);
    }
  }

  async encodeService(file: File, compression?: MarketingPhotoCompression): Promise<EncodedPhoto<ServiceVariantName>> {
    if (!this.worker) return this.mainThread.encodeService(file, compression);
    try {
      return await this.worker.encodeService(file, compression);
    } catch (error) {
      if (error instanceof ImageProcessingError && (error.code === 'CORRUPT_IMAGE' || error.code === 'UNSUPPORTED_IMAGE')) throw error;
      this.worker.dispose();
      this.worker = undefined;
      return this.mainThread.encodeService(file, compression);
    }
  }

  dispose(): void {
    this.worker?.dispose();
    this.worker = undefined;
    this.mainThread.dispose();
  }
}

/** Uses a module Worker when available; rendering stays functional with a main-thread fallback. */
export function createImageEncoder(): ServiceImageEncoder {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return new MainThreadImageEncoder();
  }
  try {
    return new FallbackImageEncoder(new WebWorkerImageEncoder());
  } catch {
    return new MainThreadImageEncoder();
  }
}
