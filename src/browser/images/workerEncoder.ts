import { encodePhoto } from './encoder';
import type { EncodedPhoto } from './types';
import { ImageProcessingError } from './types';

export interface ImageEncoder {
  encode(file: File): Promise<EncodedPhoto>;
  dispose(): void;
}

interface WorkerSuccess {
  id: string;
  photo: EncodedPhoto;
  type: 'success';
}

interface WorkerFailure {
  code: string;
  id: string;
  message: string;
  type: 'failure';
}

type WorkerResponse = WorkerSuccess | WorkerFailure;

class MainThreadImageEncoder implements ImageEncoder {
  async encode(file: File): Promise<EncodedPhoto> {
    return encodePhoto(file);
  }

  dispose(): void {}
}

class WebWorkerImageEncoder implements ImageEncoder {
  private readonly pending = new Map<string, { reject: (reason: Error) => void; resolve: (photo: EncodedPhoto) => void }>();
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
      this.worker.postMessage({ file, id, type: 'encode' });
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.failPending(new Error('Image worker was disposed.'));
  }

  private onMessage(response: WorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.type === 'success') {
      pending.resolve(response.photo);
      return;
    }
    const code = response.code === 'CORRUPT_IMAGE' || response.code === 'UNSUPPORTED_IMAGE' ? response.code : 'ENCODE_FAILED';
    pending.reject(new ImageProcessingError(code, response.message));
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

class FallbackImageEncoder implements ImageEncoder {
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

  dispose(): void {
    this.worker?.dispose();
    this.worker = undefined;
    this.mainThread.dispose();
  }
}

/** Uses a module Worker when available; rendering stays functional with a main-thread fallback. */
export function createImageEncoder(): ImageEncoder {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return new MainThreadImageEncoder();
  }
  try {
    return new FallbackImageEncoder(new WebWorkerImageEncoder());
  } catch {
    return new MainThreadImageEncoder();
  }
}
