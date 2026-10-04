import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import copy from '../../shared/i18n/publicStartup.json';
import { siteProfile } from './siteProfile';

/** Continue the static branded first frame while a photo-backed page prepares. */
export function SiteStartup({ failed = false }: { failed?: boolean }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  return <section className="site-startup site-startup--overlay">
    <section aria-label={copy[language].loading} className="site-startup__identity">
      <p className="site-startup__brand">{siteProfile.siteName}</p>
      <span aria-hidden="true" className="site-startup__rule" />
      {failed ? <p role="alert">{copy[language].unavailable} <a href={window.location.href}>{copy[language].retry}</a></p> : null}
    </section>
    <details className="site-startup__fallback">
      <summary>{copy[language].navigation}</summary>
      <nav aria-label={copy[language].navigation} className="site-startup__content">
        <Link to={`/${language}/portfolio`}>{t('gallery.portfolio')}</Link>
        <Link to={`/${language}/contact`}>{t('gallery.contact')}</Link>
      </nav>
    </details>
  </section>;
}
