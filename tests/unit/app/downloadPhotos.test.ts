import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  choosePhotoDirectory,
  createPhotoZip,
  downloadFilename,
  MAX_ZIP_PHOTOS,
  PhotoDownloadError,
  savePhotosSeparately,
} from '../../../src/app/public/downloadPhotos';

const photos = [
  { downloadUrl: '/media/event-1/photo-1/2/download', eventId: 'event-1', filename: 'First picture.png', id: 'photo-1', revision: 2 },
  { downloadUrl: '/media/event-1/photo-2/2/download', eventId: 'event-1', filename: 'Second picture.jpg', id: 'photo-2', revision: 2 },
];

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'https://cadrora.test' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('visitor photo downloads', () => {
  it('does not steer the picker to the protected Downloads root', async () => {
    const directory = {} as FileSystemDirectoryHandle;
    const picker = vi.fn(() => Promise.resolve(directory));
    vi.stubGlobal('window', { location: { origin: 'https://cadrora.test' }, showDirectoryPicker: picker });

    await expect(choosePhotoDirectory()).resolves.toBe(directory);
    expect(picker).toHaveBeenCalledWith({ id: 'cadrora-gallery-downloads', mode: 'readwrite' });
  });

  it('turns a blocked or cancelled folder picker into a visible fallback error', async () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://cadrora.test' },
      showDirectoryPicker: () => Promise.reject(new DOMException('The folder contains system files', 'AbortError')),
    });

    await expect(choosePhotoDirectory()).rejects.toMatchObject({ code: 'folder' });
  });

  it('uses the actual encoded format and safe, unique filenames', () => {
    expect(downloadFilename(photos[0]!, 'image/webp')).toBe('First-picture-photo-1.webp');
    expect(downloadFilename({ ...photos[0]!, filename: '../evil.png' }, 'image/jpeg')).toBe('evil-photo-1.jpg');
    expect(() => downloadFilename(photos[0]!, 'image/svg+xml')).toThrow(PhotoDownloadError);
  });

  it('rejects a cross-origin or non-download media URL before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createPhotoZip([{ ...photos[0]!, downloadUrl: 'https://other.test/media/event-1/photo-1/2/download' }], new AbortController().signal, vi.fn()))
      .rejects.toMatchObject({ code: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a bounded ZIP with correctly named entries from authorized media', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(new Blob(['sample'], { type: 'image/webp' }), { headers: { 'Content-Type': 'image/webp' } })));
    vi.stubGlobal('fetch', fetchMock);
    const progress = vi.fn();

    const blob = await createPhotoZip(photos, new AbortController().signal, progress);
    const reader = new ZipReader(new BlobReader(blob));
    try {
      const entries = await reader.getEntries();
      expect(entries.map((entry) => entry.filename)).toEqual(['First-picture-photo-1.webp', 'Second-picture-photo-2.webp']);
      expect(progress).toHaveBeenLastCalledWith(2);
      expect(fetchMock).toHaveBeenCalledWith('/media/event-1/photo-1/2/download', expect.objectContaining({ credentials: 'same-origin' }));
    } finally {
      await reader.close();
    }
  });

  it('rejects oversized selection without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createPhotoZip(Array.from({ length: MAX_ZIP_PHOTOS + 1 }, () => photos[0]!), new AbortController().signal, vi.fn()))
      .rejects.toMatchObject({ code: 'limit' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a revoked gallery grant to an actionable access error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 403 }))));
    await expect(createPhotoZip(photos, new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: 'access' });
  });

  it('streams separate files into a unique child folder', async () => {
    const written: string[] = [];
    const removeEntry = vi.fn(() => Promise.resolve());
    const child = {
      getFileHandle: vi.fn((name: string) => Promise.resolve({
        createWritable: () => Promise.resolve(new WritableStream<Uint8Array>({ write: (chunk) => { written.push(`${name}:${new TextDecoder().decode(chunk)}`); } })),
      })),
      removeEntry,
    };
    const getDirectoryHandle = vi.fn(() => Promise.resolve(child));
    const directory = { getDirectoryHandle } as unknown as FileSystemDirectoryHandle;
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(new Blob(['sample'], { type: 'image/webp' }), { headers: { 'Content-Type': 'image/webp' } }))));
    const progress = vi.fn();

    await savePhotosSeparately(photos, directory, new AbortController().signal, progress);

    expect(getDirectoryHandle).toHaveBeenCalledWith(expect.stringMatching(/^cadrora-.*-[a-f0-9]{8}$/u), { create: true });
    expect(written).toEqual(['First-picture-photo-1.webp:sample', 'Second-picture-photo-2.webp:sample']);
    expect(removeEntry).not.toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith(2);
  });
});
