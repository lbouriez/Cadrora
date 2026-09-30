import { useTranslation } from 'react-i18next';

import type { ProtectedGalleryPreview, PublicEvent } from '../../shared/schemas/gallery';
import { ProgressivePhoto } from '../components';
import { LockIcon } from '../components/Icons';
import { BrandPhoto } from './BrandPhoto';
import { coverPhotoSources } from './coverPhotoSources';
import { EditorialGalleryCard } from './EditorialGalleryCard';
import { siteProfile } from './siteProfile';
import { galleryText } from './galleryText';

/** Shared live-gallery cards used by the landing and events pages. */
export function PublicEventCards({ events, language, limit, protectedGalleries = [] }: { events: PublicEvent[] | undefined; language: string; limit?: number; protectedGalleries?: ProtectedGalleryPreview[] }) {
  const { t } = useTranslation();
  const cards = [
    ...(events ?? []).map((event) => ({ kind: 'public' as const, event, startsAt: event.startsAt, id: event.id })),
    ...protectedGalleries.map((gallery) => ({ kind: 'protected' as const, gallery, startsAt: gallery.startsAt, id: gallery.id })),
  ].sort((left, right) => right.startsAt.localeCompare(left.startsAt) || left.id.localeCompare(right.id));
  const visibleCards = limit === undefined ? cards : cards.slice(0, limit);
  return (
    <div className="event-list">
      {visibleCards.map((card, index) => {
        const gallery = card.kind === 'public' ? card.event : card.gallery;
        const copy = galleryText(gallery, language);
        return <EditorialGalleryCard cover={card.kind === 'protected'
          ? <><BrandPhoto alt="" immediate={index < 2} priority={index === 0} sizes="(min-width: 75rem) 36rem, (min-width: 48rem) 50vw, 100vw" src={siteProfile.privateGalleryCoverUrl} /><span aria-hidden="true" className="event-card__lock"><LockIcon /></span></>
                : card.event.coverPhotoUrl ? <ProgressivePhoto alt="" height={3} immediate={index < 2} priority={index === 0} sizes="(min-width: 75rem) 36rem, (min-width: 48rem) 50vw, 100vw" sources={coverPhotoSources(card.event.coverPhotoUrl)} width={4} /> : <span aria-hidden="true" className="event-card__placeholder" />}
          description={copy.description} eyebrow={gallery.service ? t(`gallery.category.${gallery.service}`) : null}
          href={`/e/${card.kind === 'public' ? gallery.slug : gallery.id}`} index={index} key={gallery.id}
          locked={card.kind === 'protected'} meta={new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(gallery.startsAt))}
          title={copy.title} />;
      })}
    </div>
  );
}
