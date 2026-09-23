import type { PublicPhoto } from '../../shared/schemas/gallery';

export const MAX_ZIP_PHOTOS = 100;
export const MAX_ZIP_BYTES = 250_000_000;

type DownloadPhoto = Pick<PublicPhoto, 'downloadUrl' | 'eventId' | 'filename' | 'id' | 'revision'>;
type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options: { id: string; mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
};

export class PhotoDownloadError extends Error {
  constructor(public readonly code: 'access' | 'folder' | 'limit' | 'network' | 'unavailable') {
    super(code);
  }
}

export function supportsSeparatePhotoDownloads(): boolean {
  return typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

export function downloadFilename(photo: DownloadPhoto, contentType: string): string {
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : null;
  if (!extension) throw new PhotoDownloadError('unavailable');
  const base = photo.filename.replace(/\.[^.]+$/u, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[.-]+|[.-]+$/gu, '').slice(0, 90) || 'photo';
  const id = photo.id.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 48);
  return `${base}-${id}.${extension}`;
}

function mediaUrl(photo: DownloadPhoto): string {
  if (!photo.downloadUrl) throw new PhotoDownloadError('unavailable');
  const url = new URL(photo.downloadUrl, window.location.origin);
  const expectedPath = `/media/${encodeURIComponent(photo.eventId)}/${encodeURIComponent(photo.id)}/${photo.revision}/download`;
  if (url.origin !== window.location.origin || url.pathname !== expectedPath || url.search || url.hash) {
    throw new PhotoDownloadError('unavailable');
  }
  return url.pathname;
}

async function fetchPhoto(photo: DownloadPhoto, signal: AbortSignal): Promise<Response> {
  let response: Response;
  const path = mediaUrl(photo);
  try {
    response = await fetch(path, { credentials: 'same-origin', signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new PhotoDownloadError('network');
  }
  if (response.status === 401 || response.status === 403) throw new PhotoDownloadError('access');
  if (!response.ok) throw new PhotoDownloadError('network');
  const type = response.headers.get('Content-Type')?.split(';', 1)[0]?.trim();
  if (type !== 'image/jpeg' && type !== 'image/webp') throw new PhotoDownloadError('unavailable');
  return response;
}

export async function choosePhotoDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new PhotoDownloadError('unavailable');
  try {
    // Starting inside Downloads invited selection of the protected Downloads root.
    // Let the browser restore its last safe choice for this dedicated picker.
    return await picker.call(window, { id: 'cadrora-gallery-downloads', mode: 'readwrite' });
  } catch (error) {
    if (error instanceof DOMException && ['AbortError', 'NotAllowedError', 'SecurityError'].includes(error.name)) {
      throw new PhotoDownloadError('folder');
    }
    throw error;
  }
}

/** Keep repeat saves in the chosen folder without replacing an existing filename. */
async function unusedFilename(directory: FileSystemDirectoryHandle, desired: string): Promise<string> {
  const dot = desired.lastIndexOf('.');
  const stem = desired.slice(0, dot);
  const extension = desired.slice(dot);
  for (let suffix = 0; suffix < 1_000; suffix += 1) {
    const candidate = suffix === 0 ? desired : `${stem}-${suffix + 1}${extension}`;
    try {
      await directory.getFileHandle(candidate, { create: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return candidate;
      if (error instanceof DOMException && error.name === 'TypeMismatchError') continue;
      throw error;
    }
  }
  throw new PhotoDownloadError('folder');
}

/** One authorized Worker/R2 stream per photo, with no photo bodies held by the app. */
export async function savePhotosSeparately(
  photos: DownloadPhoto[],
  directory: FileSystemDirectoryHandle,
  signal: AbortSignal,
  onProgress: (completed: number) => void,
): Promise<void> {
  for (const [index, photo] of photos.entries()) {
    const response = await fetchPhoto(photo, signal);
    if (!response.body) throw new PhotoDownloadError('network');
    let filename: string;
    let writable: FileSystemWritableFileStream;
    try {
      filename = await unusedFilename(directory, downloadFilename(photo, response.headers.get('Content-Type') ?? ''));
      if (signal.aborted) throw new DOMException('Download cancelled', 'AbortError');
      const handle = await directory.getFileHandle(filename, { create: true });
      writable = await handle.createWritable();
    } catch (error) {
      if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) throw new PhotoDownloadError('folder');
      throw error;
    }
    try {
      await response.body.pipeTo(writable, { signal });
    } catch (error) {
      await directory.removeEntry(filename).catch(() => undefined);
      throw error;
    }
    onProgress(index + 1);
  }
}

/** The portable fallback is intentionally bounded because its Blob is built on the visitor device. */
export async function createPhotoZip(
  photos: DownloadPhoto[],
  signal: AbortSignal,
  onProgress: (completed: number) => void,
): Promise<Blob> {
  if (photos.length > MAX_ZIP_PHOTOS) throw new PhotoDownloadError('limit');
  const { BlobReader, BlobWriter, ZipWriter } = await import('@zip.js/zip.js');
  const writer = new ZipWriter(new BlobWriter('application/zip'), { level: 0 });
  let totalBytes = 0;
  for (const [index, photo] of photos.entries()) {
    if (signal.aborted) throw new DOMException('Download cancelled', 'AbortError');
    const response = await fetchPhoto(photo, signal);
    const declaredBytes = Number(response.headers.get('Content-Length'));
    if (Number.isFinite(declaredBytes) && declaredBytes > 0 && totalBytes + declaredBytes > MAX_ZIP_BYTES) {
      await response.body?.cancel();
      throw new PhotoDownloadError('limit');
    }
    const body = await response.blob();
    totalBytes += body.size;
    if (totalBytes > MAX_ZIP_BYTES) throw new PhotoDownloadError('limit');
    await writer.add(downloadFilename(photo, body.type), new BlobReader(body), { level: 0 });
    onProgress(index + 1);
  }
  if (signal.aborted) throw new DOMException('Download cancelled', 'AbortError');
  return writer.close();
}

export function photoZipFilename(slug: string): string {
  const name = slug.replace(/[^a-z0-9-]/gu, '-').slice(0, 80) || 'gallery';
  return `${name}-photos.zip`;
}
