import { encodePhoto } from './encoder';

interface EncodeRequest {
  file: File;
  id: string;
  type: 'encode';
}

interface EncodeSuccess {
  id: string;
  photo: Awaited<ReturnType<typeof encodePhoto>>;
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
  return candidate.type === 'encode' && typeof candidate.id === 'string' && candidate.file instanceof File;
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isEncodeRequest(event.data)) return;
  void encode(event.data);
});

async function encode(request: EncodeRequest): Promise<void> {
  try {
    const response: EncodeSuccess = { id: request.id, photo: await encodePhoto(request.file), type: 'success' };
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
