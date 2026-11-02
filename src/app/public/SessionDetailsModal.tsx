import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Modal } from '../components';
import type { ServiceCard } from '../../shared/schemas/services';
import { localizedMarketingPath } from './localizedMarketingPath';
import { serviceText } from './serviceCatalog';
import { siteProfile } from './siteProfile';

/** One session-detail experience for Home cards, Home slides, and the full catalog. */
export function SessionDetailsModal({ card, onClose }: { card: ServiceCard | null; onClose: () => void }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const copy = card ? serviceText(card, language, (key) => t(key)) : null;
  const contactPath = (tariff?: number) => `${localizedMarketingPath('/contact', language)}?${new URLSearchParams({
    session: card?.id ?? '', ...(tariff === undefined ? {} : { tariff: String(tariff) }),
  })}`;
  const contactLabel = t(siteProfile.demo.enabled ? 'gallery.sampleContact' : 'gallery.servicesPage.contactAction');
  return <Modal backdropClassName="modal-backdrop--session-details" className="service-details-modal"
    closeLabel={t('gallery.servicesPage.closeDetails')} onClose={onClose} open={Boolean(copy)} title={copy?.title ?? ''}>
    {copy && card ? <div className="service-details-modal__body">
      <div className="service-details-modal__summary">
        <p>{copy.shortDescription}</p>
        {copy.duration || copy.priceRange ? <dl className="service-details-modal__facts">
          {copy.duration ? <div><dt>{t('gallery.servicesPage.durationLabel')}</dt><dd>{copy.duration}</dd></div> : null}
          {copy.priceRange ? <div><dt>{t('gallery.servicesPage.priceLabel')}</dt><dd>{copy.priceRange}</dd></div> : null}
        </dl> : null}
        <Link className="button button--primary" onClick={onClose} to={contactPath()}>{contactLabel}</Link>
      </div>
      {copy.illustrativeExample ? <p className="service-details-modal__example-note">{t('gallery.servicesPage.exampleNotice')}</p> : null}
      {copy.tariffs.length ? <section className="service-details-modal__pricing" aria-label={t('gallery.servicesPage.tariffsLabel')}>
          <h3>{t('gallery.servicesPage.tariffsLabel')}</h3>
          <ul className="service-details-modal__tariffs">
            {copy.tariffs.map((tariff, index) => <li key={index}>
              <h4>{tariff.name}</h4>
              <p className="service-details-modal__price">{tariff.price}</p>
              <p>{tariff.summary}</p>
              <Link aria-label={t('gallery.servicesPage.tariffContactName', { tariff: tariff.name })}
                className="button button--secondary" onClick={onClose} to={contactPath(index)}>
                {t(siteProfile.demo.enabled ? 'gallery.sampleContact' : 'gallery.servicesPage.tariffContact')}
              </Link>
            </li>)}
          </ul>
        </section> : null}
      {copy.goodToKnow ? <section className="service-details-modal__good-to-know" aria-label={t('gallery.servicesPage.goodToKnowLabel')}>
        <h3>{t('gallery.servicesPage.goodToKnowLabel')}</h3>
        <p className="service-details-modal__details">{copy.goodToKnow}</p>
      </section> : null}
      {copy.points.length ? <section><h3>{t('gallery.servicesPage.includedLabel')}</h3>
        <ul>{copy.points.map((point, index) => <li key={index}>{point}</li>)}</ul></section> : null}
      {copy.description !== copy.shortDescription || copy.details ? <details className="service-details-modal__story">
        <summary>{t('gallery.servicesPage.descriptionLabel')}</summary>
        {copy.description !== copy.shortDescription ? <p>{copy.description}</p> : null}
        {copy.details ? <p className="service-details-modal__details">{copy.details}</p> : null}
      </details> : null}
    </div> : null}
  </Modal>;
}
