import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Modal } from '../components';
import type { ServiceCard } from '../../shared/schemas/services';
import { localizedMarketingPath } from './localizedMarketingPath';
import { serviceText } from './serviceCatalog';

/** One session-detail experience for Home cards, Home slides, and the full catalog. */
export function SessionDetailsModal({ card, onClose }: { card: ServiceCard | null; onClose: () => void }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const copy = card ? serviceText(card, language, (key) => t(key)) : null;
  return <Modal backdropClassName="modal-backdrop--session-details" className="service-details-modal"
    closeLabel={t('gallery.servicesPage.closeDetails')} onClose={onClose} open={Boolean(copy)} title={copy?.title ?? ''}>
    {copy && card ? <div className="service-details-modal__body">
      <p>{copy.description}</p>
      {copy.duration ? <p><strong>{t('gallery.servicesPage.durationLabel')}</strong> {copy.duration}</p> : null}
      {copy.priceRange ? <p><strong>{t('gallery.servicesPage.priceLabel')}</strong> {copy.priceRange}</p> : null}
      {copy.illustrativeExample ? <p className="service-details-modal__example-note">{t('gallery.servicesPage.exampleNotice')}</p> : null}
      {copy.details ? <p className="service-details-modal__details">{copy.details}</p> : null}
      {copy.points.length ? <><h3>{t('gallery.servicesPage.includedLabel')}</h3>
        <ul>{copy.points.map((point, index) => <li key={index}>{point}</li>)}</ul></> : null}
      <Link className="button button--primary" onClick={onClose}
        to={`${localizedMarketingPath('/contact', language)}?${new URLSearchParams({ session: card.id })}`}>
        {t('gallery.servicesPage.contactAction')}
      </Link>
    </div> : null}
  </Modal>;
}
