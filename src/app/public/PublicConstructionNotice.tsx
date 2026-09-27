import { useTranslation } from 'react-i18next';

/** Shared visitor notice; PublicLayout renders it when the public site setting is enabled. */
export function PublicConstructionNotice() {
  const { t } = useTranslation();

  return <div className="public-construction-notice" role="status">
    <p>{t('gallery.constructionNotice')}</p>
  </div>;
}
