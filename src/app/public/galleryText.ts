import type { ProtectedGalleryPreview, PublicEvent } from '../../shared/schemas/gallery';

/** Owner galleries without translated copy continue to use their original text. */
export function galleryText(gallery: Pick<PublicEvent | ProtectedGalleryPreview, 'title' | 'description' | 'localizedCopy'>,
  language: string) {
  const selected = language.startsWith('en') ? 'en' : 'fr';
  return gallery.localizedCopy?.[selected] ?? { title: gallery.title, description: gallery.description };
}
