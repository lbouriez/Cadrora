import type { ValidatedImageFile } from '../images';

export async function sourceSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function originalVariant(
  file: File,
  photo: Pick<ValidatedImageFile, 'contentType' | 'height' | 'width'> & { orientation?: ValidatedImageFile['orientation'] },
) {
  // The declaration describes displayed dimensions; source bytes retain camera orientation.
  const swapsDimensions = (photo.orientation ?? 1) >= 5;
  return {
    blob: file,
    byteSize: file.size,
    checksumSha256: await sourceSha256(file),
    contentType: photo.contentType,
    height: swapsDimensions ? photo.width : photo.height,
    name: 'original' as const,
    width: swapsDimensions ? photo.height : photo.width,
  };
}
