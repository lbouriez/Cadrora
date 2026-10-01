import { useTranslation } from 'react-i18next';

import { MotionReveal } from '../components';
import type { ServiceCard } from '../../shared/schemas';
import { ServicePhoto } from './ServicePhoto';
import { serviceText } from './serviceCatalog';

/** The live session slide and admin phone preview share the photo and text layout. */
export function SessionStoryContent({ card, heading = 'h2', immediate = false, onVisualReady, onExplore, priority = false, preview = false, introduction = false }: {
  card: ServiceCard; heading?: 'h1' | 'h2'; immediate?: boolean; onVisualReady?: (() => void) | undefined;
  priority?: boolean; preview?: boolean; introduction?: boolean;
  onExplore?: (id: string) => void;
}) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const copy = serviceText(card, language, (key) => t(key));
  const Heading = heading;
  const Content = preview ? 'div' : MotionReveal;
  return <>
    <div className="session-story__visual" {...(preview ? {} : { 'data-swiper-parallax-scale': '1.1' })}>
      <ServicePhoto card={card} className="session-story__photo" immediate={immediate}
        onVisualReady={onVisualReady} priority={priority} sizes={preview ? '320px' : '100vw'} {...(preview ? { framing: 'mobile' as const } : {})} />
    </div>
    <div className="session-story__shade" />
    <div className="session-story__copy" {...(preview ? {} : { 'data-swiper-parallax': '-200' })}>
      <Content className="session-story__content">
        <Heading>{copy.title}</Heading>
        {copy.shortDescription ? <p className="session-story__subtitle">{copy.shortDescription}</p> : null}
        {introduction && !preview ? <p className="session-story__introduction">{t('gallery.heroLead')}</p> : null}
        {preview ? <span className="session-story__cta">{t('gallery.servicesPage.moreInfo')}</span>
          : <button aria-haspopup="dialog" className="session-story__cta" onClick={() => onExplore?.(card.id)} type="button">{t('gallery.servicesPage.moreInfo')}</button>}
      </Content>
    </div>
  </>;
}
