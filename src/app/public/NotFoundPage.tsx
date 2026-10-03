import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import { PublicPageIntro } from './PublicPageIntro';
import { localizedMarketingPath } from './localizedMarketingPath';

export function NotFoundPage() {
  const { i18n, t } = useTranslation();
  return <PublicLayout noIndex pageTitle={t('gallery.pageNotFound')}>
    <PublicPageIntro eyebrow="404" title={t('gallery.pageNotFound')} lead={t('gallery.pageNotFoundLead')} />
    <Link className="button button--primary" to={localizedMarketingPath('/', i18n.language)}>{t('gallery.home')}</Link>
  </PublicLayout>;
}
